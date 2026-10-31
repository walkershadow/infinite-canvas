import { createImageThumbnail } from "@/lib/image-thumbnail";
import { captureVideoFrame } from "@/lib/canvas/canvas-video-frame";
import { resolveMediaUrl } from "@/services/file-storage";
import { uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";

let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<string, Promise<void>>();

export function ensureAssetVideoCover(id: string) {
    const existing = pending.get(id);
    if (existing) return existing;
    const run = queue.then(async () => {
        const asset = useAssetStore.getState().assets.find((item) => item.id === id);
        if (!asset || asset.kind !== "video" || asset.coverUrl || asset.videoCover?.url) return;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error("Video cover reading timed out after 30 seconds.")), 30_000);
        let frame: Blob;
        try {
            const source = await resolveMediaUrl(asset.data.storageKey, asset.data.url, controller.signal);
            frame = await captureVideoFrame(source, "first", 0, controller.signal);
        }
        finally { clearTimeout(timer); }
        const image = await uploadImage(await createImageThumbnail(frame) || frame);
        const current = useAssetStore.getState().assets.find((item) => item.id === id);
        if (current?.kind !== "video" || current.data.url !== asset.data.url || current.coverUrl || current.videoCover?.url) return;
        useAssetStore.getState().updateAsset(id, { videoCover: { url: image.url, storageKey: image.storageKey } });
    }).finally(() => pending.delete(id));
    pending.set(id, run);
    queue = run.catch(() => undefined);
    return run;
}
