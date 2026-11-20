import { expect, mock, test } from "bun:test";
let account = "first";
let signedIn = false;
mock.module("@/services/api/workbench", () => ({ workbenchSession: () => { if (!signedIn) throw new Error("signed out"); return { user: { id: account } }; } }));
const calls: { url: string; init: RequestInit }[] = [];
globalThis.fetch = mock(async (url: string, init: RequestInit) => { calls.push({ url, init }); throw new Error("offline"); }) as any;
const { trackCanvasEvent, setAnalyticsContext, flushCanvasEvents } = await import("@/services/api/analytics");
test("overseas analytics is authenticated, failure-safe, scoped per account and deduplicates app entry", async () => {
    setAnalyticsContext({ page: "prompts" });
    trackCanvasEvent("canvas_enter");
    expect(calls).toHaveLength(0);
    signedIn = true;
    setAnalyticsContext({ page: "prompts" });
    trackCanvasEvent("canvas_enter");
    trackCanvasEvent("canvas_enter");
    trackCanvasEvent("template_save", { templateId: "seedance:test", prompt: "private prompt" } as any);
    flushCanvasEvents();
    await Promise.resolve();
    if (process.env.VITE_APP_MODE !== "overseas") { expect(calls).toHaveLength(0); return; }
    expect(calls).toHaveLength(1);
    const [first, saved] = JSON.parse(calls[0].init.body as string).events;
    expect(first.page).toBe("prompts");
    expect(first.sessionId).toMatch(/^[\da-f-]{36}$/);
    expect(saved.id).not.toBe(first.id);
    expect(saved.sessionId).toBe(first.sessionId);
    expect(saved.properties).toEqual({ templateId: "seedance:test" });
    expect(calls[0].url).toBe("/api/analytics/events");
    expect(calls[0].init.credentials).toBe("same-origin");
    expect(calls[0].init.keepalive).toBe(true);
    account = "second";
    trackCanvasEvent("template_save", { templateId: "stale-context" });
    expect(calls).toHaveLength(1);
    setAnalyticsContext({ page: "prompts" });
    trackCanvasEvent("canvas_enter");
    flushCanvasEvents();
    expect(JSON.parse(calls[1].init.body as string).events[0].sessionId).not.toBe(first.sessionId);
    expect(new Headers(calls[1].init.headers).get("X-Canvas-Account")).toBe("second");
    await Promise.resolve();
    expect(calls).toHaveLength(2);
});


test("batches cap at twenty, flush drops failures and account switches discard queued events", async () => {
    if (process.env.VITE_APP_MODE !== "overseas") return;
    const start = calls.length;
    for (let i = 0; i < 45; i++) trackCanvasEvent("template_view", { templateId: `seedance:${i}` });
    expect(calls.length - start).toBe(2);
    flushCanvasEvents();
    expect(calls.slice(start).map(call => JSON.parse(call.init.body as string).events.length)).toEqual([20, 20, 5]);
    await Promise.resolve();
    flushCanvasEvents();
    expect(calls.length - start).toBe(3);
    trackCanvasEvent("template_save", { templateId: "old-account-queued" });
    account = "third";
    flushCanvasEvents();
    expect(calls.length - start).toBe(3);
    setAnalyticsContext({ page: "assets" });
    trackCanvasEvent("canvas_enter");
    flushCanvasEvents();
    expect(JSON.parse(calls.at(-1)!.init.body as string).events).toHaveLength(1);
});

test("project context resolves at event time and omits unavailable server IDs", () => {
    if (process.env.VITE_APP_MODE !== "overseas") return;
    let serverId: string | undefined;
    setAnalyticsContext(() => ({ page: "canvas", projectId: serverId }));
    trackCanvasEvent("page_active", { activeMs: 123 });
    serverId = "cloud-saved-project";
    trackCanvasEvent("page_active", { activeMs: 456 });
    flushCanvasEvents();
    const events = JSON.parse(calls.at(-1)!.init.body as string).events;
    expect(events[0].properties).toEqual({ activeMs: 123 });
    expect(events[1].properties).toEqual({ activeMs: 456, projectId: "cloud-saved-project" });
});

test("tracker lifecycle flushes visible focused time once across timer, blur, hidden, pagehide and route cleanup", async () => {
    if (process.env.VITE_APP_MODE !== "overseas") return;
    let cleanup: (() => void) | undefined;
    mock.module("react", () => ({ useEffect: (effect: () => () => void) => { cleanup = effect(); } }));
    mock.module("react-router-dom", () => ({ useLocation: () => ({ pathname: "/canvas/new-local-project" }) }));
    let serverId: string | undefined;
    mock.module("@/services/workbench/projects", () => ({ cloudProjectId: () => serverId }));
    let tick!: () => void;
    const view = Object.assign(new EventTarget(), { setInterval: (callback: () => void, ms: number) => { expect(ms).toBe(30000); tick = callback; return 1; }, clearInterval: mock(() => {}) });
    let focused = true;
    const doc = Object.assign(new EventTarget(), { hidden: false, hasFocus: () => focused });
    let clock = 0;
    const originalPerformance = globalThis.performance;
    Object.assign(globalThis, { window: view, document: doc, performance: { now: () => clock } });
    const { CanvasAnalyticsTracker } = await import("@/components/layout/canvas-analytics-tracker");
    const start = calls.length;
    try {
        CanvasAnalyticsTracker();
        clock = 30000; tick();
        serverId = "server-project-id";
        clock = 32000; focused = false; view.dispatchEvent(new Event("blur"));
        clock = 33000; doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
        clock = 34000; view.dispatchEvent(new Event("pagehide"));
        clock = 50000; cleanup!();
        const events = calls.slice(start).flatMap(call => JSON.parse(call.init.body as string).events).filter(e => e.name === "page_active");
        expect(events.map(e => e.properties.activeMs)).toEqual([30000, 2000]);
        expect(events[0].properties.projectId).toBeUndefined();
        expect(events[1].properties.projectId).toBe("server-project-id");
        expect(view.clearInterval).toHaveBeenCalledTimes(1);
        focused = true; doc.hidden = false;
        view.dispatchEvent(new Event("focus"));
        expect(calls.slice(start).flatMap(call => JSON.parse(call.init.body as string).events).filter(e => e.name === "page_active")).toHaveLength(2);
    } finally { Object.assign(globalThis, { performance: originalPerformance }); }
});
