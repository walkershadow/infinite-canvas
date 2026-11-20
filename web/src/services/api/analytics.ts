import { isOverseas } from "@/constant/integration";
import { workbenchSession } from "./workbench";
import { analyticsNames, analyticsPages, analyticsProperties, type AnalyticsContext, type AnalyticsName, type AnalyticsProperties } from "@/lib/canvas-analytics";

let current: AnalyticsContext | (() => AnalyticsContext | undefined) | undefined;
let contextAccount: string | undefined;
let sessionId: string | undefined;
let sessionAccount: string | undefined;
let entered = false;
export function setAnalyticsContext(context?: AnalyticsContext | (() => AnalyticsContext | undefined)) {
    current = undefined; contextAccount = undefined;
    if (!isOverseas || !context) return;
    try { contextAccount = workbenchSession().user.id; current = context; } catch { /* Not signed in. */ }
}
export function currentAnalyticsContext() {
    try { return isOverseas && contextAccount === workbenchSession().user.id ? (typeof current === "function" ? current() : current) : undefined; } catch { return; }
}
type Event = { id: string; name: AnalyticsName; page: AnalyticsContext["page"]; sessionId: string; properties: AnalyticsProperties };
let pending: Event[] = [];
export function flushCanvasEvents() {
    const events = pending;
    pending = [];
    if (!events.length) return;
    try {
        const account = workbenchSession().user.id;
        if (account !== sessionAccount) return;
        void fetch("/api/analytics/events", { method: "POST", credentials: "same-origin", redirect: "error", keepalive: true, headers: { "Content-Type": "application/json", "X-Canvas-Account": account }, body: JSON.stringify({ events }) }).catch(() => undefined);
    } catch { /* Drop failed batches; never replay them for another account. */ }
}
export function trackCanvasEvent(name: AnalyticsName, properties: AnalyticsProperties = {}, context = currentAnalyticsContext()) {
    if (!isOverseas || !context || !analyticsNames.includes(name) || !analyticsPages.includes(context.page)) return;
    try {
        const account = workbenchSession().user.id;
        if (sessionAccount !== account) {
            pending = [];
            sessionAccount = account;
            sessionId = crypto.randomUUID();
            entered = false;
        }
        if (name === "canvas_enter" && entered) return;
        if (name === "canvas_enter") entered = true;
        const event = { id: crypto.randomUUID(), name, page: context.page, sessionId: sessionId!, properties: analyticsProperties({ projectId: context.projectId, ...properties }) };
        pending.push(event);
        if (pending.length === 20) flushCanvasEvents();
    } catch { /* Analytics must never interrupt the user's operation. */ }
}
