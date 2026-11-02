export const appRegion = import.meta.env.VITE_APP_MODE === "domestic" ? "domestic" : import.meta.env.VITE_APP_MODE === "overseas" ? "overseas" : "standalone";
export const isOverseas = appRegion === "overseas";
export const isDomestic = appRegion === "domestic";
export const isWorkbench = isOverseas || isDomestic;
export const canvasApiBase = "/api/canvas";
export const workbenchHome = isDomestic ? "/" : "/workbench";
export const workbenchLocale = isOverseas ? "en-US" : "zh-CN";
