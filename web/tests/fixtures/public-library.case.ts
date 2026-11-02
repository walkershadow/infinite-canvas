import { expect, mock, test } from "bun:test";
const mode = process.env.VITE_APP_MODE;
let allowed = false;
let reject = false;
const calls: { path: string; init: RequestInit }[] = [];
mock.module("@/services/api/workbench", () => ({
    workbenchSession: () => ({ user: { id: "test" }, capabilities: { publicLibrary: allowed, publicLibraryAdmin: true } }),
    workbenchRequest: async (path: string, init: RequestInit = {}) => {
        calls.push({ path, init });
        if (reject) throw new Error("Public library access denied");
        return { items: [], total: 0, page: 2, pageSize: 24, facets: { categories: [] } };
    },
}));
const api = await import("../../src/services/api/public-library");
test(`${mode}: only explicit overseas permission permits catalog access`, async () => {
    expect(api.canUsePublicLibrary()).toBe(false);
    expect(() => api.listPublicLibrary({ kind: "pose", page: 1, search: "", category: "", groupId: "" })).toThrow();
    expect(calls).toHaveLength(0);
    allowed = true;
    expect(api.canUsePublicLibrary()).toBe(mode === "overseas");
    if (mode !== "overseas") { expect(() => api.listPublicLibrary({ kind: "face", page: 1, search: "", category: "", groupId: "" })).toThrow(); expect(calls).toHaveLength(0); return; }
    const controller = new AbortController();
    await api.listPublicLibrary({ kind: "pose", page: 2, search: "动作 & angle", category: "站立", groupId: "action-1" }, controller.signal);
    const query = new URL(calls[0].path, "https://example.test").searchParams;
    expect(query.get("search")).toBe("动作 & angle");
    expect(query.get("groupId")).toBe("action-1");
    expect(query.get("page")).toBe("2");
    expect(calls[0].init.signal).toBe(controller.signal);
    reject = true;
    await expect(api.listPublicWorkflows("zh")).rejects.toThrow("access denied");
});
