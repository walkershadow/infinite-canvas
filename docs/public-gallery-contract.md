# 海外公共素材与三参考流程

仅 `overseas` 启用。国内和独立模式不显示入口、不请求图库。前端不读取角色来自行开放；bootstrap 的 `capabilities.publicLibrary` 为 true 才展示，素材列表、内容和生成接口仍须后端独立鉴权。`publicLibraryAdmin` 预留为服务端管理员能力，本轮前端不提供开关管理。

## 接口

- `GET /api/canvas/public-library?kind=face|outfit|pose|depth&search=&category=&page=1&groupId=`：返回 `{items,total,page,pageSize,facets:{categories,categoryLabels}}`。使用后端约定的24条分页，前端不截断总数；搜索提交后重新从第一页加载。
- 条目：`{id,kind,groupId,title:{en,zh,original},category,categoryLabel,tags,tagsLocalized,angle?,angleLabel?,thumbnailUrl,url,width,height,source:{label,url,author}}`。姿势默认每动作一条，打开动作后带 groupId 查询角度。只渲染当前页，缩略图懒加载；打开详情或选入流程才读取原图。
- `GET /api/canvas/public-library/workflows?language=en|zh|original`：返回 `{items:WorkflowDocument[]}`，只包含已发布模板/案例。
- `POST /api/canvas/public-library/workflows/{source.id}/open?language=en|zh|original`：直接返回 `WorkflowDocument`，沿用已确认 POST 契约，不需要新增 GET 详情。
- 需保留 `references[].galleryCategory` 及 `source.referenceInputs[].galleryCategory`（face/outfit/pose/depth）；画布节点透传到 `metadata.workflowReference.galleryCategory`。工作流 schemaVersion 仍为1。source.referenceMedia/outputMedia 使用同源绝对URL以保持现有校验不变；references[].image.url 使用相对受保护路径。

## 永久地址与权限

公共图片使用 `/api/canvas/public-library/{id}/content`，缩略图使用 `?variant=thumb`。该路径可以持久保存，由服务端鉴权并解析私有七牛内容，不向前端暴露长期密钥或将有时效签名作为永久地址。

流程保存与重开保留原路径，不赋予个人 storageKey；工作流导出保留受保护地址，不附带公共素材原图文件。画布生成上下文不把这些路径提前转为base64，Workbench生成适配器直接按顺序提交路径，不下载再上传 `/assets`。这些保障不替代服务端对内容、生成和权限开关的检查。

## 交互与真实案例

我的资产页提供“我的资产 / 公共素材”切换，提示词库也提供“公共素材”入口，复用同一个懒加载组件，不新增主导航。公共库包含模板与案例、人物、服装、姿势。整个流程复用现有 Assets 保存和 WorkflowEditor；工作流编辑器的“更换参考图片”及画布参考节点的“替换”均打开对应分类、我的图片资产和上传入口。仅替换该节点图片和尺寸，保留节点ID、连线、参考角色和用户提示词。切换界面语言不重置正在编辑的草稿。

通用模板 inputOrder 为人物→服装→姿势。用户 Infinite Canvas 1 的实际案例必须保留人物→姿势→服装，前端遵守服务端 `stages[].inputOrder`，不根据分类排序。已核对的原图为 f0a31815789.png / full_sexy_P001_diag.png / AUT-0198.png；原始提示词“结合参考图中的人物、衣服和姿势，生成一张该女生穿着该衣服的摆出这个动作的图片”，原始模型ali-image、1024×1024、3张结果。案例文本及结果由后端返回，前端不编造或用通用模板替代。缺真实案例时明确显示未发布。

## 本地验证

定向测试覆盖三模式权限隔离、分页查询编码、真实案例与模板的不同输入顺序、Assets往返、替换保留编辑，以及公共路径经过上下文准备、云保存和生成引用解析后不发生转存。类型检查通过。类型检查及定向回归13项通过（663断言），含独立Workbench集成21项（207断言）。本地海外构建通过，产物位于 `/tmp/public-library-real-build`，预览3200由真实后端3100的 `/canvas/` 代理。未部署、未提交收费生成。

本地浏览器夹具使用3213前端/3214内存服务，素材明确标为 UI FIXTURE，仅验证界面协议。已验证英文分页（24条/页）、动作组到5角度、中文切换、完整保存Assets并重开、编辑器换图、创建3参考＋1图片生成步骤、画布原位换图及刷新恢复，用户提示词不变。新公共流程副本初始生成数量为1，实际案例的原始3张结果仅作为来源记录。截图 `/tmp/public-library-fixture-canvas.png` 不代表真实原图或生成效果。

真实浏览器验收使用 `http://localhost:3100/canvas/assets`（我的资产→公共素材）及 `/canvas/prompts?collection=public-library`。真实模板与案例均显示且保存成功；案例3张原始参考图和3张1024×1024结果加载成功，输入顺序、原始提示词及参数正确。已验证 Assets 重开、编辑提示词、从真实人物库换图、保存后再重开、创建画布副本、画布参考节点再次换图、刷新后图片和编辑提示词保留。验收画布 `/canvas/canvas/h3nU-ClbF3MWD0lPY-P31`；图片保持受保护相对路径，新生成步骤默认1张。中英文目录、动作与五角度标签和图片均通过；现有资产编辑稿未随界面语言切换覆盖。截图 `/tmp/public-library-real-case.png` 与 `/tmp/public-library-real-canvas.png`，Assets 公共库英文入口截图 `/tmp/public-library-real-assets-en.png`。验收结束恢复英文显示。

首次人物缩略图曾有单张加载失败，重新打开后恢复；后端随后改为复用S3Client并使用SDK读取，复查13张人物缩略图全部加载成功。普通账号开关与收费生成的权限验证由后端测试覆盖，本轮前端浏览器只验收当前有权限会话，不将其记作多账号或收费生成验收。

管理员页SSR修复后浏览器复查通过：59条素材、2个流程、Administrator preview only，开关关闭。后端切换Cloudflare R2后再次只读验收：模板／案例全部参考图和三张实际结果加载正常，已有Assets重开及原画布刷新后图片正常，用户提示词保留。管理页显示Storage: Cloudflare R2。未新增重复验收资产、未提交生成、未切换开关；页面保持英文。截图 `/tmp/public-library-r2-case.png`、`/tmp/public-library-r2-assets.png`、`/tmp/public-library-r2-canvas.png`、`/tmp/public-library-r2-admin.png`。存储提供商切换由后端负责，前端受保护接口路径不变。
