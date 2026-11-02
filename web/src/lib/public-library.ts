// Stable authenticated paths, not signed CDN URLs or personal asset copies.
export const isPublicLibraryUrl = (url: string) => /^\/api\/canvas\/public-library\/[^/?#]+\/content(?:\?variant=thumb)?$/.test(url);

// Source pose/depth IDs share the same action and angle suffix; only the kind prefix differs.
export const poseGroupForKind = (groupId: string, kind: "pose" | "depth") => groupId.replace(/^(pose|depth)-/, `${kind}-`);
