import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("video cover timeout in an isolated process", () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/video-cover-timeout.case.ts`], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    console.log(result.stderr);
    expect(result.status).toBe(0);
});
