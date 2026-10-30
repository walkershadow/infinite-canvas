import { workbenchSession } from "./workbench";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";
import { ownedAssetUrl } from "@/services/workbench/projects";
import { runAiTask, WorkbenchTaskPendingError, type PlatformRequestOptions } from "./workbench-ai-tasks";
import type { ReferenceImage } from "@/types/image";
import type { AiTextMessage } from "./image";

function modelFor(config: AiConfig, capability: "image" | "text" | "audio") {
    const model = modelOptionName(config.model || config[`${capability}Model`]);
    const session = workbenchSession();
    const item = session.aiModels?.find((item) => item.id === model && item.capability === capability);
    if (!session.capabilities[capability] || !item) throw new Error("This Workbench capability is not enabled.");
    if (item.price !== 0) throw new Error("Platform pricing changed. Ask the administrator to update the billing configuration before generating.");
    return model;
}
export async function platformImages(config: AiConfig, prompt: string, references: ReferenceImage[], options?: PlatformRequestOptions) {
    const model = modelFor(config, "image");
    if (references.length) throw new Error("This platform image model supports text-to-image only. Remove reference images or choose an editing provider.");
    if (config.background && config.background !== "auto" && config.background !== "opaque") throw new Error("This platform image model does not support transparent backgrounds.");
    const size = config.size === "auto" ? "1024x1024" : config.size;
    const dimensions = size.match(/^(\d+)x(\d+)$/);
    if (!dimensions || dimensions.slice(1).some((value) => Number(value) < 512 || Number(value) > 2048)) throw new Error("Platform images require explicit width × height between 512 and 2048 pixels. The default is 1024x1024.");
    const count = Number(config.count);
    if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error("Choose 1–6 images per request.");
    const result = await runAiTask("images", { model, prompt, images: [], size, quality: config.quality, count, background: config.background, systemPrompt: config.systemPrompt }, options);
    if (!result.images?.length) throw new Error("This completed task has no images. Check AI tasks.");
    return result.images.map((image) => ({ id: image.id, dataUrl: ownedAssetUrl(image.url) }));
}
export async function platformText(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, options?: PlatformRequestOptions) {
    const model = modelFor(config, "text");
    if (messages.some((message) => typeof message.content !== "string" && message.content.some((part) => part.type !== "text"))) throw new Error("This platform text model supports text messages only. Remove media references or choose another provider.");
    if (messages.length > 100) throw new Error("This platform text model accepts at most 100 messages.");
    const textMessages = messages.map((message) => ({ ...message, content: typeof message.content === "string" ? message.content : message.content.map((part) => part.type === "text" ? part.text : "").join("\n") }));
    const result = await runAiTask("text", { model, messages: textMessages, systemPrompt: config.systemPrompt, reasoningEffort: config.reasoningEffort }, options);
    if (typeof result.text !== "string") throw new Error("This completed task has no text. Check AI tasks.");
    onDelta(result.text);
    return result.text;
}
export async function platformAudio(config: AiConfig, prompt: string, options?: PlatformRequestOptions) {
    const model = modelFor(config, "audio");
    if ([...prompt].length > 500) throw new Error("This platform voice model accepts at most 500 characters.");
    if (!["alloy", "default"].includes(config.audioVoice) || config.audioFormat !== "wav" || Number(config.audioSpeed) !== 1 || config.audioInstructions.trim()) throw new Error("This platform voice model requires voice alloy/default, WAV, speed 1, and no extra instructions.");
    const result = await runAiTask("audio", { model, prompt, voice: config.audioVoice, format: config.audioFormat, speed: config.audioSpeed, instructions: config.audioInstructions }, options);
    if (!result.url) throw new Error("This completed task has no audio. Check AI tasks.");
    try {
        const response = await fetch(ownedAssetUrl(result.url), { credentials: "same-origin", signal: options?.signal });
        if (!response.ok) throw new Error("Audio download failed.");
        return await response.blob();
    } catch {
        throw new WorkbenchTaskPendingError("The task completed, but audio could not be downloaded. Retry reading it from AI tasks.");
    }
}
