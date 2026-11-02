import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function copyOverseasPublicAssets(publicDir: string, outDir: string) {
    const excluded = resolve(publicDir, "case-references");
    cpSync(publicDir, outDir, { recursive: true, filter: source => resolve(source) !== excluded });
    rmSync(resolve(outDir, "case-references"), { recursive: true, force: true });
}

export function overseasPublicAssets(): Plugin {
    let publicDir: string;
    let outDir: string;
    return {
        name: "overseas-public-assets",
        apply: "build",
        configResolved(config) {
            publicDir = config.publicDir;
            outDir = resolve(config.root, config.build.outDir);
        },
        writeBundle() { copyOverseasPublicAssets(publicDir, outDir); },
    };
}
