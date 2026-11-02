import type { OverseasPromptEntry } from "../types/prompt-catalog";

export type CatalogMediaMap = { version: 1; allowedOrigins: string[]; media: Record<string, { url: string } | { unavailable: true; reason: string }> };
export function catalogMediaDependencies(entries: OverseasPromptEntry[]) {
    const files = new Map<string, { key: string; kind: "image" | "video"; urls: string[]; repositoryPath?: string; uses: { caseId: string; role: string; sources: OverseasPromptEntry["sources"] }[] }>();
    for (const entry of entries) {
        const add = (role: string, image: { url: string; localPath?: string }, kind: "image" | "video") => {
            const key = image.localPath ? `web/public/${image.localPath}` : image.url;
            const record = files.get(key) || { key, kind, urls: [], ...(image.localPath ? { repositoryPath: key } : {}), uses: [] };
            if (!record.urls.includes(image.url)) record.urls.push(image.url);
            record.uses.push({ caseId: entry.id, role, sources: entry.sources });
            files.set(key, record);
        };
        for (const field of ["referenceMedia", "outputMedia"] as const) entry[field].forEach((media, i) => {
            add(`${field}[${i}]`, media, media.kind);
            if (media.poster) add(`${field}[${i}].poster`, { url: media.poster }, "image");
        });
        for (const field of ["steps", "referenceInputs"] as const) entry[field]?.forEach((item, i) => {
            if (item.image) add(`${field}[${i}].image`, item.image, "image");
        });
    }
    return [...files.values()];
}

export function validateCatalogMediaMap(entries: OverseasPromptEntry[], mapping: CatalogMediaMap) {
    if (mapping.version !== 1 || !Array.isArray(mapping.allowedOrigins) || !mapping.media) throw new Error("Invalid catalog media map.");
    for (const item of catalogMediaDependencies(entries)) {
        const target = mapping.media[item.key];
        if (!target) throw new Error(`Missing catalog media mapping: ${item.key}`);
        if ("unavailable" in target) {
            if (target.unavailable !== true || !target.reason?.trim()) throw new Error(`Missing unavailable reason: ${item.key}`);
        } else {
            const url = new URL(target.url);
            if (url.protocol !== "https:" || url.username || url.password || !mapping.allowedOrigins.includes(url.origin)) throw new Error(`Invalid catalog CDN URL: ${item.key}`);
        }
    }
}

export function mapCatalogMedia(entries: OverseasPromptEntry[], mapping: CatalogMediaMap): OverseasPromptEntry[] {
    const copy = structuredClone(entries);
    const target = (item: { url: string; localPath?: string }) => mapping.media[item.localPath ? `web/public/${item.localPath}` : item.url];
    for (const entry of copy) {
        for (const media of [...entry.referenceMedia, ...entry.outputMedia]) {
            const result = target(media);
            media.originalUrl = media.url;
            delete media.localPath;
            if (result && "url" in result) media.url = result.url;
            else media.unavailable = true;
            if (media.poster) {
                const poster = target({ url: media.poster });
                media.originalPoster = media.poster;
                media.poster = poster && "url" in poster ? poster.url : undefined;
            }
        }
        for (const item of [...entry.steps, ...(entry.referenceInputs || [])]) {
            if (!item.image) continue;
            const result = target(item.image);
            if (result && "url" in result) { item.image.url = result.url; delete item.image.localPath; }
            else delete item.image;
        }
    }
    return copy;
}
