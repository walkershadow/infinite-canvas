import { expect, mock, test } from "bun:test";
const mode = process.env.VITE_APP_MODE!;
const domestic = mode === "domestic";
const integrated = mode !== "standalone";
const storage = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
Object.assign(globalThis, { window: { localStorage: globalThis.localStorage } });
mock.module("@/i18n", () => ({ default: { t: (key: string) => key } }));
const integration = await import("../../src/constant/integration");
const api = await import("../../src/services/api/workbench");
let nextAccount = "same-account";
let nextError = false;
let headers: Headers;
const bootstrap = () => ({ user: { id: nextAccount }, region: domestic ? "domestic" : "overseas", locale: domestic ? "zh-CN" : "en-US", models: [{ id: "video-test", name: "测试视频", price: 2, billingUnit: "second", durations: [5], defaultDuration: 5, ratios: [{ value: "16:9", label: "16:9", size: "1280x720" }] }], aiModels: [], quota: { points: 100 }, capabilities: { video: true, image: false, text: false, audio: false, externalPlugins: false, legacyImport: false }, currency: domestic ? "CNY" : "USD", ...(domestic ? { pointsPerYuan: 10 } : { pointsPerUsd: 100 }), links: { workbench: domestic ? "/" : "/workbench", login: "/login", recharge: domestic ? "/" : "/workbench" } });
globalThis.fetch = (async (_url: string, init: RequestInit) => { headers = new Headers(init.headers); expect(init.credentials).toBe("same-origin"); return nextError ? Response.json({ code: "wechat_unbound", error: "Binding required" }, { status: 403 }) : Response.json(bootstrap()); }) as typeof fetch;

if (integrated) await api.bootstrapWorkbench();
const { initializeWorkbenchConfig } = await import("../../src/services/workbench/config");
const { useConfigStore, encodeChannelModel } = await import("../../src/stores/use-config-store");
const { workbenchVideoInput, workbenchVideoEstimateText } = await import("../../src/services/workbench/video");

test("mode defaults and local account keys remain separated", async () => {
    expect(integration.isWorkbench).toBe(integrated);
    expect(integration.workbenchLocale).toBe(mode === "overseas" ? "en-US" : "zh-CN");
    if (!integrated) { expect(api.accountPreferenceKey("setting")).toBe("setting"); return; }
    await api.bootstrapWorkbench();
    expect(api.accountDatabaseName()).toBe(`infinite-canvas:workbench:${domestic ? "domestic:" : ""}same-account`);
    expect(api.workbenchLink("home")).toBe(domestic ? "/" : "/workbench");
    expect(api.workbenchLink("login")).toBe("/login");
    expect(api.canImportLegacy()).toBe(false);
    await api.workbenchRequest("/projects");
    expect(headers.get("X-Canvas-Account")).toBe("same-account");
});

test("video-only platform preserves custom channels and uses correct currency conversion", async () => {
    if (!integrated) return;
    const custom = { id: "custom", name: "自配", apiKey: "local-test-key", baseUrl: "https://provider.example", apiFormat: "openai" as const, models: [{ name: "custom-image", capability: "image" as const }] };
    useConfigStore.setState({ config: { ...useConfigStore.getState().config, channels: [custom] } });
    await initializeWorkbenchConfig();
    const config = useConfigStore.getState().config;
    expect(config.channels.find(c => c.id === "custom")).toEqual(custom);
    expect(config.channels.find(c => c.id === "workbench")!.models).toEqual([{ name: "video-test", capability: "video" }]);
    const estimate = workbenchVideoInput({ ...config, model: encodeChannelModel("workbench", "video-test"), videoSeconds: "5", size: "16:9" });
    expect(estimate.points).toBe(10);
    expect(estimate.amount).toBe(domestic ? 1 : 0.1);
    expect(workbenchVideoEstimateText(estimate, domestic ? "zh-CN" : "en-US")).toContain(domestic ? "预计" : "Estimated cost");
});

test("binding and changed accounts fail without bypassing authorization", async () => {
    if (!integrated) return;
    nextError = true;
    try { await api.workbenchRequest("/projects"); throw new Error("expected failure"); } catch (error) {
        expect(error).toBeInstanceOf(api.WorkbenchError);
        expect((error as InstanceType<typeof api.WorkbenchError>).code).toBe("wechat_unbound");
        if (domestic) expect((error as Error).message).toContain("返回国内工作台完成微信绑定");
    }
    nextError = false; nextAccount = "another-account";
    await expect(api.bootstrapWorkbench()).rejects.toThrow("account changed");
});
