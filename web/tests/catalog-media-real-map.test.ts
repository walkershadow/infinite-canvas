import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import config from "../vite.config";
import { rawOverseasPromptCatalog } from "../src/services/api/overseas-prompt-catalog";
import { catalogMediaDependencies, mapWorkflowCatalogMedia, validateCatalogMediaMap, type CatalogMediaMap } from "../src/lib/catalog-media";
import { catalogWorkflow, instantiateWorkflow } from "../src/lib/workflow";

const mapPath = process.env.CATALOG_MEDIA_MAP_FILE;
test.skipIf(!mapPath)("real CDN map covers catalog, saved workflows and isolated build configurations without building", async () => {
    const mapping = JSON.parse(readFileSync(mapPath!, "utf8")) as CatalogMediaMap & { media: Record<string, { url: string; sha256: string; bytes: number; mime: string }> };
    validateCatalogMediaMap(rawOverseasPromptCatalog, mapping);
    const dependencies = catalogMediaDependencies(rawOverseasPromptCatalog);
    expect(Object.keys(mapping.media).sort()).toEqual(dependencies.map(d => d.key).sort());
    for (const dependency of dependencies) {
        const target = mapping.media[dependency.key];
        expect(target.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(target.bytes).toBeGreaterThan(0);
        expect(target.mime).toStartWith(`${dependency.kind}/`);
        if (dependency.repositoryPath) {
            const file = readFileSync(resolve(import.meta.dir, "../..", dependency.repositoryPath));
            expect(createHash("sha256").update(file).digest("hex")).toBe(target.sha256);
            expect(file.byteLength).toBe(target.bytes);
        }
    }
    for (const entry of rawOverseasPromptCatalog) {
        const document = catalogWorkflow(entry);
        document.stages[0].prompt += "\nUser edit";
        const resolved = mapWorkflowCatalogMedia(document, rawOverseasPromptCatalog, mapping);
        expect(resolved.stages[0].prompt).toBe(document.stages[0].prompt);
        expect(catalogMediaDependencies([resolved.source]).every(d => mapping.allowedOrigins.includes(new URL(d.key).origin))).toBe(true);
        for (const node of instantiateWorkflow(resolved).nodes) {
            if (node.type === "image" && node.metadata?.content) expect(mapping.allowedOrigins).toContain(new URL(node.metadata.content).origin);
        }
    }
    const previousMode = process.env.VITE_APP_MODE;
    try {
        // Resolve configuration only; do not invoke Vite build or write dist.
        const resolveConfig = config as (env: { mode: string; command: "build" }) => any;
        process.env.VITE_APP_MODE = "overseas";
        const overseas = await resolveConfig({ mode: "production", command: "build" });
        expect(overseas.build.copyPublicDir).toBe(false);
        expect(JSON.parse(overseas.define.__CATALOG_MEDIA_MAP__)).toEqual(mapping);
        expect(overseas.plugins.some((p: any) => p?.name === "overseas-public-assets")).toBe(true);
        process.env.VITE_APP_MODE = "standalone";
        const standalone = await resolveConfig({ mode: "production", command: "build" });
        expect(standalone.build.copyPublicDir).toBe(true);
        expect(standalone.define.__CATALOG_MEDIA_MAP__).toBe("null");
        expect(standalone.plugins.some((p: any) => p?.name === "overseas-public-assets")).toBe(false);
    } finally {
        if (previousMode === undefined) delete process.env.VITE_APP_MODE;
        else process.env.VITE_APP_MODE = previousMode;
    }
});
