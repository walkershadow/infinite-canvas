import { useWorkbenchStore } from "@/stores/use-workbench-store";
import { validateAssetFolders } from "@/lib/asset-folders";
import { validateWorkflow } from "@/lib/workflow-validation";
import { isWorkbench } from "@/constant/integration";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { nanoid } from "nanoid";
import { localForageStorage } from "@/lib/localforage-storage";
import { cleanupUnusedImages, ensureImagePreview, previewUrlFor, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { cleanupUnusedMedia, resolveMediaUrl } from "@/services/file-storage";

import type { WorkflowDocument } from "@/types/workflow";
export type AssetKind = "text" | "image" | "video" | "workflow";
export type WorkflowAsset = AssetBase<"workflow"> & { data: WorkflowDocument };
export type TextAsset = AssetBase<"text"> & { data: { content: string } };
export type ImageAsset = AssetBase<"image"> & { data: { dataUrl: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type VideoAsset = AssetBase<"video"> & { data: { url: string; storageKey?: string; width: number; height: number; bytes: number; mimeType: string } };
export type AssetFolder = { id: string; kind: "folder"; title: string; data: Record<string, never>; createdAt: string; updatedAt: string };
export type LibraryDocument = Asset | AssetFolder;
export type Asset = TextAsset | ImageAsset | VideoAsset | WorkflowAsset;

type AssetBase<T extends AssetKind> = {
    id: string;
    kind: T;
    title: string;
    coverUrl: string;
    folderId?: string;
    videoCover?: { url: string; storageKey?: string };
    tags: string[];
    source?: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
};

type AssetStore = {
    hydrated: boolean;
    assets: Asset[];
    folders: AssetFolder[];
    addFolder: (title: string) => string;
    renameFolder: (id: string, title: string) => void;
    removeFolder: (id: string) => void;
    moveAssets: (ids: string[], folderId?: string) => void;
    importAssets: (assets: Asset[], folders?: AssetFolder[], destination?: string) => void;
    addAsset: (asset: Omit<Asset, "id" | "createdAt" | "updatedAt">) => string;
    updateAsset: (id: string, patch: Partial<Omit<Asset, "id" | "createdAt">>) => void;
    removeAsset: (id: string) => void;
    replaceAssets: (assets: Asset[]) => void;
    cleanupImages: (extra?: unknown) => void;
};

// 卡片用缩略图渲染，自定义封面（远程地址或单独上传的封面）保持原样。
export function assetCoverUrl(asset: Asset) {
    const own = asset.kind === "image" ? asset.data.dataUrl : "";
    const cover = asset.coverUrl || asset.videoCover?.url || own;
    return asset.kind === "image" && cover === own ? previewUrlFor(asset.data.storageKey) || cover : cover;
}

function requireFolderSupport() {
    if (isWorkbench && useWorkbenchStore.getState().libraryVersion !== 2) throw new Error("Library folders require server version 2.");
}

const ASSET_STORE_KEY = "infinite-canvas:asset_store";

const assetStorage: PersistStorage<AssetStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        if (!value) return null;
        const parsed = JSON.parse(value) as StorageValue<AssetStore>;
        parsed.state.folders ??= [];
        validateAssetFolders(parsed.state.folders);
        parsed.state.assets = await Promise.all(
            parsed.state.assets.map(async (asset) => {
                if (asset.kind === "workflow") { validateWorkflow(asset.data); const { resolveWorkflowImages } = await import("@/services/workflow-images"); return { ...asset, data: await resolveWorkflowImages(asset.data) }; }
                if (asset.kind === "video") return { ...asset, ...(asset.videoCover ? { videoCover: { ...asset.videoCover, url: await resolveImageUrl(asset.videoCover.storageKey, asset.videoCover.url) } } : {}), data: { ...asset.data, url: await resolveMediaUrl(asset.data.storageKey, asset.data.url) } };
                if (asset.kind !== "image") return asset;
                if (asset.data.storageKey) {
                    void ensureImagePreview(asset.data.storageKey);
                    return {
                        ...asset,
                        coverUrl: asset.coverUrl.startsWith("blob:") ? await resolveImageUrl(asset.data.storageKey, asset.coverUrl) : asset.coverUrl,
                        data: { ...asset.data, dataUrl: await resolveImageUrl(asset.data.storageKey, asset.data.dataUrl) },
                    };
                }
                if (!asset.data.dataUrl.startsWith("data:image/")) return asset;
                const image = await uploadImage(asset.data.dataUrl);
                return { ...asset, coverUrl: asset.coverUrl.startsWith("data:image/") ? image.url : asset.coverUrl, data: { ...asset.data, dataUrl: image.url, storageKey: image.storageKey, bytes: image.bytes, mimeType: image.mimeType } };
            }),
        );
        return parsed;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useAssetStore = create<AssetStore>()(
    persist(
        (set, get) => ({
            hydrated: false,
            assets: [],
            folders: [],
            addFolder: (title) => {
                requireFolderSupport();
                const id = nanoid(), now = new Date().toISOString();
                if (!title.trim()) throw new Error("Folder name is required");
                set(state => ({ folders: [...state.folders, { id, kind: "folder", title: title.trim(), data: {}, createdAt: now, updatedAt: now }] }));
                return id;
            },
            renameFolder: (id, title) => {
                requireFolderSupport();
                if (!title.trim()) throw new Error("Folder name is required");
                set(state => ({ folders: state.folders.map(folder => folder.id === id ? { ...folder, title: title.trim(), updatedAt: new Date().toISOString() } : folder) }));
            },
            removeFolder: (id) => { requireFolderSupport(); set(state => ({
                folders: state.folders.filter(folder => folder.id !== id),
                assets: state.assets.map(asset => asset.folderId === id ? { ...asset, folderId: undefined, updatedAt: new Date().toISOString() } : asset),
            })); },
            moveAssets: (ids, folderId) => {
                requireFolderSupport();
                if (folderId && !get().folders.some(folder => folder.id === folderId)) throw new Error("Folder not found");
                const selected = new Set(ids), now = new Date().toISOString();
                set(state => ({ assets: state.assets.map(asset => selected.has(asset.id) && asset.folderId !== folderId ? { ...asset, folderId, updatedAt: now } : asset) }));
            },
            importAssets: (assets, folders = [], destination) => {
                validateAssetFolders(folders);
                if (folders.length || destination) requireFolderSupport();
                if (destination && !get().folders.some(folder => folder.id === destination)) throw new Error("Folder not found");
                const ids = new Map(folders.map(folder => [folder.id, nanoid()])), now = new Date().toISOString();
                set(state => ({
                    folders: [...state.folders, ...(destination ? [] : folders.map(folder => ({ ...folder, id: ids.get(folder.id)!, createdAt: now, updatedAt: now })))],
                    assets: [...assets.map(asset => ({ ...asset, id: nanoid(), folderId: destination || (asset.folderId ? ids.get(asset.folderId) : undefined), createdAt: now, updatedAt: now })), ...state.assets],
                }));
            },
            addAsset: (asset) => {
                const now = new Date().toISOString();
                const id = nanoid();
                set((state) => ({ assets: [{ ...asset, id, createdAt: now, updatedAt: now } as Asset, ...state.assets] }));
                return id;
            },
            updateAsset: (id, patch) =>
                set((state) => ({
                    assets: state.assets.map((asset) => (asset.id === id ? ({ ...asset, ...patch, updatedAt: new Date().toISOString() } as Asset) : asset)),
                })),
            removeAsset: (id) =>
                set((state) => {
                    const assets = state.assets.filter((asset) => asset.id !== id);
                    get().cleanupImages({ assets });
                    return { assets };
                }),
            replaceAssets: (assets) => set({ assets }),
            cleanupImages: (extra) => {
                if (isWorkbench) return; // Keep local blobs available to unsaved recovery snapshots.
                window.setTimeout(async () => {
                    const { useCanvasStore } = await import("@/stores/canvas/use-canvas-store");
                    await cleanupUnusedImages({ assets: get().assets, projects: useCanvasStore.getState().projects, extra });
                    await cleanupUnusedMedia({ assets: get().assets, projects: useCanvasStore.getState().projects, extra });
                }, 0);
            },
        }),
        {
            name: ASSET_STORE_KEY,
            skipHydration: isWorkbench,
            storage: assetStorage,
            partialize: (state) => ({ assets: state.assets, folders: state.folders }) as StorageValue<AssetStore>["state"],
            onRehydrateStorage: () => () => {
                useAssetStore.setState({ hydrated: true });
            },
        },
    ),
);
