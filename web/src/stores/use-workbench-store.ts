import { create } from "zustand";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

export type WorkbenchRecovery = { version: 1; projects: CanvasProject[]; deletedProjects: { id: string; deletedAt: string }[] };
export const useWorkbenchStore = create<{
    ready: boolean; saving: boolean; error: string; recovery: WorkbenchRecovery | null; balance: number;
}>(() => ({ ready: false, saving: false, error: "", recovery: null, balance: 0 }));
