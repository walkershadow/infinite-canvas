# 海外公共案例媒体七牛转存协议

机器清单：`docs/catalog-media-manifest.json`。由 `bun web/scripts/catalog-media-manifest.ts` 从正式目录生成，包含29案例及27模板中所有 referenceMedia、outputMedia、poster、步骤 image、输入 image。无附件的6例不会产生虚构文件。

每条 `media` 以 `key` 去重；本地文件优先使用 `repositoryPath`（相对仓库根目录），否则使用 `urls` 中的下载地址。`uses` 列出案例ID、字段用途和完整来源署名。`urls` 是目录记录的下载地址，下载成功与实际内容校验由转存端确认。

转存端提供 UTF-8 JSON，格式如下：

```json
{
  "version": 1,
  "allowedOrigins": ["https://your-qiniu-cdn.example"],
  "media": {
    "web/public/case-references/meilin-character.jpg": {"url": "https://your-qiniu-cdn.example/catalog/meilin-character.jpg"},
    "原始视频或封面URL": {"url": "https://your-qiniu-cdn.example/catalog/example.mp4"},
    "确认无法取得的媒体key": {"unavailable": true, "reason": "原始来源无法下载，已核对"}
  }
}
```

所有清单key必须显式提供地址或不可用原因；不可用不等于转存完成。地址必须是 allowedOrigins 中的 HTTPS 公开七牛/CDN地址，不能使用短时签名链接。七牛需要允许浏览器读取、图片跨域下载和视频 Range 请求。密钥只由上传端持有，映射文件不含密钥。

Workbench集成构建（海外 `VITE_APP_MODE=overseas`，国内 `VITE_APP_MODE=domestic`）均需要映射；例如海外构建指定 `VITE_APP_MODE=overseas CATALOG_MEDIA_MAP_FILE=/absolute/path/to/map.json`，路径由构建端读取，只有地址数据进入前端。海外生产构建缺映射或漏key会拒绝继续。独立构建忽略该变量。原始来源链接保留作署名，不作为媒体加载fallback。个人素材上传和账号归属保持原链路。

本会话不构建、不部署；转存端已交付68项真实映射，覆盖及本地原图散列已核对，CDN图片和视频Range/CORS已抽查。最终浏览器和构建产物验收由发布端完成。原图暂缺的6例继续支持用户自行上传。

海外构建关闭 Vite 默认 public 全量复制，仅复制除 `public/case-references` 外的公共资源，并清除输出目录中遗留的 `case-references`。源码原图保留，独立构建仍使用 Vite 默认复制行为。发布端仍应在最终产物确认不存在 `case-references`；本地定向回归只使用临时目录，未执行完整构建。

已有 Assets 的 workflow 快照在读取、编辑展示、导入和创建画布时按已知原始URL或仓库路径应用当前映射，仅调整媒体解析。源提示词、翻译、用户阶段与参考用途不重置；带 `storageKey` 的个人上传图和未知自定义媒体不改写。无需后端接口或存储版本迁移；重新保存使用现有素材接口。不可用目录媒体在详情中显示不可用，不提供原始媒体下载fallback；作者署名链接仍保留。

可重复验证真实映射（不执行构建）：

```sh
CATALOG_MEDIA_MAP_FILE=/absolute/path/to/qiniu-map.json bun test --cwd web tests/catalog-media-real-map.test.ts tests/catalog-media.test.ts tests/overseas-public-assets.test.ts tests/workflow.test.ts
```

发布端应持久保存映射并在 jp1 使用其实际绝对路径，不依赖交接时的 `/tmp/catalog-qiniu-map.json` 长期存在。真实映射测试未设置该变量时跳过；普通映射回归仍会运行。
