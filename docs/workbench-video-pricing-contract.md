# 海外 Canvas 视频参考估价契约

本次仅调整海外估价，国内现有 priceRoundingStep（0.5／0.1 point）保持原逻辑，独立画布和自配渠道不变；不修改资产目录、个人数据及生成计费请求。服务端仍是实际扣费权威。

## Bootstrap 字段

- `region: "overseas"`、`currency: "USD"`、`pointsPerUsd: 10`。
- 新增 `quotaPerPoint: 50000`：一 point 对应的整数 quota。
- 每个视频模型新增 `unitQuota`：服务端按当前账号、模型价格及 outsea 0.5 分组比例计算，并完成 new-api 基础 quota 截断后的非负安全整数。前端不再次套分组比例、不从展示用 price 反算基础 quota。
- 模型有特殊时长价格 `prices[duration]` 时，必须同步提供 `unitQuotas[duration]`；该值同样已经完成基础截断。其优先级高于 unitQuota，值为 0 也有效。不要把整段已乘时长的 quota 填在秒计费模型的 unitQuotas 中。
- `billingUnit` 保持 `second`／`request`，对应数量分别为选中时长／1。
- `videoReferenceMultiplier`：仅指定 DreamMaker 模型返回 3，其余为 1 或省略。只有实际传入视频参考时使用，图片／音频不触发倍率。

前端计算顺序：`quota = unitQuota × billingUnits × (hasVideoReference ? videoReferenceMultiplier : 1)`，然后 `points = quota / quotaPerPoint`，`USD = points / pointsPerUsd`。不能先乘时长再截断基础 quota，也不做国内 point 步进向上取整。英文确认保留“含视频参考；图片和音频不加价”的说明，不显示倍率营销文案；美元显示最多六位小数以保留本契约精度。

例：服务端基础计算得到 1234.9 quota，返回截断后的 unitQuota=1234，5 秒视频参考估价为 `1234 × 5 × 3 = 18510 quota = 0.3702 points = $0.03702`。

旧海外 bootstrap 完全没有整数 quota 字段时仍用现有 price/prices 估算（不使用国内 priceRoundingStep）；新版只要出现任一 quota 字段即进入严格整数模式，缺失字段、特殊价格缺对应 quota 或非法数值均提示刷新价格目录并阻止生成。不能将不完整的新契约降级为近似估价。国内不启用整数模式。

## 入口及验证边界

画布确认、重试以及 API 提交前校验均使用 workbenchVideoInput；视频参考由实际 videos 列表决定。Video Studio 当前仅支持图片参考，因此按无视频估价；不在此任务扩展上传类型。

定向测试覆盖国内原费率、旧海外兼容、基础截断顺序、无视频／视频、秒计费／按次、特殊时长及零价格、缺失与非法 quota、英文说明及美元精度。Workbench 集成和三模式回归另行执行；不发起收费生成，不在本会话部署，海外接入会话从稳定提交在 jp1 构建并核对真实 bootstrap 与扣费账单。
