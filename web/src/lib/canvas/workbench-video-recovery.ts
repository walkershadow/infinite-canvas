import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import type { WorkbenchTask } from "@/types/workbench";

/** Only fill untouched video nodes; edits, new requests and selected results remain authoritative. */
export function recoverVideoNodes(current: CanvasNodeData[], snapshot: CanvasNodeData[], tasks: (WorkbenchTask & { projectId: string })[]) {
    const originals = new Map(snapshot.map((node) => [node.id, node]));
    const latest = new Map([...tasks].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).map((task) => [task.nodeId, task]));
    return current.map((node) => {
        const task = latest.get(node.id);
        if (node !== originals.get(node.id) || node.type !== CanvasNodeType.Video || !task) return node;
        const metadata = node.metadata;
        if (metadata?.content || (metadata?.videoTaskId && metadata.videoTaskId !== task.id) || (metadata?.workbenchRequestKey && metadata.workbenchRequestKey !== task.requestKey)) return node;
        return { ...node, metadata: { ...metadata, videoTaskId: task.id, videoTaskProvider: "workbench" as const, workbenchProjectId: task.projectId, workbenchRequestKey: task.requestKey } };
    });
}

export function isVideoRecoveryTarget(node: CanvasNodeData, original: CanvasNodeData) {
    return node.id === original.id && node.type === CanvasNodeType.Video && !node.metadata?.content && node.metadata?.videoTaskId === original.metadata?.videoTaskId && node.metadata?.workbenchRequestKey === original.metadata?.workbenchRequestKey && node.metadata?.prompt === original.metadata?.prompt;
}
