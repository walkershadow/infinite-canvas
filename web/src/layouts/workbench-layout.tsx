import { exportLibraryRecovery, resolveLibraryRecovery, retryCloudLibrary } from "@/services/workbench/library";
import { localForageStorage } from "@/lib/localforage-storage";
import { useWorkbenchStore } from "@/stores/use-workbench-store";
import { useEffect, useState, type ReactNode } from "react";
import { saveAs } from "file-saver";
import { useLocation, useNavigate } from "react-router-dom";
import { dismissRecovery, initializeCloudProjects, retryCloudSave } from "@/services/workbench/projects";
import { workbenchRequest } from "@/services/api/workbench";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import type { CloudProject } from "@/types/workbench";

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
    const { ready, saving, error, recovery, balance, libraryError, libraryRecovery, librarySaving } = useWorkbenchStore();
    const [notice, setNotice] = useState("");
    const [importing, setImporting] = useState(false);
    const [legacy, setLegacy] = useState<{ id: string; title: string }[] | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const onLibrary = location.pathname.replace(/\/$/, "") === "/canvas";
    useEffect(() => { void initializeCloudProjects().catch(() => undefined); }, []);
    const report = (error: unknown) => setNotice(error instanceof Error ? error.message : String(error));
    const exportRecovery = async (previous = false) => {
        const content = !ready ? await localForageStorage.getItem("workbench:canvas-recovery:previous:v1") || await localForageStorage.getItem("workbench:canvas-recovery:v1") : null;
        const state = useCanvasStore.getState();
        saveAs(new Blob([content || JSON.stringify(previous ? recovery : { version: 1, projects: state.projects, deletedProjects: state.deletedProjects }, null, 2)], { type: "application/json" }), "canvas-recovery.json");
    };
    const importLegacy = async (id: string) => {
        setImporting(true);
        try {
            const project = await workbenchRequest<CloudProject>("/import-legacy", { method: "POST", body: JSON.stringify({ projectId: id }) });
            // Reload from cloud so the server ID, version and task links become authoritative together.
            window.location.assign(`/canvas/canvas/${encodeURIComponent(project.document.id || project.id)}`);
        } catch (error) { report(error); setImporting(false); }
    };
    return <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex flex-wrap items-center gap-4 px-4 py-2 text-sm">
            <a href="/">Workbench</a>
            <button onClick={() => navigate("/canvas")}>Projects</button>
            <span className="opacity-60" role="status">{saving || librarySaving ? "Saving…" : error || libraryError ? "Not saved" : ready ? "Cloud documents saved" : "Loading…"}</span>
            <span className="ml-auto">{balance} points</span>
        </header>
        {ready && <p className="px-4 pb-1 text-xs opacity-60">Media with local files is uploaded when saving. External links and task playback URLs are not guaranteed media backups.</p>}
        {libraryRecovery && <div className="flex flex-wrap gap-3 px-4 py-2 text-sm">
            <span>Previous collection edits were not saved. Cloud items are shown; your recovery snapshot is preserved.</span>
            <button onClick={() => void exportLibraryRecovery().then((text) => saveAs(new Blob([text], { type: "application/json" }), "collection-recovery.json")).catch(report)}>Export collection recovery</button>
            <button onClick={() => void resolveLibraryRecovery(true).catch(report)}>Restore as new items</button>
            <button onClick={() => void resolveLibraryRecovery(false).catch(report)}>Discard recovery</button>
        </div>}
        {libraryError && <div role="alert" className="flex gap-3 px-4 py-2 text-sm">
            <span>Collection not saved: {libraryError}</span>
            <button onClick={() => void retryCloudLibrary().catch(report)}>Retry collection save</button>
            <button onClick={() => void exportLibraryRecovery().then((text) => saveAs(new Blob([text], { type: "application/json" }), "collection-recovery.json")).catch(report)}>Export collection recovery</button>
        </div>}
        {notice && <div role="alert" className="px-4 py-2 text-sm">{notice}<button className="ml-3" onClick={() => setNotice("")}>Dismiss</button></div>}
        {error && <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <span>{error}</span>
            {ready && <button onClick={() => void retryCloudSave().catch(report)}>Retry save</button>}
            <button onClick={() => void exportRecovery().catch(report)}>Export recovery</button>
            <button onClick={() => window.location.reload()}>Reload cloud version</button>
        </div>}
        {recovery && <div className="flex items-center gap-3 px-4 py-2 text-sm">
            <span>A previous local recovery snapshot is available. Cloud projects were loaded.</span>
            <button onClick={() => void exportRecovery(true).catch(report)}>Export recovery snapshot</button>
            <button onClick={() => { recovery.projects.forEach((project) => useCanvasStore.getState().importProject(project)); void dismissRecovery().catch(report); }}>Restore as new projects</button>
            <button onClick={() => void dismissRecovery().catch(report)}>Dismiss</button>
        </div>}
        {ready && onLibrary && <div className="px-4 py-2 text-sm">
            <button disabled={importing} onClick={() => void workbenchRequest<{ projects: { id: string; title: string }[] }>("/import-legacy").then((result) => setLegacy(result.projects)).catch(report)}>Import existing Workbench canvas</button>
            {legacy && <div className="flex flex-wrap gap-3 py-2">{legacy.length ? legacy.map((project) => <button disabled={importing} key={project.id} onClick={() => void importLegacy(project.id)}>{project.title}</button>) : "No existing canvases"}<button onClick={() => setLegacy(null)}>Close</button></div>}
        </div>}
        <div className="min-h-0 flex-1 overflow-hidden">{ready ? children : <p className="p-4">{error ? "Canvas is unavailable until the cloud connection is restored." : "Loading your cloud projects…"}</p>}</div>
    </div>;
}
