import { beforeAll, expect, mock, test } from "bun:test";

process.env.VITE_APP_MODE = "overseas";

const cache = new Map<string, string>();
const localForageStorage = {
    getItem: async (key: string) => cache.get(key) || null,
    setItem: async (key: string, value: string) => { cache.set(key, value); },
    removeItem: async (key: string) => { cache.delete(key); },
};
mock.module("@/lib/localforage-storage", () => ({ localForageStorage }));
mock.module("@/i18n", () => ({ default: { t: (key: string) => key } }));
mock.module("@/services/image-storage", () => ({ getImageBlob: async () => new Blob(["fixture"], { type: "image/png" }), imageToDataUrl: async () => "data:image/png;base64,AA==" }));
mock.module("@/services/file-storage", () => ({ getMediaBlob: async () => null, resolveMediaUrl: async (_key: string, url: string) => url, uploadMediaFile: async (url: string) => ({ url, storageKey: "video:fixture", mimeType: "video/mp4", bytes: 1 }) }));

const { create } = await import("zustand");
const assetStore = Object.assign(create<any>((set) => ({ assets: [], addAsset: (asset: any) => set((state: any) => ({ assets: [...state.assets, { ...asset, id: crypto.randomUUID() }] })) })), { persist: { rehydrate: async () => {} } });
mock.module("@/stores/use-asset-store", () => ({ useAssetStore: assetStore }));
const preferences = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (key: string) => preferences.get(key) || null, setItem: (key: string, value: string) => preferences.set(key, value), removeItem: (key: string) => preferences.delete(key) } });
Object.assign(globalThis, { window: { localStorage: globalThis.localStorage, location: { origin: "http://localhost:3200" }, addEventListener() {} } });
let account = "account-a";
let conflict = false;
let libraryConflict = false;
let libraryUnavailable = true;
let videoChecks = 0;
let videoPending = 0;
let videoQueryError = false;
let videoFailed = false;
const libraryItems = new Map<string, any>();
const promptItems = new Map<string, any>();
const requests: { path: string; method: string; body: any; account: string | null }[] = [];
const native = { schemaVersion: 1, id: "native-1", title: "Fixture", createdAt: "a", updatedAt: "a", nodes: [{ id: "group", type: "group", position: { x: 8, y: 9 }, width: 500, height: 300, metadata: { custom: { untouched: true } } }, { id: "video", type: "video", position: { x: 10, y: 30 }, width: 280, height: 220, metadata: {} }], connections: [], chatSessions: [], activeChatId: null, backgroundMode: "lines", showImageInfo: false, viewport: { x: 1, y: 2, k: 0.7 } };
let revision = 2;
globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    requests.push({ path, method: init?.method || "GET", body, account: new Headers(init?.headers).get("X-Canvas-Account") });
    if (path.endsWith("/bootstrap")) return Response.json({ user: { id: account }, models: [{ id: "platform-video", name: "Platform video", price: 1, billingUnit: "request", durations: [5], defaultDuration: 5, ratios: [{ value: "16:9", label: "16:9", size: "1280x720" }] }], currency: "USD", pointsPerUsd: 100, quota: { points: 12 }, capabilities: { video: true } });
    if (path.includes("/library") || path.includes("/prompts")) {
        const library = path.includes("/library");
        if (library && libraryUnavailable) return Response.json({ error: "Collection offline" }, { status: 503 });
        const records = library ? libraryItems : promptItems;
        const base = library ? "/api/canvas/library" : "/api/canvas/prompts";
        if (!init?.method || init.method === "GET") return Response.json(library ? { items: [...records.values()] } : { prompts: [...records.values()] });
        if (library && libraryConflict) return Response.json({ error: "Collection conflict" }, { status: 409 });
        const id = path === base ? `cloud-${body.document.id}` : decodeURIComponent(path.slice(base.length + 1));
        const current = records.get(id);
        if (current && body.revision !== current.revision) return Response.json({ error: "Revision conflict" }, { status: 409 });
        if (init.method === "DELETE") { records.delete(id); return Response.json({ ok: true }); }
        const item = { id, revision: (current?.revision || 0) + 1, document: body.document };
        records.set(id, item);
        return Response.json(item);
    }
    if (path.endsWith("/assets")) return Response.json(init?.method === "POST" ? { id: "asset-1", name: "fixture.png", url: "/api/canvas/assets/asset-1/content", mime: "image/png", bytes: 7 } : { assets: [] });
    if (path.includes("/video/tasks/")) {
        videoChecks += 1;
        if (videoQueryError) return Response.json({ error: "Temporary query failure" }, { status: 503 });
        return Response.json({ task: { id: "long-task", status: videoFailed ? "failed" : videoChecks <= videoPending ? "pending" : "completed", error: "Provider rejected task", videoUrl: "/api/tasks/long-task/video" } });
    }
    if (path.endsWith("/tasks")) return Response.json({ tasks: [
        { id: "new-task", nodeId: "video", status: "completed", createdAt: "2026-10-02", videoUrl: "/api/tasks/new-task/video" },
        { id: "old-task", nodeId: "video", status: "failed", createdAt: "2026-10-01" },
    ] });
    if (path.endsWith("/generate")) return Response.json({ task: { id: "stable-task", nodeId: body.nodeId, status: "pending" }, revision });
    if (init?.method === "PUT") return conflict ? Response.json({ error: "Revision conflict" }, { status: 409 }) : Response.json({ id: "cloud-1", revision: ++revision, document: body.document });
    return Response.json({ projects: [{ id: "cloud-1", revision, document: structuredClone(native) }] });
}) as typeof fetch;
const api = await import("@/services/api/workbench");
await api.bootstrapWorkbench();
const configModule = await import("@/stores/use-config-store");
const projects = await import("@/services/workbench/projects");
const { useCanvasStore } = await import("@/stores/canvas/use-canvas-store");
const { useWorkbenchStore } = await import("@/stores/use-workbench-store");

