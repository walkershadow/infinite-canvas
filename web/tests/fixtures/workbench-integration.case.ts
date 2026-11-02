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
mock.module("@/services/image-storage", () => ({ ensureImagePreview: async () => {}, resolveImageUrl: async (_key: string, url: string) => url, uploadImage: async (url: string | Blob) => typeof url === "string" ? { url } : { url: "blob:generated-cover", storageKey: "image:generated-cover" }, getImageBlob: async () => new Blob(["fixture"], { type: "image/png" }), imageToDataUrl: async () => "data:image/png;base64,AA==" }));
mock.module("@/services/file-storage", () => ({ getMediaBlob: async () => null, resolveMediaUrl: async (_key: string, url: string) => url, uploadMediaFile: async (url: string) => ({ url, storageKey: "video:fixture", mimeType: "video/mp4", bytes: 1 }) }));

const { create } = await import("zustand");
const assetStore = Object.assign(create<any>((set) => ({ assets: [], addAsset: (asset: any) => set((state: any) => ({ assets: [...state.assets, { ...asset, id: crypto.randomUUID() }] })) })), { persist: { rehydrate: async () => {} } });
mock.module("@/stores/use-asset-store", () => ({ useAssetStore: assetStore }));
const preferences = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (key: string) => preferences.get(key) || null, setItem: (key: string, value: string) => preferences.set(key, value), removeItem: (key: string) => preferences.delete(key) } });
Object.assign(globalThis, { window: { localStorage: globalThis.localStorage, location: { origin: "http://localhost:3200" }, addEventListener() {} } });
let account = "account-a";
let referenceCatalog: Record<string, unknown> = {};
let conflict = false;
let libraryConflict = false;
let libraryUnavailable = true;
let releaseLibrary!: () => void;
const libraryGate = new Promise<void>((resolve) => { releaseLibrary = resolve; });
let videoChecks = 0;
let videoPending = 0;
let videoQueryError = false;
let videoFailed = false;
const aiTasks = new Map<string, any>();
let aiPostLost = false;
let aiQueryError = false;
let aiStatus = "completed";
let aiChecks = 0;
let aiPending = 0;
const libraryItems = new Map<string, any>();
const promptItems = new Map<string, any>();
const requests: { path: string; method: string; body: any; account: string | null }[] = [];
const native = { schemaVersion: 1, id: "native-1", title: "Fixture", createdAt: "a", updatedAt: "a", nodes: [{ id: "group", type: "group", position: { x: 8, y: 9 }, width: 500, height: 300, metadata: { custom: { untouched: true } } }, { id: "video", type: "video", position: { x: 10, y: 30 }, width: 280, height: 220, metadata: {} }], connections: [], chatSessions: [], activeChatId: null, backgroundMode: "lines", showImageInfo: false, viewport: { x: 1, y: 2, k: 0.7 } };
let revision = 2;
globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    requests.push({ path, method: init?.method || "GET", body, account: new Headers(init?.headers).get("X-Canvas-Account") });
    if (path === "/api/canvas/assets/audio/content") return new Response(new Blob(["fixture"], { type: "audio/wav" }));
    if (path.startsWith("/api/canvas/ai/")) {
        if (init?.method === "POST") {
            const existing = aiTasks.get(body.requestKey);
            if (existing && JSON.stringify(existing.input) !== JSON.stringify(body)) return Response.json({ error: "Payload conflict" }, { status: 409 });
            const kind = path.split("/").at(-1);
            const task = existing || { id: "ai-" + aiTasks.size, requestKey: body.requestKey, model: body.model, kind, status: "queued", error: null, result: null, createdAt: "a", updatedAt: "a", input: body };
            aiTasks.set(body.requestKey, task);
            expect(cache.get("workbench:ai-tasks:v1")).toContain(body.requestKey);
            if (aiPostLost) { aiPostLost = false; throw new Error("Response lost after acceptance"); }
            return Response.json({ task });
        }
        if (path.endsWith("/tasks")) return Response.json({ tasks: [...aiTasks.values()] });
        if (aiQueryError) return Response.json({ error: "Offline" }, { status: 503 });
        const task = [...aiTasks.values()].find((item) => path.endsWith("/" + item.id));
        aiChecks++;
        task.status = aiChecks <= aiPending ? "running" : aiStatus;
        task.result = task.status === "completed" ? task.kind === "images" ? { images: [{ id: "image-result", url: "/api/canvas/assets/image/content" }] } : task.kind === "text" ? { text: "Recovered text" } : { url: "/api/canvas/assets/audio/content", mimeType: "audio/wav" } : null;
        return Response.json({ task });
    }
    if (path.endsWith("/bootstrap")) return Response.json({ user: { id: account }, models: [{ id: "platform-video", name: "Platform video", price: 1, billingUnit: "request", durations: [5], defaultDuration: 5, ratios: [{ value: "16:9", label: "16:9", size: "1280x720" }] }], currency: "USD", pointsPerUsd: 100, quota: { points: 12 }, capabilities: { video: true }, ...referenceCatalog });
    if (path.includes("/library") || path.includes("/prompts")) {
        const library = path.includes("/library");
        if (library) await libraryGate;
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

beforeAll(async () => {
    await api.bootstrapWorkbench();
    await projects.initializeCloudProjects();
    expect(useWorkbenchStore.getState().ready).toBe(true);
    expect(useWorkbenchStore.getState().balance).toBe(12);
    expect(useWorkbenchStore.getState().libraryReady).toBe(false);
    expect(requests.some((r) => r.path.includes("/projects/") && r.path.endsWith("/tasks"))).toBe(false);
    expect(requests.some((r) => r.path.includes("/library") && r.method !== "GET")).toBe(false);
    releaseLibrary();
    await (await import("@/services/workbench/library")).initializeCloudLibrary().catch(() => undefined);
});

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

test("cloud load keeps native structure and discovers tasks only for an opened project", async () => {
    const project = useCanvasStore.getState().projects[0];
    expect(project.id).toBe("native-1");
    expect(project.nodes[0]).toEqual(native.nodes[0]);
    expect(project.viewport).toEqual(native.viewport);
    const tasks = await projects.loadProjectVideoTasks(project.id);
    const { recoverVideoNodes } = await import("@/lib/canvas/workbench-video-recovery");
    const recovered = recoverVideoNodes(project.nodes, project.nodes, tasks);
    expect(recovered[1].metadata?.videoTaskId).toBe("new-task");
    expect(recovered[1].metadata?.workbenchProjectId).toBe("cloud-1");
    expect(project.nodes[1].metadata?.videoTaskId).toBeUndefined();
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

test("AI tasks persist before submission and recover lost responses with the same key", async () => {
    const { runAiTask, resumeAiTask, queryAiTask, acknowledgeAiTask, isWorkbenchTaskPending } = await import("@/services/api/workbench-ai-tasks");
    const { useAiTasksStore } = await import("@/stores/use-workbench-ai-store");
    const originalTimer = globalThis.setTimeout;
    globalThis.setTimeout = ((callback: () => void) => { queueMicrotask(callback); return 0; }) as any;
    const owner = { projectId: "native-1", nodeId: "text-fixture" };
    try {
        aiPostLost = true;
        const input = { model: "ali-llm", messages: [{ role: "user", content: "Fixture" }] };
        let lost: unknown;
        try { await runAiTask("text", input, { owner }); } catch (error) { lost = error; }
        expect(isWorkbenchTaskPending(lost)).toBe(true);
        expect(aiTasks.size).toBe(1);
        const saved = JSON.parse(cache.get("workbench:ai-tasks:v1")!)[0];
        expect(saved.owner).toEqual(owner);
        expect(saved.body).toEqual(input);
        aiPending = 301; aiChecks = 0;
        expect(await runAiTask("text", input, { owner })).toEqual({ text: "Recovered text" });
        expect(aiChecks).toBe(302);
        expect(aiTasks.size).toBe(1);
        const posts = requests.filter((r) => r.path === "/api/canvas/ai/text");
        expect(new Set(posts.map((r) => r.body.requestKey)).size).toBe(1);
        const completed = useAiTasksStore.getState().records[0];
        expect(await resumeAiTask(structuredClone(completed))).toEqual({ text: "Recovered text" });
        expect(aiTasks.size).toBe(1);
        await expect(runAiTask("text", { ...input, messages: [] }, { owner })).rejects.toThrow("unresolved");
        await acknowledgeAiTask(owner);
        aiPending = 0; aiStatus = "unknown";
        let unknown: unknown;
        try { await runAiTask("audio", { model: "ali-audio", prompt: "Fixture" }, { owner: { nodeId: "audio" } }); } catch (error) { unknown = error; }
        expect(isWorkbenchTaskPending(unknown)).toBe(true);
        const record = useAiTasksStore.getState().records.at(-1)!;
        const count = aiTasks.size;
        await expect(resumeAiTask(record)).rejects.toThrow("administrator review");
        expect(aiTasks.size).toBe(count);
        aiStatus = "completed";
        expect((await queryAiTask(record)).status).toBe("completed");
        aiQueryError = true;
        await expect(queryAiTask(record)).rejects.toThrow("Offline");
        expect(useAiTasksStore.getState().records.at(-1)?.task?.status).toBe("completed");
        aiQueryError = false; aiStatus = "failed";
        let failed: unknown;
        try { await runAiTask("images", { model: "ali-image", prompt: "Rejected" }, { owner: { slot: 99 } }); } catch (error) { failed = error; }
        expect(isWorkbenchTaskPending(failed)).toBe(false);
        expect(useAiTasksStore.getState().records.at(-1)?.task?.status).toBe("failed");
        expect(JSON.stringify(useAiTasksStore.getState().records)).not.toContain("apiKey");
    } finally { globalThis.setTimeout = originalTimer; aiStatus = "completed"; aiPending = 0; aiQueryError = false; }
});

test("platform adapters return asynchronous text, image and speech results without provider credentials", async () => {
    const { platformImages, platformText, platformAudio } = await import("@/services/api/workbench-ai");
    const { buildGenerationConfig } = await import("@/lib/canvas/canvas-generation-helpers");
    const session = api.workbenchSession();
    session.aiModels = [{ id: "ali-image", name: "Image", capability: "image", price: 0 }, { id: "ali-llm", name: "Text", capability: "text", price: 0 }, { id: "ali-audio", name: "Speech", capability: "audio", price: 0 }];
    Object.assign(session.capabilities, { image: true, text: true, audio: true });
    const channel = { id: "workbench", name: "Workbench", baseUrl: "/api/canvas", apiKey: "", apiFormat: "openai" as const, models: session.aiModels.map((model) => ({ name: model.id, capability: model.capability })) };
    const config = { ...configModule.defaultConfig, channels: [channel], model: "workbench::ali-image", imageModel: "workbench::ali-image", textModel: "workbench::ali-llm", audioModel: "workbench::ali-audio", size: "1024x1024", count: "1", audioFormat: "wav", apiKey: "" };
    const originalTimer = globalThis.setTimeout;
    globalThis.setTimeout = ((callback: () => void) => { queueMicrotask(callback); return 0; }) as any;
    try {
        expect((await platformImages(config, "Fixture", [], { owner: { slot: 100 } }))[0].dataUrl).toBe("/api/canvas/assets/image/content");
        let delta = "";
        expect(await platformText({ ...config, model: config.textModel }, [{ role: "user", content: "Fixture" }], (text) => delta = text, { owner: { nodeId: "adapter-text" } })).toBe("Recovered text");
        expect(delta).toBe("Recovered text");
        expect((await platformAudio({ ...config, model: config.audioModel }, "Fixture", { owner: { nodeId: "adapter-audio" } })).type).toBe("audio/wav");
        const before = aiTasks.size;
        await expect(platformImages({ ...config, count: "7" }, "Fixture", [])).rejects.toThrow("1–6");
        await expect(platformImages({ ...config, background: "transparent" }, "Fixture", [])).rejects.toThrow("transparent");
        await expect(platformImages(config, "Fixture", [{} as any])).rejects.toThrow("does not accept reference images");
        await expect(platformText({ ...config, model: config.textModel }, [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }], () => {})).rejects.toThrow("text messages");
        await expect(platformAudio({ ...config, model: config.audioModel, audioFormat: "mp3" }, "Fixture")).rejects.toThrow("WAV");
        await expect(platformAudio({ ...config, model: config.audioModel }, "a".repeat(501))).rejects.toThrow("500");
        session.aiModels[0].price = 1;
        await expect(platformImages(config, "Fixture", [])).rejects.toThrow("pricing changed");
        expect(aiTasks.size).toBe(before);
        expect(buildGenerationConfig({ ...config, audioFormat: "mp3", size: "720x720" }, undefined, "audio").audioFormat).toBe("wav");
        expect(buildGenerationConfig({ ...config, size: "720x720" }, undefined, "image").size).toBe("1024x1024");
        expect(configModule.defaultConfig.audioFormat).toBe("mp3");
    } finally { globalThis.setTimeout = originalTimer; session.aiModels[0].price = 0; }
});

test("recovered AI results only fill their owned node and slot", async () => {
    const { applyRecoveredAiResult } = await import("@/pages/canvas/hooks/use-workbench-ai-recovery");
    const node: any = { id: "root", type: "image", metadata: { content: "chosen", primaryImageId: "chosen-id", images: [{ id: "chosen-id", content: "chosen", status: "success" }, { id: "waiting-id", status: "idle" }] } };
    const record: any = { kind: "images", owner: { projectId: "native-1", nodeId: "root", itemId: "waiting-id" } };
    const result = applyRecoveredAiResult(node, record, { content: "recovered", status: "success" }, {});
    expect(result.metadata?.content).toBe("chosen");
    expect(result.metadata?.primaryImageId).toBe("chosen-id");
    expect(result.metadata?.images?.[1].content).toBe("recovered");
    expect(applyRecoveredAiResult({ ...node, id: "other" }, record, { content: "recovered" }, {}).metadata).toBe(node.metadata);
    expect(applyRecoveredAiResult(node, { ...record, owner: { ...record.owner, itemId: "removed" } }, { content: "recovered" }, {})).toBe(node);
    const text: any = { id: "text", type: "text", metadata: { content: "", primaryTextId: "slot", texts: [{ id: "slot", content: "", status: "idle" }] } };
    expect(applyRecoveredAiResult(text, { ...record, kind: "text", owner: { nodeId: "text", itemId: "slot" } }, { content: "answer", status: "success" }, { text: "answer" }).metadata?.texts?.[0].content).toBe("answer");
});


test("reference selection rejects empty/mixed groups and platform media without changing custom providers", async () => {
    const { referenceKindsForNode, isCompatibleReference } = await import("@/lib/canvas/canvas-reference-selection");
    const { useConfigStore } = await import("@/stores/use-config-store");
    const defaultConfig = { ...useConfigStore.getState().config, channels: [{ id: "workbench", name: "Workbench", baseUrl: "", apiKey: "", apiFormat: "openai" as const, models: [...(api.workbenchSession().aiModels || []).map((item) => ({ name: item.id, capability: item.capability })), { name: "ali-video", capability: "video" as const }] }] };
    const node = (id: string, type: string, metadata = {}) => ({ id, type, title: id, position: { x: 0, y: 0 }, width: 100, height: 100, metadata }) as any;
    const image = node("image", "image", { content: "image.png", groupId: "group" });
    const text = node("text", "text", { content: "context", groupId: "group" });
    const group = node("group", "group");
    const nodes = [image, text, group];
    expect(referenceKindsForNode(node("target", "image", { model: "workbench::ali-image" }), defaultConfig)).toEqual(["text"]);
    expect(referenceKindsForNode(node("target", "text", { model: "workbench::ali-llm" }), defaultConfig)).toEqual(["text"]);
    expect(referenceKindsForNode(node("target", "image", { model: "default::gpt-image-2" }), defaultConfig)).toEqual(["text", "image"]);
    expect(referenceKindsForNode(node("target", "video", { model: "workbench::ali-video" }), defaultConfig)).toEqual(["text"]);
    expect(isCompatibleReference(node("empty", "image"), nodes, ["image"])).toBe(false);
    expect(isCompatibleReference(image, nodes, ["text"])).toBe(false);
    expect(isCompatibleReference(text, nodes, ["text"])).toBe(true);
    expect(isCompatibleReference(group, nodes, ["text"])).toBe(false);
    expect(isCompatibleReference(group, nodes, ["text", "image"])).toBe(true);
});

test("video cover is persisted as a separate durable image while the original video is preserved", async () => {
    const { durableDocument } = await import("@/services/workbench/projects");
    const original = { id: "saved-video", kind: "video", coverUrl: "", data: { url: "/api/tasks/original/video", width: 1280, height: 720 }, videoCover: { storageKey: "image:video-cover", url: "blob:cover" } };
    const document = await durableDocument(original);
    expect(document.data).toEqual(original.data);
    expect(document.videoCover.url).toStartWith("/api/canvas/assets/");
    expect(document.videoCover.storageKey).not.toBe("image:video-cover");
    expect(original.videoCover.url).toBe("blob:cover");
});


test("cover generation deduplicates requests and never overwrites a newer cover or deleted asset", async () => {
    let release!: () => void;
    let calls = 0;
    mock.module("@/lib/canvas/canvas-video-frame", () => ({ captureVideoFrame: async () => { calls++; await new Promise<void>((resolve) => release = resolve); return new Blob(["frame"], { type: "image/png" }); } }));
    mock.module("@/lib/image-thumbnail", () => ({ createImageThumbnail: async () => undefined }));
    const { ensureAssetVideoCover } = await import("@/services/asset-video-cover");
    const original = { id: "legacy", kind: "video", coverUrl: "", data: { url: "/video", width: 640 }, note: "keep" };
    assetStore.setState({ assets: [original], updateAsset: (id: string, patch: any) => assetStore.setState({ assets: assetStore.getState().assets.map((a: any) => a.id === id ? { ...a, ...patch } : a) }) });
    const first = ensureAssetVideoCover("legacy");
    expect(ensureAssetVideoCover("legacy")).toBe(first);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release(); await first;
    expect(calls).toBe(1);
    expect(assetStore.getState().assets[0].data).toEqual(original.data);
    expect(assetStore.getState().assets[0].videoCover.storageKey).toBe("image:generated-cover");
    await ensureAssetVideoCover("legacy"); expect(calls).toBe(1);
    assetStore.setState({ assets: [original] });
    const custom = ensureAssetVideoCover("legacy");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assetStore.setState({ assets: [{ ...original, coverUrl: "/custom-cover" }] });
    release(); await custom;
    expect(assetStore.getState().assets[0].coverUrl).toBe("/custom-cover");
    expect(assetStore.getState().assets[0].videoCover).toBeUndefined();
    assetStore.setState({ assets: [original] });
    const deleted = ensureAssetVideoCover("legacy");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assetStore.setState({ assets: [] }); release(); await deleted;
    expect(assetStore.getState().assets).toEqual([]);
});

test("ali reference contracts preserve owned media, frame roles and multimodal messages", async () => {
    const session = api.workbenchSession();
    session.aiModels = [
        { id: "ali-image", name: "Image", capability: "image", price: 0, constraints: { textOnly: false, maxImages: 10 } },
        { id: "ali-llm", name: "Text", capability: "text", price: 0, constraints: { textOnly: false, referenceKinds: ["text", "image", "video"], maxImages: 10, maxVideos: 5 } },
        { id: "ali-audio", name: "Speech", capability: "audio", price: 0, constraints: { referenceAudio: true, maxAudios: 1 } },
    ];
    const videoModel = { ...session.models[0], id: "ali-video", supportsImage: true, supportsVideo: true, supportsAudio: true, supportsFrames: true, maxImages: 10, maxVideos: 5, maxAudios: 5 };
    session.models.push(videoModel);
    referenceCatalog = { aiModels: session.aiModels, models: session.models, capabilities: session.capabilities };
    const channel = { id: "workbench", name: "Workbench", baseUrl: "/api/canvas", apiKey: "", apiFormat: "openai" as const, models: [...session.aiModels.map((model) => ({ name: model.id, capability: model.capability })), { name: "ali-video", capability: "video" as const }] };
    const config = { ...configModule.defaultConfig, channels: [channel], model: "workbench::ali-image", imageModel: "workbench::ali-image", textModel: "workbench::ali-llm", audioModel: "workbench::ali-audio", videoModel: "workbench::ali-video", size: "1024x1024", count: "1", audioFormat: "wav", apiKey: "" };
    const image = { id: "ref-image", name: "fixture", type: "image/png", dataUrl: "/api/canvas/assets/ref-image/content" };
    const audio = { id: "ref-audio", name: "fixture", type: "audio/wav", url: "/api/canvas/assets/ref-audio/content" };
    const video = { id: "ref-video", name: "fixture", type: "video/mp4", url: "/api/canvas/assets/ref-video/content" };
    const { platformImages, platformText, platformAudio } = await import("@/services/api/workbench-ai");
    const { createVideoGenerationTask } = await import("@/services/api/video");
    const { referenceKindsForGeneration, assertWorkbenchReferences } = await import("@/lib/canvas/canvas-reference-selection");
    const originalTimer = globalThis.setTimeout;
    globalThis.setTimeout = ((callback: () => void) => { queueMicrotask(callback); return 0; }) as any;
    try {
        await platformImages(config, "Edit fixture", [image], { owner: { nodeId: "ref-image-output" } });
        expect(requests.filter((r) => r.path === "/api/canvas/ai/images" && r.method === "POST").at(-1)!.body.images).toEqual([image.dataUrl]);
        const messages = [{ role: "user" as const, content: [{ type: "text" as const, text: "Describe" }, { type: "image_url" as const, image_url: { url: image.dataUrl } }] }];
        await platformText({ ...config, model: config.textModel }, messages, () => {}, { owner: { nodeId: "ref-text-output" } });
        expect(requests.filter((r) => r.path === "/api/canvas/ai/text" && r.method === "POST").at(-1)!.body.messages).toEqual(messages);
        const { requestImageQuestion } = await import("@/services/api/image");
        await requestImageQuestion({ ...config, model: config.textModel }, messages, () => {}, { videos: [video], owner: { nodeId: "ref-video-understanding" } });
        expect(requests.filter((r) => r.path === "/api/canvas/ai/text" && r.method === "POST").at(-1)!.body.messages[0].content).toEqual([...messages[0].content, { type: "video_url", video_url: { url: video.url } }]);
        expect(messages[0].content).toHaveLength(2);
        await platformAudio({ ...config, model: config.audioModel }, "Fixture", { audios: [audio], owner: { nodeId: "ref-audio-output" } });
        expect(requests.filter((r) => r.path === "/api/canvas/ai/audio" && r.method === "POST").at(-1)!.body.ref_audio).toBe(audio.url);
        const videoConfig = { ...config, model: config.videoModel, size: "1280x720", vquality: "720", videoSeconds: "5" };
        const lastVideoInput = () => requests.filter((r) => r.path === "/api/canvas/video/generate").at(-1)!.body.input;
        await createVideoGenerationTask({ ...videoConfig, videoMode: "reference" }, "Fixture", [image], { requestKey: "mixed-fixture", videos: [video], audios: [audio] });
        expect(lastVideoInput()).toMatchObject({ images: [image.dataUrl], videos: [video.url], audios: [audio.url] });
        expect(lastVideoInput().media).toBeUndefined();
        await createVideoGenerationTask({ ...videoConfig, videoMode: "frames" }, "Fixture", [image], { requestKey: "first-fixture" });
        expect(lastVideoInput().input_reference).toBe(image.dataUrl);
        expect(lastVideoInput().images).toBeUndefined();
        await createVideoGenerationTask({ ...videoConfig, videoMode: "frames" }, "Fixture", [image, { ...image, dataUrl: "/api/canvas/assets/last/content" }], { requestKey: "frames-fixture" });
        expect(lastVideoInput().media).toEqual([{ type: "first_frame", url: image.dataUrl }, { type: "last_frame", url: "/api/canvas/assets/last/content" }]);
        expect(lastVideoInput().images).toBeUndefined();
        expect(lastVideoInput().input_reference).toBeUndefined();
        expect(referenceKindsForGeneration(config, "image")).toEqual(["text", "image"]);
        expect(referenceKindsForGeneration({ ...config, model: config.audioModel }, "audio")).toEqual(["text", "audio"]);
        expect(referenceKindsForGeneration({ ...config, model: config.textModel }, "text")).toEqual(["text", "image", "video"]);
        expect(referenceKindsForGeneration({ ...videoConfig, videoMode: "frames" }, "video")).toEqual(["text", "image"]);
        expect(referenceKindsForGeneration({ ...videoConfig, videoMode: "reference" }, "video")).toEqual(["text", "image", "video", "audio"]);
        expect(referenceKindsForGeneration({ ...config, channels: [], model: "custom" }, "audio")).toEqual(["text"]);
        await platformText({ ...config, model: config.textModel }, [
            { role: "user", content: Array(6).fill({ type: "image_url", image_url: { url: image.dataUrl } }) },
            { role: "user", content: Array(6).fill({ type: "image_url", image_url: { url: image.dataUrl } }) },
        ], () => {}, { owner: { nodeId: "per-message-limits" } });
        const { workbenchVideoInput } = await import("@/services/workbench/video");
        videoModel.ratios = ["16:9", "9:16", "16:9-1080p", "9:16-1080p"].map((value) => ({ value, label: value, size: value }));
        for (const ratio of videoModel.ratios) {
            const selected = { ...videoConfig, size: ratio.value, vquality: ratio.value.endsWith("-1080p") ? "1080" : "720", videoMode: "reference" };
            expect(workbenchVideoInput(selected).ratio).toBe(ratio.value);
            await createVideoGenerationTask(selected, "Fixture", [], { requestKey: `ratio-${ratio.value}` });
            expect(lastVideoInput().ratio).toBe(ratio.value);
        }
        expect(workbenchVideoInput({ ...videoConfig, videoSeconds: "6", vquality: "480" }).duration).toBe(videoModel.defaultDuration);
        expect(workbenchVideoInput({ ...videoConfig, vquality: "480" }).ratio).toBe("16:9");
        const before = requests.length;
        await expect(platformImages(config, "Fixture", Array(11).fill(image))).rejects.toThrow("10");
        await expect(platformText({ ...config, model: config.textModel }, [{ role: "user", content: Array(11).fill({ type: "image_url", image_url: { url: image.dataUrl } }) }], () => {})).rejects.toThrow("10");
        await expect(platformText({ ...config, model: config.textModel }, [{ role: "user", content: [{ type: "input_audio", input_audio: { data: "fixture", format: "wav" } }] }] as any, () => {})).rejects.toThrow("text, image and video");
        await expect(platformText({ ...config, model: config.textModel }, messages, () => {}, { videos: Array(6).fill(video) })).rejects.toThrow("5");
        await expect(platformAudio({ ...config, model: config.audioModel }, "Fixture", { audios: [audio, audio] })).rejects.toThrow("one reference");
        await expect(createVideoGenerationTask({ ...videoConfig, videoMode: "frames" }, "Fixture", [image], { requestKey: "invalid-mix", audios: [audio] })).rejects.toThrow("cannot include");
        await expect(createVideoGenerationTask({ ...videoConfig, videoMode: "frames" }, "Fixture", [image, image, image], { requestKey: "invalid-frames" })).rejects.toThrow("two first/last");
        await expect(createVideoGenerationTask({ ...videoConfig, videoMode: "reference" }, "Fixture", [], { requestKey: "invalid-count", videos: Array(6).fill(video) })).rejects.toThrow("5");
        expect(() => assertWorkbenchReferences({ ...config, model: config.textModel }, "text", { imageCount: 0, videoCount: 0, audioCount: 1 })).toThrow("does not accept audio");
        expect(() => assertWorkbenchReferences(config, "image", { imageCount: 0, videoCount: 0, audioCount: 1 })).toThrow("does not accept audio");
        expect(requests).toHaveLength(before);
    } finally { globalThis.setTimeout = originalTimer; }
});

test("protected public library images remain authenticated paths during persistence and generation", async () => {
    const { workbenchReference, durableDocument } = await import("@/services/workbench/projects");
    const urls = ["face", "pose", "outfit"].map(id => `/api/canvas/public-library/${id}/content`);
    const before = requests.length;
    const { hydrateNodeGenerationContext } = await import("@/components/canvas/canvas-node-generation");
    const context = await hydrateNodeGenerationContext({ prompt: "Keep case order", referenceImages: urls.map((dataUrl, i) => ({ id: String(i), dataUrl, name: String(i), type: "image/png" })), referenceVideos: [], referenceAudios: [], imageCount: 3, textCount: 0, videoCount: 0, audioCount: 0 });
    expect(context.referenceImages.map(ref => ref.dataUrl)).toEqual(urls);
    expect(await Promise.all(context.referenceImages.map(workbenchReference))).toEqual(urls);
    expect(await Promise.all(urls.map(url => workbenchReference({ url })))).toEqual(urls);
    expect(await durableDocument({ references: urls.map(url => ({ image: { url, width: 800, height: 1200 } })) })).toEqual({ references: urls.map(url => ({ image: { url, width: 800, height: 1200 } })) });
    expect(requests.length).toBe(before);
    const { resolveWorkflowImages } = await import("@/services/workflow-images");
    const document: any = { schemaVersion: 1, language: "en", source: { id: "public-test", title: "Test", summary: "Test", category: "Test", contentKind: "template", tags: [], steps: [], sources: [], referenceMedia: [], outputMedia: [] }, stages: [], references: urls.map((url, i) => ({ id: String(i), title: "Input", role: "Test", kind: "image", required: true, stageIds: [], image: { url, width: 800, height: 1200 } })) };
    const restored = await resolveWorkflowImages(document, true);
    expect(restored.references.map(ref => ref.image)).toEqual(document.references.map((ref: any) => ref.image));
    expect(requests.length).toBe(before);
});
