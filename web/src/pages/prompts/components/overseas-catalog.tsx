import { useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Empty, Input, Tag } from "antd";
import { ArrowUpRight, Clapperboard, Search } from "lucide-react";
import { overseasPromptCatalog } from "@/services/api/overseas-prompt-catalog";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";
import { filterCatalog } from "../catalog-filter";
import { CatalogDetailDialog } from "./catalog-detail-dialog";

export default function OverseasCatalog({ contentKind }: { contentKind: OverseasPromptEntry["contentKind"] }) {
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
    return <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
        <div className="mx-auto max-w-7xl">
            <div className="mb-6 border-b border-border pb-6"><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Public prompt library</p><h1 className="text-2xl font-semibold">{contentKind === "template" ? "Workflow templates" : "Case studies"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{contentKind === "template" ? "Plan the image first, then direct the motion. Copy one stage at a time and adapt it to your inputs." : "Explore published workflows, reference inputs and results. Learn from the original creator before adapting the prompts."}</p></div>
            <Input aria-label="Search public catalog" size="large" prefix={<Search className="size-4" />} placeholder="Search titles, prompts, models, tags or authors…" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <div className="my-5 grid gap-4 sm:grid-cols-3">{([{ label: "Category", value: category, options: categories, change: setCategory }, { label: "Source", value: source, options: sources, change: setSource }, { label: "Tag", value: tag, options: tags, change: setTag }]).map((filter) => <div key={filter.label}><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{filter.label}</p><div className="flex flex-wrap gap-1.5">{["", ...filter.options].map((option) => <Tag.CheckableTag key={option} checked={filter.value === option} onChange={() => filter.change(option)}>{option || (filter.label === "Category" ? "All categories" : `All ${filter.label.toLowerCase()}s`)}</Tag.CheckableTag>)}</div></div>)}</div>
            <p className="mb-4 text-xs text-muted-foreground">{items.length} {contentKind === "template" ? (items.length === 1 ? "template" : "templates") : (items.length === 1 ? "case" : "cases")}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((entry) => {
                const cover = entry.outputMedia.find((media) => media.kind === "image")?.url || entry.outputMedia.find((media) => media.poster)?.poster || entry.referenceMedia.find((media) => media.kind === "image")?.url;
                return <button key={entry.id} type="button" onClick={() => openEntry(entry)} className="group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:bg-muted/30">
                    {cover ? <img src={cover} alt={entry.title} loading="lazy" className="aspect-video w-full object-cover" /> : <div className="grid aspect-video w-full place-items-center bg-muted/30"><Clapperboard className="size-9 text-muted-foreground" /></div>}
                    <div className="flex flex-1 flex-col p-5"><span className="text-xs text-muted-foreground">{entry.category} · {entry.steps.length} {entry.steps.length === 1 ? "step" : "steps"}</span><h2 className="mt-2 text-base font-semibold">{entry.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{entry.summary}</p><div className="my-4 flex flex-wrap gap-1">{entry.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div><span className="mt-auto flex items-center justify-between text-xs"><span>{entry.sourceModel ? `Source model: ${entry.sourceModel}` : "Step-by-step workflow"}</span><ArrowUpRight className="size-4 shrink-0" /></span></div>
                </button>;
            })}</div>
            {searchParams.get("id") && !selected && <p role="status" className="my-4 text-sm text-muted-foreground">This shared entry is not available in this collection.</p>}
            {!items.length && <Empty description="No matching entries. Try another category, source or search." className="py-12" />}
        </div>
        {selected && <CatalogDetailDialog key={selected.id} entry={selected} related={overseasPromptCatalog.filter((entry) => selected.relatedIds?.includes(entry.id))} onOpenRelated={openEntry} onClose={closeEntry} />}
    </main>;
}