beforeAll(async () => { await api.bootstrapWorkbench(); await projects.initializeCloudProjects(); });

test("collection initialization failure and malformed recovery never overwrite preserved bytes", async () => {
    const library = await import("@/services/workbench/library");
    expect(useWorkbenchStore.getState().libraryError).toBe("Collection offline");
    expect(requests.filter((r) => r.path.includes("/library") && r.method !== "GET")).toHaveLength(0);
    cache.set("workbench:library-recovery:v1", "broken snapshot");
    await expect(library.retryCloudLibrary()).rejects.toThrow();
    expect(cache.get("workbench:library-recovery:v1")).toBe("broken snapshot");
    cache.set("workbench:library-recovery:v1", "[]");
    cache.set("workbench:library-recovery:previous:v1", "[ ]");
    libraryUnavailable = false;
    await library.retryCloudLibrary();
    expect(useWorkbenchStore.getState().libraryRecovery).toEqual([]);
    expect(cache.get("workbench:library-recovery:previous:v1")).toBe("[ ]");
    await expect(library.saveCloudLibrary()).rejects.toThrow("resolve the previous");
    expect(cache.get("workbench:library-recovery:v1")).toBe("[]");
    await library.resolveLibraryRecovery(false);
    expect(useWorkbenchStore.getState().libraryRecovery).toBe(null);
});

test("new account defaults to platform video and platform creation keeps the request key", async () => {
    const { config } = configModule.useConfigStore.getState();
    expect(config.videoModel).toBe(configModule.encodeChannelModel("workbench", "platform-video"));
    const { createVideoGenerationTask } = await import("@/services/api/video");
    const task = await createVideoGenerationTask({ ...config, model: config.videoModel, size: "16:9", videoSeconds: "5" }, "Fixture", [], { requestKey: "standalone-stable" });
    expect(task.provider).toBe("workbench");
    const request = requests.find((item) => item.path === "/api/canvas/video/generate")!;
    expect(request.body.requestKey).toBe("standalone-stable");
    expect(request.body.input.model).toBe("platform-video");
});

