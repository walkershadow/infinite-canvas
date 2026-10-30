/** Build-time isolation: an overseas bundle never falls back to provider credentials. */
export const isOverseas = import.meta.env.VITE_APP_MODE === "overseas";
export const canvasApiBase = "/api/canvas";
export function assertStandalone(capability: string) {
    if (isOverseas) throw new Error(`${capability} is unavailable in Workbench. Editing and media import remain available.`);
}
