import type { Plugin } from "vite";
import { catalogForAppMode } from "../src/services/api/overseas-prompt-catalog";
import { mapCatalogMedia, type CatalogMediaMap } from "../src/lib/catalog-media";
import { catalogText } from "../src/lib/prompt-catalog-locale";

export function caseStudies(mapping: CatalogMediaMap) {
    return mapCatalogMedia(catalogForAppMode("overseas"), mapping).filter(entry => entry.contentKind === "case").map(entry => ({
        id: entry.id,
        title: { en: entry.title, zh: entry.titleZh || catalogText(entry.title, "zh") },
        summary: { en: entry.summary, zh: entry.summaryZh || catalogText(entry.summary, "zh") },
        category: { en: entry.category, zh: catalogText(entry.category, "zh") },
        tags: [...entry.tags],
        poster: entry.outputMedia.find(media => !media.unavailable && media.poster)?.poster || null,
        detailUrl: `/canvas/prompts?collection=case&id=${encodeURIComponent(entry.id)}`,
    }));
}
export function caseStudiesExport(mapping: CatalogMediaMap): Plugin {
    return { name: "case-studies-export", apply: "build", generateBundle() {
        this.emitFile({ type: "asset", fileName: "case-studies.json", source: JSON.stringify(caseStudies(mapping)) });
    } };
}
