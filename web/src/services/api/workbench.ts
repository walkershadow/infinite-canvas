import { canvasApiBase, isOverseas } from "@/constant/integration";
import type { WorkbenchBootstrap } from "@/types/workbench";

let session: WorkbenchBootstrap | undefined;
export function workbenchSession() {
    if (!session) throw new Error("Sign in to Workbench before opening Canvas.");
    return session;
}
export class WorkbenchError extends Error {
    constructor(message: string, public status: number) { super(message); }
}
export async function workbenchRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid Canvas API path");
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (session) headers.set("X-Canvas-Account", session.user.id);
    const response = await fetch(`${canvasApiBase}${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store", redirect: "error" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new WorkbenchError(body?.error || `Canvas request failed (${response.status})`, response.status);
    return body as T;
}
export async function bootstrapWorkbench() {
    const next = await workbenchRequest<WorkbenchBootstrap>("/bootstrap");
    if (!next?.user?.id || !Array.isArray(next.models)) throw new Error("Invalid Workbench bootstrap response");
    if (session && session.user.id !== next.user.id) throw new WorkbenchError("Your account changed. Reload Canvas to continue.", 401);
    session = next;
    return next;
}
export function accountDatabaseName() {
    return `infinite-canvas:workbench:${workbenchSession().user.id}`;
}

export function accountPreferenceKey(key: string) {
    return isOverseas ? `${accountDatabaseName()}:${key}` : key;
}
