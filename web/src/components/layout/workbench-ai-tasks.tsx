import { useEffect, useRef, useState } from "react";
import { Button, Empty, Modal, theme } from "antd";
import { ListTodo, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAiTasksStore } from "@/stores/use-workbench-ai-store";
import { isAiTaskRunning, queryAiTask, refreshAiTasks, resumeAiTask, type AiTaskRecord } from "@/services/api/workbench-ai-tasks";
import { ownedAssetUrl } from "@/services/workbench/projects";

export function WorkbenchAiTasks() {
    const { records, error } = useAiTasksStore();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState<string[]>([]);
    const controllers = useRef(new Map<string, AbortController>());
    const { token } = theme.useToken();
    const report = (error: unknown) => useAiTasksStore.setState({ error: error instanceof Error ? error.message : String(error) });
    const refresh = async () => {
        setLoading(true);
        try { await refreshAiTasks(); } catch (error) { report(error); }
        finally { setLoading(false); }
    };
    const close = () => { controllers.current.forEach((controller) => controller.abort()); setOpen(false); };
    useEffect(() => () => controllers.current.forEach((controller) => controller.abort()), []);
    const resume = async (record: AiTaskRecord) => {
        const controller = new AbortController();
        controllers.current.set(record.requestKey, controller);
        setActive((keys) => [...keys, record.requestKey]);
        try { await resumeAiTask(record, controller.signal); useAiTasksStore.setState({ error: "" }); }
        catch (error) { if (!controller.signal.aborted) report(error); }
        finally { controllers.current.delete(record.requestKey); setActive((keys) => keys.filter((key) => key !== record.requestKey)); }
    };
    return <>
        <Button type="text" size="small" icon={<ListTodo className="size-3.5" />} onClick={() => { setOpen(true); void refresh(); }}>AI tasks</Button>
        <Modal title="Platform AI tasks" open={open} onCancel={close} footer={null} width={720}>
            <p className="mb-3 text-sm" style={{ color: token.colorTextSecondary }}>Text, images and speech run on Workbench. Closing this window stops waiting, not the server task. Resume uses the same request; unknown outcomes require administrator review.</p>
            <p className="mb-3 text-xs" style={{ color: token.colorTextSecondary }}>Platform images: text only, default 1024 × 1024, dimensions 512–2048px, no transparency. Text: no media or tools. Image quality and text reasoning are provider-controlled; those selectors do not affect platform requests. Speech: up to 500 characters, alloy/default, WAV, speed 1. User-configured providers keep their own settings.</p>
            <Button type="text" size="small" loading={loading} icon={<RefreshCw className="size-3.5" />} onClick={() => void refresh()}>Refresh tasks</Button>
            {error && <p role="alert" className="my-3 break-words" style={{ color: token.colorError }}>{error}</p>}
            <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto">
                {!records.length && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No platform AI tasks" />}
                {[...records].reverse().map((record) => <section key={record.requestKey} className="space-y-2 border-t pt-3" style={{ borderColor: token.colorBorderSecondary }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{record.task?.model || String(record.body.model || record.kind)}</span>
                        <span className="text-xs">{record.task?.status || "Acceptance unconfirmed"}</span>
                    </div>
                    <p className="break-all text-xs" style={{ color: token.colorTextSecondary }}>{record.task?.id || record.requestKey}</p>
                    {(record.task?.error || record.error) && <p className="break-words text-sm">{record.task?.error || record.error}</p>}
                    {record.task?.status === "unknown" && <p className="text-sm">Outcome unknown. Contact the administrator; do not create another generation.</p>}
                    {record.task?.result?.text !== undefined && <pre className="max-h-64 whitespace-pre-wrap break-words text-sm">{record.task.result.text}</pre>}
                    {record.task?.result?.images?.map((image) => <a key={image.id} href={ownedAssetUrl(image.url)} target="_blank" rel="noreferrer" className="inline-block"><img src={ownedAssetUrl(image.url)} alt="Generated result" className="max-h-64 max-w-full rounded" /></a>)}
                    {record.kind === "audio" && record.task?.result?.url && <audio controls src={ownedAssetUrl(record.task.result.url)} className="max-w-full" />}
                    <div className="flex flex-wrap gap-1">
                        {record.task && <Button type="text" size="small" onClick={() => void queryAiTask(record).catch(report)}>Check status</Button>}
                        {(!record.task || ["queued", "running"].includes(record.task.status)) && <Button type="text" size="small" loading={active.includes(record.requestKey)} disabled={isAiTaskRunning(record.requestKey)} onClick={() => void resume(record)}>Resume original task</Button>}
                        {record.owner?.projectId && <Link className="px-2 py-1 text-sm" to={`/canvas/${encodeURIComponent(record.owner.projectId)}`} onClick={close}>Open canvas</Link>}
                        {record.task?.result?.url && <a className="px-2 py-1 text-sm" href={ownedAssetUrl(record.task.result.url)} download>Download result</a>}
                    </div>
                </section>)}
            </div>
        </Modal>
    </>;
}
