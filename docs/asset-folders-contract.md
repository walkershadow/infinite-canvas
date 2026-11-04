# 我的资产单层文件夹：国内／海外接入契约

## 已确定的数据协议

继续使用现有 `/api/canvas/library` 集合和逐条 revision 乐观锁，不新增第二套文件夹 API。新增 `kind: "folder"` 的库记录；前端将文件夹和资产分别保存在 store 的 `folders`、`assets` 数组，选择器不会将文件夹当作文本或可插入资产。

文件夹 document：`{id, kind:"folder", title, data:{}, createdAt, updatedAt}`。id 为前端 nanoid；title 为非空去首尾空白名称，单层、不含 parentId／folderId，data 必须为空对象。空文件夹也以完整库记录保存。允许不同ID同名，不按名称自动合并。

资产 document 增加可选 `folderId: string`，引用文件夹的 **document.id**，不是 envelope.id。缺省表示未分类。已有 text/image/video/workflow、来源、媒体路径及其他字段原样保留，旧数据缺少 folders/folderId 按空文件夹／未分类读取，不重写原资产内容。

GET 返回 `{items:[{id,revision,document}]}`，items 同时包含文件夹和资产；POST、PUT、DELETE 格式及幂等规则沿用现有接口。前端保存顺序：文件夹创建／更新 → 资产创建／更新 → 资产删除 → 文件夹删除。移动只更新资产 folderId，保留资产ID与内容；批量移动提交每条资产的现有 revision。

## 版本握手

所有library GET/POST/PUT/DELETE均发送`X-Canvas-Library-Version: 2`。GET响应新增`libraryVersion: 2`；新前端只有确认该值后才开放文件夹创建／归类操作。未握手仍可浏览和使用旧资产，不尝试创建文件夹。独立模式沿用本地持久化，无云端握手。

旧客户端未带版本2请求且账号已有活动文件夹时，服务端GET及写操作均返回409并提示刷新；没有活动文件夹时保留旧资产请求兼容。创建folder或设置folderId必须版本2。新端冲突沿用现有恢复快照和错误提示，不以重试覆盖revision冲突。

## 后端必须实现（国内与海外一致）

- `libraryDocument` 接受上述folder结构；文件夹不要求tags、coverUrl或媒体字段，不走公共参考素材鉴权扫描。
- POST/PUT资产包含folderId时校验：同账号、未删除、kind=folder且document.id相符。缺省允许未分类。拒绝跨账号／不存在的folderId；更新保留当前既有其他字段校验和revision冲突行为。
- DELETE文件夹使用事务：校验文件夹revision，清除该账号所有未删除资产中匹配的folderId（不是删除资产），各受影响资产revision递增、updatedAt更新，再软删除文件夹。校验与写入需保证并发移动不会留下失效引用。普通资产DELETE行为不变。
- 不迁移或清空既有记录，不改变余额、公共库权限或媒体存储配置。新客户端需与支持folder的服务端一并发布；旧客户端不应在新数据集合上执行写操作。

## 本地存储、恢复与导入导出

沿用账号及地区隔离的localforage。现有库恢复快照继续为数组，新增文件夹可在同一数组中保存；旧纯资产快照仍可恢复。发生冲突／加载失败保留本地恢复快照，禁止悄悄覆盖云端。

ZIP assets.json保留原version=1及assets/files结构，新增可选folders数组；资产folderId引用包内文件夹ID。旧ZIP缺folders按未分类导入。导入为每个文件夹和资产重新生成ID、重映射folderId，保留同名文件夹而不误合并；导出空文件夹也保留。媒体和流程格式不变。

## 交付记录

前端稳定提交和压缩包 SHA-256 记录在本机 `/tmp/asset-folders-delivery.json`（提交后生成，避免文档自引用 hash）。部署分别由海外 Workbench 和国内接入会话执行；本会话不部署。

构建命令（仓库根目录）：

