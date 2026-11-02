import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { catalogWorkflow, workflowAsset, instantiateWorkflow, workflowGenerationError } from "@/lib/workflow";
import { validateWorkflow } from "@/lib/workflow-validation";
import { overseasPromptCatalog } from "@/services/api/overseas-prompt-catalog";
const templates = overseasPromptCatalog.filter(e => e.contentKind === "template");
const grid = templates.find(e => e.id === "seedance:storyboard-grid-to-video")!;

test("all six categories retain all 27 bilingual planning templates, not fabricated video prompts", () => {
    expect(templates).toHaveLength(27);
    expect(new Set(templates.map(e => e.category)).size).toBe(6);
    for (const entry of templates) {
        const w = catalogWorkflow(entry); validateWorkflow(w);
        expect(w.stages[0].mode).toBe("planning");
        expect(w.source.steps[0].prompts.original).toBe(entry.steps[0].prompts.en);
        expect(w.source.steps[0].prompts.zh!.length).toBeGreaterThan(100);
        expect(w.stages).toHaveLength(entry.steps.length);
        expect(w.stages.every(s => s.prompt.trim())).toBe(true);
        expect(w.stages.filter(s => s.mode === "video")).toHaveLength(0);
    }
});
test("whole assets preserve source, translations, media, notes and edits across a JSON round trip", () => {
    for (const entry of overseasPromptCatalog) {
        const before = JSON.stringify(entry);
        const w = catalogWorkflow(entry); w.stages[0].prompt = "User draft";
        const saved = JSON.parse(JSON.stringify(workflowAsset(w)));
        validateWorkflow(saved.data);
        expect(saved.data.source).toEqual(entry);
        expect(saved.data.stages[0].prompt).toBe("User draft");
        expect(JSON.stringify(entry)).toBe(before);
        saved.data.source.title = "Changed copy";
        expect(w.source.title).toBe(entry.title);
    }
});
test("fresh instances have independent IDs, intact dependency edges, no task IDs or sample videos as inputs", () => {
    const w = catalogWorkflow(grid);
    w.stages.push({ id: "image-draft", title: "User image", mode: "image", prompt: "User image prompt", dependsOn: [] }, { id: "video-draft", title: "User video", mode: "video", prompt: "User video prompt", dependsOn: ["image-draft"] });
    w.references.push({ id: "character", title: "Character", kind: "image", role: "identity", required: true, stageIds: ["image-draft", "video-draft"] });
    const a = instantiateWorkflow(w), b = instantiateWorkflow(w);
    expect(a.nodes.every(n => !b.nodes.some(m => m.id === n.id))).toBe(true);
    expect(a.connections).toHaveLength(3);
    const ids = new Set(a.nodes.map(n => n.id));
    for (const edge of a.connections) { expect(ids.has(edge.fromNodeId)).toBe(true); expect(ids.has(edge.toNodeId)).toBe(true); }
    for (const n of a.nodes.slice(1)) { expect(n.metadata?.groupId).toBe(a.groupId); expect(n.metadata?.videoTaskId).toBeUndefined(); expect(n.metadata?.content || "").toBe(n.metadata?.workflowStage?.mode === "planning" ? w.stages[0].prompt : ""); }
    expect(a.nodes[0].metadata?.workflow?.source).toEqual(grid);
    a.nodes[0].metadata!.workflow!.source.title = "Local"; expect(w.source.title).toBe(grid.title);
});
test("incomplete cases remain manual source notes; required outputs block submission including disconnected or loading inputs", () => {
    const entry = { ...grid, contentKind: "case" as const, sourceCompleteness: "excerpt" as const };
    const g = instantiateWorkflow(catalogWorkflow(entry));
    expect(workflowGenerationError(g.nodes[1], g.nodes, "try")).toContain("source material");
    const workflow = catalogWorkflow(grid);
    workflow.stages.push({ id: "image", title: "User image", mode: "image", prompt: "User image", dependsOn: [] }, { id: "video", title: "User video", mode: "video", prompt: "User video", dependsOn: ["image"] });
    const graph = instantiateWorkflow(workflow);
    const video = graph.nodes.find(n => n.metadata?.workflowStage?.mode === "video")!;
    const image = graph.nodes.find(n => n.metadata?.workflowStage?.mode === "image")!;
    expect(workflowGenerationError(video, graph.nodes, "")).toContain("prompt");
    expect(workflowGenerationError(video, graph.nodes, "video")).toContain("required");
    image.metadata!.content = "/api/canvas/assets/example/content"; image.metadata!.status = "loading";
    expect(workflowGenerationError(video, graph.nodes, "video")).toContain("required");
    image.metadata!.status = "success";
    expect(workflowGenerationError(video, graph.nodes, "video", graph.connections)).toBeUndefined();
    expect(workflowGenerationError(video, graph.nodes, "video", [])).toContain("required");
});
test("reject unknown schemas, cycles, dangling references and unsafe source links before persistence", () => {
    const w = catalogWorkflow(grid);
    for (const mutate of [(d: any) => d.schemaVersion = 2, (d: any) => d.stages[0].dependsOn = [d.stages[0].id], (d: any) => d.source.sources[0].url = "javascript:alert(1)", (d: any) => d.references.push({ id: "bad", title: "ref", kind: "image", role: "identity", required: true, stageIds: ["missing"] })]) {
        const d = structuredClone(w); mutate(d); expect(() => validateWorkflow(d)).toThrow();
    }
});

 test("Meilin carries both authorized source prompts with character and storyboard references", () => {
    const w = catalogWorkflow(overseasPromptCatalog.find(e => e.id === "seedance:real-case-06-aimikoda")!);
    expect(w.stages.map(s => s.mode)).toEqual(["image", "video"]);
    expect(w.stages.every(s => s.prompt.trim().length > 1000)).toBe(true);
    expect(w.stages[1].dependsOn).toEqual(["storyboard"]);

    const graph = instantiateWorkflow(w);
    expect(graph.nodes.filter(n => n.metadata?.workflowStage)).toHaveLength(2);
    expect(graph.nodes.filter(n => n.metadata?.workflowReference)[0].title).toContain("Input material");
    expect(graph.connections).toHaveLength(3);
    expect(workflowGenerationError(graph.nodes.find(n => n.metadata?.workflowStage?.id === "storyboard"), graph.nodes, "")).toContain("prompt");
 });


