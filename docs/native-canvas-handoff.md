# 海外原生画布前端交接

仅修改 infinite-canvas 的 `dev` 分支，无部署、无供应商真实付费请求。Workbench 后端在另一工作树维护，本文描述当前前端实际契约，不包含旧草案建议。

## 本地入口

- Vite 服务：`http://localhost:3200/canvas/`，仅监听本机。
- Workbench 本地：`http://localhost:3100`；设置 `NATIVE_CANVAS_DEV_ORIGIN=http://localhost:3200` 后访问其 `/canvas/`。
- 前端启动：在 `web/` 执行 `VITE_APP_MODE=overseas bun run dev --host 127.0.0.1 --port 3200 --strictPort`。
- 资源 base 固定 `/canvas/`。React Router 保留原生绝对路由 `/canvas`、`/canvas/:id`，因此不再额外设置 basename，避免 `/canvas/canvas` 双前缀。Workbench 根页通过整页链接返回。

## 实际接口

- 首次 GET `/api/canvas/bootstrap` 使用 cookie；后续 JSON 请求附带 `X-Canvas-Account`。账号改变时不得继续写入旧页面。服务端校验 cookie、账号 header 和写请求 Origin。
- projects 列表/创建/读取/更新使用 `{id,revision,document,...}` envelope。POST `{document}`，PUT `{revision,document}`，DELETE `{revision}`。`document.schemaVersion=1`，原生 `document.id` 与云端 envelope ID 映射保存在适配层，节点结构不转换为旧画布格式。POST 按 document.id 幂等。
- POST `/projects/:id/generate` 为 `{revision,requestKey,nodeId,input}`，返回 `{task,revision}`。生成前保存节点和 `metadata.workbenchRequestKey`。重试保留该 key；终态失败后才允许新提交。后端通过独立 submission 关联任务，不要求修改 document 的 revision。
- GET `/projects/:id/tasks` 返回含 `nodeId/requestKey/createdAt/videoUrl` 的 DTO。恢复时按时间排序，同节点使用最新任务；不会把先前任务的失败覆盖最新成功结果。
- GET `/assets` 返回 `{assets:[{id,name,mime,bytes,url,createdAt}]}`；POST multipart `file` 直接返回 Asset 对象，无 `asset` 包装、无 `mimeType` 字段。持久 URL 是 `/api/canvas/assets/:id/content`。原生 storageKey 在云端转换为 `image:workbench:<id>` / `video:workbench:<id>` / `audio:workbench:<id>`，本地导入数据不需要迁移。
- 生成引用使用 owned asset URL，任务视频作为下一次参考时先经同域读取并上传到当前账号素材。前端不请求供应商。
- GET `/import-legacy` 返回可导入旧项目；POST `{projectId}` 返回新原生 envelope，原项目和扣费记录不变。前端已有英文入口。

## 实现入口

- `web/src/constant/integration.ts`：构建模式及禁用能力守卫。
- `web/src/main.tsx`、`app.tsx`：先完成账号 bootstrap，再加载会初始化浏览器存储的应用模块。
- `web/src/services/api/workbench.ts`：同域 cookie 请求与账号绑定。
- `web/src/services/workbench/projects.ts`：原生文档云同步、版本冲突、恢复缓存、素材持久化、任务恢复。
- `web/src/services/workbench/video.ts`、`services/api/video.ts`：平台模型参数、估价、任务提交及轮询。
- `web/src/layouts/workbench-layout.tsx`、`stores/use-workbench-store.ts`：保存状态、余额、恢复操作和旧项目导入。

## 验证与剩余事项

- 5 项适配测试、24 个断言通过：原生结构和最新任务恢复、云端 ID/素材映射、请求键保留、冲突暂停与恢复缓存、跨账号及外部素材地址拒绝。全部使用 mock，不接触真实账号或供应商。
- 海外模式和默认独立模式构建均通过。联调时已最小修复 `model-script-editor.tsx` 的 Ant Design 样式键为 `styles.container`，完整类型检查通过。
- 独立 Chrome 夹具已看到英文原生画布、视频节点、仅平台目录提供的 5s/10s 与画幅选项、撤销/重做恢复原节点数，以及视频提交前的估价确认与取消。真实 localhost:3200 入口验证未登录时阻止初始化并提示登录。
- 真实 cookie 会话、跨设备云媒体、旧项目导入、失败退款后的余额、断网恢复和完整节点交互仍需双方联合验收。不是生产验收结论。
- 当前每次原生视频操作仅生成一项并确认估价，没有新增批量扣费入口。未来批量入口必须先展示总估价并逐项保留幂等 key。
- 文本/图像/音频 AI 和外部脚本禁用；Canvas Agent 在海外模式不可连接，保留独立模式现状。未来单独接入需平台授权与工具权限设计。
- 当前恢复缓存不自动清理媒体，避免恢复副本失去原文件。文本收藏、素材自定义标签属于账号隔离的本地数据；云上传媒体可重新显示，尚非完整云素材管理器。

详细架构、存储、运维和验收清单见 `docs/content/docs/development/overseas-workbench.mdx`。

## Workbench 联调补充

后端会话已完成本地真实 cookie HTTP、4 项原生数据库测试、70 项既有单元测试及8项既有数据库测试，均通过；后端本地完整构建通过。Next 本地预览已指向本会话 Vite 3200，入口 http://localhost:3100/canvas/ 。媒体实际端到端与用户交互最终验收仍待完成；未部署。后端 bootstrap 对免费账号将免费 Fast 排在首位，价格不变。
