import type { Asset, AssetFolder } from "@/stores/use-asset-store";

export function assetInFolder(asset: Asset, selected: string, folders: AssetFolder[]) {
    const folderId = folders.some(folder => folder.id === asset.folderId) ? asset.folderId : "";
    return selected === "all" || folderId === selected;
}

export function validateAssetFolders(value: unknown): asserts value is AssetFolder[] {
    if (!Array.isArray(value) || value.some(folder => !folder || typeof folder.id !== "string" || !folder.id || folder.kind !== "folder" || typeof folder.title !== "string" || !folder.title.trim() || typeof folder.createdAt !== "string" || typeof folder.updatedAt !== "string" || !folder.data || typeof folder.data !== "object" || Array.isArray(folder.data) || Object.keys(folder.data).length !== 0 || folder.parentId !== undefined || folder.folderId !== undefined) || new Set(value.map(folder => folder.id)).size !== value.length) throw new Error("Invalid asset folders");
}
