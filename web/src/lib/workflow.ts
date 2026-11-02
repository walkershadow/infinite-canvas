import { catalogText, catalogTitle } from "./prompt-catalog-locale";
import { nanoid } from "nanoid";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";
import type { WorkflowDocument } from "@/types/workflow";
import type { WorkflowAsset } from "@/stores/use-asset-store";
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from "@/types/canvas";
import { validateWorkflow } from "./workflow-validation";

export function catalogWorkflow(entry: OverseasPromptEntry, language: WorkflowDocument["language"] = "en"): WorkflowDocument {
    const text = (value: string) => catalogText(value, language);
    const complete = entry.sourceCompleteness === "complete";
    const stages: WorkflowDocument["stages"] = entry.steps.map(step => ({ id: step.id, title: text(step.title), mode: step.mode || (complete && entry.contentKind === "template" ? "planning" : "manual"), prompt: step.prompts[language] || step.prompts.original || step.prompts.en || step.prompts.zh || "", dependsOn: [...(step.dependsOn || [])], ...(step.image ? { image: structuredClone(step.image) } : {}), ...(step.inputOrder ? { inputOrder: [...step.inputOrder] } : {}) }));
    return { schemaVersion: 1, source: structuredClone(entry), language, stages, references: (entry.referenceInputs || []).map(ref => ({ ...structuredClone(ref), title: text(ref.title), role: text(ref.role) })) };
}
export function workflowAsset(document: WorkflowDocument): Omit<WorkflowAsset, "id" | "createdAt" | "updatedAt"> {
    validateWorkflow(document);
    return { kind: "workflow", title: catalogTitle(document.source, document.language), coverUrl: "", tags: [...document.source.tags.map(tag => catalogText(tag, document.language)), catalogText("Workflow", document.language)], source: document.source.sources[0]?.author || document.source.sources[0]?.label, note: catalogText("Complete saved collection. Source text and editable stages are stored separately. External samples remain external links.", document.language), data: structuredClone(document) };
}
export function instantiateWorkflow(document: WorkflowDocument, origin = { x: 0, y: 0 }) {
    validateWorkflow(document);
    if (document.stages.some(stage => stage.mode !== "manual" && !stage.prompt.trim())) throw new Error(catalogText("Fill and review this stage’s prompt before generating.", document.language));
    const groupId = nanoid();
    const stageIds = new Map(document.stages.map(s => [s.id, nanoid()]));
    const refIds = new Map(document.references.map(r => [r.id, nanoid()]));
    const connections: CanvasConnection[] = [];
    const nodes: CanvasNodeData[] = [];
    const addEdge = (from: string, to: string) => connections.push({ id: nanoid(), fromNodeId: from, toNodeId: to });
    let referenceY = origin.y + 90;
    document.references.forEach(ref => {
        const height = ref.image ? 280 * ref.image.height / ref.image.width : 220;
        nodes.push({ id: refIds.get(ref.id)!, type: ref.kind, title: `${catalogText("Input material", document.language)} · ${ref.title} · ${ref.role}${ref.required ? ` (${catalogText("Required", document.language)})` : ""}`, position: { x: origin.x + 40, y: referenceY }, width: 280, height, metadata: { groupId, status: ref.image ? "success" : "idle", ...(ref.image ? { content: ref.image.url, storageKey: ref.image.storageKey } : {}), workflowReference: { role: ref.role, required: ref.required, ...(ref.galleryCategory ? { galleryCategory: ref.galleryCategory } : {}) } } });
        referenceY += height + 60;
    });
    document.stages.forEach((stage, i) => {
        const id = stageIds.get(stage.id)!;
        const manual = stage.mode === "manual";
        const mode = stage.mode === "planning" || stage.mode === "manual" ? "text" : stage.mode;
        nodes.push({ id, type: mode, title: stage.title, position: { x: origin.x + 380 + i * 400, y: origin.y + 90 }, width: 320, height: stage.image ? 320 * stage.image.height / stage.image.width : 260,
            metadata: { groupId, ...(document.source.publicLibrary && mode === "image" ? { count: 1 } : {}), status: manual || stage.image ? "success" : "idle", generationMode: mode, prompt: manual ? "" : stage.prompt, content: stage.image?.url || (manual || stage.mode === "planning" ? stage.prompt : ""), ...(stage.image ? { storageKey: stage.image.storageKey } : {}), workflowStage: { id: stage.id, mode: stage.mode }, workflowRequiredInputs: stage.dependsOn.map(dep => stageIds.get(dep)!).concat(document.references.filter(r => r.required && r.stageIds.includes(stage.id)).map(r => refIds.get(r.id)!)) } });
        const inputs = [...document.references.filter(r => r.stageIds.includes(stage.id)).map(r => r.id), ...stage.dependsOn];
        const ordered = stage.inputOrder ? [...stage.inputOrder.filter(input => inputs.includes(input)), ...inputs.filter(input => !stage.inputOrder!.includes(input))] : inputs;
        if (ordered.length !== inputs.length || new Set(ordered).size !== inputs.length || ordered.some(input => !inputs.includes(input))) throw new Error("Invalid workflow input order.");
        ordered.forEach(input => addEdge(refIds.get(input) || stageIds.get(input)!, id));
    });
    // The immutable source snapshot lives on the group, not in a generation input node.
    nodes.unshift({ id: groupId, type: CanvasNodeType.Group, title: catalogTitle(document.source, document.language), position: origin, width: Math.max(800, 440 + document.stages.length * 400), height: Math.max(420, ...nodes.map(node => node.position.y - origin.y + node.height + 60)), metadata: { workflow: structuredClone(document) } });
    return { nodes, connections, groupId };
}
export function workflowGenerationError(node: CanvasNodeData | undefined, nodes: CanvasNodeData[], prompt: string, connections?: CanvasConnection[]): string | undefined {
    if (!node?.metadata?.workflowStage) return;
    if (node.metadata.workflowStage.mode === "manual") return "This is source material, not a generation prompt. Create an editable generation stage first.";
    if (!prompt.trim()) return "Fill and review this stage’s prompt before generating.";
    const missing = node.metadata.workflowRequiredInputs?.filter(id => !nodes.find(n => n.id === id && n.metadata?.status === "success")?.metadata?.content?.trim() || (connections && !connections.some(c => c.fromNodeId === id && c.toNodeId === node.id)));
    if (missing?.length) return "Complete or upload the required inputs before generating this stage.";
}

export function workflowNodeMetadata(node?: CanvasNodeData) {
    if (!node?.metadata?.workflowStage) return {};
    return { groupId: node.metadata.groupId, workflowStage: node.metadata.workflowStage, workflowRequiredInputs: node.metadata.workflowRequiredInputs };
}