```sh
VITE_APP_MODE=domestic CATALOG_MEDIA_MAP_FILE=/tmp/catalog-qiniu-map.json bun run --cwd web build --outDir /tmp/infinite-canvas-asset-folders-domestic
VITE_APP_MODE=overseas CATALOG_MEDIA_MAP_FILE=/tmp/catalog-qiniu-map.json bun run --cwd web build --outDir /tmp/infinite-canvas-asset-folders-overseas
```

目录对应压缩包为 `/tmp/infinite-canvas-asset-folders-domestic.tar.gz`、`/tmp/infinite-canvas-asset-folders-overseas.tar.gz`，解压即静态站根目录，部署在 `/canvas/`。生产构建的 config.js 外置和大 chunk 提示沿用现有配置，不影响构建完成。

验证：类型检查通过；`bun test --cwd web tests/asset-folders.test.ts tests/workbench-integration.test.ts tests/workbench-modes.test.ts` 通过，覆盖文件夹四种模式共 123 断言、Workbench 集成 21 项／207 断言及三模式检查。浏览器连接本机内存 API 夹具，验证创建、重命名、12 项资产跨页批量归类、刷新后恢复及文件夹与搜索组合筛选，页面显示 Documents saved；截图 `/tmp/asset-folders-verified.png`。这是前端及夹具验证，不代表真实双端浏览器验收；真实账号跨设备、移动端、画布选择器交互和发布验证由接入会话继续完成。删除保留资产、旧数据及 ZIP 和冲突恢复由定向测试覆盖。

## 卡片目录与统一保存入口

我的资产根目录显示文件夹卡片（图标、资产数及标题预览）和未归类资产；新建文件夹后留在根目录显示新卡片，点击卡片进入，面包屑返回根目录。卡片更多菜单提供改名和删除。全部资产检索是独立入口，不再使用下拉框浏览目录；移动目标与素材选择器仍可用紧凑下拉。

文件夹内新增素材默认归当前文件夹。导入 ZIP 前说明归类规则：在文件夹内导入，所有新资产副本归入当前目录，不创建包内文件夹或嵌套；在根目录导入，保留包内文件夹及空文件夹并重新映射 ID。原 ZIP、已有目录和资产不修改；如需保留空目录必须从根目录导入。

统一目标选择覆盖以下 UI 入口，默认根目录，集成模式先完成云端 library 初始化；加载失败或取消不新增资产、不开始输入媒体上传：

- 提示词库列表及详情中的普通提示词。
- 提示词来源内容弹窗的列表与详情。
- 完整模板、案例及公共库 workflow 的直接保存和编辑器新副本保存；始终整体保存。
- 图片／视频 Studio 成功结果。
- 画布文本、图片、视频节点保存。
- 画布侧栏图片／视频上传（本批次共用一个目标）。

已有 workflow 的“保存修改”保留原目录；“创建画布副本”仅创建画布，不暗中保存到 My Assets。相同 workflow 仅在相同目标目录去重，保存到其他目录创建独立完整副本。Agent 程序化添加仍默认根目录，不弹交互窗口。

本轮不改变 libraryVersion=2、单层 folder 文档、revision、删除保留资产或计费协议。交付清单写入 `/tmp/asset-grid-delivery.json`；构建目录和压缩包使用 `/tmp/infinite-canvas-asset-grid-domestic`、`/tmp/infinite-canvas-asset-grid-overseas` 及对应 `.tar.gz`，使用同一七牛媒体映射。

本轮验证：23 项外层定向回归及隔离子进程通过，覆盖四模式目录、目标默认值／取消／失效／云端加载失败、各 UI 入口接入和 workflow 往返；类型检查和双端构建通过。浏览器本机夹具验证新卡片展示、进入目录新增、普通提示词及 workflow 取消无新增、整体 workflow 保存到指定目录及 390px 中文卡片布局。ZIP 浏览器上传受扩展文件网址权限阻挡（审批后复试仍返回权限未开启），未改该设置；ZIP 归类与空目录保留由自动测试验证。真实生成结果及跨账号发布验收由双端接入会话完成。
