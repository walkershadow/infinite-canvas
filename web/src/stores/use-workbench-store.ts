import type { LibraryDocument } from "@/stores/use-asset-store";
import { create } from "zustand";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

export type WorkbenchRecovery = { version: 1; projects: CanvasProject[]; deletedProjects: { id: string; deletedAt: string }[] };
export const useWorkbenchStore = create<{
    libraryVersion: number; libraryReady: boolean; librarySaving: boolean; libraryRecovery: LibraryDocument[] | null; libraryError: string; ready: boolean; saving: boolean; error: string; recovery: WorkbenchRecovery | null; balance: number | null;
}>(() => ({ libraryVersion: 0, libraryReady: false, librarySaving: false, libraryRecovery: null, libraryError: "", ready: false, saving: false, error: "", recovery: null, balance: null }));
