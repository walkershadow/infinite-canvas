import { resolveCatalogWorkflowMedia } from "@/services/api/overseas-prompt-catalog";
import { resolveWorkflowImages, workflowImageUrl } from "@/services/workflow-images";
import { useWorkflowLocale } from "@/hooks/use-workflow-locale";
import { catalogTitle, catalogSummary } from "@/lib/prompt-catalog-locale";
import { focusViewportForNode } from "@/lib/canvas/canvas-node-geometry";
import { useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";
import { initializeCloudLibrary, saveCloudLibrary } from "@/services/workbench/library";
import { useRef, useState } from "react";
import { App, Button, Input, Modal, Select, Switch, Tabs } from "antd";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import type { WorkflowDocument, WorkflowStage } from "@/types/workflow";
import type { WorkflowAsset } from "@/stores/use-asset-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { instantiateWorkflow, workflowAsset } from "@/lib/workflow";
import { validateWorkflow } from "@/lib/workflow-validation";

const workflowIdentity = (document: WorkflowDocument) => JSON.stringify(document, (key, value) => key === "image" ? undefined : value);

export function WorkflowActions({ document }: { document: WorkflowDocument }) {
    const { text } = useWorkflowLocale();
    const [editing, setEditing] = useState(false);
    const saving = useRef(false);
    const [busy, setBusy] = useState(false);
    const { message } = App.useApp();
    const assets = useAssetStore(s => s.assets);
    const exists = assets.some(a => a.kind === "workflow" && workflowIdentity(a.data) === workflowIdentity(document));
    const save = async () => {
        if (saving.current) return;
        saving.current = true; setBusy(true);
        try {
            await initializeCloudLibrary();
            if (!useAssetStore.getState().assets.some(a => a.kind === "workflow" && workflowIdentity(a.data) === workflowIdentity(document))) useAssetStore.getState().addAsset(workflowAsset(await resolveWorkflowImages(document, true)));
            await saveCloudLibrary();
            message.success(text("Entire workflow saved to My Assets."));
        } catch (error) { message.error(error instanceof Error ? text(error.message) : text("Unable to save workflow. Local edits are preserved.")); }
        finally { saving.current = false; setBusy(false); }
    };
    return <div className="my-4 flex flex-wrap gap-2">
        <Button disabled={exists || busy} loading={busy} onClick={() => void save()}>{exists ? text("Saved to My Assets") : text("Save to My Assets")}</Button>
        <Button type="primary" onClick={() => setEditing(true)}>{text("Edit in Canvas")}</Button>
        {editing && <WorkflowEditor document={document} onClose={() => setEditing(false)} />}
    </div>;
}

export function WorkflowEditor({ document, asset, onClose }: { document: WorkflowDocument; asset?: WorkflowAsset; onClose: () => void }) {
    const { text, language } = useWorkflowLocale();
    const [draft, setDraft] = useState(() => resolveCatalogWorkflowMedia(document));
    const saving = useRef(false);
    const [busy, setBusy] = useState(false);
    const { message } = App.useApp();
    const navigate = useNavigate();
    const patchStage = (id: string, patch: Partial<WorkflowStage>) => setDraft(d => ({ ...d, stages: d.stages.map(s => s.id === id ? { ...s, ...patch, ...(patch.mode && patch.mode !== "image" ? { image: undefined } : {}) } : s) }));
    const act = async (canvas: boolean) => {
        if (saving.current) return;
        saving.current = true; setBusy(true);
        try {
            validateWorkflow(draft);
            const prepared = await resolveWorkflowImages(draft, true);
            if (canvas) {
                const graph = instantiateWorkflow(prepared);
                const panel = useCanvasSidePanelStore.getState();
                const viewport = focusViewportForNode(graph.nodes[0], { width: window.innerWidth - (panel.panelOpen ? panel.width : 0), height: window.innerHeight });
                const id = useCanvasStore.getState().importProject({ title: catalogTitle(draft.source, draft.language), nodes: graph.nodes, connections: graph.connections, viewport });
                onClose(); navigate(`/canvas/${id}`);
            } else {
                await initializeCloudLibrary();
                const value = workflowAsset(prepared);
                asset ? useAssetStore.getState().updateAsset(asset.id, { data: value.data }) : useAssetStore.getState().addAsset(value);
                await saveCloudLibrary();
                message.success(text("Entire workflow saved. Original text is preserved.")); onClose();
            }
        } catch (error) { message.error(error instanceof Error ? text(error.message) : text("Unable to save workflow.")); } finally { saving.current = false; setBusy(false); }
    };
    return <Modal title={`${text("Workflow")} · ${catalogTitle(draft.source, language)}`} open onCancel={onClose} width={960} style={{ top: 20 }} styles={{ body: { maxHeight: "min(64dvh, calc(100dvh - 230px))", overflowY: "auto" } }} footer={<div className="flex flex-wrap justify-end gap-2"><Button onClick={onClose}>{text("Cancel")}</Button><Button disabled={busy} loading={busy} onClick={() => void act(false)}>{asset ? text("Save changes") : text("Save to My Assets")}</Button><Button type="primary" disabled={busy} onClick={() => void act(true)}>{text("Create canvas copy")}</Button></div>}>
        <p className="mb-4 text-sm text-muted-foreground">{text("Edit your draft below. Original source text and sample results stay attached to this workflow. Creating a canvas does not generate or spend points. Choose models and parameters in the canvas.")}</p>
        {draft.source.sourceCompleteness !== "complete" && <p className="mb-4 rounded border border-border p-3 text-sm">{text("The published source is incomplete. Its available text is preserved for review; do not treat it as a complete original workflow.")}</p>}
        {draft.source.availabilityNote && <p role="status" className="mb-4 rounded border border-border p-3 text-sm">{text(draft.source.availabilityNote)}</p>}
        <WorkflowSource document={draft} />
        <div className="my-4 flex flex-wrap items-center gap-2"><span>{text("Draft language")}</span><Select aria-label={text("Draft language")} value={draft.language} options={[{ value: "en", label: text("English") }, { value: "zh", label: text("Chinese") }, { value: "original", label: text("Original") }]} onChange={language => setDraft(d => ({ ...d, language }))} /><span className="text-xs text-muted-foreground">{text("Language selection never overwrites edits. Use “Load source version” explicitly.")}</span></div>
        <div className="space-y-4">{draft.stages.map((stage, i) => <section key={stage.id} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-2"><Input aria-label={`${text("Stage")} ${i + 1} ${text("title")}`} value={stage.title} onChange={e => patchStage(stage.id, { title: e.target.value })} className="!w-full min-w-0 sm:!w-auto sm:flex-1" /><Select aria-label={`${text("Stage")} ${i + 1} ${text("type")}`} value={stage.mode} options={["planning", "image", "video", "audio", "manual"].map(value => ({ value, label: text(value) }))} onChange={mode => patchStage(stage.id, { mode })} /><Button onClick={() => setDraft(d => ({ ...d, stages: d.stages.filter(s => s.id !== stage.id).map(s => ({ ...s, dependsOn: s.dependsOn.filter(id => id !== stage.id) })), references: d.references.map(r => ({ ...r, stageIds: r.stageIds.filter(id => id !== stage.id) })) }))}>{text("Remove")}</Button></div>
            {stage.image && <div><img src={workflowImageUrl(stage.image)} alt={stage.title} className="max-h-40 max-w-full rounded object-contain" /><p className="text-xs text-muted-foreground">{text("Author’s image is included. You can edit the prompt and regenerate it.")}</p></div>}
            <Input.TextArea aria-label={`${text("Stage")} ${i + 1} ${text("prompt")}`} rows={5} value={stage.prompt} onChange={e => patchStage(stage.id, { prompt: e.target.value })} placeholder={text("Review the planning output and enter the complete generation prompt here.")} />
            {draft.source.steps.find(s => s.id === stage.id)?.prompts[draft.language] && <Button size="small" onClick={() => Modal.confirm({ title: text("Replace this draft with the selected source version?"), content: text("Your current draft for this stage will be replaced; the original remains unchanged."), onOk: () => patchStage(stage.id, { prompt: draft.source.steps.find(s => s.id === stage.id)!.prompts[draft.language]! }) })}>{text("Load source version")}</Button>}
            <label className="block text-sm">{text("Required earlier outputs")}<Select className="mt-1 w-full" aria-label={`${text("Stage")} ${i + 1} ${text("dependencies")}`} mode="multiple" value={stage.dependsOn} options={draft.stages.slice(0, i).filter(s => s.mode !== "manual").map(s => ({ value: s.id, label: s.title }))} onChange={dependsOn => patchStage(stage.id, { dependsOn })} /></label>
        </section>)}</div>
        <Button className="mt-3" onClick={() => setDraft(d => ({ ...d, stages: [...d.stages, { id: nanoid(), title: text("New generation stage"), mode: "video", prompt: "", dependsOn: [] }] }))}>{text("Add stage")}</Button>
        <h3 className="mb-2 mt-6 font-semibold">{text("Reference inputs")}</h3><p className="mb-3 text-xs text-muted-foreground">{text("Add placeholders here and upload your media into their canvas nodes. Roles describe the source; select normal references or first/last-frame mode explicitly in the video settings. External sample results are never used as inputs automatically.")}</p>
        {draft.references.map((ref, i) => <div key={ref.id} className="mb-3 space-y-2 rounded border border-border p-3"><div className="flex flex-wrap gap-2">{ref.image && <img src={workflowImageUrl(ref.image)} alt={ref.title} className="max-h-40 max-w-full rounded object-contain" />}<Input aria-label={`${text("Reference")} ${i + 1} ${text("name")}`} className="!w-full min-w-0 sm:!w-auto sm:flex-1" value={ref.title} onChange={e => setDraft(d => ({ ...d, references: d.references.map(r => r.id === ref.id ? { ...r, title: e.target.value } : r) }))} /><Select aria-label={`${text("Reference")} ${i + 1} ${text("media type")}`} value={ref.kind} options={["image", "video", "audio"].map(value => ({ value, label: text(value) }))} onChange={kind => setDraft(d => ({ ...d, references: d.references.map(r => r.id === ref.id ? { ...r, kind, ...(kind !== "image" ? { image: undefined } : {}) } : r) }))} /></div><Input aria-label={`${text("Reference")} ${i + 1} ${text("role")}`} value={ref.role} placeholder={text("Role or original token (character, product, storyboard, @Image1…)")} onChange={e => setDraft(d => ({ ...d, references: d.references.map(r => r.id === ref.id ? { ...r, role: e.target.value } : r) }))} /><Select aria-label={`${text("Reference")} ${i + 1} ${text("stages")}`} className="w-full" mode="multiple" value={ref.stageIds} placeholder={text("Used by stages")} options={draft.stages.map(s => ({ value: s.id, label: s.title }))} onChange={stageIds => setDraft(d => ({ ...d, references: d.references.map(r => r.id === ref.id ? { ...r, stageIds } : r) }))} /><div className="flex items-center gap-2"><Switch aria-label={`${text("Reference")} ${i + 1} ${text("required")}`} checked={ref.required} onChange={required => setDraft(d => ({ ...d, references: d.references.map(r => r.id === ref.id ? { ...r, required } : r) }))} /><span>{text("Required")}</span><Button size="small" onClick={() => setDraft(d => ({ ...d, references: d.references.filter(r => r.id !== ref.id) }))}>{text("Remove")}</Button></div></div>)}
        <Button onClick={() => setDraft(d => ({ ...d, references: [...d.references, { id: nanoid(), title: text("Reference"), kind: "image", role: text("ordinary reference"), required: true, stageIds: [] }] }))}>{text("Add reference input")}</Button>
    </Modal>;
}

export function WorkflowSource({ document }: { document: WorkflowDocument }) {
    const { text, language } = useWorkflowLocale();
    return <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{text("Original source, translations & examples")}</summary><p className="my-3 text-sm">{catalogSummary(document.source, language)}</p>{document.source.steps.map(step => <div key={step.id}><h4>{text(step.title)}</h4><Tabs key={language} defaultActiveKey={language} items={(["en", "zh", "original"] as const).filter(lang => step.prompts[lang]).map(lang => ({ key: lang, label: { en: text("English"), zh: text("Chinese"), original: text("Original") }[lang], children: <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-6">{step.prompts[lang]}</pre> }))} /></div>)}{document.source.referenceMedia.map((media, i) => <p key={`ref:${i}`} className="my-2 text-sm">{media.unavailable ? <span>{text("Media unavailable")}: {text(media.caption)}</span> : <a href={media.url} target="_blank" rel="noopener noreferrer">{text("Source reference")}: {text(media.caption)} ↗</a>}</p>)}{document.source.notes?.map((note, i) => <p key={`note:${i}`} className="my-2 text-xs text-muted-foreground">{text(note)}</p>)}{document.source.outputMedia.map((media, i) => <p key={i} className="my-2 text-sm">{media.unavailable ? <span>{text("Media unavailable")}: {text(media.caption)}</span> : <a href={media.url} target="_blank" rel="noopener noreferrer">{text("External sample")}: {text(media.caption)} ↗</a>}</p>)}{document.source.sources.map(source => <a className="my-2 block text-sm underline" key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{text(source.label)} · {source.license ? text(source.license) : source.author} ↗</a>)}</details>;
}
