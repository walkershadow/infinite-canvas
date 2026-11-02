import { canvasApiBase, isWorkbench, isDomestic, workbenchHome } from "@/constant/integration";
import type { WorkbenchBootstrap } from "@/types/workbench";

let session: WorkbenchBootstrap | undefined;
export function workbenchSession() {
    if (!session) throw new Error("Sign in to Workbench before opening Canvas.");
    return session;
}
export class WorkbenchError extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
}
export async function workbenchRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid Canvas API path");
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (session) headers.set("X-Canvas-Account", session.user.id);
    const response = await fetch(`${canvasApiBase}${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store", redirect: "error" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const code = body?.code || body?.error?.code || (typeof body?.error === "string" ? body.error : undefined);
        const message = code === "wechat_unbound" && isDomestic ? "请返回国内工作台完成微信绑定后再继续。" : body?.error?.message || body?.error || body?.message || `Canvas request failed (${response.status})`;
        throw new WorkbenchError(message, response.status, code);
    }
    return body as T;
}
export async function bootstrapWorkbench() {
    const next = await workbenchRequest<WorkbenchBootstrap>("/bootstrap");
    if (!next?.user?.id || !Array.isArray(next.models)) throw new Error("Invalid Workbench bootstrap response");
    if (session && session.user.id !== next.user.id) throw new WorkbenchError("Your account changed. Reload Canvas to continue.", 401);
    if (next.region && next.region !== (isDomestic ? "domestic" : "overseas")) throw new WorkbenchError(isDomestic ? "工作台地区配置不匹配，请返回工作台。" : "Workbench region mismatch.", 409);
    session = next;
    return next;
}
export function accountDatabaseName() {
    return `infinite-canvas:workbench:${isDomestic ? "domestic:" : ""}${workbenchSession().user.id}`;
}

export function accountPreferenceKey(key: string) {
    return isWorkbench ? `${accountDatabaseName()}:${key}` : key;
}

export function workbenchLink(kind: "home" | "login" | "recharge") {
    const path = session?.links?.[kind === "home" ? "workbench" : kind];
    if (path?.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) return path;
    return kind === "home" ? workbenchHome : kind === "login" ? "/login" : isDomestic ? "/settings/recharges" : workbenchHome;
}
export function canImportLegacy() { return !isDomestic && workbenchSession().capabilities.legacyImport !== false; }