test("language defaults localize new copies but preserve source and saved edits", () => {
    for (const entry of templates) {
        const zh = catalogWorkflow(entry, "zh");
        expect(zh.stages[0].prompt).toBe(entry.steps[0].prompts.zh!);
        expect(zh.stages[0].title).toBe("编写生成提示词");
        expect(workflowAsset(zh).title).toBe(entry.titleZh!);
        expect(workflowAsset(zh).tags).toContain("规划模板");
        expect(instantiateWorkflow(zh).nodes[1].metadata?.prompt).toBe(entry.steps[0].prompts.zh!);
        expect(zh.source).toEqual(entry);
        zh.stages[0].prompt = "我的编辑，不得覆盖";
        zh.language = "en";
        const restored = JSON.parse(JSON.stringify(workflowAsset(zh))).data;
        validateWorkflow(restored);
        expect(restored.stages[0].prompt).toBe("我的编辑，不得覆盖");
    }
});


test("visible planning instructions are not treated as completed outputs", () => {
    const w = catalogWorkflow(grid, "zh");
    w.stages.push({ id: "video", title: "User video", mode: "video", prompt: "User reviewed prompt", dependsOn: [w.stages[0].id] });
    const g = instantiateWorkflow(w);
    const planning = g.nodes.find(n => n.metadata?.workflowStage?.mode === "planning")!;
    const video = g.nodes.find(n => n.metadata?.workflowStage?.mode === "video")!;
    expect(planning.metadata?.content).toBe(w.stages[0].prompt);
    expect(workflowGenerationError(video, g.nodes, "User reviewed prompt", g.connections)).toContain("required");
    planning.metadata!.status = "success";
    planning.metadata!.content = "Reviewed model output";
    expect(workflowGenerationError(video, g.nodes, "User reviewed prompt", g.connections)).toBeUndefined();
});


