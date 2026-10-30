# 完整原版能力接入契约

本轮在 `dev` 本地开发，不推送、不部署。原版画布、图片、视频、提示词、素材、配置、插件和 Agent 入口保留；海外根入口按新要求跳转项目列表，独立版首页不变。请求按所选渠道分流，不再采用整个海外模式禁用自配渠道的方案。

## 路由

React Router 的 basename 为 `/canvas`，内部仍使用原版路由。完整入口：`/canvas/` 跳转项目列表、`/canvas/canvas` 项目列表、`/canvas/canvas/:id` 项目、`/canvas/image`、`/canvas/video`、`/canvas/prompts`、`/canvas/assets`、`/canvas/config`。保留 `/canvas/:id` 项目旧链接别名。原项目不迁移、不转换格式。

## 渠道与鉴权

- Workbench 内置渠道由 bootstrap 管理，使用 cookie、`X-Canvas-Account`、账户余额及服务端计费，不能编辑平台 API Key。新账号默认选平台视频模型。
- 自配渠道保留原 endpoint、模型、API Key、调用脚本和 OpenAI/Gemini 请求流程，费用由供应商直接结算，不经过 Workbench。初始化和刷新保留用户渠道与已选模型，包括暂时不可用的选择，避免静默换渠道。
- 自配密钥、Agent 连接配置和偏好按账号保存在当前浏览器，不上传至项目、个人提示词或收藏文档；偏好不是云同步。
- 原版插件脚本和本地 Agent 手动连接恢复，仍属于用户自配能力，不代表平台托管 Agent 或平台代付。仅运行用户信任的脚本。

## 已接通接口

以下路径均以 `/api/canvas` 为前缀。

| 用途 | 请求与响应 |
| --- | --- |
| 初始化 | GET `/bootstrap` 返回 user/models/quota/capabilities 等 |
| 云项目 | GET/POST `/projects`，PUT/DELETE `/projects/:id`；POST `{document}`，PUT `{revision,document}`，DELETE `{revision}` |
| 画布视频 | POST `/projects/:id/generate` `{revision,requestKey,nodeId,input}` → `{task,revision}`；GET `/projects/:id/tasks` |
| 独立视频页 | POST `/video/generate` `{requestKey,input}` → `{task}`；GET `/video/tasks/:id` → `{task}` |
| 个人提示词 | GET `/prompts` → `{prompts:Envelope[]}`；POST `{document}`；PUT/DELETE `/prompts/:id` 带 revision |
| 云收藏 | GET `/library` → `{items:Envelope[]}`；POST `{document}`；PUT/DELETE `/library/:id` 带 revision |
| 媒体 | GET `/assets` → `{assets:Asset[]}`；POST multipart `file` → Asset；GET `/assets/:id/content` |
| 旧项目复制 | GET `/import-legacy`；POST `{projectId}` → 新项目 envelope |

Envelope 使用服务端 id/revision/document。项目和收藏的原生 document.id 与云端 id 分开管理。收藏保留 text/image/video 原生字段；删除收藏不删除项目引用的媒体。创建按账号和 document.id 幂等，版本冲突暂停写入，恢复副本需导出或明确恢复后处理。

## 平台 AI 能力

前端按后端已确认的异步契约接入 ali-llm、ali-image、ali-audio，仅在 bootstrap 宣告相应 capability 和 aiModels 时显示平台能力。平台无前端密钥；自配渠道保持独立。ali-video 使用既有视频任务及计费通路。

## 媒体持久性

有本地 storageKey 的图片/视频在保存项目或收藏时上传平台媒体。若供应商下载因 CORS/过期失败而只能保留远端 URL，则只保证文档保存，不保证媒体备份。平台 task 播放地址也不等同于已复制到素材库；作为下一次生成参考时会读取并上传。页面用 “Cloud documents saved” 区分文档状态，并显示媒体边界说明。

## 平台 AI 异步契约

