import { expect, test } from "bun:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/services/workbench/video.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const model = { id: "seedance2.5-full-720p", name: "720p", price: 4.9, billingUnit: "second", durations: [5], defaultDuration: 5, ratios: [{value: "16:9"}], videoReferenceMultiplier: 3, priceRoundingStep: .5 };
const session = { models: [model], capabilities: {video:true}, currency:"CNY", pointsPerYuan:10 };
const loaded = {exports: {} as any};
new Function("require", "exports", code)((name: string) => name.includes("media-size") ? {inferVideoRatio:()=>"16:9"} : name.includes("use-config-store") ? {modelOptionName:(s:string)=>s} : {workbenchSession:()=>session}, loaded.exports);
const {workbenchVideoInput, workbenchVideoEstimateText} = loaded.exports;
const config = {model:model.id, videoSeconds:5, size:"16:9"};
test("video add/remove changes whole-task fee and keeps half-point rounding", () => {
 expect(workbenchVideoInput(config).points).toBe(24.5);
 const withVideo = workbenchVideoInput(config, true);
 expect(withVideo.points).toBe(73.5);
 expect(withVideo.amount).toBe(7.35);
 expect(workbenchVideoEstimateText(withVideo, "zh-CN")).toContain("含视频参考");
 expect(workbenchVideoInput(config, false).points).toBe(24.5);
});
test("missing overseas metadata preserves existing fee", () => {
 const previous = {...model};
 try { delete (model as any).videoReferenceMultiplier; delete (model as any).priceRoundingStep; expect(workbenchVideoInput(config, true).points).toBe(24.5); }
 finally {Object.assign(model, previous);}
});
