import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, App, Button, Empty, Modal, Spin, Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { canUsePublicLibrary, listPublicWorkflows, openPublicWorkflow } from "@/services/api/public-library";
import { workbenchSession } from "@/services/api/workbench";
import { PublicImagePicker } from "@/components/public-library/public-image-picker";
import { WorkflowActions } from "@/components/prompts/workflow-editor";
import { catalogSummary, catalogTitle } from "@/lib/prompt-catalog-locale";
import type { PublicLibraryItem } from "@/types/public-gallery";
import type { WorkflowDocument } from "@/types/workflow";

export default function PublicLibrary() {
    const { t, i18n } = useTranslation();
    const { message } = App.useApp();
    const language = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
    const [document, setDocument] = useState<WorkflowDocument | null>(null);
    const [preview, setPreview] = useState<PublicLibraryItem | null>(null);
    const [opening, setOpening] = useState("");
    const allowed = canUsePublicLibrary();
    const query = useQuery({ queryKey: ["public-workflows", workbenchSession().user.id, language], queryFn: ({ signal }) => listPublicWorkflows(language, signal), enabled: allowed });
    if (!allowed) return <div className="p-6"><Alert type="info" title={t("publicLibrary.disabled")} /></div>;
    const open = async (id: string) => {
        setOpening(id);
        try { setDocument(await openPublicWorkflow(id, language)); }
        catch (error) { void message.error(error instanceof Error ? error.message : t("publicLibrary.loadFailed")); }
        finally { setOpening(""); }
    };
    return <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-6">
        <header><h1 className="text-2xl font-semibold">{t("publicLibrary.title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("publicLibrary.intro")}</p></header>
        <Tabs items={[
            { key: "workflows", label: t("publicLibrary.workflows"), children: <div className="space-y-4">
                {query.isPending ? <Spin /> : query.isError ? <Alert type="error" title={t("publicLibrary.loadFailed")} description={query.error.message} action={<Button onClick={() => void query.refetch()}>{t("publicLibrary.retry")}</Button>} /> : <>
                    <div className="grid gap-4 md:grid-cols-2">{query.data?.map(item => <article key={item.source.id} className="rounded-xl border border-border p-5">
                        <p className="text-xs text-muted-foreground">{t(item.source.contentKind === "case" ? "publicLibrary.case" : "publicLibrary.template")}</p>
                        <h2 className="mt-2 text-lg font-medium">{catalogTitle(item.source, language)}</h2>
                        <p className="my-3 text-sm text-muted-foreground">{catalogSummary(item.source, language)}</p>
                        <div className="grid grid-cols-3 gap-2">{item.references.map(ref => <figure key={ref.id}>{ref.image && <img src={ref.image.url} alt={ref.title} loading="lazy" className="aspect-[3/4] w-full object-contain" />}<figcaption className="mt-1 text-xs">{ref.galleryCategory ? t(`publicLibrary.${ref.galleryCategory}`) : ref.title}</figcaption></figure>)}</div>
                        <Button className="mt-4" disabled={!!opening} loading={opening === item.source.id} onClick={() => void open(item.source.id)}>{t("publicLibrary.openWorkflow")}</Button>
                    </article>)}</div>
                    {!query.data?.length && <Empty description={t("publicLibrary.unpublished")} />}
                    {!query.data?.some(item => item.source.contentKind === "case") && <p role="status" className="text-sm text-muted-foreground">{t("publicLibrary.caseUnpublished")}</p>}
                </>}
            </div> },
            ...(["face", "outfit", "pose"] as const).map(kind => ({ key: kind, label: t(`publicLibrary.${kind}`), children: <PublicImagePicker kind={kind} onSelect={setPreview} /> })),
        ]} />
    </div>
        {preview && <Modal open footer={null} onCancel={() => setPreview(null)} title={preview.title[language]}><img src={preview.url} alt={preview.title[language]} className="max-h-[60dvh] w-full object-contain" /><p className="mt-3 text-sm">{t("publicLibrary.pickInWorkflow")}</p><a className="mt-2 block text-xs underline" href={preview.source.url} target="_blank" rel="noopener noreferrer">{t("publicLibrary.source")}: {preview.source.label}{preview.source.author ? ` · ${preview.source.author}` : ""}</a></Modal>}
        {document && <Modal open onCancel={() => setDocument(null)} footer={null} width={960} title={catalogTitle(document.source, language)} styles={{ body: { maxHeight: "75dvh", overflowY: "auto" } }}>
            <p className="text-sm text-muted-foreground">{catalogSummary(document.source, language)}</p>
            <WorkflowActions document={document} />
            <p className="mb-3 text-xs text-muted-foreground">{t("publicLibrary.order")}</p>
            <div className="grid grid-cols-3 gap-3">{(document.stages[0]?.inputOrder || document.references.map(ref => ref.id)).map((id, index) => { const ref = document.references.find(item => item.id === id); return ref && <figure key={id}>{ref.image && <img src={ref.image.url} alt={ref.title} className="max-h-56 w-full object-contain" />}<figcaption className="mt-2 text-sm">{index + 1}. {ref.title}</figcaption></figure>; })}</div>
            {document.stages.map(stage => <section key={stage.id} className="mt-5"><h3 className="font-medium">{stage.title}</h3><pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{stage.prompt}</pre></section>)}
            {document.source.outputMedia.length > 0 && <section className="mt-5"><h3 className="mb-3 font-medium">{t("publicLibrary.actualResults")}</h3><div className="grid grid-cols-3 gap-3">{document.source.outputMedia.map(media => <figure key={media.url}><img loading="lazy" src={media.url} alt={language === "zh" ? media.captionZh || media.caption : media.caption} className="w-full object-contain" /><figcaption className="mt-1 text-xs">{language === "zh" ? media.captionZh || media.caption : media.caption}</figcaption></figure>)}</div></section>}
            {(language === "zh" ? document.source.notesZh || document.source.notes : document.source.notes)?.map(note => <p className="mt-3 text-xs text-muted-foreground" key={note}>{note}</p>)}
        </Modal>}
    </main>;
}
