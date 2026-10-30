import { create } from "zustand";
import type { AiTaskRecord } from "@/services/api/workbench-ai-tasks";
export const useAiTasksStore = create<{ records: AiTaskRecord[]; error: string }>(() => ({ records: [], error: "" }));
