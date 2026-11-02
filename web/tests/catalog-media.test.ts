import { expect, test } from "bun:test";
import { rawOverseasPromptCatalog } from "../src/services/api/overseas-prompt-catalog";
import { catalogMediaDependencies, mapCatalogMedia, mapWorkflowCatalogMedia, validateCatalogMediaMap, type CatalogMediaMap } from "../src/lib/catalog-media";
import manifest from "../../docs/catalog-media-manifest.json";
import { catalogWorkflow, instantiateWorkflow, workflowGenerationError } from "../src/lib/workflow";

const dependencies = catalogMediaDependencies(rawOverseasPromptCatalog);
const mapping: CatalogMediaMap = { version: 1, allowedOrigins: ["https://cdn.example.com"], media: Object.fromEntries(dependencies.map((item, i) => [item.key, { url: `https://cdn.example.com/catalog/${i}` }])) };

test("manifest covers every source media use and deduplicates original local attachments", () => {
    expect(manifest.media).toEqual(dependencies);
    expect(dependencies).toHaveLength(68);
    expect(dependencies.filter(d => d.repositoryPath)).toHaveLength(10);
    expect(new Set(dependencies.map(d => d.key)).size).toBe(dependencies.length);
});

test("mapped catalog loads only CDN media and preserves source attribution without changing originals", () => {
    validateCatalogMediaMap(rawOverseasPromptCatalog, mapping);
    const mapped = mapCatalogMedia(rawOverseasPromptCatalog, mapping);
    expect(catalogMediaDependencies(mapped).every(d => d.key.startsWith("https://cdn.example.com/"))).toBe(true);
    expect(mapped.map(e => e.sources)).toEqual(rawOverseasPromptCatalog.map(e => e.sources));
    expect(catalogMediaDependencies(rawOverseasPromptCatalog)).toEqual(dependencies);
    for (const entry of mapped) {
        const saved = JSON.parse(JSON.stringify(catalogWorkflow(entry)));
        expect(() => instantiateWorkflow(saved)).not.toThrow();
        for (const item of [...saved.references, ...saved.stages]) {
            if (item.image) { expect(item.image.url).toStartWith("https://cdn.example.com/"); expect(item.image.localPath).toBeUndefined(); }
        }
    }
});

test("incomplete or third-party mappings fail; explicit unavailable media cannot load or generate", () => {
    const incomplete = structuredClone(mapping);
    delete incomplete.media[dependencies[0].key];
    expect(() => validateCatalogMediaMap(rawOverseasPromptCatalog, incomplete)).toThrow("Missing catalog media mapping");
    incomplete.media[dependencies[0].key] = { url: "https://thirdparty.example/file.jpg" };
    expect(() => validateCatalogMediaMap(rawOverseasPromptCatalog, incomplete)).toThrow("Invalid catalog CDN URL");
    const unavailable: CatalogMediaMap = { ...mapping, media: Object.fromEntries(dependencies.map(d => [d.key, { unavailable: true, reason: "Source unavailable" }])) };
    validateCatalogMediaMap(rawOverseasPromptCatalog, unavailable);
    const mapped = mapCatalogMedia(rawOverseasPromptCatalog, unavailable);
    for (const entry of mapped) {
        for (const media of [...entry.referenceMedia, ...entry.outputMedia]) { expect(media.unavailable).toBe(true); expect(media.localPath).toBeUndefined(); expect(media.poster).toBeUndefined(); }
        expect([...entry.steps, ...(entry.referenceInputs || [])].every(item => !item.image)).toBe(true);
    }
    const meilin = mapped.find(e => e.id === "seedance:real-case-06-aimikoda")!;
    const graph = instantiateWorkflow(catalogWorkflow(meilin));
    const video = graph.nodes.find(n => n.type === "video")!;
    expect(workflowGenerationError(video, graph.nodes, video.metadata!.prompt!, graph.connections)).toContain("required");
});

test("saved snapshots resolve known URLs while preserving edits, personal uploads and unknown media", () => {
    const entry = rawOverseasPromptCatalog.find(e => e.id === "seedance:real-case-06-aimikoda")!;
    const saved = catalogWorkflow(entry, "zh");
    saved.stages[0].prompt = "用户修改的完整提示词";
    saved.stages[0].title = "自定义步骤名称";
    saved.references[0].role = "自定义参考用途";
    const image = saved.references[0].image!;
    delete image.localPath; // Old snapshots may retain only the original URL.
    saved.stages[0].image = { url: image.url, storageKey: "image:personal-upload", width: 50, height: 60 };
    saved.source.outputMedia.push({ kind: "video", url: "https://user.example/custom.mp4", caption: "个人样例" });
    const original = structuredClone(saved);
    const mapped = mapWorkflowCatalogMedia(saved, rawOverseasPromptCatalog, mapping);
    expect(saved).toEqual(original);
    expect(mapped.stages[0]).toEqual(original.stages[0]);
    expect(mapped.references[0].role).toBe("自定义参考用途");
    expect(mapped.references[0].image!.url).toStartWith("https://cdn.example.com/");
    expect(mapped.source.outputMedia.at(-1)).toEqual(original.source.outputMedia.at(-1));
    expect(mapped.source.sources).toEqual(original.source.sources);
    expect(mapped.source.steps.map(s => s.prompts)).toEqual(original.source.steps.map(s => s.prompts));
    expect(mapWorkflowCatalogMedia(mapped, rawOverseasPromptCatalog, mapping)).toEqual(mapped);
    expect(mapWorkflowCatalogMedia(saved, rawOverseasPromptCatalog, null)).toEqual(saved);
    const missing = mapWorkflowCatalogMedia(saved, rawOverseasPromptCatalog, { version: 1, allowedOrigins: [], media: {} });
    expect(missing.references[0].image).toBeUndefined();
    expect(missing.stages[0].image).toEqual(saved.stages[0].image);
    expect(missing.source.outputMedia[0].unavailable).toBe(true);
    expect(missing.source.outputMedia.at(-1)).toEqual(saved.source.outputMedia.at(-1));
});
