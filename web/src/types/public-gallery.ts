export type GalleryCategory = "face" | "outfit" | "pose" | "depth";
export type GalleryLabel = { en: string; zh: string; original?: string };
export type PublicLibraryItem = {
    id: string; kind: GalleryCategory; groupId: string; title: GalleryLabel;
    category: string; categoryLabel: GalleryLabel; tags: string[]; tagsLocalized: { en: string[]; zh: string[] }; angle?: string; angleLabel?: GalleryLabel;
    thumbnailUrl: string; url: string; width: number; height: number;
    source: { label: string; url: string; author?: string };
};
export type PublicLibraryPage = {
    items: PublicLibraryItem[]; total: number; page: number; pageSize: number;
    facets: { categories: string[]; categoryLabels: Record<string, GalleryLabel> };
};
