import { isOverseas } from "@/constant/integration";
import { bootstrapWorkbench } from "@/services/api/workbench";

async function start() {
    if (isOverseas) {
        document.documentElement.lang = "en-US";
        document.title = "Canvas · Workbench";
        await bootstrapWorkbench();
    }
    await import("./app");
}
void start().catch((error: unknown) => {
    const root = document.getElementById("root")!;
    const description = document.createElement("p");
    description.textContent = error instanceof Error ? error.message : "Canvas could not start.";
    const retry = document.createElement("button");
    retry.textContent = "Retry";
    retry.onclick = () => window.location.reload();
    const home = document.createElement("a");
    home.href = "/";
    home.textContent = "Return to Workbench";
    root.replaceChildren(description, retry, home);
});
