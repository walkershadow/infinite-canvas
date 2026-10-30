import { workbenchSession } from "@/services/api/workbench";
import { isWorkbenchModel, modelOptionName, resolveModelForCapability, type AiConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { getGroupResourceNodes, type CanvasResourceKind } from "./canvas-resource-references";
import { getNodeDefinition } from "./node-registry";

export function referenceKindsForNode(node: CanvasNodeData, config: AiConfig): CanvasResourceKind[] {
    if (node.type === CanvasNodeType.Config) return ["text", "image", "video", "audio"];
    const mode = getNodeDefinition(node.type)?.useBuiltinPanel?.mode || (node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : node.type === CanvasNodeType.Text ? "text" : "image");
    const model = resolveModelForCapability(config, node.metadata?.model, mode);
    if (isWorkbenchModel(config, model) && ["ali-image", "ali-llm", "ali-audio"].includes(modelOptionName(model))) return ["text"];
    if (mode === "video" && isWorkbenchModel(config, model)) {
        const item = workbenchSession().models.find((item) => item.id === modelOptionName(model));
        return ["text", ...(item?.supportsImage ? ["image" as const] : []), ...(item?.supportsVideo ? ["video" as const] : []), ...(item?.supportsAudio ? ["audio" as const] : [])];
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
