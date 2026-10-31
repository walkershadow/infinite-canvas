import { expect, mock, test } from "bun:test";

const original = (id: string) => ({ id, kind: "video", coverUrl: "", data: { url: `/${id}.mp4` }, note: "preserved" });
let assets: any[] = [original("stalled"), original("next")];
mock.module("@/stores/use-asset-store", () => ({ useAssetStore: { getState: () => ({ assets, updateAsset: (id: string, patch: any) => { assets = assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset); } }) } }));
mock.module("@/constant/integration", () => ({ isOverseas: true }));
mock.module("@/services/api/workbench", () => ({ accountDatabaseName: () => "test" }));
mock.module("@/stores/use-config-store", () => ({ withLocalProxy: (url: string) => url }));
mock.module("localforage", () => ({ default: { createInstance: () => ({ getItem: async () => null }) } }));
mock.module("@/services/workbench/projects", () => ({ cloudMediaUrl: () => "/owned-video" }));
let fetchAborted = false;
globalThis.fetch = ((_url: unknown, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener("abort", () => { fetchAborted = true; reject(options.signal?.reason); }, { once: true });
})) as typeof fetch;
mock.module("@/services/image-storage", () => ({ uploadImage: async () => ({ url: "blob:cover", storageKey: "image:cover" }) }));
mock.module("@/lib/image-thumbnail", () => ({ createImageThumbnail: async () => undefined }));

const videos: FakeVideo[] = [];
class FakeVideo extends EventTarget {
    src = "";
    duration = 2;
    readyState = 2;
    videoWidth = 640;
    videoHeight = 360;
    released = false;
    listeners = new Set<unknown>();
    load() { if (this.src === "/next.mp4") queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata"))); }
    removeAttribute() { this.src = ""; this.released = true; }
    override addEventListener(type: string, listener: any, options?: any) { this.listeners.add(listener); super.addEventListener(type, listener, options); }
    override removeEventListener(type: string, listener: any, options?: any) { this.listeners.delete(listener); super.removeEventListener(type, listener, options); }
}
let encode: ((result: Blob) => void) | undefined;
let stallEncoding = false;
Object.assign(globalThis, {
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    document: { createElement: (tag: string) => {
        if (tag === "video") { const video = new FakeVideo(); videos.push(video); return video; }
        return { getContext: () => ({ drawImage() {} }), toBlob: (callback: (result: Blob) => void) => { if (stallEncoding) encode = callback; else callback(new Blob(["frame"])); } };
    } },
});
const { ensureAssetVideoCover } = await import("@/services/asset-video-cover");
const { captureVideoFrame } = await import("@/lib/canvas/canvas-video-frame");

test("30-second cover timeout releases a stalled video and advances the queue without changing original media", async () => {
    const originalTimer = globalThis.setTimeout;
    const originalClear = globalThis.clearTimeout;
    const timers: { callback: () => void; delay: number; cleared?: boolean }[] = [];
    globalThis.setTimeout = ((callback: () => void, delay: number) => { const timer = { callback, delay }; timers.push(timer); return timer; }) as any;
    globalThis.clearTimeout = ((timer: any) => { timer.cleared = true; }) as any;
    try {
        const first = ensureAssetVideoCover("stalled").catch((error) => error);
        const second = ensureAssetVideoCover("next");
        await new Promise((resolve) => originalTimer(resolve, 0));
        expect(timers.map((timer) => timer.delay)).toEqual([30_000]);
        timers[0].callback();
        expect((await first).message).toContain("30 seconds");
        await second;
        expect(videos.every((video) => video.released && video.listeners.size === 0)).toBe(true);
        expect(timers.length).toBe(2);
        expect(timers.every((timer) => timer.cleared && timer.delay === 30_000)).toBe(true);
        expect(assets[0]).toEqual(original("stalled"));
        expect(assets[1].data).toEqual(original("next").data);
        expect(assets[1].videoCover.storageKey).toBe("image:cover");
        await captureVideoFrame("/next.mp4", "first", 0);
        expect(timers.length).toBe(2); // Manual frame capture acquires no timeout.
    } finally { globalThis.setTimeout = originalTimer; globalThis.clearTimeout = originalClear; }
});

test("cancelling while encoding a frame releases video and ignores a late result", async () => {
    stallEncoding = true;
    const controller = new AbortController();
    const pending = captureVideoFrame("/next.mp4", "first", 0, controller.signal).catch((error) => error);
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort(new Error("Cover timeout"));
    expect((await pending).message).toBe("Cover timeout");
    expect(videos.at(-1)?.released).toBe(true);
    encode?.(new Blob(["late frame"]));
    stallEncoding = false;
});


test("cloud source download shares the 30-second deadline and is aborted before the queue continues", async () => {
    assets = [{ ...original("download"), data: { url: "/owned-video", storageKey: "video:workbench:owned" } }, original("next")];
    const originalTimer = globalThis.setTimeout;
    const timers: { callback: () => void; delay: number }[] = [];
    const originalClear = globalThis.clearTimeout;
    globalThis.setTimeout = ((callback: () => void, delay: number) => { timers.push({ callback, delay }); return 0; }) as any;
    globalThis.clearTimeout = (() => {}) as any;
    const before = videos.length;
    try {
        const first = ensureAssetVideoCover("download").catch((error) => error);
        const second = ensureAssetVideoCover("next");
        await new Promise((resolve) => originalTimer(resolve, 0));
        expect(timers[0].delay).toBe(30_000);
        expect(videos.length).toBe(before);
        timers[0].callback();
        expect((await first).message).toContain("30 seconds");
        await second;
        expect(fetchAborted).toBe(true);
        expect(assets[0].data.storageKey).toBe("video:workbench:owned");
        expect(assets[0].videoCover).toBeUndefined();
        expect(assets[1].videoCover.storageKey).toBe("image:cover");
    } finally { globalThis.setTimeout = originalTimer; globalThis.clearTimeout = originalClear; }
});

test("cold-device media display returns its authenticated URL without downloading the full video", async () => {
    const { resolveMediaUrl } = await import("@/services/file-storage");
    expect(await resolveMediaUrl("video:workbench:remote", "blob:expired-on-another-device")).toBe("/owned-video");
});
