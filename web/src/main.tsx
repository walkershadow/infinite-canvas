import { isWorkbench, workbenchLocale, isDomestic, isOverseas } from "@/constant/integration";
import { bootstrapWorkbench, workbenchLink, WorkbenchError } from "@/services/api/workbench";

async function start() {
    if (isWorkbench) {
        document.documentElement.lang = workbenchLocale;
        document.title = isDomestic ? "画布 · 视频工作台" : "Canvas · AI Creator";
        await bootstrapWorkbench();
    }
    await import("./app");
}
void start().catch((error: unknown) => {
    const root = document.getElementById("root")!;
    const description = document.createElement("p");
    description.textContent = error instanceof Error ? error.message : "Canvas could not start.";
    const retry = document.createElement("button");
    retry.textContent = isDomestic ? "重试" : "Retry";
    retry.onclick = () => window.location.reload();
    const home = document.createElement("a");
    home.href = workbenchLink(error instanceof WorkbenchError && error.status === 401 ? "login" : "home");
    home.textContent = isDomestic ? "返回工作台完成登录或微信绑定" : isOverseas ? "Return to AI Creator" : "Return to Workbench";
    root.replaceChildren(description, retry, home);
});
