import { catalogText } from "@/lib/prompt-catalog-locale";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";

export function filterCatalog(entries: OverseasPromptEntry[], { contentKind, keyword, category, source, tag }: { contentKind: OverseasPromptEntry["contentKind"]; keyword: string; category: string; source: string; tag?: string }) {
    const terms = keyword.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
        if ((tag && !entry.tags.includes(tag)) || entry.contentKind !== contentKind || (category && entry.category !== category) || (source && !entry.sources.some((item) => item.label === source))) return false;
        const text = [entry.title, entry.titleZh, entry.summary, entry.summaryZh, entry.category, catalogText(entry.category, "zh"), ...entry.tags.map(tag => catalogText(tag, "zh")), entry.sourceModel, ...entry.tags, ...(entry.notes || []), ...entry.sources.flatMap((item) => [item.label, item.author]), ...entry.steps.flatMap((step) => [step.title, step.instruction, step.originalZh, ...Object.values(step.prompts)])].join(" ").toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
    });
}
