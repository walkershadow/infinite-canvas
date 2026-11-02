import type { TextAsset } from "@/stores/use-asset-store";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";

export type CatalogLanguage = "en" | "zh" | "original";

export function catalogTextAsset(entry: OverseasPromptEntry, stepId: string, language: CatalogLanguage): Omit<TextAsset, "id" | "createdAt" | "updatedAt"> {
    const step = entry.steps.find((item) => item.id === stepId);
    const content = step?.prompts[language];
    if (!step || !content?.trim()) throw new Error("This prompt version is unavailable.");
    const variant = step.textKind === "licensed-case" ? (language === "zh" ? "Chinese translation" : "Original case prompt") : step.textKind === "source-excerpt" ? "Original excerpt" : language === "original" ? (step.originalKind === "excerpt" ? "Original excerpt" : "Licensed template") : (step.textKind === "adaptation" ? "Adapted example" : "Licensed template");
    const languageLabel = { en: "English", zh: "Chinese", original: "Original" }[language];
    const original = entry.sources.find((source) => source.role === "original");
    return {
        kind: "text", title: `${entry.title} · ${step.title} · ${languageLabel} · ${variant}`,
        coverUrl: "", tags: [...new Set([...entry.tags, entry.contentKind === "template" ? "Workflow template" : "Case study", languageLabel])],
        source: original?.author || original?.label || entry.title,
        note: `${variant}. ${entry.contentKind === "template" ? "Planning template: use with a text assistant to write the image and video prompts first." : "Use this step with your own inputs and model settings."}${step.originalKind === "excerpt" && (language === "original" || step.textKind === "source-excerpt") ? " This is a short excerpt, not a complete generation prompt." : ""}${original ? ` Original source: ${original.url}` : ""}`,
        data: { content },
        metadata: { source: "overseas-prompt-catalog", catalogId: entry.id, stepId: step.id, language, contentKind: entry.contentKind, variant, sourceModel: entry.sourceModel, sources: entry.sources },
    };
}
