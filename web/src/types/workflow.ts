import type { OverseasPromptEntry } from "./prompt-catalog";

export type WorkflowImage = { url: string; storageKey?: string; localPath?: string; width: number; height: number };

export type WorkflowStage = {
    image?: WorkflowImage;
    inputOrder?: string[];
    id: string;
    title: string;
    mode: "planning" | "image" | "video" | "audio" | "manual";
    prompt: string;
    dependsOn: string[];
};
export type WorkflowReference = {
    image?: WorkflowImage;
    id: string;
    title: string;
    kind: "image" | "video" | "audio";
    role: string;
    stageIds: string[];
    required: boolean;
};
export type WorkflowDocument = {
    schemaVersion: 1;
    source: OverseasPromptEntry;
    language: "en" | "zh" | "original";
    stages: WorkflowStage[];
    references: WorkflowReference[];
};
