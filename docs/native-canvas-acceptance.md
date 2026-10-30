# 海外完整原版集成本地验收记录

验收对象为 `dev` 的完整页面/渠道分流/个人提示词/云收藏增量。前期本地验收没有推送、部署或真实付费生成；后续发布结果见下方独立记录。后端由另一个工作树维护，本文只记录本前端实际执行的验证，不把后端会话报告的检查当作本次执行结果。

## 自动化检查

在 `web/` 执行：

| 命令 | 结果与范围 |
| --- | --- |
| `bunx tsc --noEmit` | 通过，完整前端类型检查 |
| `bun test` | 主进程 16 项通过（包括集成子进程入口），集成子进程 11 项、67 个断言通过；无失败 |
| `VITE_APP_MODE=overseas bun run build --outDir /private/tmp/infinite-canvas-overseas-check` | 通过 |
| `bun run build --outDir /private/tmp/infinite-canvas-standalone-check` | 通过 |

构建仍提示大 chunk、动态/静态混合导入与运行时 config.js 不参与打包；没有用增加阈值隐藏警告。临时输出目录不自动清空，未覆盖正式产物。

集成测试用 mock：覆盖项目原结构与最新任务、媒体上传与云端 ID 映射、平台视频默认模型/稳定 requestKey、自配渠道/密钥/模型保持、模型移除后不静默换渠道、自配视频创建与轮询不走平台、外部结果走原存储、个人提示词 CRUD/revision 冲突/空引用清理、云收藏 CRUD/加载失败/损坏恢复原始字节/前次副本不覆盖，以及账号变化拒绝。真实 HTTP 和计费不由这些 mock 测试证明。

## 真实浏览器验收

使用 CUA 创建独立 Chrome 测试标签，通过 `http://localhost:3100/canvas/` 访问本地 Workbench 真实 cookie 会话和真实本地后端；前端由 Vite 3200 代理。没有使用 3201 夹具冒充真实验收，没有关闭用户原有标签。

| 验收项 | 实际操作与结果 |
| --- | --- |
| 完整导航 | 首页、My Canvases、Image Studio、Video Studio、Prompt Library、My Assets、Settings 可进入；默认英文 |
| 个人提示词 | 创建 `CUA integration disposable prompt`，刷新仍存在；修改标题并保存成功；删除后刷新不再出现 |
| 云收藏 | 创建 `CUA disposable collection stable` 文本收藏，刷新仍存在；改为 `CUA disposable collection edited`，再次刷新保留；删除并刷新为空，没有由媒体列表自动复活 |
| 自配渠道 | 手动添加 `CUA disposable provider`、虚构 endpoint/密钥、`cua-fixture-video`；没有点击拉取模型或生成；刷新保留渠道，视频页选中该模型后刷新仍选中 |
| 原生画布 | 新建临时画布、创建文本节点、看到撤销与节点工具、打开节点插件列表；最后删除临时画布，列表恢复为空 |
| 插件/Agent | 插件管理可打开并展示原注册表，Agent 连接入口和本地参数可见；没有安装插件、连接真实 Agent 或执行任务，因此不声称执行链路已验收 |
| 清理 | 仅删除本轮可丢弃提示词、收藏、渠道和画布；将视频模型恢复为测试前的 `grok-imagine-video（Default provider）`，重载后确认保持 |

开发中曾在收藏操作期间修改适配模块，Vite 热更新导致页面内旧订阅与新状态实例不一致，刷新后未看到测试数据。这一次尝试没有记为通过。停止代码改动并完整重载后，按上述新增→刷新→编辑→刷新→删除→刷新重做，真实后端持久化通过。修改同步适配模块后应完整刷新再验收，不沿用 HMR 中的旧订阅。

## 截图

截图保留在仓库，均为本地验收数据、不含真实密钥。截图用于说明测试时的状态；测试数据已清理。

- [个人提示词编辑后](acceptance/native-canvas/prompts.jpg)
- [云收藏编辑成功](acceptance/native-canvas/library.jpg)
- [自配视频模型刷新后](acceptance/native-canvas/custom-provider.jpg)
- [原生画布文本节点与工具栏](acceptance/native-canvas/canvas.jpg)

## 尚未验证与真实缺口

