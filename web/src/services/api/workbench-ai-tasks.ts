import { useAiTasksStore } from "@/stores/use-workbench-ai-store";
import { localForageStorage } from "@/lib/localforage-storage";
import { workbenchRequest } from "./workbench";

export class WorkbenchTaskPendingError extends Error {}
export const isWorkbenchTaskPending = (error: unknown) => error instanceof WorkbenchTaskPendingError;
export type AiTaskKind = "images" | "text" | "audio";
export type AiTaskResult = { images?: { id: string; url: string }[]; text?: string; url?: string; mimeType?: string };
export type AiTask = { id: string; requestKey: string; kind: AiTaskKind; model: string; status: "queued" | "running" | "completed" | "failed" | "unknown"; error: string | null; result: AiTaskResult | null; createdAt: string; updatedAt: string };
export type AiTaskOwner = { projectId?: string; nodeId?: string; itemId?: string; slot?: number };
export type PlatformRequestOptions = { signal?: AbortSignal; owner?: AiTaskOwner };
export type AiTaskRecord = { requestKey: string; kind: AiTaskKind; body: Record<string, unknown>; owner?: AiTaskOwner; task?: AiTask; delivered?: boolean; error?: string };
const KEY = "workbench:ai-tasks:v1";
let loading: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const active = new Map<string, Promise<AiTaskResult>>();
export const isAiTaskRunning = (key: string) => active.has(key);

export function loadAiTasks() {
    return loading ??= (async () => {
        const raw = await localForageStorage.getItem(KEY);
        if (raw) {
            const records = JSON.parse(raw);
            if (!Array.isArray(records) || records.some((r) => !r.requestKey || !r.body || !["images", "text", "audio"].includes(r.kind))) throw new Error("Invalid AI task history. Export browser storage before continuing.");
            useAiTasksStore.setState({ records });
        }
    })().catch((error) => { loading = undefined; throw error; });
}
function changeRecords(update: (records: AiTaskRecord[]) => AiTaskRecord[]) {
    const run = queue.then(async () => {
        await loadAiTasks();
        const records = update(useAiTasksStore.getState().records);
        await localForageStorage.setItem(KEY, JSON.stringify(records));
        useAiTasksStore.setState({ records });
    });
    queue = run.catch(() => undefined);
    return run;
}
async function saveTask(task: AiTask) {
    if (!task?.id || !task.requestKey || !["queued", "running", "completed", "failed", "unknown"].includes(task.status)) throw new Error("Invalid AI task response. The original request is preserved.");
    await changeRecords((records) => {
        const record = records.find((r) => r.requestKey === task.requestKey);
        return record ? records.map((r) => r === record ? { ...r, task, error: undefined } : r) : [...records, { requestKey: task.requestKey, kind: task.kind, body: {}, task }];
    });
}
export async function refreshAiTasks() {
    await loadAiTasks();
    const { tasks } = await workbenchRequest<{ tasks: AiTask[] }>("/ai/tasks");
    for (const task of tasks) await saveTask(task);
    useAiTasksStore.setState({ error: "" });
}
export async function queryAiTask(record: AiTaskRecord) {
    if (!record.task) {
        await refreshAiTasks();
        const found = useAiTasksStore.getState().records.find((r) => r.requestKey === record.requestKey)?.task;
        if (!found) throw new Error("Acceptance is not yet confirmed. Resume the original request; do not create another generation.");
        return found;
    }
    const { task } = await workbenchRequest<{ task: AiTask }>(`/ai/tasks/${encodeURIComponent(record.task.id)}`);
    if (task.requestKey !== record.requestKey) throw new Error("AI task identity mismatch.");
    await saveTask(task);
    return task;
}
export function acknowledgeAiTask(owner: AiTaskOwner) {
    return changeRecords((records) => records.map((r) => JSON.stringify(r.owner) === JSON.stringify(owner) && r.task?.status === "completed" ? { ...r, delivered: true } : r));
}
export function waitForAiPoll(signal?: AbortSignal) {
    signal?.throwIfAborted();
    return new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal?.reason); };
        const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, 2500);
        signal?.addEventListener("abort", abort, { once: true });
    });
}
export async function runAiTask(kind: AiTaskKind, body: Record<string, unknown>, options: PlatformRequestOptions = {}) {
    options.signal?.throwIfAborted();
    let record!: AiTaskRecord;
    await changeRecords((records) => {
        const unfinished = options.owner && records.find((r) => !r.delivered && r.task?.status !== "failed" && r.kind === kind && JSON.stringify(r.owner) === JSON.stringify(options.owner));
        if (unfinished && JSON.stringify(unfinished.body) !== JSON.stringify(body)) throw new Error("An earlier operation is still unresolved. Open Points → AI tasks before starting a different request for this result.");
        if (options.owner?.nodeId && !options.owner.itemId && records.some((r) => !r.delivered && r.task?.status !== "failed" && r.owner?.projectId === options.owner?.projectId && r.owner?.nodeId === options.owner?.nodeId && r.owner?.itemId)) throw new Error("This node still has preserved result tasks. Open Points → AI tasks to resume those tasks.");
        record = records.find((r) => !r.delivered && r.task?.status !== "failed" && r.kind === kind && JSON.stringify(r.owner) === JSON.stringify(options.owner) && JSON.stringify(r.body) === JSON.stringify(body))
            || { requestKey: crypto.randomUUID(), kind, body, owner: options.owner };
        return records.includes(record) ? records : [...records, record];
    });
    const existing = active.get(record.requestKey);
    if (existing) return existing;
    if (record.task?.status === "unknown") record = { ...record, task: await queryAiTask(record) };
    const pending = resumeAiTask(record, options.signal).then(async (result) => {
        if (!options.owner) await changeRecords((records) => records.map((r) => r.requestKey === record.requestKey ? { ...r, delivered: true } : r));
        return result;
    }).finally(() => active.delete(record.requestKey));
    active.set(record.requestKey, pending);
    return pending;
}
export async function resumeAiTask(record: AiTaskRecord, signal?: AbortSignal): Promise<AiTaskResult> {
    let task = record.task;
    try {
        if (!task) {
            signal?.throwIfAborted();
            // Replaying the exact persisted body/key is idempotent even when the first response was lost.
            task = (await workbenchRequest<{ task: AiTask }>(`/ai/${record.kind}`, { method: "POST", signal, body: JSON.stringify({ ...record.body, requestKey: record.requestKey }) })).task;
            if (task.requestKey !== record.requestKey) throw new Error("AI task identity mismatch.");
            await saveTask(task);
        }
        for (;;) {
            signal?.throwIfAborted();
            if (task.status === "completed") {
                if (!task.result) throw new Error("The completed task has no result. Check this task again.");
                return task.result;
            }
            if (task.status === "failed") throw new Error(task.error || "The upstream task failed.");
            if (task.status === "unknown") throw new Error("This task needs administrator review. Its outcome is unknown; no new generation was submitted.");
            await waitForAiPoll(signal);
            if (typeof document !== "undefined" && document.hidden) continue;
            task = await queryAiTask({ ...record, task });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await changeRecords((records) => records.map((r) => r.requestKey === record.requestKey ? { ...r, error: message } : r));
        useAiTasksStore.setState({ error: message });
        if (signal?.aborted) throw error;
        if (task?.status === "failed") throw new Error(message);
        throw new WorkbenchTaskPendingError(`Task preserved. Open Points → AI tasks to check or resume it. ${message}`);
    }
}
