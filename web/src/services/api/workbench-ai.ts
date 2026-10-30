import { workbenchRequest, workbenchSession } from "./workbench";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";
import { ownedAssetUrl, workbenchReference } from "@/services/workbench/projects";
import type { ReferenceImage } from "@/types/image";
import type { AiTextMessage } from "./image";

function modelFor(config: AiConfig, capability: "image" | "text" | "audio") {
    const model = modelOptionName(config.model || config[`${capability}Model`]);
    const session = workbenchSession();
    if (!session.capabilities[capability] || !session.aiModels?.some((item) => item.id === model && item.capability === capability)) throw new Error(`Workbench has not configured a billed ${capability} model yet. Your work is preserved; ask the platform administrator to enable this capability.`);
    return model;
}
export async function platformImages(config: AiConfig, prompt: string, references: ReferenceImage[], signal?: AbortSignal) {
    const model = modelFor(config, "image");
    const images = await Promise.all(references.map(workbenchReference));
    const result = await workbenchRequest<{ images: { id: string; url: string }[] }>("/ai/images", { method: "POST", signal, body: JSON.stringify({ requestKey: crypto.randomUUID(), model, prompt, images, size: config.size, quality: config.quality, count: Number(config.count), background: config.background, systemPrompt: config.systemPrompt }) });
    return result.images.map((image) => ({ id: image.id, dataUrl: ownedAssetUrl(image.url) }));
}
export async function platformText(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, signal?: AbortSignal) {
    const model = modelFor(config, "text");
    const ownedMessages = await Promise.all(messages.map(async (message) => ({ ...message, content: typeof message.content === "string" ? message.content : await Promise.all(message.content.map(async (part) => part.type === "text" ? part : { ...part, image_url: { url: await workbenchReference({ url: part.image_url.url }) } })) })));
    const { text } = await workbenchRequest<{ text: string }>("/ai/text", { method: "POST", signal, body: JSON.stringify({ requestKey: crypto.randomUUID(), model, messages: ownedMessages, systemPrompt: config.systemPrompt, reasoningEffort: config.reasoningEffort }) });
    onDelta(text);
    return text;
}
export async function platformAudio(config: AiConfig, prompt: string, signal?: AbortSignal) {
    const model = modelFor(config, "audio");
    const { url } = await workbenchRequest<{ url: string; mimeType: string }>("/ai/audio", { method: "POST", signal, body: JSON.stringify({ requestKey: crypto.randomUUID(), model, prompt, voice: config.audioVoice, format: config.audioFormat, speed: config.audioSpeed, instructions: config.audioInstructions }) });
    const response = await fetch(ownedAssetUrl(url), { credentials: "same-origin", signal });
    if (!response.ok) throw new Error("Unable to read generated audio.");
    return response.blob();
}
