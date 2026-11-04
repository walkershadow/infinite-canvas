import { isWorkbench } from "@/constant/integration";
import { initializeCloudLibrary } from "@/services/workbench/library";
import { App } from "antd";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AssetFolderSelect } from "@/components/assets/asset-folder-select";
import { useAssetFoldersEnabled } from "@/hooks/use-asset-folders-enabled";
import { useAssetStore } from "@/stores/use-asset-store";

function Destination({ onChange }: { onChange: (id: string) => void }) {
    const [value, setValue] = useState("");
    const enabled = useAssetFoldersEnabled();
    const { t } = useTranslation();
    return <div className="py-3">{enabled ? <AssetFolderSelect value={value} onChange={id => { setValue(id); onChange(id); }} /> : t("assetFolders.root")}</div>;
}

export function useAssetDestination() {
    const { modal, message } = App.useApp();
    const { t } = useTranslation();
    return useCallback(async () => {
        try { if (isWorkbench) await initializeCloudLibrary(); }
        catch { message.error(t("assetFolders.loadFailed")); return null; }
        return new Promise<string | null>(resolve => {
            let folderId = "";
            modal.confirm({
                title: t("assetFolders.saveTo"), icon: null,
                content: <Destination onChange={id => { folderId = id; }} />,
                okText: t("common.save"), cancelText: t("common.cancel"),
                onOk: () => {
                    if (folderId && !useAssetStore.getState().folders.some(folder => folder.id === folderId)) {
                        message.error(t("assetFolders.missing"));
                        return Promise.reject(new Error("Folder no longer exists"));
                    }
                    resolve(folderId);
                },
                onCancel: () => { resolve(null); },
            });
        });
    }, [modal, message, t]);
}
