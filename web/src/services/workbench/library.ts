import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import { localForageStorage } from "@/lib/localforage-storage";
import { workbenchRequest } from "@/services/api/workbench";
import { durableDocument } from "./projects";
import { useWorkbenchStore } from "@/stores/use-workbench-store";

type Envelope = { id: string; revision: number; document: Asset };
const entries = new Map<string, Envelope>();
const saved = new Map<string, Asset>();
const marker = "workbench:library-initialized:v1";
const previousRecovery = "workbench:library-recovery:previous:v1";
const recovery = "workbench:library-recovery:v1";
let queue: Promise<unknown> = Promise.resolve();

let loaded = false;
let subscribed = false;
let initializing = false;

export async function initializeCloudLibrary() {
    if (loaded) return;
    initializing = true;
    try {
        await useAssetStore.persist.rehydrate();
        if (!subscribed) {
            useAssetStore.subscribe((state, previous) => {
                if (!initializing && state.assets !== previous.assets) void saveCloudLibrary().catch(() => undefined);
            });
            subscribed = true;
        }
        let raw = await localForageStorage.getItem(recovery) || await localForageStorage.getItem(previousRecovery);
        if (raw) {
            useWorkbenchStore.setState({ libraryRecovery: [] });
            const snapshot = JSON.parse(raw) as Asset[];
            if (!Array.isArray(snapshot)) throw new Error("Invalid collection recovery. Export it before continuing.");
            if (!(await localForageStorage.getItem(previousRecovery))) await localForageStorage.setItem(previousRecovery, raw);
            useWorkbenchStore.setState({ libraryRecovery: snapshot });
        }
        const beforeLoad = useAssetStore.getState().assets;
        const { items } = await workbenchRequest<{ items: Envelope[] }>("/library");
        const local = useAssetStore.getState().assets;
        if (!raw && local !== beforeLoad) {
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
        useAssetStore.setState({ assets, hydrated: true });
        loaded = true;
        if (!raw) await saveCloudLibrary();
    } catch (error) {
        useWorkbenchStore.setState({ libraryError: error instanceof Error ? error.message : String(error) });
        throw error;
    } finally { initializing = false; }
}
export function saveCloudLibrary() {
    const run = queue.then(async () => {
        useWorkbenchStore.setState({ librarySaving: true });
        if (useWorkbenchStore.getState().libraryRecovery) throw new Error("Export or resolve the previous collection recovery before saving new changes.");
        const assets = useAssetStore.getState().assets;
        await localForageStorage.setItem(recovery, JSON.stringify(assets));
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
        for (const [id, entry] of entries) {
            if (ids.has(id)) continue;
            await workbenchRequest(`/library/${encodeURIComponent(entry.id)}`, { method: "DELETE", body: JSON.stringify({ revision: entry.revision }) });
            entries.delete(id);
            saved.delete(id);
        }
        await localForageStorage.setItem(marker, "1");
        if (assets === useAssetStore.getState().assets) {
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
        try { snapshot?.forEach(({ id: _id, createdAt: _created, updatedAt: _updated, ...asset }) => useAssetStore.getState().addAsset(asset)); }
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
