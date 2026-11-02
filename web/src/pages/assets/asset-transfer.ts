import { resolveWorkflowImages } from "@/services/workflow-images";
import { validateWorkflow } from "@/lib/workflow-validation";
import { isWorkbench } from "@/constant/integration";
import { saveAs } from "file-saver";

import { createZip, readZip } from "@/lib/zip";
import { getMediaBlob, setMediaBlob } from "@/services/file-storage";
import { collectImageStorageKeys, getImageBlob, resolveImageUrl, setImageBlob } from "@/services/image-storage";
import type { Asset } from "@/stores/use-asset-store";

type AssetExportFile = {
    app: "infinite-canvas";
    version: 1;
    exportedAt: string;
    assets: Asset[];
    files: AssetExportItem[];
};

type AssetExportItem = {
    storageKey: string;
    path: string;
    mimeType: string;
    bytes: number;
};

export async function exportAssets(assets: Asset[], filename: string) {
    const files: AssetExportItem[] = [];
    const zipFiles: { name: string; data: BlobPart }[] = [];
    const workflowImageKeys = new Set<string>();

    await Promise.all(
        assets.map(async (asset) => {
            if (asset.videoCover?.storageKey) {
                const blob = await getImageBlob(asset.videoCover.storageKey);
                if (blob) {
                    const path = `files/${safeFileName(asset.videoCover.storageKey)}.${fileExtension(blob.type, "image")}`;
                    files.push({ storageKey: asset.videoCover.storageKey, path, mimeType: blob.type, bytes: blob.size });
                    zipFiles.push({ name: path, data: blob });
                }
            }
            if (asset.kind === "workflow") {
                for (const storageKey of collectImageStorageKeys(asset.data)) {
                    if (workflowImageKeys.has(storageKey)) continue;
                    workflowImageKeys.add(storageKey);
                    const blob = await getImageBlob(storageKey);
                    if (!blob) throw new Error("Missing workflow reference image. Re-import the original image before exporting.");
                    const path = `files/${safeFileName(storageKey)}.${fileExtension(blob.type, "image")}`;
                    files.push({ storageKey, path, mimeType: blob.type, bytes: blob.size });
                    zipFiles.push({ name: path, data: blob });
                }
            }
            if (asset.kind !== "image" && asset.kind !== "video") return;
            const storageKey = asset.data.storageKey;
            if (!storageKey) return;
            const blob = asset.kind === "image" ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
            if (!blob) return;
            const path = `files/${safeFileName(storageKey)}.${fileExtension(blob.type, asset.kind)}`;
            files.push({ storageKey, path, mimeType: blob.type || asset.data.mimeType, bytes: blob.size });
            zipFiles.push({ name: path, data: blob });
        }),
    );

    const data: AssetExportFile = { app: "infinite-canvas", version: 1, exportedAt: new Date().toISOString(), assets, files };
    const zip = await createZip([{ name: "assets.json", data: JSON.stringify(data, null, 2) }, ...zipFiles]);
    saveAs(zip, filename);
}

export async function readAssetPackage(file: File) {
    const zip = await readZip(file);
    const assetFile = zip.get("assets.json");
    if (!assetFile) throw new Error("missing assets.json");
    const data = JSON.parse(await assetFile.text()) as AssetExportFile;
    for (const asset of data.assets) if (asset.kind === "workflow") { if (!isWorkbench) throw new Error("Workflow packages require Workbench."); validateWorkflow(asset.data); }
    for (const asset of data.assets) if (asset.kind === "workflow") {
        for (const key of collectImageStorageKeys(asset.data)) {
            const file = data.files.find(item => item.storageKey === key);
            if (!file || !zip.has(file.path)) throw new Error("Workflow package is missing a reference image file.");
        }
    }
    await Promise.all(
        data.files.map(async (item) => {
            const blob = zip.get(item.path);
            if (!blob) return;
            const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
            await (item.storageKey.startsWith("image:") ? setImageBlob(item.storageKey, typedBlob) : setMediaBlob(item.storageKey, typedBlob));
        }),
    );
    return Promise.all(data.assets.map(async (asset) => asset.kind === "workflow" ? { ...asset, data: await resolveWorkflowImages(asset.data) } : asset.videoCover ? { ...asset, videoCover: { ...asset.videoCover, url: await resolveImageUrl(asset.videoCover.storageKey, asset.videoCover.url) } } : asset));
}

function safeFileName(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "_");
}

function fileExtension(mimeType: string, kind: Asset["kind"]) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    return kind === "image" ? "png" : "bin";
}