test("authorized cases retain complete source text through Assets and Canvas", () => {
    const hashes: Record<string, string> = {"seedance:real-case-06-aimikoda": "e3be2e4cdd9b9d187ac655c00ccc3b5214de4f7a1a6aaa3de856305e6cdf8677", "seedance:real-case-07-techiebysa": "098564dd37dc2ea1febf8b5734361e24ee8370f3472b55d5cc9f9161ebe31f17", "seedance:apartment-arrival-storyboard-animation": "3daa4671f422ab52818734ef6475c74dafff4a64a1966d0644afca3856782975"};
    for (const entry of overseasPromptCatalog.filter(e => e.contentKind === "case")) {
        if (hashes[entry.id]) {
            expect(entry.sourceCompleteness).toBe("complete");
            const joined = entry.steps.map(s => s.prompts.original).join("\n\n");
            expect(createHash("sha256").update(joined).digest("hex")).toBe(hashes[entry.id]);
        }
        for (const language of ["en", "zh", "original"] as const) {
            const document = catalogWorkflow(entry, language);
            const saved = JSON.parse(JSON.stringify(workflowAsset(document)));
            validateWorkflow(saved.data);
            const graph = instantiateWorkflow(saved.data);
            for (const step of entry.steps) {
                const node = graph.nodes.find(n => n.metadata?.workflowStage?.id === step.id)!;
                expect(node.metadata?.prompt).toBe(step.prompts[language]);
                expect(node.metadata?.prompt?.trim().length).toBeGreaterThan(500);
                expect(node.type).toBe(step.mode!);
            }
            expect(graph.nodes.filter(n => n.metadata?.workflowStage)).toHaveLength(entry.steps.length);
            expect(graph.nodes.filter(n => n.metadata?.workflowReference)).toHaveLength(entry.referenceInputs?.length || 0);
            expect(graph.nodes.every(n => !n.metadata?.videoTaskId)).toBe(true);
        }
    }
});

test("apartment uses real sheets and two image-to-video sequences, not the nine-panel overview as a six-panel grid", () => {
    const w = catalogWorkflow(overseasPromptCatalog.find(e => e.id === "seedance:apartment-arrival-storyboard-animation")!);
    expect(w.stages.map(s => s.mode)).toEqual(["image", "video", "image", "video"]);
    expect(w.references).toHaveLength(3);
    expect(w.references.every(r => r.image?.url)).toBe(true);
    const graph = instantiateWorkflow(w);
    expect(graph.connections).toHaveLength(10);
    for (const id of ["grid-1-video", "grid-2-video"]) {
        const video = graph.nodes.find(n => n.metadata?.workflowStage?.id === id)!;
        const upstream = graph.connections.filter(c => c.toNodeId === video.id).map(c => graph.nodes.find(n => n.id === c.fromNodeId)!);
        expect(upstream.map(n => n.metadata?.workflowStage?.mode || n.metadata?.workflowReference?.role)).toEqual(["image", "Image2 in video · character identity", "Image3 in video · apartment and handbag"]);
        expect(workflowGenerationError(video, graph.nodes, video.metadata!.prompt!, graph.connections)).toContain("required");
    }
    const overview = graph.nodes.find(n => n.title.includes("Original nine-panel overview"))!;
    expect(overview.metadata?.content).toContain("HOuLl9gaoAAMsgk");
    expect(graph.connections.some(c => c.fromNodeId === overview.id)).toBe(false);
});

test("author images survive Assets round-trip, keep aspect ratios and enable the published storyboard inputs", () => {
    for (const entry of overseasPromptCatalog.filter(e => e.contentKind === "case")) {
        const w = JSON.parse(JSON.stringify(workflowAsset(catalogWorkflow(entry)))).data;
        const graph = instantiateWorkflow(w);
        for (const ref of w.references) {
            const node = graph.nodes.find(n => n.title.includes(ref.title))!;
            expect(node.metadata?.status).toBe("success");
            expect(node.metadata?.content).toBe(ref.image.url);
            expect(node.width / node.height).toBeCloseTo(ref.image.width / ref.image.height);
        }
        for (const stage of w.stages.filter((s: any) => s.image)) {
            const node = graph.nodes.find(n => n.metadata?.workflowStage?.id === stage.id)!;
            expect(node.metadata?.content).toBe(stage.image.url);
            expect(node.metadata?.prompt).toBe(stage.prompt);
            expect(node.width / node.height).toBeCloseTo(stage.image.width / stage.image.height);
        }
        if (!entry.id.includes("apartment")) {
            const video = graph.nodes.find(n => n.type === "video")!;
            expect(workflowGenerationError(video, graph.nodes, video.metadata!.prompt!, graph.connections)).toBeUndefined();
        }
    }
});
