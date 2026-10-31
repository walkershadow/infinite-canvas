import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

export type WorkbenchModel = {
    id: string;
    name: string;
    price: number;
    billingUnit: "request" | "second";
    prices?: Record<number, number>;
    durations: number[];
    defaultDuration: number;
    ratios: { value: string; label: string; size: string }[];
    supportsImage: boolean;
    supportsVideo: boolean;
    supportsAudio: boolean;
    supportsFrames?: boolean;
    maxImages?: number;
    maxVideos?: number;
    maxAudios?: number;
    freeQuota: boolean;
};
export type WorkbenchBootstrap = {
    user: { id: string; name?: string; image?: string };
    models: WorkbenchModel[];
    aiModels?: { id: string; name: string; capability: "image" | "text" | "audio"; price: number; constraints?: { textOnly?: boolean; maxImages?: number; maxVideos?: number; referenceAudio?: boolean; maxAudios?: number; referenceKinds?: ("text" | "image" | "video" | "audio")[] } }[];
    quota: { points: number; daily: { remaining: number } };
    capabilities: { video: boolean; image: boolean; text: boolean; audio: boolean; externalPlugins: boolean };
    currency: string;
    pointsPerUsd: number;
};
export type NativeDocument = CanvasProject & { schemaVersion: 1 };
export type CloudProject = { id: string; revision: number; document: NativeDocument; title: string; createdAt: string; updatedAt: string };
export type WorkbenchTask = { id: string; createdAt?: string; nodeId?: string; requestKey?: string; status: string; videoUrl?: string; error?: string | null };
