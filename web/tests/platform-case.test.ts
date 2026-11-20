import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { catalogForAppMode } from "@/services/api/overseas-prompt-catalog";
import { catalogWorkflow, workflowAsset, instantiateWorkflow } from "@/lib/workflow";
import { validateWorkflow } from "@/lib/workflow-validation";
import { catalogTextAsset } from "@/pages/prompts/catalog-asset";
import { catalogText, platformPromptLabel } from "@/lib/prompt-catalog-locale";
const id = "ai-creator-book-of-light";
const entry = catalogForAppMode("overseas").find(e => e.id === id)!;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

test("published original retains exact submitted text and supplied translation, only overseas", () => {
    expect(catalogForAppMode("domestic").some(e => e.id === id)).toBe(false);
    expect(catalogForAppMode("standalone").some(e => e.id === id)).toBe(false);
    expect(entry.steps).toHaveLength(1);
    const step = entry.steps[0];
    expect(hash(step.prompts.en!)).toBe("dcea92d12a4c421c15876b866d11062fd8923c08e9654fc92c836d921b050a09");
    expect(hash(step.prompts.zh!)).toBe("36af425ef53585914249344bba168c5a4f79fcac8907b9590f032ab4539f8c34");
    expect(step.prompts.original).toBe(step.prompts.en);
    expect(step.settings).toEqual({ model: "wb-seedance-2-15s", seconds: "15", size: "720x1280" });
    expect(catalogText(platformPromptLabel(step, "en"), "en")).toBe("Platform-tested original prompt");
    expect(catalogText(platformPromptLabel(step, "zh"), "zh")).toBe("平台实测提示词译文");
    expect(entry.sources[0].role).toBe("inspiration");
    expect(entry.sources[0].url).toBe("https://www.youtube.com/shorts/Ejog3je9Ivo");
    expect(catalogTextAsset(entry, "video", "en").source).toBe("AI Creator (platform test)");
});

test("whole case saves and reopens with editable parameters; sample result never becomes input", () => {
    for (const language of ["en", "zh", "original"] as const) {
        const saved = JSON.parse(JSON.stringify(workflowAsset(catalogWorkflow(entry, language))));
        validateWorkflow(saved.data);
        expect(saved.source).toBe("AI Creator (platform test)");
        expect(saved.data.stages[0].prompt).toBe(entry.steps[0].prompts[language]);
        saved.data.stages[0].prompt += " User edit";
        saved.data.stages[0].settings.size = "1280x720";
        const graph = instantiateWorkflow(saved.data);
        expect(graph.nodes).toHaveLength(2);
        expect(graph.connections).toHaveLength(0);
        const video = graph.nodes.find(n => n.type === "video")!;
        expect(video.metadata).toMatchObject({ model: "wb-seedance-2-15s", seconds: "15", size: "1280x720", status: "idle", content: "" });
        expect(video.metadata?.prompt).toEndWith(" User edit");
        expect(video.metadata?.videoTaskId).toBeUndefined();
        expect(saved.data.source.steps[0].settings.size).toBe("720x1280");
        expect(saved.data.source.outputMedia[0].url).toEndWith(".mp4");
        expect(saved.data.source.outputMedia[0].poster).toEndWith(".jpg");
        expect(saved.data.references).toEqual([]);
    }
});
