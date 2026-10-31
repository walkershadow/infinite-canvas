import { test } from "bun:test";
import { spawnSync } from "node:child_process";
test("cloud collection loading races in an isolated process", () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/cloud-library-loading.case.ts`], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
});
