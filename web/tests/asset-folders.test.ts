import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
for (const mode of ["overseas", "domestic", "standalone", "legacy"]) test(`asset folder persistence and compatibility: ${mode}`, () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/asset-folders.case.ts`], { env: { ...process.env, VITE_APP_MODE: mode === "legacy" ? "overseas" : mode, LIBRARY_TEST_VERSION: mode === "legacy" ? "1" : "2" }, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    console.log(result.stderr);
    expect(result.status).toBe(0);
});
