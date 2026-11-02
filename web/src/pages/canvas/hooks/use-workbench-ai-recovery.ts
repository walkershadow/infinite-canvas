import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { isWorkbench } from "@/constant/integration";
import { useAiTasksStore } from "@/stores/use-workbench-ai-store";
import { acknowledgeAiTask, loadAiTasks, resumeAiTask, type AiTaskRecord, type AiTaskResult } from "@/services/api/workbench-ai-tasks";
import { ownedAssetUrl } from "@/services/workbench/projects";
import { uploadImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { imageMetadata, audioMetadata } from "@/lib/canvas/canvas-node-factory";
import type { CanvasNodeData } from "@/types/canvas";

export function useWorkbenchAiRecovery(projectId: string, nodes: CanvasNodeData[], setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>, active: { current: Map<string, unknown> }, runningNodeId: string | null) {
    const records = useAiTasksStore((state) => state.records);
    const attempted = useRef(new Map<string, AiTaskRecord["task"]>());
    const applied = useRef(new Map<string, string>());
    const processing = useRef(new Map<string, AbortController>());
    useEffect(() => {
        if (isWorkbench) void loadAiTasks().catch((error) => useAiTasksStore.setState({ error: String(error) }));
        return () => processing.current.forEach((controller) => controller.abort());
    }, []);
    useEffect(() => {
        if (!isWorkbench) return;
        for (const record of records) {
            const owner = record.owner;
            const node = nodes.find((node) => node.id === owner?.nodeId);
            if (!owner || owner.projectId !== projectId || !node || record.delivered || active.current.has(node.id) || processing.current.has(record.requestKey)) continue;
            if (record.task?.status === "failed" || record.task?.status === "unknown") continue;
            const item = owner.itemId ? (record.kind === "images" ? node.metadata?.images : node.metadata?.texts)?.find((item) => item.id === owner.itemId) : node.metadata;
            if (applied.current.has(record.requestKey) && item?.status === "success" && item.content === applied.current.get(record.requestKey)) {
                void acknowledgeAiTask(owner);
                continue;
            }
            if (attempted.current.has(record.requestKey) && attempted.current.get(record.requestKey) === record.task) continue;
            attempted.current.set(record.requestKey, record.task);
            const controller = new AbortController();
            processing.current.set(record.requestKey, controller);
            void (async () => {
                const result = await resumeAiTask(record, controller.signal);
                let metadata: CanvasNodeData["metadata"];
                if (record.kind === "images") {
                    if (!result.images?.[0]) throw new Error("Completed image task has no image.");
                    metadata = imageMetadata(await uploadImage(ownedAssetUrl(result.images[0].url), { signal: controller.signal }));
                } else if (record.kind === "audio") {
                    if (!result.url) throw new Error("Completed audio task has no audio.");
                    const response = await fetch(ownedAssetUrl(result.url), { credentials: "same-origin", signal: controller.signal });
                    if (!response.ok) throw new Error("Unable to download completed audio.");
                    metadata = audioMetadata(await uploadMediaFile(await response.blob(), "audio"));
                } else {
                    if (typeof result.text !== "string") throw new Error("Completed text task has no text.");
                    metadata = { content: result.text, status: "success" };
                }
                controller.signal.throwIfAborted();
                applied.current.set(record.requestKey, metadata?.content || "");
                setNodes((current) => current.map((item) => applyRecoveredAiResult(item, record, metadata, result)));
            })().catch((error) => {
                attempted.current.set(record.requestKey, useAiTasksStore.getState().records.find((item) => item.requestKey === record.requestKey)?.task);
                if (!controller.signal.aborted) useAiTasksStore.setState({ error: `Task preserved. Open Points → AI tasks. ${error instanceof Error ? error.message : String(error)}` });
            }).finally(() => processing.current.delete(record.requestKey));
        }
    }, [records, nodes, projectId, setNodes, active, runningNodeId]);
}

export function applyRecoveredAiResult(node: CanvasNodeData, record: AiTaskRecord, metadata: CanvasNodeData["metadata"], result: AiTaskResult): CanvasNodeData {
    const owner = record.owner;
    if (!owner || node.id !== owner.nodeId) return node;
    if (!owner.itemId) return { ...node, metadata: { ...node.metadata, ...metadata, errorDetails: undefined } };
    if (record.kind === "images") {
        if (!node.metadata?.images?.some((image) => image.id === owner.itemId)) return node;
        const primary = node.metadata.primaryImageId === owner.itemId || !node.metadata.content;
        return { ...node, metadata: { ...node.metadata, ...(primary ? metadata : {}), primaryImageId: primary ? owner.itemId : node.metadata.primaryImageId, status: "success", errorDetails: undefined, images: node.metadata.images.map((image) => image.id === owner.itemId ? { ...image, ...metadata, id: image.id } : image) } };
    }
    if (!node.metadata?.texts?.some((text) => text.id === owner.itemId)) return node;
    const primary = node.metadata.primaryTextId === owner.itemId || !node.metadata.content;
    return { ...node, metadata: { ...node.metadata, ...(primary ? metadata : {}), primaryTextId: primary ? owner.itemId : node.metadata.primaryTextId, status: "success", errorDetails: undefined, texts: node.metadata.texts.map((text) => text.id === owner.itemId ? { ...text, content: result.text!, status: "success" } : text) } };
}