- 此前仅视频目录的限制已被下方平台四模型接入更新取代；目录仍以实际 bootstrap 为准。用户自配渠道保留原能力。
- 没有执行供应商收费生成、真实余额扣减/退款、失败任务恢复或平台批量扣费；平台视频估价/请求键适配通过 mock，前一阶段曾做估价取消夹具，但不是本次真实生成验收。
- 没有验证真实自配图片/视频下载上传、CORS 失败、链接过期、大文件和跨设备媒体。代码对本地 storageKey 原文件执行云上传；没有本地原文件的外部 URL 只保留链接，平台 task URL 也是播放地址，不能据文档已保存推断已备份媒体。页面明确显示该边界。
- 没有实测多账号切换、网络中断、多端并发 409、损坏 IndexedDB、旧项目导入、全量节点连线/分组/快捷键回归。恢复和冲突的自动化结果不替代这些真实场景。
- 独立模式完整类型与构建、原模型选择/视口/缩略图测试通过；未对独立版和国内部署做浏览器或生产验收，也未改写其历史数据。
- 偏好、渠道密钥与生成历史仍是账号隔离的本地数据；平台托管 Agent 和偏好云同步未接入。Docker 静态路径与生产反代仍需专门验收。

## 子路径资源修复补验

后续部署准备发现插件与图标仍使用根路径，本次仅修正前端路径和初始 HTML，不执行部署。

- 类型检查通过；海外与独立构建分别输出到 `/private/tmp/canvas-base-overseas`、`/private/tmp/canvas-base-standalone`，均通过。
- 解析构建 HTML，海外 lang/title/description 为英文，图标、入口脚本及 config.js 均为 `/canvas/` 绝对路径；独立构建保留 `zh-CN`、原中文标题/描述及根路径。
- 以深层 `/canvas/canvas/test` 为基址验证链接解析，并确认 HTML 引用文件在构建产物内存在。
- 临时创建插件文件，验证海外插件清单条目为 `/canvas/plugins/*.js`、开发清单路由为 `/canvas/plugins/index.json`；独立模式均保留 `/plugins/`。临时文件和目录已清理，未进入提交或构建产物。
- `todo.mdx` 已检查，本次未完成生产代理验收事项，无需移除；线上深层路由与插件加载仍列在 pending-test。

## 视频长任务、导航与 ali-image 修正验收

- Video Studio 平台任务取消浏览器端约五分钟总期限，继续按原有 2.5 秒间隔串行查询同一 taskId。页面隐藏或卸载会取消当前查询，返回可见页面后恢复 pending 历史；查询错误保留任务并显示 Check status，不自动重新生成。
- 旧的 failed/timeout 历史如果保有 Workbench taskId 且没有明确终态标记，可手动查询。服务端返回 failed 时记录终态，仍显示失败。后台任务只更新自己的历史，只有当前选中的任务可以替换结果区域；新建会话清空选择后，后台结果也不会覆盖它。
- 自配视频渠道保留原来的轮询次数。此次修改范围为 Video Studio；画布节点共享轮询器未调整。
- 云状态与余额、Workbench、Projects、旧画布导入合并进原导航；恢复导出、重试、还原及丢弃入口保留在云状态弹层。初始化失败时仍显示恢复入口。浏览器检查了浅色、深色、390×844 窄屏、云状态弹层、项目跳转及旧画布导入空列表。未执行旧画布导入写操作。
- Video Studio 上传目前只接受图片，现有上限为 7 张，已修正文案此前误写 9 张；本轮没有新增视频或音频上传入口。画布视频/音频节点及传引用能力保留，受具体模型限制。
- ali-image 自配渠道发送 response_format=url，保留现有 URL 结果解析；单次超过 6 张与图片编辑在请求前报错，提供中英文提示，其他模型响应格式保持原行为。未添加虚假的平台图片能力。
- mock 覆盖平台等待超过 12.5 分钟、查询中断后同任务续查、旧超时记录、真正上游失败、取消查询不发请求及不新增生成；ali-image 覆盖 URL、1/6/7 张、编辑拦截和其他模型格式回归。
- 主会话报告在 jp1 经本机 new-api 到 ali-relay 的真实单张 ali-image 请求成功；公网 Python 请求得到 403。本会话没有重复真实生成，未将此结果当作浏览器跨域、图片下载/存储或平台托管图片全链路通过。

截图（本地真实页面，未包含凭据）：

- [深色云状态弹层](acceptance/native-canvas/feedback-dark.jpg)
- [浅色视频页](acceptance/native-canvas/feedback-light.jpg)
- [手机宽度视频页](acceptance/native-canvas/feedback-mobile.jpg)

