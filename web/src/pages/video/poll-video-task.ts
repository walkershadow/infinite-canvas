import { pollVideoGenerationTask, type VideoGenerationTask, type VideoGenerationTaskState } from "@/services/api/video";
import type { AiConfig } from "@/stores/use-config-store";
import i18n from "@/i18n";

export type VideoPollOutcome = Exclude<VideoGenerationTaskState, { status: "pending" }> | { status: "paused"; error: string };

// Platform jobs have no client-side deadline; keep the existing sequential 2.5-second cadence.
export async function pollVideoTaskWindow(config: AiConfig, task: VideoGenerationTask, signal: AbortSignal): Promise<VideoPollOutcome> {
    try {
        for (let attempt = 0; task.provider === "workbench" || attempt < 120; attempt += 1) {
            signal.throwIfAborted();
            const state = await pollVideoGenerationTask(config, task, { signal });
            signal.throwIfAborted();
            if (state.status !== "pending") return state;
            if (task.provider === "workbench" || attempt < 119) await new Promise<void>((resolve, reject) => {
                const abort = () => { clearTimeout(timer); reject(signal.reason); };
                const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2500);
                signal.addEventListener("abort", abort, { once: true });
                if (signal.aborted) abort();
            });
        }
        throw new Error(i18n.t("videoWorkbench.timeout"));
    } catch (error) {
        if (signal.aborted || task.provider !== "workbench") throw error;
        return { status: "paused", error: `Unable to check this task. Use Check status to resume without generating again. ${error instanceof Error ? error.message : String(error)}` };
    }
}

export function canResumePlatformVideo(log?: { status: string; terminal?: boolean; task?: VideoGenerationTask } | null) {
    return log?.task?.provider === "workbench" && log.status !== "success" && !log.terminal;
}
