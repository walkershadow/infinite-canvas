import { initializeWorkbenchConfig } from "./config";
import { initializeCloudLibrary, prepareCloudLibrary } from "./library";
import { useWorkbenchStore, type WorkbenchRecovery as Recovery } from "@/stores/use-workbench-store";
import { localForageStorage } from "@/lib/localforage-storage";
import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { bootstrapWorkbench, workbenchRequest, workbenchSession } from "@/services/api/workbench";
import { getImageBlob } from "@/services/image-storage";
import { getMediaBlob } from "@/services/file-storage";
import type { CloudProject, NativeDocument, WorkbenchTask } from "@/types/workbench";

const PREVIOUS_RECOVERY_KEY = "workbench:canvas-recovery:previous:v1";
const RECOVERY_KEY = "workbench:canvas-recovery:v1";
type Asset = { id: string; name: string; url: string; mime: string; bytes: number; createdAt?: string };
const assetKey = (asset: Asset) => `${asset.mime.split("/")[0]}:workbench:${asset.id}`;
const uploading = new Map<string, Promise<Asset>>();
const durableUrls = new Map<string, string>();
const envelopes = new Map<string, CloudProject>();
const saved = new Map<string, CanvasProject>();
const assets = new Map<string, Asset>();
let queue: Promise<unknown> = Promise.resolve();
let starting: Promise<void> | undefined;
let projectsLoaded = false;
let subscribed = false;

