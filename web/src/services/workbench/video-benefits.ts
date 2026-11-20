import type { WorkbenchBootstrap, WorkbenchModel } from "@/types/workbench";

export function giftQuotaEligible(model: WorkbenchModel, session: Pick<WorkbenchBootstrap, "region" | "currency">) {
    return model.giftQuota ?? ((session.region === "domestic" || (!session.region && session.currency === "CNY")) && model.id === "wb-seedance-2-fast");
}

export function videoBenefitLabels(model: WorkbenchModel, session: Pick<WorkbenchBootstrap, "region" | "currency">, language: string) {
    const zh = language.startsWith("zh");
    const label = model.recommendationLabel;
    return {
        recommendation: model.recommended ? (label === "New" ? (zh ? "新模型" : "New") : label === "Special price" ? (zh ? "特价" : "Special price") : label || (zh ? "推荐" : "Recommended")) : "",
        daily: model.freeQuota ? (zh ? "可用每日免费次数" : "Daily free eligible") : "",
        gift: giftQuotaEligible(model, session) ? (zh ? "可抵扣赠送次数" : "Gift uses eligible") : "",
    };
}

export function giftUsesSummary(quota: WorkbenchBootstrap["quota"], language: string) {
    if (quota.gift_uses === undefined) return "";
    const zh = language.startsWith("zh");
    const parts = [zh ? `可用赠送次数：${quota.gift_uses}` : `Available gift uses: ${quota.gift_uses}`];
    if (quota.gift_uses_permanent !== undefined) parts.push(zh ? `永久：${quota.gift_uses_permanent}` : `Permanent: ${quota.gift_uses_permanent}`);
    if (quota.gift_uses_expiring !== undefined) parts.push(zh ? `限期：${quota.gift_uses_expiring}` : `Expiring: ${quota.gift_uses_expiring}`);
    const expiry = quota.gift_uses_next_expiry ? new Date(quota.gift_uses_next_expiry) : null;
    if (expiry && Number.isFinite(expiry.getTime())) parts.push((zh ? "最早到期：" : "Next expiry: ") + new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(expiry));
    return parts.join(" · ");
}

export function videoDeductionText(model: WorkbenchModel, session: Pick<WorkbenchBootstrap, "region" | "currency">, language: string) {
    const zh = language.startsWith("zh");
    const order = [model.freeQuota ? (zh ? "每日免费次数" : "daily free uses") : "", giftQuotaEligible(model, session) ? (zh ? "赠送次数" : "gift uses") : "", zh ? "赠送积分" : "bonus points", zh ? "付费积分" : "paid points"].filter(Boolean).join(" → ");
    return zh ? `工作台按资格及可用余额依次抵扣：${order}；实际扣费以提交时为准。` : `Workbench applies eligible available balances in order: ${order}. Final charges are determined at submission.`;
}
