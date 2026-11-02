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

海外构建指定 `VITE_APP_MODE=overseas CATALOG_MEDIA_MAP_FILE=/absolute/path/to/map.json`，路径由构建端读取，只有地址数据进入前端。海外生产构建缺映射或漏key会拒绝继续。独立构建忽略该变量。原始来源链接保留作署名，不作为媒体加载fallback。个人素材上传和账号归属保持原链路。

本会话不构建、不部署；待转存端交付映射后再核对真实地址及媒体覆盖。原图暂缺的6例继续支持用户自行上传。
