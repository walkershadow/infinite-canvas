import { useState } from "react";
import { Button, Modal, Tag, Tabs } from "antd";
import { Copy, ExternalLink, Play } from "lucide-react";
import { useCopyText } from "@/hooks/use-copy-text";
import type { CatalogMedia, OverseasPromptEntry } from "@/types/prompt-catalog";

export function CatalogDetailDialog({ entry, related, onOpenRelated, onClose }: { entry: OverseasPromptEntry; related: OverseasPromptEntry[]; onOpenRelated: (entry: OverseasPromptEntry) => void; onClose: () => void }) {
    const copyText = useCopyText();
    const original = entry.sources.find((source) => source.role === "original");

    return <Modal title={entry.title} open onCancel={onClose} footer={null} width={960} centered styles={{ body: { maxHeight: "75dvh", overflowY: "auto" } }}>
        <div className="space-y-7 py-2">
            <div>
                <div className="mb-3 flex flex-wrap gap-2"><Tag>{entry.contentKind === "template" ? "Workflow template" : "Case study"}</Tag><Tag>{entry.category}</Tag></div>
                <p className="text-sm leading-6">{entry.summary}</p>
                {original && <a href={original.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm underline underline-offset-4">View original source <ExternalLink className="size-4" /></a>}
                <Button className="mt-3" size="small" type="text" icon={<Copy className="size-3.5" />} onClick={() => copyText(window.location.href, "Detail link copied")}>Copy detail link</Button>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{entry.contentKind === "template" ? "Work through each stage separately. This is a workflow, not a ready-to-run video prompt." : "Study the original workflow and adapt each step to your own inputs."} Copying does not start generation or spend points.</p>
                {entry.sourceModel && <p className="mt-2 text-xs text-muted-foreground">Source model: <strong>{entry.sourceModel}</strong>. This is the original creator’s model, not a selected Workbench model.</p>}

            </div>
            {entry.contentKind === "case" && <p className="rounded-lg border border-border p-3 text-xs leading-6 text-muted-foreground">External example · Not tested on this platform. Steps below are adapted practice prompts; they did not produce this external sample.</p>}
            {entry.outputMedia.length > 0 && <MediaSection title="Output results" items={entry.outputMedia} />}
            {entry.referenceMedia.length > 0 && <MediaSection title="Reference media" items={entry.referenceMedia} />}
            <section className="space-y-5" aria-label="Workflow steps">
                <h3 className="text-base font-semibold">Step-by-step prompts</h3>
                {entry.steps.map((step, index) => <PromptStep key={step.id} step={step} index={index} sources={entry.sources} />)}
            </section>
            {related.length > 0 && <section aria-label="Related templates and cases"><h3 className="mb-3 text-base font-semibold">Related templates & cases</h3><div className="flex flex-wrap gap-2">{related.map((item) => <Button key={item.id} onClick={() => onOpenRelated(item)}>{item.contentKind === "case" ? "Case" : "Template"}: {item.title}</Button>)}</div></section>}
            {entry.notes?.length ? <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm">Source details & usage notes</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">{entry.notes.map((note) => <li key={note}>{note}</li>)}</ul></details> : null}
            <section aria-label="Sources" className="border-t border-border pt-5">
                <h3 className="mb-3 text-base font-semibold">Sources & attribution</h3>
                <p className="mb-3 text-xs text-muted-foreground">Original authors are listed first. Curated collections are credited separately. Links open in a new tab and keep this detail open.</p>
                {[...entry.sources.filter((source) => source.role === "original"), ...entry.sources.filter((source) => source.role === "curation")].map((source) => <a key={`${source.role}:${source.url}`} href={source.url} target="_blank" rel="noopener noreferrer" className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/40">
                    <span><span className="block text-xs text-muted-foreground">{source.role === "original" ? entry.contentKind === "case" ? "Original post (listed by curator)" : "Original source" : "Curated collection"}{source.author ? ` · ${source.author}` : ""}</span><span className="mt-1 block break-words">{source.label}{source.license ? ` · ${source.license}` : ""}</span></span><ExternalLink className="mt-1 size-4 shrink-0" />
                </a>)}
            </section>
        </div>
    </Modal>;
}

function MediaSection({ title, items }: { title: string; items: CatalogMedia[] }) {
    return <section aria-label={title}><h3 className="mb-3 text-base font-semibold">{title}</h3>{items.length ? <div className="grid gap-4 sm:grid-cols-2">{items.map((media, index) => <CatalogMediaPreview key={`${index}:${media.url}`} media={media} />)}</div> : <p className="text-sm text-muted-foreground">No media supplied for this section.</p>}</section>;
}

function CatalogMediaPreview({ media }: { media: CatalogMedia }) {
    const [playing, setPlaying] = useState(false);
    const [failed, setFailed] = useState(false);
    return <figure className="min-w-0 overflow-hidden rounded-xl border border-border">
        {failed ? <p className="p-5 text-sm text-muted-foreground">Media unavailable. Open the original source below to view the example.</p> : media.kind === "image" ? <img onError={() => setFailed(true)} src={media.url} alt={media.caption} loading="lazy" className="max-h-96 w-full object-contain" /> : playing ? <video onError={() => setFailed(true)} src={media.url} poster={media.poster} controls playsInline preload="none" className="max-h-96 w-full" aria-label={media.caption} /> : <button type="button" onClick={() => setPlaying(true)} className="relative grid aspect-video w-full cursor-pointer place-items-center bg-muted/40" aria-label={`Load video: ${media.caption}`}>
            {media.poster && <img src={media.poster} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" />}<span className="relative flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-sm"><Play className="size-4" />Load video</span>
        </button>}
        <figcaption className="p-3 text-xs leading-5 text-muted-foreground">{media.caption}</figcaption>
    </figure>;
}

function PromptStep({ step, index, sources }: { step: OverseasPromptEntry["steps"][number]; index: number; sources: OverseasPromptEntry["sources"] }) {
    const copyText = useCopyText();
    return <article className="rounded-xl border border-border p-4 sm:p-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Step {index + 1}</div>
        <h4 className="text-base font-semibold">{step.title}</h4>
        <p className="my-3 text-sm leading-6 text-muted-foreground">{step.instruction}</p>
        <Tabs items={(["en", "zh", "original"] as const).filter((language) => step.prompts[language]?.trim()).map((language) => {
            const label = language === "en" ? "English" : language === "zh" ? "Chinese" : "Original";
            const kindLabel = language === "original" ? step.originalKind === "full" ? "Licensed template" : "Original excerpt" : step.textKind === "licensed-template" ? "Licensed template" : "Adapted example";
            return { key: language, label, children: <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium">{kindLabel}{language === "original" && step.originalLanguage ? ` · ${step.originalLanguage}` : ""}</span><Button size="small" type="text" icon={<Copy className="size-3.5" />} aria-label={`Copy step ${index + 1} ${label} ${kindLabel}`} onClick={() => copyText(step.prompts[language]!, `${kindLabel} copied`)}>Copy {label} · {kindLabel}</Button></div>
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 font-mono text-xs leading-6" lang={language === "original" ? undefined : language}>{step.prompts[language]}</pre>
                {language === "original" && <div className="mt-3 space-y-3">{step.originalZh && <div><span className="text-xs text-muted-foreground">Chinese translation of original {step.originalKind === "full" ? "template" : "excerpt"}</span><p lang="zh" className="mt-2 whitespace-pre-wrap text-sm leading-6">{step.originalZh}</p><Button type="text" size="small" onClick={() => copyText(step.originalZh!, "Original translation copied")}>Copy original translation</Button></div>}{sources.filter((source) => source.role === "original").map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-sm underline underline-offset-4">Read original: {source.label} ↗</a>)}</div>}
            </div> };
        })} />
    </article>;
}
