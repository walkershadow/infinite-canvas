import { Select } from "antd";
import { useTranslation } from "react-i18next";
import { useAssetStore } from "@/stores/use-asset-store";

export function AssetFolderSelect({ value, onChange, browse = false }: { value: string; onChange: (id: string) => void; browse?: boolean }) {
    const folders = useAssetStore(state => state.folders);
    const { t } = useTranslation();
    return <Select aria-label={t(browse ? "assetFolders.browse" : "assetFolders.destination")} className="min-w-40 max-w-full" value={value} onChange={onChange} showSearch={{ optionFilterProp: "label" }} options={[
        ...(browse ? [{ value: "all", label: t("assetFolders.all") }] : []),
        { value: "", label: t(browse ? "assetFolders.unfiled" : "assetFolders.root") },
        ...folders.map(folder => ({ value: folder.id, label: folder.title })),
    ]} />;
}
