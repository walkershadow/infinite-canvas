import { expect, test } from "bun:test";
import { analyticsRoute, analyticsProperties } from "@/lib/canvas-analytics";
import { catalogWorkflow, instantiateWorkflow, workflowNodeMetadata } from "@/lib/workflow";
import { catalogForAppMode } from "@/services/api/overseas-prompt-catalog";
test("analytics uses stable pages and excludes free text, media, email and unapproved collection values", () => {
    expect(analyticsRoute("/canvas")).toEqual({ page: "canvases" });
    expect(analyticsRoute("/canvas/project-1")).toEqual({ page: "canvas", projectId: "project-1" });
    expect(analyticsRoute("/project-1")).toEqual({ page: "canvas", projectId: "project-1" });
    expect(analyticsRoute("/video")).toEqual({ page: "video_studio" });
    expect(analyticsRoute("/image")).toEqual({ page: "image_studio" });
    expect(analyticsProperties({ templateId: "template-1", activeMs: 125.2, collection: "private prompt text", prompt: "secret", email: "user@example.com", media: "data:image/" } as any)).toEqual({ templateId: "template-1", activeMs: 125 });
    expect(analyticsProperties({ activeMs: Infinity })).toEqual({});
});
test("workflow attribution survives save round trips and generated node metadata inheritance", () => {
    const entry = catalogForAppMode("overseas").find(e => e.id === "ai-creator-book-of-light")!;
    const nodes = instantiateWorkflow(JSON.parse(JSON.stringify(catalogWorkflow(entry)))).nodes;
    const stage = nodes.find(n => n.metadata?.workflowStage)!;
    expect(stage.metadata?.workflowTemplateId).toBe(entry.id);
    expect(workflowNodeMetadata(stage).workflowTemplateId).toBe(entry.id);
    expect(JSON.stringify(workflowNodeMetadata(stage))).not.toContain(entry.steps[0].prompts.en!);
});

test("analytics transport stays isolated across application modes", async () => {
    const { spawnSync } = await import("node:child_process");
    for (const mode of ["overseas", "domestic", "standalone"]) {
        const run = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/canvas-analytics.case.ts`], { env: { ...process.env, VITE_APP_MODE: mode }, encoding: "utf8" });
        if (run.status !== 0) throw new Error(run.stdout + run.stderr);
        expect(run.status).toBe(0);
    }
});
