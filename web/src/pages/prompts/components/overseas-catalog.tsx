import { isOverseas } from "@/constant/integration";
import { catalogCover } from "../catalog-cover";
import { useWorkflowLocale } from "@/hooks/use-workflow-locale";
import { catalogTitle, catalogSummary } from "@/lib/prompt-catalog-locale";
import { useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, Empty, Input, Select, Tag } from "antd";
import { ArrowUpRight, Clapperboard, Search } from "lucide-react";
import { overseasPromptCatalog } from "@/services/api/overseas-prompt-catalog";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";
import { filterCatalog } from "../catalog-filter";
import { CatalogDetailDialog } from "./catalog-detail-dialog";

export default function OverseasCatalog({ contentKind }: { contentKind: OverseasPromptEntry["contentKind"] }) {
    const { text, language } = useWorkflowLocale();
    const [keyword, setKeyword] = useState("");
    const [category, setCategory] = useState("");
    const [source, setSource] = useState("");
    const [tag, setTag] = useState("");
    const [searchParams, setSearchParams] = useSearchParams();
    const selected = overseasPromptCatalog.find((entry) => entry.id === searchParams.get("id") && entry.contentKind === contentKind);
    const openEntry = (entry: OverseasPromptEntry) => setSearchParams((previous) => { const next = new URLSearchParams(previous); next.set("collection", entry.contentKind); next.set("id", entry.id); return next; });
    const closeEntry = () => setSearchParams((previous) => { const next = new URLSearchParams(previous); next.delete("id"); return next; });
    const entries = overseasPromptCatalog.filter((entry) => entry.contentKind === contentKind);
    const categories = [...new Set(entries.map((entry) => entry.category))];
    const tags = [...new Set(entries.flatMap((entry) => entry.tags))];
    const sources = [...new Set(entries.flatMap((entry) => entry.sources.map((item) => item.label)))];
    const items = useMemo(() => filterCatalog(overseasPromptCatalog, { contentKind, keyword, category, source, tag }), [contentKind, keyword, category, source, tag]);
    const filters = [{ label: "Category", all: "All categories", value: category, options: categories, change: setCategory }, { label: "Source", all: "All sources", value: source, options: sources, change: setSource }, { label: "Tag", all: "All tags", value: tag, options: tags, change: setTag }];
    const active = keyword.trim() || category || source || tag;
    return <main className="min-w-0 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
        <div className="mx-auto max-w-7xl">
            <div className="mb-4 border-b border-border pb-4 sm:mb-6 sm:pb-6"><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{text("Public prompt library")}</p><h1 className="text-2xl font-semibold">{contentKind === "template" ? text("Workflow templates") : text("Case studies")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{contentKind === "template" ? text("Save a complete template or edit its workflow in Canvas. Explore six categories, with original text and bilingual planning instructions.") : text("Explore published workflows, reference inputs and results. Learn from the original creator before adapting the prompts.")}</p></div>
            <Input allowClear aria-label={text("Search public catalog")} size="large" prefix={<Search className="size-4" />} placeholder={text("Search titles, prompts, models, tags or authors…")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <section aria-label={text("Filter catalog")} className="my-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">{filters.map(filter => <div key={filter.label} className="min-w-0">
                    <label htmlFor={`catalog-${filter.label}`} className="mb-1 block text-xs text-muted-foreground">{text(filter.label)}</label>
                    <Select id={`catalog-${filter.label}`} aria-label={text(filter.label)} className="w-full min-w-0" value={filter.value || undefined} placeholder={text(filter.all)} allowClear
                        showSearch={{ optionFilterProp: ["label", "value"] }} popupMatchSelectWidth={false} styles={{ popup: { root: { width: "min(360px, calc(100vw - 32px))" } } }}
                        optionRender={option => <span className="whitespace-normal break-words">{option.label}</span>}
                        options={filter.options.map(value => ({ value, label: text(value) }))} onChange={value => filter.change(value || "")} />
                </div>)}</div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p role="status" aria-live="polite" className="mr-auto text-xs text-muted-foreground">{items.length} {text(contentKind === "template" ? "Workflow templates" : "Case studies")}</p>
                    {active && <Button size="small" type="text" onClick={() => { setKeyword(""); setCategory(""); setSource(""); setTag(""); }}>{text("Clear filters")}</Button>}
                </div>
                {active && <div aria-label={text("Selected filters")} className="flex min-w-0 flex-wrap gap-2">{[{ label: "Search", value: keyword.trim(), change: setKeyword }, ...filters].filter(filter => filter.value).map(filter => <Tag key={filter.label} closable onClose={() => filter.change("")} className="!m-0 !inline-flex max-w-full items-center"><span className="min-w-0 truncate" title={`${text(filter.label)}: ${text(filter.value)}`}>{text(filter.label)}: {text(filter.value)}</span></Tag>)}</div>}
            </section>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((entry) => {
                const { url: cover, relatedCase } = catalogCover(entry, overseasPromptCatalog, isOverseas);
                return <button key={entry.id} type="button" onClick={() => openEntry(entry)} className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:bg-muted/30">
                    <CatalogCover key={cover || entry.id} url={cover} title={catalogTitle(entry, language)} unavailable={entry.outputMedia.some(media => media.unavailable)} />
                    <div className="flex flex-1 flex-col p-5">{relatedCase && <span className="mb-2 text-xs text-muted-foreground">{text("Related case illustration")}</span>}<span className="text-xs text-muted-foreground">{text(entry.category)} · {entry.contentKind === "case" ? text(entry.sourceCompleteness === "complete" ? "Full case prompts" : "Partial source · verified steps only") : text("Planning template")}</span>{entry.availabilityNote && <span className="mt-1 text-xs">{text("Source limitation · see details")}</span>}<h2 className="mt-2 text-base font-semibold">{catalogTitle(entry, language)}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{catalogSummary(entry, language)}</p><div className="my-4 flex flex-wrap gap-1">{entry.tags.map((tag) => <Tag key={tag}>{text(tag)}</Tag>)}</div><span className="mt-auto flex items-center justify-between text-xs"><span>{entry.sourceModel ? `${text("Source model")}: ${text(entry.sourceModel)}` : text("Editable workflow")}</span><ArrowUpRight className="size-4 shrink-0" /></span></div>
                </button>;
            })}</div>
            {searchParams.get("id") && !selected && <p role="status" className="my-4 text-sm text-muted-foreground">{text("This shared entry is not available in this collection.")}</p>}
            {!items.length && <Empty description={text("No matching entries. Try another category, source or search.")} className="py-12" />}
        </div>
        {selected && <CatalogDetailDialog key={selected.id} entry={selected} related={overseasPromptCatalog.filter((entry) => selected.relatedIds?.includes(entry.id))} onOpenRelated={openEntry} onClose={closeEntry} />}
    </main>;
}

function CatalogCover({ url, title, unavailable }: { url?: string; title: string; unavailable: boolean }) {
    const [failed, setFailed] = useState(false);
    const { text } = useWorkflowLocale();
    return url && !failed ? <img src={url} alt={title} loading="lazy" onError={() => setFailed(true)} className="aspect-video w-full object-cover" />
        : <div className="grid aspect-video w-full place-items-center bg-muted/30">{failed || unavailable ? <span className="text-xs text-muted-foreground">{text("Media unavailable")}</span> : <Clapperboard className="size-9 text-muted-foreground" />}</div>;
}
