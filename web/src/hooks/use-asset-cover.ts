import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { assetCoverUrl, type Asset } from "@/stores/use-asset-store";
import { getImagePreviewRevision, subscribeImagePreviews } from "@/services/image-storage";
import { ensureAssetVideoCover } from "@/services/asset-video-cover";

export function useAssetCover(asset: Asset) {
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const ref = useRef<HTMLButtonElement>(null);
    const [failed, setFailed] = useState(false);
    const cover = assetCoverUrl(asset);
    useEffect(() => {
        if (asset.kind !== "video" || cover || !ref.current) return;
        let mounted = true;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            void ensureAssetVideoCover(asset.id).catch(() => { if (mounted) setFailed(true); });
        });
        observer.observe(ref.current);
        return () => { mounted = false; observer.disconnect(); };
    }, [asset.id, asset.kind, cover]);
    return { ref, cover, failed };
}
