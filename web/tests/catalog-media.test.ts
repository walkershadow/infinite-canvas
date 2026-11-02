import { expect, test } from "bun:test";
import { rawOverseasPromptCatalog } from "../src/services/api/overseas-prompt-catalog";
import { catalogMediaDependencies, mapCatalogMedia, validateCatalogMediaMap, type CatalogMediaMap } from "../src/lib/catalog-media";
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
