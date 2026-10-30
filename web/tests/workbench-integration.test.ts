import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

// Module mocks must not replace the real stores used by the other suites.
test("Workbench integration in an isolated process", () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/workbench-integration.case.ts`], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    console.log(result.stderr);
    expect(result.status).toBe(0);
});
