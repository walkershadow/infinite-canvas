import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
for (const mode of ["overseas", "domestic", "standalone"]) test(`public library ${mode} access isolation`, () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/public-library.case.ts`], { env: { ...process.env, VITE_APP_MODE: mode }, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    expect(result.status).toBe(0);
});
