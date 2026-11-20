export type AnalyticsPage = "canvases" | "canvas" | "image_studio" | "video_studio" | "prompts" | "assets" | "settings";
export type AnalyticsName = "canvas_enter" | "page_active" | "template_view" | "template_save" | "template_open";
export type AnalyticsContext = { page: AnalyticsPage; projectId?: string; templateId?: string };
export type AnalyticsProperties = { projectId?: string; templateId?: string; collection?: string; activeMs?: number };
export const analyticsPages: AnalyticsPage[] = ["canvases", "canvas", "image_studio", "video_studio", "prompts", "assets", "settings"];
export const analyticsNames: AnalyticsName[] = ["canvas_enter", "page_active", "template_view", "template_save", "template_open"];
export function analyticsRoute(path: string): { page: AnalyticsPage; projectId?: string } | undefined {
    const parts = path.split("/").filter(Boolean);
    const pages: Record<string, AnalyticsPage> = { image: "image_studio", video: "video_studio", prompts: "prompts", assets: "assets", config: "settings" };
    if (!parts.length || (parts[0] === "canvas" && parts.length === 1)) return { page: "canvases" };
    if (parts.length === 1 && pages[parts[0]]) return { page: pages[parts[0]] };
    if ((parts[0] === "canvas" && parts.length === 2) || parts.length === 1) return { page: "canvas", projectId: parts.at(-1) };
}
export function analyticsProperties(input: AnalyticsProperties): AnalyticsProperties {
    return {
        ...(typeof input.projectId === "string" && input.projectId ? { projectId: input.projectId } : {}),
        ...(typeof input.templateId === "string" && input.templateId ? { templateId: input.templateId } : {}),
        ...(["case", "template", "public-library"].includes(input.collection || "") ? { collection: input.collection } : {}),
        ...(typeof input.activeMs === "number" && Number.isFinite(input.activeMs) && input.activeMs > 0 ? { activeMs: Math.round(input.activeMs) } : {}),
    };
}
