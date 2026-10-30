import { workbenchRequest } from "./workbench";
import type { Prompt } from "./prompts";

export const PERSONAL_PROMPT_SOURCE = "workbench-personal";
type PromptEnvelope = { id: string; revision: number; document: Prompt; createdAt: string; updatedAt: string };
function fromEnvelope(item: PromptEnvelope): Prompt {
    return { ...item.document, id: item.id, sourceId: PERSONAL_PROMPT_SOURCE, cloudRevision: item.revision, createdAt: item.createdAt, updatedAt: item.updatedAt, category: item.document.category || "My prompts", tags: item.document.tags || [], referenceImageUrls: item.document.referenceImageUrls || [], coverUrl: item.document.coverUrl || "", description: item.document.description || "", githubUrl: item.document.githubUrl || "" };
}
export async function fetchPersonalPrompts() {
    const { prompts } = await workbenchRequest<{ prompts: PromptEnvelope[] }>("/prompts");
    return prompts.map(fromEnvelope);
}
export async function savePersonalPrompt(document: Prompt, current?: Prompt) {
    const { cloudRevision: _revision, ...content } = document;
    content.tags = content.tags.map((tag) => tag.trim()).filter(Boolean);
    content.referenceImageUrls = content.referenceImageUrls.map((url) => url.trim()).filter(Boolean);
    return fromEnvelope(await workbenchRequest<PromptEnvelope>(current ? `/prompts/${encodeURIComponent(current.id)}` : "/prompts", {
        method: current ? "PUT" : "POST", body: JSON.stringify({ document: content, ...(current ? { revision: current.cloudRevision } : {}) }),
    }));
}
export function deletePersonalPrompt(prompt: Prompt) {
    return workbenchRequest(`/prompts/${encodeURIComponent(prompt.id)}`, { method: "DELETE", body: JSON.stringify({ revision: prompt.cloudRevision }) });
}
