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
mock.module("@/services/image-storage", () => ({ getImageBlob: async () => new Blob(["fixture"], { type: "image/png" }) }));
mock.module("@/services/file-storage", () => ({ getMediaBlob: async () => null }));
mock.module("@/stores/use-config-store", () => ({ useConfigStore: { setState() {} }, defaultConfig: {}, encodeChannelModel: (channel: string, model: string) => `${channel}::${model}` }));
mock.module("@/stores/use-asset-store", () => ({ useAssetStore: { persist: { rehydrate: async () => {} }, getState: () => ({ assets: [], replaceAssets() {} }) } }));
Object.assign(globalThis, { window: { location: { origin: "http://localhost:3200" }, addEventListener() {} } });
let account = "account-a";
let conflict = false;
const requests: { path: string; method: string; body: any; account: string | null }[] = [];
const native = { schemaVersion: 1, id: "native-1", title: "Fixture", createdAt: "a", updatedAt: "a", nodes: [{ id: "group", type: "group", position: { x: 8, y: 9 }, width: 500, height: 300, metadata: { custom: { untouched: true } } }, { id: "video", type: "video", position: { x: 10, y: 30 }, width: 280, height: 220, metadata: {} }], connections: [], chatSessions: [], activeChatId: null, backgroundMode: "lines", showImageInfo: false, viewport: { x: 1, y: 2, k: 0.7 } };
let revision = 2;
globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    requests.push({ path, method: init?.method || "GET", body, account: new Headers(init?.headers).get("X-Canvas-Account") });
    if (path.endsWith("/bootstrap")) return Response.json({ user: { id: account }, models: [], quota: { points: 12 }, capabilities: { video: true } });
    if (path.endsWith("/assets")) return Response.json(init?.method === "POST" ? { id: "asset-1", name: "fixture.png", url: "/api/canvas/assets/asset-1/content", mime: "image/png", bytes: 7 } : { assets: [] });
    if (path.endsWith("/tasks")) return Response.json({ tasks: [
        { id: "new-task", nodeId: "video", status: "completed", createdAt: "2026-10-02", videoUrl: "/api/tasks/new-task/video" },
        { id: "old-task", nodeId: "video", status: "failed", createdAt: "2026-10-01" },
    ] });
    if (path.endsWith("/generate")) return Response.json({ task: { id: "stable-task", nodeId: body.nodeId, status: "pending" }, revision });
    if (init?.method === "PUT") return conflict ? Response.json({ error: "Revision conflict" }, { status: 409 }) : Response.json({ id: "cloud-1", revision: ++revision, document: body.document });
    return Response.json({ projects: [{ id: "cloud-1", revision, document: structuredClone(native) }] });
}) as typeof fetch;
const api = await import("@/services/api/workbench");
const projects = await import("@/services/workbench/projects");
const { useCanvasStore } = await import("@/stores/canvas/use-canvas-store");
const { useWorkbenchStore } = await import("@/stores/use-workbench-store");

beforeAll(async () => { await api.bootstrapWorkbench(); await projects.initializeCloudProjects(); });

test("cloud load keeps native structure and resumes the newest task regardless of response order", () => {
    const project = useCanvasStore.getState().projects[0];
    expect(project.id).toBe("native-1");
    expect(project.nodes[0]).toEqual(native.nodes[0]);
    expect(project.viewport).toEqual(native.viewport);
    expect(project.nodes[1].metadata?.videoTaskId).toBe("new-task");
    expect(project.nodes[1].metadata?.content).toBe("/api/tasks/new-task/video");
    expect(requests.filter((r) => r.method === "PUT")).toHaveLength(0);
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
    expect(requests.filter((r) => r.path.endsWith("/generate")).map((r) => r.body.requestKey)).toEqual([key, key]);
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

test("account change is rejected and media rejects external URLs", async () => {
    expect(api.accountDatabaseName()).toBe("infinite-canvas:workbench:account-a");
    expect(() => projects.ownedAssetUrl("https://external.test/private.mp4")).toThrow();
    account = "account-b";
    await expect(api.bootstrapWorkbench()).rejects.toThrow("Your account changed");
    expect(api.workbenchSession().user.id).toBe("account-a");
});
