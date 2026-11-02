import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Empty, Input, Pagination, Select, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { canUsePublicLibrary, listPublicLibrary } from "@/services/api/public-library";
import { workbenchSession } from "@/services/api/workbench";
import type { GalleryCategory, PublicLibraryItem } from "@/types/public-gallery";

export function PublicImagePicker({ kind, onSelect }: { kind: GalleryCategory; onSelect: (item: PublicLibraryItem) => void }) {
    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [page, setPage] = useState(1);
    const [groupId, setGroupId] = useState("");
    const allowed = canUsePublicLibrary();
    const query = useQuery({
        queryKey: ["public-library", workbenchSession().user.id, kind, search, category, page, groupId],
        queryFn: ({ signal }) => listPublicLibrary({ kind, search, category, page, groupId }, signal), enabled: allowed,
    });
    if (!allowed) return <Alert type="info" title={t("publicLibrary.disabled")} />;
    const grouped = (kind === "pose" || kind === "depth") && !groupId;
    return <div className="space-y-4">
        {groupId ? <Button type="text" onClick={() => { setGroupId(""); setPage(1); }}>{t("publicLibrary.backToActions")}</Button> : <div className="flex flex-wrap gap-2">
            <Input.Search aria-label={t("publicLibrary.search")} placeholder={t("publicLibrary.search")} allowClear className="min-w-40 flex-1" onSearch={value => { setSearch(value); setPage(1); }} />
            <Select aria-label={t("publicLibrary.category")} className="min-w-40" value={category} onChange={value => { setCategory(value); setPage(1); }} options={[{ value: "", label: t("common.all") }, ...(query.data?.facets.categories || []).map(value => ({ value, label: query.data?.facets.categoryLabels?.[value]?.[language] || query.data?.items.find(item => item.category === value)?.categoryLabel?.[language] || t("publicLibrary.category") }))]} />
        </div>}
        <p className="text-xs text-muted-foreground">{t(grouped ? "publicLibrary.chooseAction" : groupId ? "publicLibrary.chooseAngle" : "publicLibrary.chooseImage")}</p>
        {query.isError ? <Alert type="error" title={t("publicLibrary.loadFailed")} description={query.error.message} action={<Button onClick={() => void query.refetch()}>{t("publicLibrary.retry")}</Button>} /> : query.isFetching ? <div className="grid min-h-48 place-items-center"><Spin /></div> : <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{query.data?.items.map(item => <button key={item.id} type="button" className="min-w-0 rounded-lg border border-border p-2 text-left hover:bg-black/5 dark:hover:bg-white/10" onClick={() => { if (grouped) { setGroupId(item.groupId); setPage(1); } else onSelect(item); }}>
                <LibraryThumbnail item={item} />
                <span className="mt-2 block text-sm">{item.title[i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en"]}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{grouped ? t("publicLibrary.viewAngles") : item.angleLabel?.[language] || item.categoryLabel?.[language] || ""}</span>
            </button>)}</div>
            {!query.data?.items.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("publicLibrary.empty")} />}
            {!!query.data && query.data.total > query.data.pageSize && <Pagination current={page} pageSize={query.data.pageSize} total={query.data.total} onChange={setPage} showSizeChanger={false} size="small" />}
        </>}
    </div>;
}
function LibraryThumbnail({ item }: { item: PublicLibraryItem }) {
    const [failed, setFailed] = useState(false);
    const { t, i18n } = useTranslation();
    return failed ? <span className="grid aspect-[3/4] place-items-center text-xs text-muted-foreground">{t("publicLibrary.imageUnavailable")}</span> : <img src={item.thumbnailUrl} loading="lazy" decoding="async" className="aspect-[3/4] w-full object-contain" alt={item.title[i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en"]} onError={() => setFailed(true)} />;
}
