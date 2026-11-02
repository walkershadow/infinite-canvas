import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rawOverseasPromptCatalog } from "../src/services/api/overseas-prompt-catalog";
import { catalogMediaDependencies } from "../src/lib/catalog-media";
const media = catalogMediaDependencies(rawOverseasPromptCatalog);
const destination = resolve(import.meta.dir, "../../docs/catalog-media-manifest.json");
writeFileSync(destination, JSON.stringify({ version: 1, media }, null, 2) + "\n");
console.log(`${media.length} unique media dependencies → ${destination}`);
