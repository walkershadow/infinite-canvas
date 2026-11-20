import { expect, test } from "bun:test";
import { caseStudies, caseStudiesExport } from "../scripts/case-studies";
import { catalogMediaDependencies } from "@/lib/catalog-media";
import { catalogForAppMode } from "@/services/api/overseas-prompt-catalog";
const media = Object.fromEntries(catalogMediaDependencies(catalogForAppMode("overseas")).map((item, i) => [item.key, { url: `https://cdn.example.com/public/${i}.jpg` }]));
const mapping = { version: 1 as const, allowedOrigins: ["https://cdn.example.com"], media };
test("homepage teasers contain only public allowlisted fields and mapped posters", () => {
    const teasers = caseStudies(mapping);
    expect(teasers).toHaveLength(30);
    for (const teaser of teasers) {
        expect(Object.keys(teaser).sort()).toEqual(["category", "detailUrl", "id", "poster", "summary", "tags", "title"]);
        expect(teaser.title.en.length).toBeGreaterThan(0);
        expect(teaser.title.zh.length).toBeGreaterThan(0);
        expect(teaser.poster).toStartWith("https://cdn.example.com/");
        expect(teaser.detailUrl).toBe(`/canvas/prompts?collection=case&id=${encodeURIComponent(teaser.id)}`);
    }
    expect(JSON.stringify(teasers)).not.toContain("prompts\":");
    const plugin = caseStudiesExport(mapping);
    const emitted: any[] = [];
    (plugin.generateBundle as Function).call({ emitFile: (file: unknown) => emitted.push(file) });
    expect(emitted[0].fileName).toBe("case-studies.json");
    expect(JSON.parse(emitted[0].source)).toEqual(teasers);
});
