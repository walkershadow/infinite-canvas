import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyOverseasPublicAssets } from "../scripts/overseas-public-assets";

test("overseas public copy excludes original media and removes stale copies without changing source or other assets", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-public-"));
    try {
        const source = join(dir, "public");
        const output = join(dir, "dist");
        for (const base of [source, output]) mkdirSync(join(base, "case-references"), { recursive: true });
        mkdirSync(join(source, "icons"));
        writeFileSync(join(source, "case-references", "original.jpg"), "original");
        writeFileSync(join(output, "case-references", "stale.jpg"), "old build");
        writeFileSync(join(source, "icons", "logo.svg"), "logo");
        writeFileSync(join(output, "index.html"), "built HTML");
        copyOverseasPublicAssets(source, output);
        expect(existsSync(join(output, "case-references"))).toBe(false);
        expect(readFileSync(join(source, "case-references", "original.jpg"), "utf8")).toBe("original");
        expect(readFileSync(join(output, "icons", "logo.svg"), "utf8")).toBe("logo");
        expect(readFileSync(join(output, "index.html"), "utf8")).toBe("built HTML");
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
