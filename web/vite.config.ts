import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { rawOverseasPromptCatalog } from "./src/services/api/overseas-prompt-catalog";
import { validateCatalogMediaMap, type CatalogMediaMap } from "./src/lib/catalog-media";

import { parseChangelog } from "./src/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");

// Expose /plugins/index.json with local plugin files from public/plugins.
// The frontend can discover and list them when enabled; development reads the directory live, while builds emit a static registry.
function localPluginsManifest(base: string): Plugin {
    const pluginsDir = resolve(webDir, "public/plugins");
    const listLocalPlugins = () => {
        try {
            return readdirSync(pluginsDir)
                .filter((file) => file.endsWith(".js"))
                .sort()
                .map((file) => `${base}plugins/${file}`);
        } catch {
            return [];
        }
    };
    return {
        name: "local-plugins-manifest",
        configureServer(server) {
            server.middlewares.use(`${base}plugins/index.json`, (_req, res) => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(listLocalPlugins()));
            });
        },
        generateBundle() {
            this.emitFile({ type: "asset", fileName: "plugins/index.json", source: JSON.stringify(listLocalPlugins()) });
        },
    };
}

export default defineConfig(({ mode, command }) => {
    const env = { ...loadEnv(mode, webDir, ""), ...process.env };
    const overseas = env.VITE_APP_MODE === "overseas";
    let catalogMediaMap: CatalogMediaMap | null = null;
    if (overseas) {
        if (env.CATALOG_MEDIA_MAP_FILE) {
            catalogMediaMap = JSON.parse(readFileSync(resolve(webDir, env.CATALOG_MEDIA_MAP_FILE), "utf8"));
            validateCatalogMediaMap(rawOverseasPromptCatalog, catalogMediaMap!);
        } else if (command === "build") {
            throw new Error("Overseas builds require CATALOG_MEDIA_MAP_FILE. See docs/catalog-media-storage.md.");
        } else {
            catalogMediaMap = { version: 1, allowedOrigins: [], media: {} };
        }
    }
    const base = overseas ? "/canvas/" : env.VITE_BASE || "/";
    return {
        base,
        server: overseas ? { proxy: { "/api": { target: env.WORKBENCH_DEV_ORIGIN || "http://localhost:3100", changeOrigin: true, xfwd: true } } } : undefined,
        plugins: [react(), localPluginsManifest(base), ...(overseas ? [{
            name: "overseas-html",
            transformIndexHtml: (html: string) => html
                .replace('lang="zh-CN"', 'lang="en-US"')
                .replace("<title>无限画布</title>", "<title>Canvas · Workbench</title>")
                .replace('content="一个无限画布创作工具"', 'content="Create with images, video, text, and connected workflows in Workbench Canvas."'),
        }] : [])],
        resolve: {
            alias: {
                "@": resolve(webDir, "src"),
            },
        },
        define: {
            __CATALOG_MEDIA_MAP__: JSON.stringify(catalogMediaMap),
            __APP_VERSION__: JSON.stringify(localVersion),
            __APP_RELEASES__: JSON.stringify(parseChangelog(localChangelog)),
        },
};
});