检查：TypeScript、全量 bun test（16 个外层测试及 13 个隔离集成测试）和海外/独立 Vite 构建通过。构建保留已有大 chunk、静态/动态混合导入及运行时 config.js 提示。生产旧超时任务续查、多任务切换结果隔离和浏览器 ali-image 完整出图链路仍需发布后人工确认。

## 原导航恢复验收

按最新要求恢复原版 max-w-7xl、gap-5、px-6 与导航 gap-7；删除额外 Workbench/云按钮。海外品牌显示 Workbench 并链接 /workbench，积分替代原 GitHub 位置，保留云恢复和旧画布导入。实际打开 /canvas/ 已跳转 /canvas/canvas；浏览器确认海外导航无 GitHub 链接且积分弹层正常。独立版仍使用原首页与 GitHub。截图：[原导航及积分弹层](acceptance/native-canvas/original-navigation.jpg)。

## 平台异步 AI 最终补验

- 本地真实页面检查 Workbench 导航链接 `/workbench`、原 GitHub 位置积分菜单、AI tasks 空列表与约束说明；ali-image 正确显示名称和 1024×1024 默认尺寸。没有点击生成，没有修改用户凭据；检查后已恢复原 gpt-image-2 自配选择。
- mock 覆盖提交前持久化、响应丢失后同键重放、连续 301 次 pending 后完成、查询中断、unknown 与真实 failed、文本最终回调、同域图片/WAV 读取、禁止不支持参数及价格变化、画布节点和结果槽位隔离。未伪造真实账号任务记录。
- TypeScript、全量 bun test（16 个外层测试、16 个隔离集成测试）及海外/独立构建通过。构建仍有既有大 chunk、混合静态/动态导入、运行时 config.js 提示。
- 主会话报告 jp1 上 ali-llm、ali-image、ali-audio、ali-video 真实验收通过：图片 1187558 字节、WAV 111404 字节经七牛保存与鉴权读取成功；零价调用未扣余额，测试用户已清理。本轮不重复生成，也不将接口验收等同发布后完整浏览器恢复验收。
- 发布后仍需人工验证页面断网/刷新后的任务恢复、图片显示、语音播放、原节点持久化及跨设备任务读取。跨设备没有本地 owner 时仅展示服务端结果，不自动猜测节点。

截图：[导航与积分](acceptance/native-canvas/original-navigation.jpg)、[平台任务中心](acceptance/native-canvas/platform-ai-tasks.jpg)、[平台图片设置](acceptance/native-canvas/platform-image-settings.jpg)。

## 主会话部署结果交接

主会话报告：前端 `f28416f` 已在 jp1 构建并部署至 https://seedance-cheap.xprismai.com/canvas/ ，后端 `69bb4d5`、文档 `f809dba`。四个 Ali 模型真实请求、图片/WAV 七牛转存与鉴权读取、双边零使用量且余额不变、旧数据一致性均验证通过；国内版、独立画布和 new-api 容器未重启。

以上属于发布会话的验证结果，本前端会话未重复执行。最终线上交互仍等待用户验收，具体项目保留在 pending-test。

## 素材卡片与引用交互本地回归

使用独立的 127.0.0.1:3202 浏览器存储与可丢弃测试数据，不操作用户生产画布。英文桌面与 Agent 展开时，My Assets 删除按钮均在卡片边界内；Image Studio 卡片改为按容器宽度排布，三按钮 scrollWidth 等于 clientWidth，无文本裁切。390px 时结果按钮分行，右边界均在视口内。

本地无封面视频自动截帧，刷新后图片解码成功；原视频字段保持。画布仅空目标时显示无可选项说明，从 My Assets 选择图片后节点数增加且显示 1 connected；完成后可见引用缩略图，断开再点击原节点可重新连接，Esc 返回输入框。平台能力过滤与持久媒体转换由自动化验证，生产跨设备及真实历史媒体由主会话发布后核验。

手机画布原有侧栏和浮层仍可能挤占操作空间，未将整个手机画布交互记为通过。本轮没有修改这些无关布局。封面新增时限未获确认，尚未设置；坏源取消释放的测试不等同已完成超时策略验收。

最终检查：TypeScript 通过；bun test 共 17 个外层测试及 19 个隔离集成测试通过；海外与独立 Vite 构建通过，产物分别位于 `/private/tmp/canvas-assets-overseas` 与 `/private/tmp/canvas-assets-standalone`。保留既有大 chunk、混合导入及运行时 config.js 提示。临时验收 HTML 与媒体目录已移除，未进入提交或最终构建。
