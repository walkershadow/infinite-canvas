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


## 海外发布与构建记录

以下为海外接入会话回报，本源码会话未重复操作生产环境：

- Canvas `4918ae02e559a06d30a2510eca93ad31355c2e35` 已在 jp1 以 overseas 模式构建，发布至 https://ai-creator.xprismai.com/canvas/ ，release.json 已核实。
- Workbench 后端 `432f1cc`，镜像 `seedance-cheap:release-20261110-sync`；bootstrap 已提供整数 unitQuota／unitQuotas、quotaPerPoint=50000 和 videoReferenceMultiplier。保留 22 个可用模型；新增两个 GM 模型的单位 quota 分别为 20000／12500。
- 后端 95 项单测、10 项隔离数据库测试、本地认证 HTTP 及生产认证 HTTP 报价／权限／分页检查通过，临时验证账号已清理，业务数据摘要保持一致。未发起真实收费生成或支付，实际上游扣费、退款仍未验收。
- 国内、new-api、独立画布容器未变；本次未在源码会话部署。

本次 jp1 构建使用 1024MB Node heap 时，在 8635 modules transformed 后明确出现 `Reached heap limit`／`JavaScript heap out of memory`，最后一次 Mark-Compact 为 1009.4 → 1006.3MB，耗时 325 秒，退出 139。因此本次失败已确认为 V8 heap 不足，不能只归为打包缓慢。

代码不变，恢复旧脚本的 2048MB Node heap 后，构建 48.39 秒成功。当次容器物理内存上限 1280MB、soft reservation 1024MB、memory+swap 3072MB，使用临时 swap，完成后已移除。这是该主机本次实测配置，不是所有环境的硬性要求；heap 上限不等于进程总内存。后续在同机重建可参考该成功记录，资源设置变更仍由发布会话确认，不自动修改线上配置。

## 模型推荐、免费与赠送次数

平台视频模型扩展 `recommended?: boolean`、`recommendationLabel?: string`、`giftQuota?: boolean`。推荐星标和标签直接读取后台配置，不按模型 ID 固定；两款新模型 `bt-minimax-h3-768-sp`／`doubao-seedance-2-0-mini-480p` 由后台配置推荐，英文标签分别为 `New`／`Special price`，中文显示“新模型”／“特价”。取消推荐或修改标签后，下一次 bootstrap 加载按新配置展示。

`freeQuota` 仅表示每日免费资格，`giftQuota` 独立表示赠送次数资格。选择器列表分别显示太阳图标及 Daily free eligible／可用每日免费次数、礼物图标及 Gift uses eligible／可抵扣赠送次数，选中项提供对应图标提示。资格不是余额，也不保证本次免费。

海外仅以明确的 giftQuota=true 授予赠送资格，不按 Fast 名称推断；后台默认仅原 Fast 为 true，其余 false，管理员可配置。为兼容未升级的国内宿主，仅国内且缺少 giftQuota 字段时沿用 `wb-seedance-2-fast` 旧资格；显式 false 优先。独立模式及自配模型不读取这些平台标识。

bootstrap.quota 保留 `gift_uses`（当前可用赠送总次数），新增可选字段 `gift_uses_permanent`、`gift_uses_expiring`、`gift_uses_next_expiry`（ISO 时间或 null）。Canvas 积分菜单分别展示永久／限期次数和最早到期时间（按用户语言及浏览器时区格式化）；旧宿主仅有总数时只显示总数，不推定全部永久，也不从总数反算批次。空／无效到期时间不显示错误日期。

生成确认按模型资格列出抵扣顺序：每日免费次数 → 赠送次数 → 赠送积分 → 付费积分；无对应资格的次数项省略，最终按提交时资格和可用余额结算。估价仍是原始模型费率，不在前端提前扣除次数或承诺免费。

新充值赠送批次 30 天有效、旧管理员永久赠送保留，以及批次消费顺序、到期扣减均由海外后端处理。Canvas 只展示 bootstrap 明细和资格，不新增下单／支付／批次写入逻辑。本轮保留整数 quota 估价、资产目录及个人数据。
