import { expect, test } from "bun:test";
import { catalogTextAsset } from "@/pages/prompts/catalog-asset";
import { overseasPromptCatalog } from "@/services/api/overseas-prompt-catalog";

test("case assets preserve the selected step and language without copying external sample media", () => {
    const entry = overseasPromptCatalog.find((e) => e.id === "seedance:real-case-07-techiebysa")!;
    const before = JSON.stringify(entry);
    const asset = catalogTextAsset(entry, "video", "zh");
    expect(asset.kind).toBe("text");
    expect(asset.data.content).toBe(entry.steps[1].prompts.zh!);
    expect(asset.title).toContain("Chinese");
    expect(asset.title).toContain("Chinese translation");
    expect(asset.source).toBe("@TechieBySA");
    expect(asset.note).toContain("https://x.com/TechieBySA/status/2053523775702925768");
    expect(asset.coverUrl).toBe("");
    expect(JSON.stringify(asset)).not.toContain(entry.outputMedia[0].url);
    expect(asset.metadata?.stepId).toBe("video");
    expect(asset.metadata?.language).toBe("zh");
    expect(JSON.stringify(entry)).toBe(before);
});

test("templates and original excerpts retain their distinct intended uses", () => {
    const template = overseasPromptCatalog.find((e) => e.contentKind === "template")!;
    const asset = catalogTextAsset(template, "plan", "en");
    expect(asset.note).toContain("Planning template");
    expect(asset.tags).toContain("Workflow template");
    expect(asset.data.content).toBe(template.steps[0].prompts.en!);
    const entry = overseasPromptCatalog.find((e) => e.id === "seedance:real-case-07-techiebysa")!;
    const excerpt = catalogTextAsset(entry, "video", "original");
    expect(excerpt.title).toContain("Original case prompt");
    expect(excerpt.note).not.toContain("not a complete generation prompt");
    expect(catalogTextAsset(entry, "storyboard", "original").data.content).toBe(entry.steps[0].prompts.original!);
    expect(() => catalogTextAsset(entry, "unknown", "en")).toThrow("unavailable");
});

test("platform originals and translations never attribute prompt authorship to inspiration", () => {
    const entry = structuredClone(overseasPromptCatalog.find(e => e.contentKind === "case")!);
    const step = entry.steps[0];
    step.textKind = "platform-tested";
    step.originalLanguage = "en";
    entry.sources = [{ role: "inspiration", label: "Inspiration video", url: "https://example.com/video", author: "Video creator" }];
    expect(catalogTextAsset(entry, step.id, "en").metadata?.variant).toBe("Platform-tested original prompt");
    expect(catalogTextAsset(entry, step.id, "zh").metadata?.variant).toBe("Translation of platform-tested prompt");
    expect(catalogTextAsset(entry, step.id, "original").note).not.toContain("Original source:");
    expect(catalogTextAsset(entry, step.id, "en").source).not.toBe("Video creator");
});
