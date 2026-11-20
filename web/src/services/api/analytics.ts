import { isOverseas } from "@/constant/integration";
import { workbenchSession } from "./workbench";
import { analyticsNames, analyticsPages, analyticsProperties, type AnalyticsContext, type AnalyticsName, type AnalyticsProperties } from "@/lib/canvas-analytics";

let current: AnalyticsContext | undefined;
let contextAccount: string | undefined;
let sessionId: string | undefined;
let sessionAccount: string | undefined;
let entered = false;
export function setAnalyticsContext(context?: AnalyticsContext) {
    current = undefined; contextAccount = undefined;
    if (!isOverseas || !context) return;
    try { contextAccount = workbenchSession().user.id; current = context; } catch { /* Not signed in. */ }
}
export function currentAnalyticsContext() {
    try { return isOverseas && contextAccount === workbenchSession().user.id ? current : undefined; } catch { return; }
}
export function trackCanvasEvent(name: AnalyticsName, properties: AnalyticsProperties = {}, context = currentAnalyticsContext()) {
    if (!isOverseas || !context || !analyticsNames.includes(name) || !analyticsPages.includes(context.page)) return;
    try {
        const account = workbenchSession().user.id;
        if (sessionAccount !== account) {
            sessionAccount = account;
            sessionId = crypto.randomUUID();
            entered = false;
        }
        if (name === "canvas_enter" && entered) return;
        if (name === "canvas_enter") entered = true;
        // One event per request: no unbounded queue, retries or persisted behavioral data.
        const event = { id: crypto.randomUUID(), name, page: context.page, sessionId, properties: analyticsProperties({ projectId: context.projectId, ...properties }) };
        void fetch("/api/analytics/events", { method: "POST", credentials: "same-origin", redirect: "error", keepalive: true, headers: { "Content-Type": "application/json", "X-Canvas-Account": account }, body: JSON.stringify({ events: [event] }) }).catch(() => undefined);
    } catch { /* Analytics must never interrupt the user's operation. */ }
}
