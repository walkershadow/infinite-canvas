import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isOverseas } from "@/constant/integration";
import { analyticsRoute } from "@/lib/canvas-analytics";
import { setAnalyticsContext, trackCanvasEvent } from "@/services/api/analytics";
import { cloudProjectId } from "@/services/workbench/projects";

export function CanvasAnalyticsTracker() {
    const { pathname } = useLocation();
    useEffect(() => {
        if (!isOverseas) return;
        const route = analyticsRoute(pathname);
        const context = route ? { page: route.page, projectId: cloudProjectId(route.projectId) } : undefined;
        setAnalyticsContext(context);
        const enter = () => {
            if (!context || document.hidden) return;
            trackCanvasEvent("canvas_enter", {}, context);
        };
        enter();
        document.addEventListener("visibilitychange", enter);
        return () => { document.removeEventListener("visibilitychange", enter); setAnalyticsContext(undefined); };
    }, [pathname]);
    return null;
}