test("cloud load keeps native structure and resumes the newest task regardless of response order", () => {
    const project = useCanvasStore.getState().projects[0];
    expect(project.id).toBe("native-1");
    expect(project.nodes[0]).toEqual(native.nodes[0]);
    expect(project.viewport).toEqual(native.viewport);
    expect(project.nodes[1].metadata?.videoTaskId).toBe("new-task");
    expect(project.nodes[1].metadata?.content).toBe("/api/tasks/new-task/video");
    expect(requests.filter((r) => r.method === "PUT")).toHaveLength(0);
    expect(requests.some((r) => r.path === "/api/canvas/library")).toBe(true);
    expect(useWorkbenchStore.getState().libraryError).toBe("");
});

test("saving uploads local media and uses cloud envelope ID, native fields and account header", async () => {
    const state = useCanvasStore.getState();
    state.updateProject("native-1", { nodes: [...state.projects[0].nodes, { id: "image", type: "image", position: { x: 1, y: 1 }, width: 80, height: 40, metadata: { storageKey: "image:local", content: "blob:fixture" } }] });
    await projects.saveCloudProjects();
    const saved = requests.filter((r) => r.method === "PUT").at(-1)!;
    expect(saved.path).toBe("/api/canvas/projects/cloud-1");
    expect(saved.account).toBe("account-a");
    expect(saved.body.document.nodes[0]).toEqual(native.nodes[0]);
    expect(saved.body.document.nodes[2].metadata).toEqual({ storageKey: "image:workbench:asset-1", content: "/api/canvas/assets/asset-1/content" });
    expect(JSON.stringify(saved.body)).not.toContain("blob:");
});

test("generation retains the caller's stable request key and server project ID", async () => {
    const input = { prompt: "Fixture", model: "test", duration: 5, ratio: "16:9" };
    const key = "stable-fixture-request-key";
    const first = await projects.createWorkbenchVideo("native-1", "video", key, input);
    const second = await projects.createWorkbenchVideo("native-1", "video", key, input);
    expect(first.id).toBe(second.id);
    expect(first.projectId).toBe("cloud-1");
    expect(requests.filter((r) => r.path.includes("/projects/") && r.path.endsWith("/generate")).map((r) => r.body.requestKey)).toEqual([key, key]);
});

test("revision conflict pauses cloud writes while retaining recovery data", async () => {
    conflict = true;
    useCanvasStore.getState().renameProject("native-1", "Unsaved change");
    await expect(projects.saveCloudProjects()).rejects.toThrow("Revision conflict");
    const writes = requests.filter((r) => r.method === "PUT").length;
    useCanvasStore.getState().renameProject("native-1", "Further local change");
    await expect(projects.saveCloudProjects()).rejects.toThrow("Revision conflict");
    expect(requests.filter((r) => r.method === "PUT")).toHaveLength(writes);
    expect(useWorkbenchStore.getState().error).toBe("Revision conflict");
    expect(cache.get("workbench:canvas-recovery:v1")).toContain("Further local change");
    conflict = false;
    await projects.retryCloudSave();
    expect(useWorkbenchStore.getState().error).toBe("");
});

test("bootstrap preserves custom channel keys and selected models in account preferences", async () => {
    const { initializeWorkbenchConfig } = await import("@/services/workbench/config");
    const { useConfigStore, encodeChannelModel, isWorkbenchModel } = configModule;
    const custom = { id: "custom", name: "Fixture", baseUrl: "https://provider.invalid/v1", apiKey: "fixture-not-a-secret", apiFormat: "openai" as const, models: [{ name: "custom-video", capability: "video" as const }] };
    const selected = encodeChannelModel(custom.id, "custom-video");
    useConfigStore.setState({ config: { ...useConfigStore.getState().config, channels: [custom], videoModel: selected } });
    await initializeWorkbenchConfig();
    await initializeWorkbenchConfig();
    expect(useConfigStore.getState().config.channels.find((c) => c.id === "custom")).toEqual(custom);
    expect(useConfigStore.getState().config.videoModel).toBe(selected);
    useConfigStore.setState({ config: { ...useConfigStore.getState().config, videoModel: "removed::model" } });
    await initializeWorkbenchConfig();
    expect(useConfigStore.getState().config.videoModel).toBe("removed::model");
    useConfigStore.setState({ config: { ...useConfigStore.getState().config, videoModel: selected } });
    expect(isWorkbenchModel(useConfigStore.getState().config, selected)).toBe(false);
    expect([...preferences.keys()]).toContain("infinite-canvas:workbench:account-a:preferences");
    expect(JSON.stringify(requests)).not.toContain("fixture-not-a-secret");
});

