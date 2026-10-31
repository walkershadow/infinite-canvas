import { useAiTasksStore } from "@/stores/use-workbench-ai-store";
import { WorkbenchAiTasks } from "./workbench-ai-tasks";
import { workbenchSession } from "@/services/api/workbench";
import { useState } from "react";
import { Button, Empty, Modal, Popover, Spin, theme } from "antd";
import { FolderOpen, Import, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { saveAs } from "file-saver";
import { useWorkbenchStore } from "@/stores/use-workbench-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { localForageStorage } from "@/lib/localforage-storage";
import { dismissRecovery, retryCloudSave } from "@/services/workbench/projects";
import { exportLibraryRecovery, resolveLibraryRecovery, retryCloudLibrary } from "@/services/workbench/library";
import { workbenchRequest } from "@/services/api/workbench";
import type { CloudProject } from "@/types/workbench";

export function WorkbenchActions() {
    const { ready, saving, error, recovery, balance, libraryReady, libraryError, libraryRecovery, librarySaving } = useWorkbenchStore();
    const aiError = useAiTasksStore((state) => state.error);
    const { token } = theme.useToken();
    const [open, setOpen] = useState(false);
    const [notice, setNotice] = useState("");
    const [importOpen, setImportOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<string>();
    const [legacy, setLegacy] = useState<{ id: string; title: string }[]>([]);
    const busy = saving || librarySaving;
    const attention = Boolean(error || libraryError || recovery || libraryRecovery || notice || aiError);
    const status = attention ? "Cloud storage needs attention" : busy ? "Saving documents…" : ready && libraryReady ? "Documents saved" : "Loading cloud documents…";
    const report = (error: unknown) => { setNotice(error instanceof Error ? error.message : String(error)); setOpen(true); };
    const download = (content: string, filename: string) => saveAs(new Blob([content], { type: "application/json" }), filename);
    const exportRecovery = async (previous = false) => {
        const content = !ready ? await localForageStorage.getItem("workbench:canvas-recovery:previous:v1") || await localForageStorage.getItem("workbench:canvas-recovery:v1") : null;
        const state = useCanvasStore.getState();
        download(content || JSON.stringify(previous ? recovery : { version: 1, projects: state.projects, deletedProjects: state.deletedProjects }, null, 2), "canvas-recovery.json");
    };
    const loadLegacy = async () => {
        setOpen(false); setImportOpen(true); setLoading(true); setNotice("");
        try { setLegacy((await workbenchRequest<{ projects: { id: string; title: string }[] }>("/import-legacy")).projects); }
        catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
        finally { setLoading(false); }
    };
    const importLegacy = async (id: string) => {
        setImporting(id); setNotice("");
        try {
            const project = await workbenchRequest<CloudProject>("/import-legacy", { method: "POST", body: JSON.stringify({ projectId: id }) });
            window.location.assign(`/canvas/canvas/${encodeURIComponent(project.document.id || project.id)}`);
        } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); setImporting(undefined); }
    };
    const details = <div className="w-80 max-w-[calc(100vw-48px)] space-y-3 whitespace-normal text-sm">
        <div className="flex items-center justify-between gap-3"><span className="font-medium">{status}</span><span className="shrink-0 tabular-nums">{balance ?? "…"} points</span></div>
        <p className="text-xs leading-relaxed" style={{ color: token.colorTextSecondary }}>Local media files are uploaded with your documents. External links and task playback URLs are not guaranteed media backups.</p>
        {aiError && <p role="alert" className="break-words text-xs">{aiError}</p>}
        {notice && !importOpen && <div role="alert" className="break-words"><p>{notice}</p><Button type="text" size="small" onClick={() => setNotice("")}>Dismiss</Button></div>}
        {error && <section className="space-y-1" role="alert"><p className="break-words">{error}</p><div className="flex flex-wrap gap-1">
            <Button type="text" size="small" onClick={() => void retryCloudSave().catch(report)}>{ready ? "Retry save" : "Retry loading"}</Button>
            <Button type="text" size="small" onClick={() => void exportRecovery().catch(report)}>Export recovery</Button>
            <Button type="text" size="small" onClick={() => window.location.reload()}>Reload cloud version</Button>
        </div></section>}
        {libraryError && <section className="space-y-1" role="alert"><p className="break-words">Collection: {libraryError}</p><div className="flex flex-wrap gap-1">
            <Button type="text" size="small" onClick={() => void retryCloudLibrary().catch(report)}>Retry collection save</Button>
            <Button type="text" size="small" onClick={() => void exportLibraryRecovery().then((text) => download(text, "collection-recovery.json")).catch(report)}>Export collection recovery</Button>
        </div></section>}
        {recovery && <section className="space-y-1"><p>Previous project edits are preserved in a recovery snapshot.</p><div className="flex flex-wrap gap-1">
            <Button type="text" size="small" onClick={() => void exportRecovery(true).catch(report)}>Export snapshot</Button>
            <Button type="text" size="small" onClick={() => { recovery.projects.forEach((project) => useCanvasStore.getState().importProject(project)); void dismissRecovery().catch(report); }}>Restore as new projects</Button>
            <Button type="text" size="small" onClick={() => void dismissRecovery().catch(report)}>Dismiss</Button>
        </div></section>}
        {libraryRecovery && <section className="space-y-1"><p>Previous collection edits are preserved. Cloud items are shown.</p><div className="flex flex-wrap gap-1">
            <Button type="text" size="small" onClick={() => void exportLibraryRecovery().then((text) => download(text, "collection-recovery.json")).catch(report)}>Export collection recovery</Button>
            <Button type="text" size="small" onClick={() => void resolveLibraryRecovery(true).catch(report)}>Restore as new items</Button>
            <Button type="text" size="small" onClick={() => void resolveLibraryRecovery(false).catch(report)}>Discard recovery</Button>
        </div></section>}
        <div className="flex flex-wrap items-center gap-1 pt-1">
            {Boolean(workbenchSession().aiModels?.length) && <WorkbenchAiTasks />}
            <Link to="/canvas" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"><FolderOpen className="size-3.5" />Projects</Link>
            <Button type="text" size="small" icon={<Import className="size-3.5" />} onClick={() => void loadLegacy()}>Import existing canvas</Button>
        </div>
    </div>;
    return <>
        <Popover trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} content={details}>
            <button type="button" aria-label={`${status}. ${balance ?? "…"} points. Open cloud storage`} title={status} className="inline-flex h-7 shrink-0 items-center rounded px-1 text-xs hover:bg-black/5 dark:hover:bg-white/10" style={{ color: attention ? token.colorWarning : token.colorTextSecondary }}>
                <span className="tabular-nums">{balance ?? "…"} pts</span>
            </button>
        </Popover>
        <Modal title="Import existing Workbench canvas" open={importOpen} onCancel={() => !importing && setImportOpen(false)} footer={null} closable={!importing} maskClosable={!importing}>
            <p className="mb-4 text-sm" style={{ color: token.colorTextSecondary }}>Import a copy into My Canvases. The original canvas and billing history stay unchanged.</p>
            {notice && <p role="alert" className="mb-3 break-words" style={{ color: token.colorError }}>{notice}</p>}
            {loading ? <div className="py-10 text-center"><Spin /></div> : <div className="max-h-[55vh] space-y-1 overflow-y-auto">
                {legacy.length ? legacy.map((project) => <div key={project.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate">{project.title}</span><Button type="text" loading={importing === project.id} disabled={Boolean(importing)} icon={<Import className="size-4" />} onClick={() => void importLegacy(project.id)}>Import copy</Button></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No existing canvases" />}
            </div>}
            <div className="mt-4 flex justify-end"><Button type="text" disabled={loading || Boolean(importing)} icon={<RefreshCw className="size-3.5" />} onClick={() => void loadLegacy()}>Refresh</Button></div>
        </Modal>
    </>;
}
