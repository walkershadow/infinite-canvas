import { Button, Dropdown } from "antd";
import { FolderOpen, MoreHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAssetStore, type AssetFolder } from "@/stores/use-asset-store";

export function FolderGrid({ onOpen, onRename, onDelete }: { onOpen: (id: string) => void; onRename: (folder: AssetFolder) => void; onDelete: (folder: AssetFolder) => void }) {
    const { t } = useTranslation();
    const folders = useAssetStore(state => state.folders);
    const assets = useAssetStore(state => state.assets);
    const contents = useMemo(() => {
        const result = new Map<string, { count: number; preview: string[] }>();
        for (const asset of assets) {
            if (!asset.folderId) continue;
            const entry = result.get(asset.folderId) || { count: 0, preview: [] };
            entry.count++;
            if (entry.preview.length < 3) entry.preview.push(asset.title);
            result.set(asset.folderId, entry);
        }
        return result;
    }, [assets]);
    return <section aria-label={t("assetFolders.folders")} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {folders.map(folder => <article key={folder.id} className="group relative min-w-0 rounded-2xl border border-border bg-background transition-colors hover:border-current">
            <button type="button" aria-label={t("assetFolders.open", { title: folder.title })} onClick={() => onOpen(folder.id)} className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-4 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5">
                <FolderOpen aria-hidden className="size-8 text-muted-foreground" strokeWidth={1.25} />
                <div className="w-full min-w-0"><h3 className="truncate font-medium">{folder.title}</h3><p className="mt-1 text-xs text-muted-foreground">{t("assetFolders.count", { count: contents.get(folder.id)?.count || 0 })}</p></div>
                <p className="w-full truncate text-xs text-muted-foreground">{contents.get(folder.id)?.preview.join(" · ") || "—"}</p>
            </button>
            <Dropdown trigger={["click"]} menu={{ items: [{ key: "rename", label: t("assetFolders.rename"), onClick: () => onRename(folder) }, { key: "delete", label: t("assetFolders.delete"), danger: true, onClick: () => onDelete(folder) }] }}>
                <Button type="text" className="!absolute right-2 top-2" aria-label={t("assetFolders.more", { title: folder.title })} icon={<MoreHorizontal className="size-4" />} />
            </Dropdown>
        </article>)}
    </section>;
}
