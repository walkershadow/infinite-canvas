import { useWorkflowLocale } from "@/hooks/use-workflow-locale";
import { useState } from "react";
import { App, Form, Input, Modal } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import type { Prompt } from "@/services/api/prompts";
import { PERSONAL_PROMPT_SOURCE, savePersonalPrompt } from "@/services/api/personal-prompts";

export function PersonalPromptEditor({ prompt, onClose }: { prompt?: Prompt; onClose: () => void }) {
    const { text } = useWorkflowLocale();
    const { message } = App.useApp();
    const client = useQueryClient();
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<Prompt>(() => prompt || { id: nanoid(), title: "", prompt: "", description: "", category: text("My prompts"), coverUrl: "", tags: [], referenceImageUrls: [], preview: "", createdAt: "", updatedAt: "", sourceId: PERSONAL_PROMPT_SOURCE, githubUrl: "" });
    const save = async () => {
        if (!draft.title.trim() || !draft.prompt.trim()) { void message.error(text("Enter a title and prompt.")); return; }
        setSaving(true);
        try {
            await savePersonalPrompt(draft, prompt);
            await Promise.all([client.invalidateQueries({ queryKey: ["prompts"] }), client.invalidateQueries({ queryKey: ["side-panel-prompts", PERSONAL_PROMPT_SOURCE] })]);
            void message.success(text("Prompt saved to your account."));
            onClose();
        } catch (error) { void message.error(error instanceof Error ? error.message : text("Unable to save prompt.")); }
        finally { setSaving(false); }
    };
    return <Modal open title={text(prompt ? "Edit personal prompt" : "New personal prompt")} okText={text("Save")} cancelText={text("Cancel")} confirmLoading={saving} onOk={() => void save()} onCancel={onClose} maskClosable={!saving}>
        <Form layout="vertical">
            <Form.Item label={text("Title")} required><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Form.Item>
            <Form.Item label={text("Prompt")} required><Input.TextArea rows={7} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} /></Form.Item>
            <Form.Item label={text("Description")}><Input.TextArea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Form.Item>
            <Form.Item label={text("Category")}><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Form.Item>
            <Form.Item label={text("Tags (comma separated)")}><Input value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((tag) => tag.trim()) })} /></Form.Item>
            <Form.Item label={text("Cover URL")}><Input value={draft.coverUrl} onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })} /></Form.Item>
            <Form.Item label={text("Reference image URLs (one per line)")}><Input.TextArea value={draft.referenceImageUrls.join("\n")} onChange={(e) => setDraft({ ...draft, referenceImageUrls: e.target.value.split("\n") })} /></Form.Item>
        </Form>
    </Modal>;
}
