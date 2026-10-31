import { expect, test } from "bun:test";
import { pinchViewport } from "@/lib/canvas/canvas-touch";
import { isVideoRecoveryTarget, recoverVideoNodes } from "@/lib/canvas/workbench-video-recovery";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

const node: CanvasNodeData = { id: "video", type: CanvasNodeType.Video, position: { x: 0, y: 0 }, width: 100, height: 100, metadata: {} };
const tasks = [{ id: "new", nodeId: "video", status: "completed", createdAt: "b", projectId: "cloud", requestKey: "request" }, { id: "old", nodeId: "video", status: "failed", createdAt: "a", projectId: "cloud" }];
test("late video discovery fills only unchanged nodes and takes the latest task", () => {
    expect(recoverVideoNodes([node], [node], tasks)[0].metadata?.videoTaskId).toBe("new");
    const edited = { ...node, metadata: { prompt: "User typed" } };
    expect(recoverVideoNodes([edited], [node], tasks)[0]).toBe(edited);
    expect(recoverVideoNodes([], [node], tasks)).toEqual([]);
    for (const metadata of [{ content: "/api/tasks/selected/video" }, { workbenchRequestKey: "new-request" }, { videoTaskId: "selected" }]) {
        const selected = { ...node, metadata };
        expect(recoverVideoNodes([selected], [selected], tasks)[0]).toBe(selected);
    }
    const text = { ...node, type: CanvasNodeType.Text };
    expect(recoverVideoNodes([text], [text], tasks)[0]).toBe(text);
});
test("late polling results cannot replace chosen content, edited prompts or a new request", () => {
    const original = { ...node, metadata: { videoTaskId: "new", workbenchRequestKey: "request", prompt: "Original" } };
    expect(isVideoRecoveryTarget({ ...original, position: { x: 20, y: 40 } }, original)).toBe(true);
    for (const patch of [{ content: "selected" }, { prompt: "Edited" }, { videoTaskId: "other" }, { workbenchRequestKey: "other" }]) {
        expect(isVideoRecoveryTarget({ ...original, metadata: { ...original.metadata, ...patch } }, original)).toBe(false);
    }
});
test("pinch keeps its world anchor and follows both fingers using existing zoom limits", () => {
    expect(pinchViewport({ x: 0, y: 0, k: 1 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 20 }, { x: 200, y: 20 }])).toEqual({ x: 0, y: 20, k: 2 });
    expect(pinchViewport({ x: 0, y: 0, k: 4 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 100, y: 0 }]).k).toBe(5);
    expect(pinchViewport({ x: 0, y: 0, k: 1 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }]).k).toBe(0.05);
});
