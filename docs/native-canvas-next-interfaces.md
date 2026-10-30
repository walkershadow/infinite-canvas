# 完整原版能力接入契约

本轮在 `dev` 本地开发，不推送、不部署。原版首页、画布、图片、视频、提示词、素材、配置、插件和 Agent 入口全部保留。请求按所选渠道分流，不再采用整个海外模式禁用自配渠道的方案。

## 路由

React Router 的 basename 为 `/canvas`，内部仍使用原版路由。完整入口：`/canvas/` 首页、`/canvas/canvas` 项目列表、`/canvas/canvas/:id` 项目、`/canvas/image`、`/canvas/video`、`/canvas/prompts`、`/canvas/assets`、`/canvas/config`。保留 `/canvas/:id` 项目旧链接别名。原项目不迁移、不转换格式。

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

## 尚未接通的平台能力

平台当前只确认视频目录（模型数量与别名以 bootstrap 实际返回为准），没有确认图片、文本、音频模型和价格。这些能力可以使用用户自配渠道。`workbench-ai.ts` 是未启用的平台适配草案：`aiModels` 和 `/ai/images`、`/ai/text`、`/ai/audio` 尚不能当成已完成接口。启用前仍需双方确认响应、估价、稳定请求键、失败退款及多模态/工具调用语义，并补充测试。不得只在 bootstrap 添加模型就宣称可投产。

## 媒体持久性

有本地 storageKey 的图片/视频在保存项目或收藏时上传平台媒体。若供应商下载因 CORS/过期失败而只能保留远端 URL，则只保证文档保存，不保证媒体备份。平台 task 播放地址也不等同于已复制到素材库；作为下一次生成参考时会读取并上传。页面用 “Cloud documents saved” 区分文档状态，并显示媒体边界说明。
