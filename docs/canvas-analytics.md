# 海外画布统计与首页案例摘要

仅 `VITE_APP_MODE=overseas` 启用站内统计。独立版既有统计保持不变，国内版不发送新事件。IP 与地区由服务端处理，浏览器不查询 IP 或地理位置。

## 事件协议

登录后以同源请求发送 `POST /api/analytics/events`，携带账号隔离头 `X-Canvas-Account`，请求体为 `{ events: [{ id, name, page, sessionId, properties }] }`。事件 ID 和 sessionId 使用 UUID；会话保留在内存，刷新建立新会话，账号变化重建 sessionId，旧页面上下文不会复用。

- name：canvas_enter、page_active、template_view、template_save、template_open。
- page：canvases、canvas、image_studio、video_studio、prompts、assets、settings；不发送 URL 查询参数。
- properties 只构造 projectId、templateId、collection、activeMs。collection 只允许 case、template、public-library。templateId 保留原目录 ID，包括冒号。
- canvas_enter 指任意 Canvas 应用页面首次前台进入，每会话一次。查看详情记录 template_view，流程云端保存成功后记录 template_save；创建画布或成功插入节点后记录 template_open。取消、失败和重复保存提示不算新保存。
- 按用户确认参数，每 30 秒提交一次，队列达到 20 条立即提交；失焦、隐藏、pagehide 和路由离开立即结算并提交。失败丢弃、不重试、不持久化行为队列；请求使用 keepalive，失败不提示、不阻断业务。账号切换丢弃旧账号未发送事件。
- page_active 仅累计页面可见且聚焦时的 performance.now() 实际经过时间；失焦和隐藏均暂停，重新聚焦／显示后恢复。重复生命周期事件不重复累计，路由离开清理计时器和监听器。延迟计时器按后端单事件 60000ms 上限拆分，不丢失整段时长，也不将计时器触发次数当作时间。
- 页面上下文在记录时解析服务端项目 ID；新项目保存前省略 projectId，服务端 ID 可用后才携带，不提交本地项目 ID。

不发送提示词、媒体地址、邮箱、作品标题或错误正文。服务端必须继续校验账号、事件白名单、项目归属和模板 ID，不应直接信任浏览器上报。

## 生成关联

视频和 AI 创建请求增加顶层 `analyticsContext: { page, projectId?, templateId? }`，不放入上游模型 input。projectId 使用服务端 cloud envelope ID，尚未保存的本地项目不冒充服务端 ID；项目视频请求先保存项目后再解析上下文。

节点持久化 `metadata.workflowTemplateId`，整个模板实例及后续生成节点保留模板来源。AI 任务上下文作为记录的独立字段保存，与 body、owner、requestKey 分开；恢复使用同一上下文和原键，已有任务不补写上下文。后端应从业务幂等 hash 中排除 analyticsContext，项目生成以路由实际项目为准；通用 video/AI 接口核验 projectId 所有权。

## 首页案例摘要

海外构建由 Vite 插件输出 `dist/case-studies.json`，数组条目只包含：

- id；title、summary、category（各含 en、zh）；tags。
- poster：经过既有 CDN 映射的样例封面，缺失则为 null。
- detailUrl：`/canvas/prompts?collection=case&id=<encoded id>`。

复用公开目录与 `CATALOG_MEDIA_MAP_FILE`，不访问用户素材或保存的个人流程，不输出完整提示词、生成输入、源文件或任务信息。只有海外构建输出此文件。构建仍在 CI 执行，本任务不在服务器构建、不部署。
