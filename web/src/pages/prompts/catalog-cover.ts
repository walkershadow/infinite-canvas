import type { OverseasPromptEntry } from "@/types/prompt-catalog";

const ownCover = (entry: OverseasPromptEntry) => entry.outputMedia.find(media => !media.unavailable && media.kind === "image")?.url
    || entry.outputMedia.find(media => !media.unavailable && media.poster)?.poster
    || entry.referenceMedia.find(media => !media.unavailable && media.kind === "image")?.url;

export function catalogCover(entry: OverseasPromptEntry, catalog: OverseasPromptEntry[], overseas: boolean) {
    const related = overseas && entry.contentKind === "template" ? entry.relatedIds?.map(id => catalog.find(item => item.id === id && item.contentKind === "case")).find(item => item && ownCover(item)) : undefined;
    return { url: related ? ownCover(related) : ownCover(entry), relatedCase: related?.id };
}
