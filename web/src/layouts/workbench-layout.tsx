import { useWorkflowLocale } from "@/hooks/use-workflow-locale";
import { refreshAiTasks } from "@/services/api/workbench-ai-tasks";
import { useAiTasksStore } from "@/stores/use-workbench-ai-store";
import { workbenchSession } from "@/services/api/workbench";
import { useEffect, type ReactNode } from "react";
import { Spin } from "antd";
import { WorkbenchActions } from "@/components/layout/workbench-actions";
import { useWorkbenchStore } from "@/stores/use-workbench-store";
import { initializeCloudProjects } from "@/services/workbench/projects";

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
    const { text } = useWorkflowLocale();
    const { ready, error } = useWorkbenchStore();
    useEffect(() => {
        void initializeCloudProjects().catch(() => undefined);
        if (workbenchSession().aiModels?.length) void refreshAiTasks().catch((error) => useAiTasksStore.setState({ error: String(error) }));
    }, []);
    return <div className="flex h-dvh flex-col bg-background text-foreground">
        <div className="min-h-0 flex-1 overflow-hidden">{ready ? children : <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm"><WorkbenchActions /><div className="flex items-center gap-3">{error ? text("Cloud projects could not be loaded. Open the points menu to retry or export recovery.") : <><Spin size="small" />{text("Loading your cloud projects…")}</>}</div></div>}</div>
    </div>;
}
