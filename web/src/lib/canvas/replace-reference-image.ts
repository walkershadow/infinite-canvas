import type { CanvasNodeData } from "@/types/canvas";
import type { WorkflowImage } from "@/types/workflow";
import { fitNodeSize } from "./canvas-node-size";

// Replace the input in place: graph identity, role and user prompts remain intact.
export function replaceReferenceImage(node: CanvasNodeData, image: WorkflowImage): CanvasNodeData {
    return {
        ...node,
        ...fitNodeSize(image.width, image.height, node.width, node.height),
        metadata: {
            ...node.metadata,
            content: image.url, storageKey: image.storageKey,
            naturalWidth: image.width, naturalHeight: image.height,
            status: "success", errorDetails: undefined, freeResize: false,
            images: undefined, primaryImageId: undefined,
        },
    };
}
