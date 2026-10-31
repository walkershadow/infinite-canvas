import { workbenchSession } from "./workbench";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";
import { ownedAssetUrl, workbenchReference } from "@/services/workbench/projects";
import { runAiTask, WorkbenchTaskPendingError, type PlatformRequestOptions } from "./workbench-ai-tasks";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import type { ReferenceImage } from "@/types/image";
import type { AiTextMessage } from "./image";

type WorkbenchTextMessage = Omit<AiTextMessage, "content"> & { content: string | (Exclude<AiTextMessage["content"], string>[number] | { type: "video_url"; video_url: { url: string } })[] };

function modelFor(config: AiConfig, capability: "image" | "text" | "audio") {
    const model = modelOptionName(config.model || config[`${capability}Model`]);
    const session = workbenchSession();
    const item = session.aiModels?.find((item) => item.id === model && item.capability === capability);
    if (!session.capabilities[capability] || !item) throw new Error("This Workbench capability is not enabled.");
    if (item.price !== 0) throw new Error("Platform pricing changed. Ask the administrator to update the billing configuration before generating.");
    return item;
}
export async function platformImages(config: AiConfig, prompt: string, references: ReferenceImage[], options?: PlatformRequestOptions) {
    const { id: model, constraints } = modelFor(config, "image");
    if (references.length && constraints?.textOnly !== false) throw new Error("This platform image model does not accept reference images. Choose an editing model.");
    if (constraints?.maxImages != null && references.length > constraints.maxImages) throw new Error(`This model accepts at most ${constraints.maxImages} reference images. Disconnect extra references before generating.`);
    if (config.background && config.background !== "auto" && config.background !== "opaque") throw new Error("This platform image model does not support transparent backgrounds.");
    const size = config.size === "auto" ? "1024x1024" : config.size;
    const dimensions = size.match(/^(\d+)x(\d+)$/);
    if (!dimensions || dimensions.slice(1).some((value) => Number(value) < 512 || Number(value) > 2048)) throw new Error("Platform images require explicit width × height between 512 and 2048 pixels. The default is 1024x1024.");
    const count = Number(config.count);
    if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error("Choose 1–6 images per request.");
    const images = await Promise.all(references.map(workbenchReference));
    const result = await runAiTask("images", { model, prompt, images, size, quality: config.quality, count, background: config.background, systemPrompt: config.systemPrompt }, options);
    if (!result.images?.length) throw new Error("This completed task has no images. Check AI tasks.");
    return result.images.map((image) => ({ id: image.id, dataUrl: ownedAssetUrl(image.url) }));
}
export async function platformText(config: AiConfig, messages: WorkbenchTextMessage[], onDelta: (text: string) => void, options?: PlatformRequestOptions & { videos?: ReferenceVideo[] }) {
    const { id: model, constraints } = modelFor(config, "text");
    const userIndex = messages.findLastIndex((message) => message.role === "user");
    for (const [index, message] of messages.entries()) {
        const parts = typeof message.content === "string" ? [] : message.content;
        const imageCount = parts.filter((part) => part.type === "image_url").length;
        const videoCount = parts.filter((part) => part.type === "video_url").length + (index === userIndex ? options?.videos?.length || 0 : 0);
        if (imageCount && !constraints?.referenceKinds?.includes("image")) throw new Error("This platform text model supports text messages only. Remove media references or choose another provider.");
        if (videoCount && !constraints?.referenceKinds?.includes("video")) throw new Error("This platform text model does not accept video references.");
        if (constraints?.maxImages != null && imageCount > constraints.maxImages) throw new Error(`This model accepts at most ${constraints.maxImages} reference images per message.`);
        if (constraints?.maxVideos != null && videoCount > constraints.maxVideos) throw new Error(`This model accepts at most ${constraints.maxVideos} reference videos per message.`);
    }
    if (messages.length > 100) throw new Error("This platform text model accepts at most 100 messages.");
    if (options?.videos?.length) {
        if (userIndex < 0) throw new Error("Video references require a user message.");
        const parts = await Promise.all(options.videos.map(async (video) => ({ type: "video_url" as const, video_url: { url: await workbenchReference(video) } })));
        messages = messages.map((message, index) => index === userIndex ? { ...message, content: [...(typeof message.content === "string" ? [{ type: "text" as const, text: message.content }] : message.content), ...parts] } : message);
    }
    const textMessages = await Promise.all(messages.map(async (message) => ({ ...message, content: typeof message.content === "string" ? message.content : await Promise.all(message.content.map(async (part) => {
        if (part.type === "text") return part;
        if (part.type === "video_url") return { ...part, video_url: { url: await workbenchReference({ url: part.video_url.url }) } };
        if (part.type !== "image_url") throw new Error("This platform text model accepts text, image and video references only.");
        return { ...part, image_url: { ...part.image_url, url: await workbenchReference({ url: part.image_url.url }) } };
    })) })));
    const result = await runAiTask("text", { model, messages: textMessages, systemPrompt: config.systemPrompt, reasoningEffort: config.reasoningEffort }, options);
    if (typeof result.text !== "string") throw new Error("This completed task has no text. Check AI tasks.");
    onDelta(result.text);
    return result.text;
}
export async function platformAudio(config: AiConfig, prompt: string, options?: PlatformRequestOptions & { audios?: ReferenceAudio[] }) {
    const { id: model, constraints } = modelFor(config, "audio");
    const audios = options?.audios || [];
    if (audios.length && !constraints?.referenceAudio) throw new Error("This platform voice model does not accept reference audio.");
    if (audios.length > 1) throw new Error("Voice cloning accepts one reference audio. Disconnect the extra audio nodes before generating.");
    if ([...prompt].length > 500) throw new Error("This platform voice model accepts at most 500 characters.");
    if (!["alloy", "default"].includes(config.audioVoice) || config.audioFormat !== "wav" || Number(config.audioSpeed) !== 1 || config.audioInstructions.trim()) throw new Error("This platform voice model requires voice alloy/default, WAV, speed 1, and no extra instructions.");
    const ref_audio = audios.length ? await workbenchReference(audios[0]) : undefined;
    const result = await runAiTask("audio", { model, prompt, ...(ref_audio ? { ref_audio } : {}), voice: config.audioVoice, format: config.audioFormat, speed: config.audioSpeed, instructions: config.audioInstructions }, options);
    if (!result.url) throw new Error("This completed task has no audio. Check AI tasks.");
    try {
        const response = await fetch(ownedAssetUrl(result.url), { credentials: "same-origin", signal: options?.signal });
        if (!response.ok) throw new Error("Audio download failed.");
        return await response.blob();
    } catch {
        throw new WorkbenchTaskPendingError("The task completed, but audio could not be downloaded. Retry reading it from AI tasks.");
    }
}
