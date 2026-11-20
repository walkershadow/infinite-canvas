import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isOverseas } from "@/constant/integration";
import { analyticsRoute } from "@/lib/canvas-analytics";
import { createPageActivity } from "@/lib/page-activity";
import { flushCanvasEvents, setAnalyticsContext, trackCanvasEvent } from "@/services/api/analytics";
import { workbenchSession } from "@/services/api/workbench";
import { cloudProjectId } from "@/services/workbench/projects";

export function CanvasAnalyticsTracker() {
    const { pathname } = useLocation();
    useEffect(() => {
        if (!isOverseas) return;
        const route = analyticsRoute(pathname);
        const account = workbenchSession().user.id;
        const context = () => {
            try { return route && workbenchSession().user.id === account ? { page: route.page, projectId: cloudProjectId(route.projectId) } : undefined; }
            catch { return; }
        };
        setAnalyticsContext(context);
        let leaving = false;
        const active = () => !leaving && !document.hidden && document.hasFocus();
        const sample = createPageActivity(() => performance.now(), activeMs => {
            const current = context();
            if (current) trackCanvasEvent("page_active", { activeMs }, current);
        });
        const update = () => {
            sample(active());
            const current = context();
            if (current && !document.hidden && !leaving) trackCanvasEvent("canvas_enter", {}, current);
            flushCanvasEvents();
        };
        const leave = () => { leaving = true; update(); };
        const resume = () => { leaving = false; update(); };
        update();
        const timer = window.setInterval(update, 30000);
        window.addEventListener("focus", update);
        window.addEventListener("blur", update);
        window.addEventListener("pagehide", leave);
        window.addEventListener("pageshow", resume);
        document.addEventListener("visibilitychange", update);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", update);
            window.removeEventListener("blur", update);
            window.removeEventListener("pagehide", leave);
            window.removeEventListener("pageshow", resume);
            document.removeEventListener("visibilitychange", update);
            leave();
            setAnalyticsContext(undefined);
        };
    }, [pathname]);
    return null;
}
