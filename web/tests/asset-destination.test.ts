import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
test("asset destination interaction contract in isolation", () => {
    const result = spawnSync(process.execPath, ["test", `${import.meta.dir}/fixtures/asset-destination.case.tsx`], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    console.log(result.stderr);
    expect(result.status).toBe(0);
});
