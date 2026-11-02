import { poseGroupForKind } from "@/lib/public-library";
import { expect, test } from "bun:test";
import { catalogWorkflow, instantiateWorkflow, workflowAsset, workflowGenerationError } from "@/lib/workflow";
import { replaceReferenceImage } from "@/lib/canvas/replace-reference-image";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";

// Synthetic protocol fixture, never a published case or claimed generation result.
const source: OverseasPromptEntry = {
    id: "gallery-test", publicLibrary: true, contentKind: "template", title: "Test references", summary: "Protocol fixture", category: "Test", tags: [],
    sourceCompleteness: "complete", sources: [], referenceMedia: [], outputMedia: [],
    steps: [{ id: "render", title: "Render", instruction: "Test", mode: "image", inputOrder: ["face", "outfit", "pose"], prompts: { en: "Reference 1, 2, 3: protocol fixture", zh: "参考图1、2、3：协议测试" } }],
    referenceInputs: ["pose", "face", "outfit"].map(id => ({ id, title: id, kind: "image", galleryCategory: id as "pose" | "face" | "outfit", role: id, required: true, stageIds: ["render"], image: { url: `https://example.com/${id}.png`, width: 800, height: 1200 } })),
};

test("Assets roundtrip retains three categories and explicit image order across languages", () => {
    for (const lang of ["en", "zh"] as const) {
        const saved = workflowAsset(catalogWorkflow(source, lang));
        const document = JSON.parse(JSON.stringify(saved.data));
        const { nodes, connections } = instantiateWorkflow(document);
        const stage = nodes.find(n => n.metadata?.workflowStage)!;
        expect(nodes.filter(n => n.metadata?.workflowReference)).toHaveLength(3);
        expect(nodes.filter(n => n.metadata?.workflowStage)).toHaveLength(1);
        expect(stage.type).toBe("image");
        expect(stage.metadata!.count).toBe(1);
        expect(stage.metadata!.prompt).toBe(source.steps[0].prompts[lang]);
        expect(connections.map(c => nodes.find(n => n.id === c.fromNodeId)!.metadata!.workflowReference!.galleryCategory)).toEqual(["face", "outfit", "pose"]);
    }
});

test("replacing an input keeps graph identity, user prompt and connections without overwriting source", () => {
    const doc = catalogWorkflow(source);
    doc.stages[0].prompt = "User edited prompt — keep exactly";
    const { nodes, connections } = instantiateWorkflow(doc);
    const ref = nodes.find(n => n.metadata?.workflowReference?.galleryCategory === "face")!;
    ref.metadata!.prompt = "Personal note";
    const stage = nodes.find(n => n.metadata?.workflowStage)!;
    const snapshot = JSON.stringify({ nodes, connections });
    const next = nodes.map(n => n.id === ref.id ? replaceReferenceImage(n, { url: "blob:replacement", storageKey: "image:own", width: 1600, height: 900 }) : n);
    const replaced = next.find(n => n.id === ref.id)!;
    expect(replaced.id).toBe(ref.id);
    expect(replaced.metadata!.workflowReference).toEqual(ref.metadata!.workflowReference);
    expect(replaced.metadata!.prompt).toBe("Personal note");
    expect(replaced.width / replaced.height).toBeCloseTo(16 / 9);
    expect(replaced.width).toBeLessThanOrEqual(ref.width);
    expect(next.find(n => n.id === stage.id)!.metadata!.prompt).toBe(doc.stages[0].prompt);
    expect(workflowGenerationError(stage, next, stage.metadata!.prompt!, connections)).toBeUndefined();
    expect(JSON.stringify({ nodes, connections })).toBe(snapshot);
});

test("a real-case order is independent of the generic template order", () => {
    const doc = catalogWorkflow(source);
    doc.stages[0].inputOrder = ["face", "pose", "outfit"];
    const { nodes, connections } = instantiateWorkflow(doc);
    expect(connections.map(edge => nodes.find(node => node.id === edge.fromNodeId)!.metadata!.workflowReference!.galleryCategory)).toEqual(["face", "pose", "outfit"]);
});


test("pose representation switching preserves the source action and angle identity", () => {
    for (const angle of ["front", "high", "low", "side", "diag"]) {
        expect(poseGroupForKind(`pose-full_sexy_P001_${angle}`, "depth")).toBe(`depth-full_sexy_P001_${angle}`);
        expect(poseGroupForKind(`depth-full_sexy_P001_${angle}`, "pose")).toBe(`pose-full_sexy_P001_${angle}`);
    }
    expect(poseGroupForKind("pose-full_sexy_P001", "depth")).toBe("depth-full_sexy_P001");
    expect(poseGroupForKind("", "depth")).toBe("");
});
