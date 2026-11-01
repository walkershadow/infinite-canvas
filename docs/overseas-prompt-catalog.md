# 海外公共模板与案例目录

> 最新状态：用户随后授权部署供线上验收。前端48aee62已在jp1构建并发布到20261101-prompt-catalog，公开路由与登录浏览器中文检索/案例详情通过；全部运行容器未重启，未修改数据。下文仅本地、不部署为此前开发阶段记录。

本轮仅本地开发与验收，不部署、不推送，不修改后端。正式功能说明暂不更新，用户确认后再整理。

## 接入与数据隔离

- 数据：`web/src/services/api/overseas-prompt-catalog.ts` 导出 `overseasPromptCatalog`；类型：`web/src/types/prompt-catalog.ts`。
- 仅海外提示词页面追加 Workflow templates / Case studies。原有七个图像来源、个人提示词 API/存储、编辑删除和生成选择器保持原样。
- 公共条目使用独立 `contentKind: template | case`，不转换为可执行的 `Prompt`，不调用生成接口、不自动选择平台模型、不自动扣费。
- 分类 `category`、来源 `sources` 和标签独立筛选。搜索包含中英文标题/摘要、步骤、中英文提示词、原文摘录及翻译、作者、标签、原模型。
- `sourceModel` 仅为原案例的模型标识，不代表 Workbench 已支持或已验证。模板是元提示词/多阶段工作流，用户需逐步改写与执行。

## 内容维护

每个条目使用稳定唯一 id。`relatedIds` 关联模板与案例，所有 id 必须存在。分享地址为 `/canvas/prompts?collection=template&id=<id>` 或 `collection=case`；浏览器后退可恢复原详情。删除或更改 id 会使旧分享链接失效，页面显示不可用提示。

步骤 `prompts.en/zh` 是完整可复制的改写例或许可模板，`textKind` 标明 adaptation / licensed-template；`prompts.original` 使用 `originalKind` 区分 excerpt / full。`originalZh` 是原文摘录的中文翻译，不冒充完整原始提示词。版权许可不明确的案例只保留短摘录与独立编写的中英文示例；原帖全文通过链接查看，禁止把全文复制进仓库。原始材料截断时用 `sourceCompleteness: truncated` 并在 notes 解释，不宣称完整。

`sources.role: original` 列在前面，GoodCase 等聚合站仅为 curation。案例原帖链接如仅根据整理站字段取得，显示 Original post (listed by curator)，不宣称独立核验。许可模板在 source.license 中记录许可与署名。所有来源链接使用新标签和 noopener noreferrer，原页面保留详情。

## 媒体与加载

`referenceMedia` 是输入参考，`outputMedia` 是输出示例，分区展示。外链媒体不下载镜像；权利未确认时使用 mediaRights: pending。案例统一显示 External example / Not tested on this platform。列表只加载图片或 poster；详情中的视频只有用户点击 Load video 才挂载播放器，preload=none，无自动播放。外链无效时显示说明，并可在同一详情的原帖链接查看来源。来源站可改变链接、拒绝跨域读取或关闭内容，本功能不增加下载代理或新的重试边界。

## 本地验收清单

1. 原七个来源、个人提示词创建/编辑/删除入口及已有记录保留；独立版不显示公共目录入口。
2. Cases 独立筛选，使用中文标题、步骤内容、原模型或作者搜索；分类与来源不混用。
3. 模板详情按阶段展示，English / Chinese / Original 切换后复制的是该阶段对应文字；摘录按钮明确标注 Original excerpt。
4. 参考与结果不混放；视频列表不挂载播放器，详情点击前也不挂载；关闭详情卸载播放器。
5. 原作者链接优先，整理来源单列；新标签打开来源后原详情保持。
6. 复制详情链接后重新打开可直达；相关模板/案例互链可用；不存在的 id 有明确提示。
7. 桌面与 390px 下检查详情滚动、语言标签和长来源链接；不发起真实生成。

针对性测试位于 `web/tests/prompt-catalog.test.ts`。数据更新后运行该测试和类型检查；浏览器验收仅使用独立本地页面及测试数据。部署和上传必须等待后续明确授权。


## 本轮实际验收结果

- 前端类型检查通过；目录测试 3 项、63 个断言通过，覆盖中英文/作者/模型/内容检索、独立案例、分类来源标签组合和互链完整性。
- 海外模式和独立模式均构建成功；仍有项目原有大 chunk、静态 config.js 和动态/静态混合导入提示，无构建失败。
- Workbench 隔离数据库的原生文档、个人提示词隔离及并发、云素材库保留 3 项测试通过，未变更 schema、余额、订单和现有记录。
- 真实浏览器在本地构建页面验证：中文“牛角包”仅返回对应案例；Food 标签筛选有效；中文复制结果与显示文本一致；案例与模板互链、独立详情链接直达正常。
- 原帖按钮实际新开 X 标签，原标签保留详情；X 链接身份来自整理源，未宣称验证帖子内容或版权。
- 视频点击前 DOM 无播放器；点击后牛角包样例实际播放至结尾（11.49 秒，video.error=null），关闭详情卸载。六个外部视频/封面 HEAD 为200；仅此一个视频做了完整播放验证。
- 390px 手机案例详情与模板详情无横向溢出（正文 clientWidth=scrollWidth=326），列表 clientWidth=scrollWidth=390。测试后已恢复浏览器视口。

## 本地构建预览

开发模式通过 Next 转发 Vite 模块时观察到动态模块加载失败，直接 Vite 可打开，静态依赖 HTTP 检查未定位根因。本轮验收改用本地构建预览，未修改生产配置来绕过该问题：

```sh
# infinite-canvas/web
VITE_APP_MODE=overseas bun run build --outDir /tmp/seedance-prompt-preview
VITE_APP_MODE=overseas bunx vite preview --host 127.0.0.1 --port 3204 --outDir /tmp/seedance-prompt-preview
# 海外 Workbench worktree
NATIVE_CANVAS_DEV_ORIGIN=http://127.0.0.1:3204 npm run dev:international
```

通过 http://localhost:3100/canvas/prompts?collection=case 验收；需要已有本地 Workbench 登录。预览产物是本地临时目录，不是生产部署。源代码变化后需重新构建并刷新。本轮临时 fixture 页面已删除，未推送、未部署；完整原作者提示词和参考图未转载，不将改写例称为原作者完整版。
