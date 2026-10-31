import { workbenchSession } from "@/services/api/workbench";
import { isWorkbenchModel, modelOptionName, resolveModelForCapability, type AiConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { getGroupResourceNodes, type CanvasResourceKind } from "./canvas-resource-references";
import { getNodeDefinition } from "./node-registry";

export function referenceKindsForNode(node: CanvasNodeData, config: AiConfig): CanvasResourceKind[] {
    if (node.type === CanvasNodeType.Config) return ["text", "image", "video", "audio"];
    const mode = getNodeDefinition(node.type)?.useBuiltinPanel?.mode || (node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : node.type === CanvasNodeType.Text ? "text" : "image");
    const model = resolveModelForCapability(config, node.metadata?.model, mode);
    return referenceKindsForGeneration(config, mode, model, node.metadata?.videoMode || config.videoMode);
}

export function referenceKindsForGeneration(config: AiConfig, mode: "image" | "video" | "audio" | "text", model = config.model, videoMode = config.videoMode): CanvasResourceKind[] {
    if (isWorkbenchModel(config, model)) {
        const session = workbenchSession();
        if (mode === "video") {
            const item = session.models.find((item) => item.id === modelOptionName(model));
            const frames = item?.supportsFrames && videoMode !== "reference";
            return ["text", ...(item?.supportsImage || frames ? ["image" as const] : []), ...(!frames && item?.supportsVideo ? ["video" as const] : []), ...(!frames && item?.supportsAudio ? ["audio" as const] : [])];
        }
        const limits = session.aiModels?.find((item) => item.id === modelOptionName(model) && item.capability === mode)?.constraints;
        if (mode === "image") return limits?.textOnly === false ? ["text", "image"] : ["text"];
        if (mode === "audio") return limits?.referenceAudio ? ["text", "audio"] : ["text"];
        return limits?.referenceKinds?.filter((kind) => kind === "text" || kind === "image" || kind === "video") || ["text"];
    }
    return mode === "video" ? ["text", "image", "video", "audio"] : mode === "audio" ? ["text"] : ["text", "image"];
}

export function isCompatibleReference(node: CanvasNodeData, nodes: CanvasNodeData[], kinds: CanvasResourceKind[]): boolean {
    if (node.type === CanvasNodeType.Group) {
        const children = getGroupResourceNodes(node.id, nodes);
        return children.length > 0 && children.every((child) => isCompatibleReference(child, nodes, kinds));
    }
    const kind = node.type === CanvasNodeType.Text && (node.metadata?.content || node.metadata?.prompt) ? "text"
        : [CanvasNodeType.Image, CanvasNodeType.Video, CanvasNodeType.Audio].includes(node.type as CanvasNodeType) && node.metadata?.content ? node.type as CanvasResourceKind
        : getNodeDefinition(node.type)?.resource?.(node)?.kind;
    return Boolean(kind && kinds.includes(kind));
}

export function assertWorkbenchReferences(config: AiConfig, mode: "image" | "video" | "audio" | "text", context: { imageCount: number; videoCount: number; audioCount: number }) {
    if (!isWorkbenchModel(config, config.model)) return;
    const kinds = referenceKindsForGeneration(config, mode);
    for (const [kind, count] of [["image", context.imageCount], ["video", context.videoCount], ["audio", context.audioCount]] as const) {
        if (count && !kinds.includes(kind)) throw new Error(`The selected model or reference mode does not accept ${kind} references. Disconnect them or choose a compatible model/mode before generating.`);
    }
}