前缀 /api/canvas，cookie + X-Canvas-Account。POST /ai/images、/ai/text、/ai/audio 均返回 {task}，GET /ai/tasks/:id 返回同形；GET /ai/tasks 返回用户最近 100 条 {tasks}。前端保留本地任务历史，不据此裁剪旧记录。

Task 字段为 id/requestKey/kind/model/status/error/result/createdAt/updatedAt；kind 对应 images/text/audio，status 为 queued/running/completed/failed/unknown。error 是 null 或字符串，result 是 null 或以下完成结果：

| 路由 | 输入（均附稳定 requestKey） | 完成 result |
| --- | --- | --- |
| /ai/images | model,prompt,images:[],size,quality,count,background,systemPrompt | {images:[{id,url}]} |
| /ai/text | model,messages,systemPrompt,reasoningEffort | {text} |
| /ai/audio | model,prompt,voice,format,speed,instructions | {url,mimeType} |

结果媒体使用 /api/canvas/assets/:id/content。同一个 requestKey、同一输入返回原任务，输入变化返回 409。前端发送前把键、输入快照及本地节点/结果槽归属写入账号 localforage；丢响应时可用原 body/key 重放 POST，不生成新键。成功取回但下载失败仅重读结果，未交付结果保留原键。unknown 需管理员核查，不能自动重新生成。

后台接受任务不受浏览器断开影响。前端按 2.5 秒间隔串行查询，没有总等待期限；隐藏页面暂停查询，离开画布或图片页停止当前等待，任务保留。积分菜单的 AI tasks 可检查状态、恢复原任务、读取文本/图片/音频结果。当前浏览器保有节点归属且目标节点仍存在时，画布可恢复到对应节点及结果槽；已删除的节点/槽不会重新创建，其他选中结果不会被覆盖。跨设备可从服务端任务列表读取结果，但没有本地归属时不猜测目标节点。

平台模型当前价格为 0；前端检测非零价格时暂停新 AI 提交，后端负责上游价格快照、额度检查和计费规则。零价格不等于零余额必定可用，服务器返回 429 时前端显示真实错误，不授予测试额度。

模型限制：

- ali-image：纯文生图、单次请求 1–6 张、URL 结果，不支持 edits/透明背景；默认 1024x1024，显式尺寸每边 512–2048。Image Studio 使用独立 platformImageSize 偏好，避免继承视频尺寸或修改自配渠道尺寸。
- ali-llm：仅文本消息，最多 100 条；多模态/工具参数不可静默丢弃。
- ali-audio：最多 500 字符，alloy/default、WAV、speed=1，不支持额外 instructions；平台画布请求初始化这些默认参数，自配配置不改写。
- ali-video：既有视频接口，3–15 秒，16:9/9:16，720p/1080p；1080p 映射到目录的 -1080p ratio 值，freeQuota=false，不使用每日免费次数。

## 超时核查

| 环节 | 当前行为 |
| --- | --- |
| 平台视频（Video Studio、画布） | 无客户端总期限，保留 taskId/requestKey；服务端明确 failed 才是任务失败 |
| 平台图片/文本/语音 | 持久异步任务，2.5 秒查询；传输失败或停止等待保留任务，unknown 不重提 |
| 自配图片/Gemini/edits | 保留现有 10 分钟 axios 请求超时 |
| 自配文本/音频 | 保留原 fetch/axios + signal，没有新增总超时 |
| 自定义脚本 poll | 保留原默认 300000ms 及脚本自定义行为 |
| 图片下载/解码 | 保留原存储层超时；失败后通过原平台任务重读，不把它当作重新生成理由 |

后端说明：worker 上游超时转 unknown，生成成功但资产保存失败保留原结果并重试存储。前端不自行推断成功/失败或绕过存储环节。

平台图片 quality 与文本 reasoningEffort 当前不由后端应用；上游自行决定，前端平台参数说明明确提示对应控件不生效。自配渠道仍沿用原参数行为。
