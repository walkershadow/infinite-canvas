// Stable authenticated paths, not signed CDN URLs or personal asset copies.
export const isPublicLibraryUrl = (url: string) => /^\/api\/canvas\/public-library\/[^/?#]+\/content(?:\?variant=thumb)?$/.test(url);
