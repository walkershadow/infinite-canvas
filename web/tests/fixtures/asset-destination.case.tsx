import { expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
const React = await import("react");
let dialog: any;
let folders = [{ id: "target" }];
const errors: string[] = [];
let failLoad = false;
mock.module("@/constant/integration", () => ({ isWorkbench: true }));
mock.module("@/services/workbench/library", () => ({ initializeCloudLibrary: async () => { if (failLoad) throw new Error("offline"); } }));
mock.module("react", () => ({ ...React, useCallback: (fn: unknown) => fn, useState: () => ["", () => {}] }));
mock.module("antd", () => ({ App: { useApp: () => ({ modal: { confirm: (props: unknown) => { dialog = props; } }, message: { error: (text: string) => errors.push(text) } }) } }));
mock.module("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
mock.module("@/components/assets/asset-folder-select", () => ({ AssetFolderSelect: () => null }));
mock.module("@/hooks/use-asset-folders-enabled", () => ({ useAssetFoldersEnabled: () => true }));
mock.module("@/stores/use-asset-store", () => ({ useAssetStore: { getState: () => ({ folders }) } }));
const { useAssetDestination } = await import("@/hooks/use-asset-destination");

test("destination defaults to root, cancellation stays distinct, stale folders cannot silently save", async () => {
    const choose = useAssetDestination();
    const root = choose(); await Promise.resolve(); dialog.onOk(); expect(await root).toBe("");
    const picked = choose(); await Promise.resolve(); dialog.content.props.onChange("target"); dialog.onOk(); expect(await picked).toBe("target");
    const canceled = choose(); await Promise.resolve(); dialog.content.props.onChange("target"); dialog.onCancel(); expect(await canceled).toBeNull();
    const stale = choose(); await Promise.resolve(); dialog.content.props.onChange("target"); folders = [];
    await expect(dialog.onOk()).rejects.toThrow("Folder no longer exists");
    expect(errors).toEqual(["assetFolders.missing"]);
    dialog.onCancel(); expect(await stale).toBeNull();
    failLoad = true; dialog = undefined;
    expect(await choose()).toBeNull(); expect(dialog).toBeUndefined();
    expect(errors.at(-1)).toBe("assetFolders.loadFailed");
});

test("every UI save entry has a destination gate before asset writes; workflow dedupe is destination scoped", () => {
    for (const path of ["pages/prompts/index.tsx", "components/layout/prompt-source-content-modal.tsx", "pages/image/index.tsx", "pages/video/index.tsx", "pages/canvas/project.tsx", "components/canvas/canvas-side-panel.tsx", "components/prompts/workflow-editor.tsx"]) {
        const source = readFileSync(`${import.meta.dir}/../../src/${path}`, "utf8");
        expect(source).toContain('from "@/hooks/use-asset-destination"');
        expect(source).toContain("await chooseDestination()");
        expect(source).toContain("folderId === null");
        expect(source).toContain("folderId: folderId || undefined");
    }
    const workflow = readFileSync(`${import.meta.dir}/../../src/components/prompts/workflow-editor.tsx`, "utf8");
    expect(workflow).toContain('(a.folderId || "") === folderId');
    expect(workflow.indexOf("if (folderId === null) return;")).toBeLessThan(workflow.indexOf("await resolveWorkflowImages(document, true)"));
    const image = readFileSync(`${import.meta.dir}/../../src/pages/image/index.tsx`, "utf8").split("const saveResultToAssets")[1];
    expect(image.indexOf("if (folderId === null) return;")).toBeLessThan(image.indexOf("await uploadImage"));
});
