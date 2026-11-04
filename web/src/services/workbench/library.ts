import { validateAssetFolders } from "@/lib/asset-folders";
import { validateWorkflow } from "@/lib/workflow-validation";
import { useAssetStore, type LibraryDocument } from "@/stores/use-asset-store";
import { localForageStorage } from "@/lib/localforage-storage";
import { workbenchRequest as request } from "@/services/api/workbench";
import { durableDocument } from "./projects";
import { useWorkbenchStore } from "@/stores/use-workbench-store";

function workbenchRequest<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("X-Canvas-Library-Version", "2");
    return request<T>(path, { ...init, headers });
}

type Envelope = { id: string; revision: number; document: LibraryDocument };
const entries = new Map<string, Envelope>();
const saved = new Map<string, LibraryDocument>();
const marker = "workbench:library-initialized:v1";
const previousRecovery = "workbench:library-recovery:previous:v1";
const recovery = "workbench:library-recovery:v1";
let queue: Promise<unknown> = Promise.resolve();

let preparation: Promise<void> | undefined;
export function prepareCloudLibrary() { return preparation ??= Promise.resolve(useAssetStore.persist.rehydrate()); }
let starting: Promise<void> | undefined;
let loaded = false;
let subscribed = false;
let initializing = false;

export function initializeCloudLibrary() {
    return starting ??= loadCloudLibrary().finally(() => { starting = undefined; });
}
async function loadCloudLibrary() {
    if (loaded) return;
    initializing = true;
    try {
        await prepareCloudLibrary();
        const beforeLoad = useAssetStore.getState();
        if (!subscribed) {
            useAssetStore.subscribe((state, previous) => {
                if (!initializing && (state.assets !== previous.assets || state.folders !== previous.folders)) void saveCloudLibrary().catch(() => undefined);
            });
            subscribed = true;
        }
        let raw = await localForageStorage.getItem(recovery) || await localForageStorage.getItem(previousRecovery);
        if (raw) {
            useWorkbenchStore.setState({ libraryRecovery: [] });
            const snapshot = JSON.parse(raw) as LibraryDocument[];
            if (!Array.isArray(snapshot)) throw new Error("Invalid collection recovery. Export it before continuing.");
            validateAssetFolders(snapshot.filter(item => item.kind === "folder"));
            if (!(await localForageStorage.getItem(previousRecovery))) await localForageStorage.setItem(previousRecovery, raw);
            useWorkbenchStore.setState({ libraryRecovery: snapshot });
        }
        const { items, libraryVersion } = await workbenchRequest<{ items: Envelope[]; libraryVersion?: number }>("/library");
        useWorkbenchStore.setState({ libraryVersion: libraryVersion === 2 ? 2 : 0 });
        if (libraryVersion !== 2 && items.some(item => item.document.kind === "folder" || "folderId" in item.document)) throw new Error("Reload after the server enables library folders.");
        validateAssetFolders(items.filter(item => item.document.kind === "folder").map(item => item.document));
        for (const item of items) if (item.document.kind === "workflow") validateWorkflow(item.document.data);
        const current = useAssetStore.getState();
        const local = [...current.folders, ...current.assets];
        if (current.assets !== beforeLoad.assets || current.folders !== beforeLoad.folders) {
            raw = JSON.stringify(local);
            await localForageStorage.setItem(recovery, raw);
            useWorkbenchStore.setState({ libraryRecovery: local });
        }
        entries.clear();
        saved.clear();
        for (const item of items) {
            entries.set(item.document.id, item);
            saved.set(item.document.id, item.document);
        }
        const firstSync = !(await localForageStorage.getItem(marker));
        const assets = [...items.map((item) => item.document), ...(firstSync && !raw ? local.filter((item) => !entries.has(item.id)) : [])];
        if (firstSync && local.length && !raw) await localForageStorage.setItem(recovery, JSON.stringify(local));
        useAssetStore.setState({ assets: assets.filter(item => item.kind !== "folder"), folders: assets.filter(item => item.kind === "folder"), hydrated: true });
        loaded = true;
        initializing = false;
        if (!raw) await saveCloudLibrary();
    } catch (error) {
        useWorkbenchStore.setState({ libraryError: error instanceof Error ? error.message : String(error) });
        throw error;
    } finally {
        initializing = false;
        useWorkbenchStore.setState({ libraryReady: loaded });
    }
}
export function saveCloudLibrary() {
    const run = queue.then(async () => {
        useWorkbenchStore.setState({ librarySaving: true });
        if (useWorkbenchStore.getState().libraryRecovery) throw new Error("Export or resolve the previous collection recovery before saving new changes.");
        const snapshot = useAssetStore.getState();
        const assets = [...snapshot.folders, ...snapshot.assets];
        await localForageStorage.setItem(recovery, JSON.stringify(assets));
        if (useWorkbenchStore.getState().libraryVersion !== 2 && assets.some(item => item.kind === "folder" || "folderId" in item && item.folderId)) throw new Error("Library folders require server version 2.");
        if (!loaded) throw new Error("Load the cloud collection before saving. Local edits are preserved.");
        if (useWorkbenchStore.getState().libraryError) throw new Error(useWorkbenchStore.getState().libraryError);
        for (const asset of assets) {
            if (saved.get(asset.id) === asset) continue;
            const current = entries.get(asset.id);
            const document = await durableDocument(asset);
            const result = await workbenchRequest<Envelope>(current ? `/library/${encodeURIComponent(current.id)}` : "/library", { method: current ? "PUT" : "POST", body: JSON.stringify({ document, ...(current ? { revision: current.revision } : {}) }) });
            entries.set(asset.id, result);
            saved.set(asset.id, asset);
        }
        const ids = new Set(assets.map((asset) => asset.id));
        for (const [id, entry] of [...entries].sort((a, b) => Number(a[1].document.kind === "folder") - Number(b[1].document.kind === "folder"))) {
            if (ids.has(id)) continue;
            await workbenchRequest(`/library/${encodeURIComponent(entry.id)}`, { method: "DELETE", body: JSON.stringify({ revision: entry.revision }) });
            entries.delete(id);
            saved.delete(id);
        }
        await localForageStorage.setItem(marker, "1");
        if (snapshot.assets === useAssetStore.getState().assets && snapshot.folders === useAssetStore.getState().folders) {
            await localForageStorage.removeItem(recovery);
            await localForageStorage.removeItem(previousRecovery);
        }
    }).catch((error) => { useWorkbenchStore.setState({ libraryError: error instanceof Error ? error.message : String(error) }); throw error; }).finally(() => useWorkbenchStore.setState({ librarySaving: false }));
    queue = run.catch(() => undefined);
    return run;
}
export function retryCloudLibrary() {
    useWorkbenchStore.setState({ libraryError: "" });
    return loaded ? saveCloudLibrary() : initializeCloudLibrary();
}

export async function resolveLibraryRecovery(restore: boolean) {
    const snapshot = useWorkbenchStore.getState().libraryRecovery;
    if (restore && !loaded) throw new Error("Reload the cloud collection before restoring recovery.");
    if (restore) {
        initializing = true;
        try { if (snapshot) useAssetStore.getState().importAssets(snapshot.filter(item => item.kind !== "folder"), snapshot.filter(item => item.kind === "folder")); }
        finally { initializing = false; }
    } else {
        await localForageStorage.removeItem(recovery);
        await localForageStorage.removeItem(previousRecovery);
    }
    useWorkbenchStore.setState({ libraryRecovery: null, libraryError: "" });
    await (loaded ? saveCloudLibrary() : initializeCloudLibrary());
    await localForageStorage.removeItem(previousRecovery);
}
export async function exportLibraryRecovery() {
    return JSON.stringify({ current: await localForageStorage.getItem(recovery), previous: await localForageStorage.getItem(previousRecovery) }, null, 2);
}
