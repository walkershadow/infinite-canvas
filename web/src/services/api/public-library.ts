import { isOverseas } from "@/constant/integration";
import { workbenchRequest, workbenchSession } from "./workbench";
import type { GalleryCategory, PublicLibraryPage } from "@/types/public-gallery";
import type { WorkflowDocument } from "@/types/workflow";
import { validateWorkflow } from "@/lib/workflow-validation";

export function canUsePublicLibrary() {
    return isOverseas && workbenchSession().capabilities.publicLibrary === true;
}
function requirePublicLibrary() {
    if (!canUsePublicLibrary()) throw new Error("Public library access is not enabled for this account.");
}
export function listPublicLibrary(query: { kind: GalleryCategory; page: number; search: string; category: string; groupId: string }, signal?: AbortSignal) {
    requirePublicLibrary();
    return workbenchRequest<PublicLibraryPage>(`/public-library?${new URLSearchParams({ ...query, page: String(query.page) })}`, { signal });
}
export async function listPublicWorkflows(language: WorkflowDocument["language"], signal?: AbortSignal) {
    requirePublicLibrary();
    const result = await workbenchRequest<{ items: WorkflowDocument[] }>(`/public-library/workflows?language=${language}`, { signal });
    result.items.forEach(validateWorkflow);
    return result.items;
}
export async function openPublicWorkflow(id: string, language: WorkflowDocument["language"]) {
    requirePublicLibrary();
    const document = await workbenchRequest<WorkflowDocument>(`/public-library/workflows/${encodeURIComponent(id)}/open?language=${language}`, { method: "POST" });
    validateWorkflow(document);
    return document;
}