test("personal prompts create, refresh, update and delete with revision", async () => {
    const service = await import("@/services/api/personal-prompts");
    const document = { id: "prompt-fixture", title: "Title", prompt: "Content", tags: [" test ", ""], referenceImageUrls: [" "], category: "Test" } as any;
    const created = await service.savePersonalPrompt(document);
    expect((await service.fetchPersonalPrompts())[0].prompt).toBe("Content");
    const updated = await service.savePersonalPrompt({ ...created, prompt: "Changed" }, created);
    expect(updated.cloudRevision).toBe(2);
    expect(updated.tags).toEqual(["test"]);
    expect(updated.referenceImageUrls).toEqual([]);
    await expect(service.savePersonalPrompt(created, created)).rejects.toThrow("Revision conflict");
    await service.deletePersonalPrompt(updated);
    expect(await service.fetchPersonalPrompts()).toEqual([]);
});

test("collection CRUD uses cloud envelope IDs; failure preserves edits and previous recovery", async () => {
    const library = await import("@/services/workbench/library");
    const asset = { id: "text-fixture", kind: "text", title: "Collection", data: { content: "One" }, tags: [], coverUrl: "", createdAt: "a", updatedAt: "a" };
    assetStore.setState({ assets: [asset] });
    await library.saveCloudLibrary();
    expect(libraryItems.get("cloud-text-fixture").document.data.content).toBe("One");
    assetStore.setState({ assets: [{ ...asset, title: "Changed" }] });
    await library.saveCloudLibrary();
    expect(libraryItems.get("cloud-text-fixture").revision).toBe(2);
    libraryConflict = true;
    assetStore.setState({ assets: [{ ...asset, title: "Unsaved" }] });
    await expect(library.saveCloudLibrary()).rejects.toThrow("Collection conflict");
    expect(cache.get("workbench:library-recovery:v1")).toContain("Unsaved");
    const previous = JSON.stringify([asset]);
    cache.set("workbench:library-recovery:previous:v1", previous);
    useWorkbenchStore.setState({ libraryRecovery: [asset] as any });
    assetStore.setState({ assets: [] });
    await expect(library.saveCloudLibrary()).rejects.toThrow("resolve the previous");
    expect(cache.get("workbench:library-recovery:previous:v1")).toBe(previous);
    expect(cache.get("workbench:library-recovery:v1")).toContain("Unsaved");
    libraryConflict = false;
    await library.resolveLibraryRecovery(true);
    expect(libraryItems.size).toBe(1);
    expect([...libraryItems.values()][0].document.id).not.toBe(asset.id);
    assetStore.setState({ assets: [] });
    await library.saveCloudLibrary();
    expect(libraryItems.size).toBe(0);
    expect(cache.has("workbench:library-recovery:previous:v1")).toBe(false);
});

test("custom video creation and polling use the provider, and external output uses original storage", async () => {
    const axios = (await import("axios")).default;
    const original = axios.defaults.adapter;
    const providerCalls: string[] = [];
    axios.defaults.adapter = async (config) => {
        providerCalls.push(config.url || "");
        return { data: { id: "custom-task", status: "pending" }, status: 200, statusText: "OK", headers: {}, config };
    };
    try {
        const video = await import("@/services/api/video");
        const config = configModule.useConfigStore.getState().config;
        const providerConfig = { ...config, model: config.videoModel };
        const before = requests.length;
        const task = await video.createVideoGenerationTask(providerConfig, "Fixture");
        expect(task.provider).toBe("openai");
        expect(await video.pollVideoGenerationTask(providerConfig, task)).toEqual({ status: "pending" });
        expect(providerCalls).toEqual(["https://provider.invalid/v1/videos", "https://provider.invalid/v1/videos/custom-task"]);
        expect(requests.length).toBe(before);
        expect((await video.storeGeneratedVideo({ url: "https://media.invalid/fixture.mp4" })).storageKey).toBe("video:fixture");
    } finally { axios.defaults.adapter = original; }
});

