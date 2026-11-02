# 国内 Workbench Canvas 本地适配

## 模式

- `VITE_APP_MODE=domestic`：国内工作台接入，默认中文、`/canvas/` 基路径、同源 `/api/canvas`。
- `VITE_APP_MODE=overseas`：保留海外行为、英文默认及已有账号缓存名。
- 未设置或其他值：独立版，不请求 Workbench bootstrap、不使用公共 CDN 构建映射，默认中文。

集成行为统一由 `isWorkbench` 控制；地区由 `isDomestic` / `isOverseas` 区分。国内账号数据库和自配渠道偏好使用 `infinite-canvas:workbench:domestic:<userId>`，海外缓存名保持原样。用户修改、自配渠道密钥和个人数据不跨账号合并。

## 国内接口约定

核对国内 `video-workbench/src/app/api/canvas/bootstrap/route.ts` 后使用：

- `user.id`、`models`、`quota.points`、`capabilities` 为既有协议。
- `region=domestic`、`locale=zh-CN`、`currency=CNY`、`pointsPerYuan=10`。视频报价按实际币种对应换算率计算，不再假定美元。
- `aiModels=[]`，`capabilities.image/text/audio=false`。平台仅提供视频；自配渠道仍可提供其他能力。不会轮询不存在的平台AI任务。
- `capabilities.legacyImport=false`，国内不显示、不请求旧画布导入。
- `links.workbench=/`、`links.login=/login`、`links.recharge=/`，以 bootstrap 返回的同源路径为准。国内充值按钮在工作台弹窗中提供；`/settings/recharges` 是已核对存在的记录页，仅作为缺省回退。
- 继续复用原生 projects/assets/prompts/library/video 接口及 revision、requestKey、X-Canvas-Account。不引入旧 CanvasProject 表。
- `wechat_unbound` 保留403错误，显示返回国内工作台完成绑定提示；不尝试绕过、不自动重试生成。401启动失败给出登录链接。登录、绑定、授权和计费最终由后端验证。
- 国内不支持首尾帧时模型不得声明 `supportsFrames=true`；前端不显示首尾帧设置，后端继续拒绝不支持参数。

## 本地联调

```sh
VITE_APP_MODE=domestic CATALOG_MEDIA_MAP_FILE=/tmp/catalog-qiniu-map.json WORKBENCH_DEV_ORIGIN=http://127.0.0.1:3102 bun run --cwd web dev --host 127.0.0.1 --port 3202
```

正式本地联调入口为 `http://127.0.0.1:3102/canvas/`，由国内 Next 转发到3202，登录、返回和充值自然留在3102同源。3202只连接国内3102及专用测试库，不使用海外3100；不为Vite额外代理工作台首页或登录。

两种 Workbench 模式均要求完整的公共媒体映射，默认不回退第三方或本地案例原图，产物排除 `case-references`；独立构建保持原有静态资源行为。真实映射和服务发布由对应主会话管理；本轮已补做三模式临时目录构建，不推送、不部署。

## 验证与边界

- 三模式独立进程测试覆盖账号隔离、仅视频平台目录、自配渠道保留、人民币/美元换算、微信未绑定拒绝和账号切换拒绝。
- 海外原有20项集成回归通过；三模式构建配置通过真实68项映射验证，随后补做类型检查和三种模式实际生产构建，均通过。
- 只读国内UI夹具（测试账号、3210后端/3209前端）验证默认中文、平台视频设置、国内菜单无旧画布导入、人民币计费确认。确认已取消，未生成、未扣费；该夹具不代表真实登录或后端CRUD验收。
- 前端连接真实国内3102时，未登录请求正确显示中文登录提示；已登录的真实账号CRUD、上传及生成拒绝行为由国内主会话继续联调。

### 实际构建补充

`bun run --cwd web typecheck` 通过。使用 `bun run --cwd web build --outDir <独立临时目录>` 依次构建：

| 模式 | 临时输出目录 | 结果 |
| --- | --- | --- |
| domestic | `/tmp/infinite-canvas-domestic-validation` | 32.77秒；中文入口、68项映射、无case-references |
| overseas | `/tmp/infinite-canvas-overseas-validation` | 29.32秒；英文入口、68项映射、无case-references |
| standalone | `/tmp/infinite-canvas-standalone-validation` | 37.07秒；中文根入口、保留10张原图、不含七牛映射 |

两种集成构建使用 `CATALOG_MEDIA_MAP_FILE=/tmp/catalog-qiniu-map.json`。三种产物均保留config.js和logo.svg。现有非module config.js、混合静态/动态导入及大分包警告不阻止构建，本轮未改分包或警告阈值。以上不是部署或已登录浏览器验收；真实登录后的创建、保存、刷新恢复仍待本次图形验证码授权。
