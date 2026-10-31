import { expect, mock, test } from "bun:test";
import { create } from "zustand";
const cache = new Map<string, string>([["workbench:library-initialized:v1", "1"]]);
mock.module("@/lib/localforage-storage", () => ({ localForageStorage: { getItem: async (key: string) => cache.get(key), setItem: async (key: string, value: string) => cache.set(key, value), removeItem: async (key: string) => cache.delete(key) } }));
const store = Object.assign(create<any>((set) => ({ assets: [], addAsset: (asset: any) => set((state: any) => ({ assets: [...state.assets, { ...asset, id: "restored" }] })) })), { persist: { rehydrate: async () => {} } });
mock.module("@/stores/use-asset-store", () => ({ useAssetStore: store }));
mock.module("@/services/workbench/projects", () => ({ durableDocument: async (value: unknown) => value }));
let release!: () => void, requested!: () => void;
const gate = new Promise<void>((resolve) => { release = resolve; });
const reached = new Promise<void>((resolve) => { requested = resolve; });
const writes: string[] = [];
const remote = { id: "remote", kind: "text", data: { content: "Cloud data" } };
mock.module("@/services/api/workbench", () => ({ workbenchRequest: async (path: string, init?: RequestInit) => {
    if (!init?.method) { requested(); await gate; return { items: [{ id: "cloud-envelope", revision: 1, document: remote }] }; }
    writes.push(init.method + " " + path);
    return { id: "new-envelope", revision: 1, document: JSON.parse(init.body as string).document };
} }));
const library = await import("@/services/workbench/library");
const { useWorkbenchStore } = await import("@/stores/use-workbench-store");
test("pending cloud library never saves empty data or overwrites edits; recovery restores as new items", async () => {
    const loading = library.initializeCloudLibrary();
    expect(library.initializeCloudLibrary()).toBe(loading);
    await reached;
    expect(writes).toEqual([]);
    store.setState({ assets: [{ id: "local", kind: "text", data: { content: "Typed while loading" } }] });
    await expect(library.saveCloudLibrary()).rejects.toThrow("Load the cloud collection");
    expect(writes).toEqual([]);
    release();
    await loading;
    expect(store.getState().assets).toEqual([remote]);
    expect(useWorkbenchStore.getState().libraryRecovery?.[0].id).toBe("local");
    expect(cache.get("workbench:library-recovery:v1")).toContain("Typed while loading");
    expect(writes).toEqual([]);
    await library.resolveLibraryRecovery(true);
    expect(store.getState().assets.map((item: any) => item.id)).toEqual(["remote", "restored"]);
    expect(writes).toEqual(["POST /library"]);
});
