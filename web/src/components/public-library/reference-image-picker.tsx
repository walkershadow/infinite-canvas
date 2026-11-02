import { useRef, useState } from "react";
import { App, Button, Modal, Spin, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { PublicImagePicker } from "./public-image-picker";
import { MyAssetsTab } from "@/components/canvas/asset-picker-modal";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { readImageMeta } from "@/lib/image-utils";
import { canUsePublicLibrary } from "@/services/api/public-library";
import type { WorkflowImage } from "@/types/workflow";
import type { GalleryCategory } from "@/types/public-gallery";

export function ReferenceImagePicker({ kind, onSelect, onClose }: { kind: GalleryCategory; onSelect: (image: WorkflowImage) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const choose = async (load: () => Promise<WorkflowImage>) => {
        setBusy(true);
        try { onSelect(await load()); onClose(); }
        catch (error) { void message.error(error instanceof Error ? error.message : t("publicLibrary.loadFailed")); }
        finally { setBusy(false); }
    };
    return <Modal open title={`${t("publicLibrary.replaceReference")} · ${t(`publicLibrary.${kind}`)}`} onCancel={onClose} footer={null} width={900} styles={{ body: { maxHeight: "70dvh", overflowY: "auto" } }}>
        <p className="mb-4 text-sm text-muted-foreground">{t("publicLibrary.keepEdits")}</p>
        <Spin spinning={busy}><Tabs defaultActiveKey={canUsePublicLibrary() ? "public" : "assets"} items={[
            { key: "public", label: t("publicLibrary.title"), children: <PublicImagePicker kind={kind} onSelect={item => { onSelect({ url: item.url, width: item.width, height: item.height }); onClose(); }} /> },
            { key: "assets", label: t("publicLibrary.myAssets"), children: <MyAssetsTab imageOnly onInsert={payload => { if (payload.kind !== "image") return; void choose(async () => { const url = await resolveImageUrl(payload.storageKey, payload.dataUrl); const meta = payload.width && payload.height ? { width: payload.width, height: payload.height } : await readImageMeta(url); if (!meta) throw new Error(t("publicLibrary.imageUnavailable")); return { url, storageKey: payload.storageKey, width: meta.width, height: meta.height }; }); }} /> },
            { key: "upload", label: t("publicLibrary.upload"), children: <div className="py-10 text-center"><Button disabled={busy} onClick={() => input.current?.click()}>{t("publicLibrary.upload")}</Button><input ref={input} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void choose(() => uploadImage(file)); }} /></div> },
        ]} /></Spin>
    </Modal>;
}
