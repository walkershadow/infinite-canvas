/** Shared with Workbench native-canvas-workflow.ts; keep protocol validation identical. */
export function validateWorkflow(value: unknown): void {
    const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
    const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
    const fail = () => { throw new Error("Invalid workflow document or unsupported version."); };
    if (!obj(value)) return fail();
    const w = value;
    if (w.schemaVersion !== 1 || !["en", "zh", "original"].includes(w.language) || !obj(w.source) || !Array.isArray(w.stages) || !Array.isArray(w.references)) return fail();
    const s = w.source;
    if (typeof s.id !== "string" || typeof s.title !== "string" || typeof s.summary !== "string" || typeof s.category !== "string" || !["case", "template"].includes(s.contentKind) || !strings(s.tags) || !Array.isArray(s.steps) || !Array.isArray(s.sources) || !Array.isArray(s.referenceMedia) || !Array.isArray(s.outputMedia)) return fail();
    if (s.notes !== undefined && !strings(s.notes)) return fail();
    const sourceIds = new Set<string>();
    for (const step of s.steps) {
        if (!obj(step) || typeof step.id !== "string" || !step.id || sourceIds.has(step.id) || typeof step.title !== "string" || typeof step.instruction !== "string" || !obj(step.prompts) || Object.values(step.prompts).some(x => typeof x !== "string")) return fail();
        sourceIds.add(step.id);
    }
    const safeUrl = (v: unknown) => { try { return typeof v === "string" && ["https:", "http:"].includes(new URL(v).protocol); } catch { return false; } };
    for (const source of s.sources) if (!obj(source) || !["original", "curation"].includes(source.role) || typeof source.label !== "string" || !safeUrl(source.url)) return fail();
    for (const media of [...s.referenceMedia, ...s.outputMedia]) if (!obj(media) || !["image", "video"].includes(media.kind) || !safeUrl(media.url) || typeof media.caption !== "string" || (media.poster !== undefined && !safeUrl(media.poster))) return fail();
    const ids = new Set<string>();
    for (const stage of w.stages) {
        if (!obj(stage) || typeof stage.id !== "string" || !stage.id || ids.has(stage.id) || typeof stage.title !== "string" || typeof stage.prompt !== "string" || !["planning", "image", "video", "audio", "manual"].includes(stage.mode) || !strings(stage.dependsOn) || stage.dependsOn.some((id: string) => !ids.has(id)) || new Set(stage.dependsOn).size !== stage.dependsOn.length) return fail();
        ids.add(stage.id);
    }
    const refs = new Set<string>();
    for (const ref of w.references) {
        if (!obj(ref) || typeof ref.id !== "string" || !ref.id || refs.has(ref.id) || typeof ref.title !== "string" || typeof ref.role !== "string" || !["image", "video", "audio"].includes(ref.kind) || typeof ref.required !== "boolean" || !strings(ref.stageIds) || ref.stageIds.some((id: string) => !ids.has(id))) return fail();
        refs.add(ref.id);
    }
}
