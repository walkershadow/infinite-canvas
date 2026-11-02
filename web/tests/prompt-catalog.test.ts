import { expect, test } from "bun:test";
import { filterCatalog } from "@/pages/prompts/catalog-filter";
import { overseasPromptCatalog } from "@/services/api/overseas-prompt-catalog";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";

const entry: OverseasPromptEntry = { id: "grid", contentKind: "template", title: "Storyboard grid", titleZh: "分镜网格", summary: "Plan a sequence", summaryZh: "先设计镜头，再制作视频", category: "Storyboarding", tags: ["continuity"], sourceModel: "Source-only model", sources: [{ role: "original", label: "Creator", author: "Example Author", url: "https://example.com/original" }, { role: "curation", label: "GoodCase", url: "https://example.com/collection" }], steps: [{ id: "plan", title: "Plan", instruction: "Draft the grid", prompts: { en: "Maintain the same wardrobe", zh: "保持服装一致", original: "short excerpt" }, originalKind: "excerpt", textKind: "adaptation", originalZh: "短摘录" }], referenceMedia: [], outputMedia: [] };
const caseEntry = { ...entry, id: "case", contentKind: "case" as const };
const filter = (options: Partial<Parameters<typeof filterCatalog>[1]>) => filterCatalog([entry, caseEntry], { contentKind: "case", keyword: "", category: "", source: "", ...options });

test("cases are independently searchable across bilingual titles, prompts, source models and author names", () => {
    for (const keyword of ["分镜网格", "制作视频", "wardrobe", "保持服装", "短摘录", "source-only", "example author"]) expect(filter({ keyword }).map((item) => item.id)).toEqual(["case"]);
    expect(filter({ contentKind: "template", keyword: "storyboard wardrobe" }).map((item) => item.id)).toEqual(["grid"]);
    expect(filter({ keyword: "missing" })).toEqual([]);
});

test("category and source filters are separate and do not mutate catalog entries", () => {
    const before = JSON.stringify(entry);
    expect(filter({ category: "Storyboarding", source: "GoodCase", tag: "continuity" })).toHaveLength(1);
    expect(filter({ tag: "missing" })).toHaveLength(0);
    expect(filter({ keyword: "wardrobe", tag: "continuity" })).toHaveLength(1);
    expect(filter({ category: "GoodCase" })).toHaveLength(0);
    expect(filter({ source: "Storyboarding" })).toHaveLength(0);
    expect(JSON.stringify(entry)).toBe(before);
});

test("public catalog has valid related entries, explicit excerpt/adaptation labels and original attribution", () => {
    const ids = new Set(overseasPromptCatalog.map((item) => item.id));
    expect(ids.size).toBe(overseasPromptCatalog.length);
    for (const item of overseasPromptCatalog) {
        expect(item.steps.length).toBeGreaterThan(0);
        expect(item.sources.some((source) => source.role === "original")).toBe(true);
        for (const id of item.relatedIds || []) expect(ids.has(id)).toBe(true);
        for (const source of item.sources) {
            expect(new URL(source.url).protocol).toBe("https:");
            if (source.url.includes("goodcase.ai")) expect(source.role).toBe("curation");
        }
        for (const step of item.steps) {
            if (step.prompts.original) expect(step.originalKind).toBeDefined();
            if (step.prompts.en || step.prompts.zh) expect(step.textKind).toBeDefined();
            if (item.contentKind === "case") {
                expect(step.textKind).toBe("licensed-case");
                expect(step.prompts[step.originalLanguage === "zh" ? "zh" : "en"]).toBe(step.prompts.original);
                expect(step.prompts.zh?.trim()).toBeTruthy();
                if (step.prompts.original) expect(step.originalKind).toBe("full");
            }
        }
    }
});
