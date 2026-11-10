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

test("overseas uses server-truncated base quota before duration and video multiplier", () => {
 const previousModel = {...model}, previousSession = {...session};
 try {
  Object.assign(session, {region:"overseas", currency:"USD", pointsPerUsd:10, quotaPerPoint:50000});
  // Raw 1234.9 must be truncated upstream to 1234 BEFORE multiplying by 5 and 3.
  Object.assign(model, {price:0.024698, unitQuota:1234, priceRoundingStep:.5});
  expect(workbenchVideoInput(config).points).toBe(6170 / 50000);
  const video = workbenchVideoInput(config, true);
  expect(video.points).toBe(18510 / 50000);
  expect(video.amount).toBe(0.03702);
  expect(workbenchVideoEstimateText(video, "en-US")).toContain("$0.03702");
  expect(video.points).not.toBe(Math.trunc(1234.9 * 5 * 3) / 50000);
  expect(workbenchVideoEstimateText(video, "en-US")).toContain("Includes video references; image and audio references do not increase the rate.");
  expect(workbenchVideoEstimateText(video, "en-US")).not.toContain("3×");
  Object.assign(model, {priceRoundingStep:.1});
  expect(workbenchVideoInput(config, true).points).toBe(18510 / 50000);
  // Image/audio inputs do not activate hasVideoReference.
  expect(workbenchVideoInput(config, false).points).toBe(6170 / 50000);
  Object.assign(model, {billingUnit:"request"});
  expect(workbenchVideoInput(config, true).points).toBe(3702 / 50000);
  Object.assign(model, {prices:{5:0.08}, unitQuotas:{5:3999}});
  expect(workbenchVideoInput(config, true).points).toBe(11997 / 50000);
  Object.assign(model, {billingUnit:"second"});
  expect(workbenchVideoInput(config, true).points).toBe(59985 / 50000);
  Object.assign(model, {unitQuotas:{5:0}});
  expect(workbenchVideoInput(config, true).points).toBe(0);
  delete (model as any).unitQuotas;
  expect(() => workbenchVideoInput(config, true)).toThrow("pricing is unavailable");
  delete (model as any).prices;
  Object.assign(model, {unitQuota:1234.9});
  expect(() => workbenchVideoInput(config)).toThrow("pricing is unavailable");
  Object.assign(model, {unitQuota:1234}); delete (session as any).quotaPerPoint;
  expect(() => workbenchVideoInput(config)).toThrow("pricing is unavailable");
 } finally {
  for (const key of Object.keys(model)) if (!(key in previousModel)) delete (model as any)[key];
  for (const key of Object.keys(session)) if (!(key in previousSession)) delete (session as any)[key];
  Object.assign(model, previousModel); Object.assign(session, previousSession);
 }
});

test("old overseas catalog never applies domestic point rounding; domestic stays unchanged", () => {
 const previous = {...session};
 try {
  Object.assign(session, {region:"overseas", currency:"USD", pointsPerUsd:10});
  const priorPrice = model.price; model.price = .024698;
  try { expect(workbenchVideoInput(config, true).points).toBe(.024698 * 5 * 3); }
  finally {model.price = priorPrice;}
 } finally {
  for (const key of Object.keys(session)) if (!(key in previous)) delete (session as any)[key];
  Object.assign(session, previous);
 }
 expect(workbenchVideoInput(config, true).points).toBe(73.5);
});