test("platform polling exceeds five minutes and resumes the same task without creating a generation", async () => {
    const { pollVideoTaskWindow, canResumePlatformVideo } = await import("@/pages/video/poll-video-task");
    const originalTimer = globalThis.setTimeout;
    const waits: number[] = [];
    globalThis.setTimeout = ((callback: () => void, ms: number) => { waits.push(ms); queueMicrotask(callback); return 0; }) as any;
    const task = { id: "long-task", provider: "workbench" as const, model: "platform-video" };
    const config = configModule.useConfigStore.getState().config;
    const creates = () => requests.filter((r) => r.path.endsWith("/generate")).length;
    const before = creates();
    try {
        videoChecks = 0; videoPending = 301;
        const result = await pollVideoTaskWindow(config, task, new AbortController().signal);
        expect(result.status).toBe("completed");
        expect(videoChecks).toBe(302);
        expect(waits).toHaveLength(301);
        expect(waits.every((ms) => ms === 2500)).toBe(true);
        expect(canResumePlatformVideo({ status: "failed", task })).toBe(true);
        expect(canResumePlatformVideo({ status: "failed", terminal: true, task })).toBe(false);
        videoQueryError = true;
        expect((await pollVideoTaskWindow(config, task, new AbortController().signal)).status).toBe("paused");
        videoQueryError = false; videoPending = 0;
        expect((await pollVideoTaskWindow(config, task, new AbortController().signal)).status).toBe("completed");
        videoFailed = true;
        expect((await pollVideoTaskWindow(config, task, new AbortController().signal)).status).toBe("failed");
        videoFailed = false;
        const controller = new AbortController();
        controller.abort();
        const checks = videoChecks;
        await expect(pollVideoTaskWindow(config, task, controller.signal)).rejects.toThrow();
        expect(videoChecks).toBe(checks);
        expect(creates()).toBe(before);
    } finally { globalThis.setTimeout = originalTimer; videoFailed = false; videoQueryError = false; }
});

test("account change is rejected and media rejects external URLs", async () => {
    expect(api.accountDatabaseName()).toBe("infinite-canvas:workbench:account-a");
    expect(() => projects.ownedAssetUrl("https://external.test/private.mp4")).toThrow();
    account = "account-b";
    await expect(api.bootstrapWorkbench()).rejects.toThrow("Your account changed");
    expect(api.workbenchSession().user.id).toBe("account-a");
});

test("ali-image uses URL output and rejects unsupported count and editing before sending", async () => {
    const axios = (await import("axios")).default;
    const original = axios.defaults.adapter;
    const calls: Record<string, unknown>[] = [];
    axios.defaults.adapter = async (config) => {
        calls.push(JSON.parse(config.data));
        return { data: { data: [{ url: "https://media.invalid/image.png" }] }, status: 200, statusText: "OK", headers: {}, config };
    };
    try {
        const { requestGeneration, requestEdit } = await import("@/services/api/image");
        const channel = configModule.createModelChannel({ id: "ali-fixture", baseUrl: "https://provider.invalid/v1", apiKey: "fixture", models: ["ali-image"] });
        const config = { ...configModule.useConfigStore.getState().config, channels: [channel], model: configModule.encodeChannelModel(channel.id, "ali-image"), count: "1", size: "1024x1024" };
        expect((await requestGeneration(config, "Fixture"))[0].dataUrl).toBe("https://media.invalid/image.png");
        expect(calls[0]).toMatchObject({ model: "ali-image", n: 1, response_format: "url" });
        await requestGeneration({ ...config, count: "6" }, "Fixture");
        expect(calls[1].n).toBe(6);
        await expect(requestGeneration({ ...config, count: "7" }, "Fixture")).rejects.toThrow("apiErrors.aliImageCount");
        await expect(requestEdit(config, "Fixture", [])).rejects.toThrow("apiErrors.aliImageTextOnly");
        expect(calls).toHaveLength(2);
        await requestGeneration({ ...config, model: configModule.encodeChannelModel(channel.id, "other-image") }, "Fixture");
        expect(calls[2].response_format).toBe("b64_json");
    } finally { axios.defaults.adapter = original; }
});
