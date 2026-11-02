import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { validateWorkflow } from "@/lib/workflow-validation";
import type { WorkflowDocument, WorkflowImage } from "@/types/workflow";

export function workflowImageUrl(image: WorkflowImage) {
    return !image.storageKey && image.localPath ? `${import.meta.env.BASE_URL}${image.localPath}` : image.url;
}

export async function resolveWorkflowImages(document: WorkflowDocument, importFiles = false): Promise<WorkflowDocument> {
    validateWorkflow(document);
    const copy = structuredClone(document);
    const pending = new Map<string, Promise<WorkflowImage>>();
    await Promise.all([...copy.references, ...copy.stages].map(async item => {
        if (!item.image) return;
        const image = item.image;
        if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0 || typeof image.url !== "string") throw new Error("Invalid workflow image.");
        if (image.localPath && !/^case-references\/[a-z0-9-]+\.jpg$/.test(image.localPath)) throw new Error("Invalid workflow image path.");
        const key = image.storageKey || image.localPath || image.url;
        let request = pending.get(key);
        if (!request) {
            request = image.storageKey
                ? resolveImageUrl(image.storageKey, image.url).then(url => ({ ...image, url }))
                : importFiles ? uploadImage(workflowImageUrl(image)).then(uploaded => {
                    if (!uploaded.storageKey) throw new Error("Unable to save the reference image file.");
                    return { url: uploaded.url, storageKey: uploaded.storageKey, width: uploaded.width, height: uploaded.height };
                }) : Promise.resolve(image);
            pending.set(key, request);
        }
        item.image = { ...await request };
    }));
    return copy;
}
