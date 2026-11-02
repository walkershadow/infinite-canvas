import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
for (const mode of ["domestic", "overseas", "standalone"]) test(`${mode} Workbench mode, account isolation and capability contract`, () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/workbench-modes.case.ts`], { env: { ...process.env, VITE_APP_MODE: mode }, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    expect(result.status).toBe(0);
});
