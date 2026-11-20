import { expect, test } from "bun:test";
import { giftQuotaEligible, giftUsesSummary, videoBenefitLabels, videoDeductionText } from "../src/services/workbench/video-benefits";
import type { WorkbenchModel } from "../src/types/workbench";
const model = { id: "wb-seedance-2-fast", freeQuota: true } as WorkbenchModel;
const overseas = { region: "overseas" as const, currency: "USD" };
const domestic = { region: "domestic" as const, currency: "CNY" };
test("overseas gift eligibility is explicit; only old domestic Fast defaults to eligible", () => {
 expect(giftQuotaEligible(model, overseas)).toBe(false);
 expect(giftQuotaEligible(model, domestic)).toBe(true);
 expect(giftQuotaEligible({...model, giftQuota:false}, domestic)).toBe(false);
 expect(giftQuotaEligible({...model, id:"another", giftQuota:true, freeQuota:false}, overseas)).toBe(true);
 expect(giftQuotaEligible({...model, id:"another"}, domestic)).toBe(false);
});
test("recommendations and daily/gift badges remain independent and admin driven", () => {
 for (const [id, label] of [["bt-minimax-h3-768-sp","New"],["doubao-seedance-2-0-mini-480p","Special price"]]) {
  const item = {...model,id,recommended:true,recommendationLabel:label,giftQuota:false};
  expect(videoBenefitLabels(item,overseas,"en-US")).toEqual({recommendation:label,daily:"Daily free eligible",gift:""});
  expect(videoBenefitLabels({...item,recommended:false,freeQuota:false,giftQuota:true},overseas,"en-US")).toEqual({recommendation:"",daily:"",gift:"Gift uses eligible"});
 }
 expect(videoBenefitLabels({...model,giftQuota:true,recommended:true,recommendationLabel:"Special price"},overseas,"zh-CN")).toEqual({recommendation:"特价",daily:"可用每日免费次数",gift:"可抵扣赠送次数"});
});
test("confirmation order follows eligibility without claiming balances or free generation", () => {
 const both = videoDeductionText({...model,giftQuota:true},overseas,"en-US");
 expect(both).toContain("daily free uses → gift uses → bonus points → paid points");
 expect(videoDeductionText({...model,freeQuota:false,giftQuota:true},overseas,"zh-CN")).toContain("赠送次数 → 赠送积分 → 付费积分");
 expect(videoDeductionText({...model,freeQuota:false,giftQuota:false},overseas,"en-US")).toContain("bonus points → paid points");
});
test("gift expiry summary separates permanent and expiring batches without inventing permanence", () => {
 const quota = {points:1,daily:{remaining:0},gift_uses:7,gift_uses_permanent:2,gift_uses_expiring:5,gift_uses_next_expiry:"2026-12-01T12:00:00Z"};
 const summary=giftUsesSummary(quota,"en-US");
 expect(summary).toContain("Available gift uses: 7");expect(summary).toContain("Permanent: 2");expect(summary).toContain("Expiring: 5");expect(summary).toContain("Next expiry:");
 expect(giftUsesSummary({...quota,gift_uses_next_expiry:null},"zh-CN")).not.toContain("最早到期");
 expect(giftUsesSummary({points:1,daily:{remaining:0},gift_uses:7},"en-US")).toBe("Available gift uses: 7");
 expect(giftUsesSummary({points:1,daily:{remaining:0}},"en-US")).toBe("");
 expect(giftUsesSummary({...quota,gift_uses_next_expiry:"bad date"},"en-US")).not.toContain("Invalid Date");
});