function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = queue.then(operation);
    queue = run.catch(() => undefined);
    return run;
}
export function ownedAssetUrl(url: string) {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith("/api/")) throw new Error("Workbench assets must use an authenticated same-origin API URL.");
    return parsed.pathname + parsed.search;
}
async function uploadAsset(key: string) {
    const existing = assets.get(key);
    if (existing) return existing;
    const blob = key.startsWith("image:") ? await getImageBlob(key) : await getMediaBlob(key);
    if (!blob) throw new Error(`Missing media: ${key}. Import the original file before saving.`);
    const body = new FormData();
    body.append("file", blob, key.replaceAll(":", "-"));
    const asset = await workbenchRequest<Asset>("/assets", { method: "POST", body });
    asset.url = ownedAssetUrl(asset.url);
    assets.set(key, asset);
    assets.set(assetKey(asset), asset);
    return asset;
}
function cloudAsset(key: string) {
    const existing = uploading.get(key);
    if (existing) return existing;
    const pending = uploadAsset(key).catch((error) => { uploading.delete(key); throw error; });
    uploading.set(key, pending);
    return pending;
}
async function collectDurableUrls(value: unknown): Promise<void> {
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (typeof item.storageKey === "string" && item.storageKey) {
        const asset = await cloudAsset(item.storageKey);
        for (const field of ["content", "url", "dataUrl"]) if (typeof item[field] === "string") durableUrls.set(item[field], asset.url);
    }
    await Promise.all(Object.values(item).map(collectDurableUrls));
}
/** Preserve native fields; replace only ephemeral media URLs at the persistence boundary. */
async function durableValue(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) return Promise.all(value.map(durableValue));
    if (!value || typeof value !== "object") {
        if (typeof value === "string" && durableUrls.has(value)) return durableUrls.get(value);
        if (typeof value === "string" && value.startsWith("blob:")) throw new Error("A temporary media URL has no storage key. Re-import that media before saving.");
        return value;
    }
    const result = { ...value } as Record<string, unknown>;
    if (typeof result.storageKey === "string" && result.storageKey) {
        const asset = await cloudAsset(result.storageKey);
        result.storageKey = assetKey(asset);
        for (const field of ["content", "url", "dataUrl"]) if (typeof result[field] === "string") result[field] = asset.url;
    }
    for (const [key, child] of Object.entries(result)) result[key] = await durableValue(child);
    return result;
}
export async function refreshWorkbenchBalance() {
    const session = await bootstrapWorkbench();
    useWorkbenchStore.setState({ balance: session.quota.points });
}
export function initializeCloudProjects() {
    return starting ??= (async () => {
        useWorkbenchStore.setState({ balance: workbenchSession().quota.points });
        await initializeWorkbenchConfig();
        if (!subscribed) useCanvasStore.subscribe((state, previous) => {
            if (!useWorkbenchStore.getState().ready || (state.projects === previous.projects && state.deletedProjects === previous.deletedProjects)) return;
            void saveCloudProjects().catch(() => undefined);
        });
        subscribed = true;
        const cache = await localForageStorage.getItem(PREVIOUS_RECOVERY_KEY) || await localForageStorage.getItem(RECOVERY_KEY);
        if (cache) {
            const recovery = JSON.parse(cache) as Recovery;
            if (recovery.version !== 1 || !Array.isArray(recovery.projects)) throw new Error("Unknown recovery cache format. Export the browser database before continuing.");
            await localForageStorage.setItem(PREVIOUS_RECOVERY_KEY, cache);
            useWorkbenchStore.setState({ recovery });
        }
        const [response, media] = await Promise.all([
            workbenchRequest<{ projects: CloudProject[] }>("/projects"),
            workbenchRequest<{ assets: Asset[] }>("/assets"),
        ]);
        for (const asset of media.assets) assets.set(assetKey(asset), { ...asset, url: ownedAssetUrl(asset.url) });
        for (const envelope of response.projects) {
            if (envelope.document.schemaVersion !== 1) throw new Error("Unsupported cloud project schema. No projects were overwritten.");
            envelope.document = { ...envelope.document, id: envelope.document.id || envelope.id, createdAt: envelope.document.createdAt || envelope.createdAt, updatedAt: envelope.document.updatedAt || envelope.updatedAt };
            envelopes.set(envelope.document.id, envelope);
            saved.set(envelope.document.id, envelope.document);
        }
        await prepareCloudLibrary();
        projectsLoaded = true;
        void initializeCloudLibrary().catch(() => undefined);
        const session = workbenchSession();
        useCanvasStore.setState({ projects: response.projects.map((p) => p.document), deletedProjects: [], hydrated: true });
        useWorkbenchStore.setState({ ready: true, balance: session.quota.points });
        window.addEventListener("beforeunload", (event) => {
            if (useWorkbenchStore.getState().saving || useWorkbenchStore.getState().librarySaving || useWorkbenchStore.getState().error || useWorkbenchStore.getState().libraryError) event.preventDefault();
        });
    })().catch((error) => { useWorkbenchStore.setState({ ready: false, error: String(error instanceof Error ? error.message : error) }); useCanvasStore.setState({ hydrated: true }); throw error; });
}
async function saveCurrentProjects() {
    const state = useCanvasStore.getState();
    const recovery: Recovery = { version: 1, projects: state.projects, deletedProjects: state.deletedProjects };
    useWorkbenchStore.setState({ saving: true });
    try {
        await localForageStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
        if (!projectsLoaded) throw new Error("Cloud projects could not be loaded. Export local work and reload before saving.");
        if (useWorkbenchStore.getState().error) throw new Error(useWorkbenchStore.getState().error);
        for (const project of state.projects) {
            if (saved.get(project.id) === project) continue;
            await collectDurableUrls(project);
            const document = { ...await durableValue(project) as CanvasProject, schemaVersion: 1 } satisfies NativeDocument;
            const current = envelopes.get(project.id);
            const envelope = await workbenchRequest<CloudProject>(current ? `/projects/${encodeURIComponent(current.id)}` : "/projects", {
                method: current ? "PUT" : "POST", body: JSON.stringify({ document, ...(current ? { revision: current.revision } : {}) }),
            });
            envelopes.set(project.id, envelope);
            saved.set(project.id, project);
        }
        for (const { id } of state.deletedProjects) {
            const current = envelopes.get(id);
            if (!current) continue;
            await workbenchRequest(`/projects/${encodeURIComponent(current.id)}`, { method: "DELETE", body: JSON.stringify({ revision: current.revision }) });
            envelopes.delete(id);
            saved.delete(id);
        }
        if (useCanvasStore.getState().projects === state.projects && useCanvasStore.getState().deletedProjects === state.deletedProjects) await localForageStorage.removeItem(RECOVERY_KEY);
    } catch (error) {
        useWorkbenchStore.setState({ error: error instanceof Error ? error.message : String(error) });
        throw error;
    } finally {
        useWorkbenchStore.setState({ saving: false });
    }
}
export function saveCloudProjects() { return exclusive(saveCurrentProjects); }
export async function retryCloudSave() {
    if (!projectsLoaded) { starting = undefined; useWorkbenchStore.setState({ error: "" }); return initializeCloudProjects(); }
    await refreshWorkbenchBalance();
    useWorkbenchStore.setState({ error: "" });
    return saveCloudProjects();
}
export async function createWorkbenchVideo(projectId: string, nodeId: string, requestKey: string, input: unknown, signal?: AbortSignal) {
    return exclusive(async () => {
        await saveCurrentProjects();
        const current = envelopes.get(projectId);
        if (!current) throw new Error("Save this project before generating.");
        const response = await workbenchRequest<{ task: WorkbenchTask; revision: number }>(`/projects/${encodeURIComponent(current.id)}/generate`, { method: "POST", body: JSON.stringify({ revision: current.revision, requestKey, nodeId, input }), signal });
        current.revision = response.revision;
        void refreshWorkbenchBalance().catch(() => undefined);
        return { ...response.task, projectId: current.id };
    });
}
export async function workbenchReference(reference: { storageKey?: string; url?: string; dataUrl?: string }) {
    if (reference.storageKey) return (await cloudAsset(reference.storageKey)).url;
    const source = reference.url || reference.dataUrl || "";
    const url = source.startsWith("blob:") || /^data:(image|video|audio)\//.test(source) ? source : ownedAssetUrl(source);
    if (url.startsWith("/api/canvas/assets/") || url.startsWith("/api/images/")) return url;
    const existing = assets.get(url);
    if (existing) return existing.url;
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Unable to read the reference media.");
    const body = new FormData();
    body.append("file", await response.blob(), "reference");
    const asset = await workbenchRequest<Asset>("/assets", { method: "POST", body });
    asset.url = ownedAssetUrl(asset.url);
    assets.set(url, asset);
    assets.set(assetKey(asset), asset);
    return asset.url;
}
export function cloudMediaUrl(storageKey: string) { return assets.get(storageKey)?.url; }

export async function loadProjectVideoTasks(projectId: string) {
    const envelope = envelopes.get(projectId);
    if (!envelope) return [];
    const { tasks } = await workbenchRequest<{ tasks: WorkbenchTask[] }>(`/projects/${encodeURIComponent(envelope.id)}/tasks`);
    return tasks.map((task) => ({ ...task, projectId: envelope.id }));
}

export async function dismissRecovery() {
    await localForageStorage.removeItem(PREVIOUS_RECOVERY_KEY);
    useWorkbenchStore.setState({ recovery: null });
}

export async function durableDocument<T>(value: T): Promise<T> {
    await collectDurableUrls(value);
    return await durableValue(value) as T;
}
