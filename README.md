# 抖音本地下载助手

一个基于 TypeScript、React、Vite 和 Chrome Manifest V3 的本地扩展。第一阶段支持：

- 自动识别 `douyin.com/video/*` 当前视频；
- 在当前播放作品右侧原生操作栏提供一键下载按钮，并跟随 SPA 视频切换；
- 展示 aweme_id、作者、标题、封面；
- 下载无水印 MP4、复制视频地址；
- 从详情链接、`v.douyin.com` 短链接或完整分享文本解析作品；
- 识别抖音图文，预览全部原图并支持单张/批量下载；
- 不使用后端，不调用第三方解析 API，不向第三方发送 Cookie、Token 或媒体地址。

## 构建与安装

```bash
npm install
npm run build
```

构建产物位于 `dist/`。打开 `chrome://extensions`，启用开发者模式，点击“加载已解压的扩展程序”，选择本项目的 `dist/`。

扩展更新后，需要在扩展管理页点击刷新，并刷新已打开的抖音标签页。

## 解析架构

抖音相关逻辑全部位于 `src/douyin/`，UI 位于 `src/popup/`，下载位于 `src/background/downloads.ts`。

解析顺序：

1. 页面现有数据：`_ROUTER_DATA`、`SSR_HYDRATED_DATA`、`__INITIAL_STATE__` 等；
2. DOM 与内联 JSON script（包括旧版 `RENDER_DATA`）；
3. MAIN world 只读观察页面自己的 fetch/XHR JSON 响应；
4. 前三层未命中时，在当前抖音页面环境中请求同源 `aweme/detail`。

分享链接使用后台临时非活动标签页打开，沿用用户浏览器当前的抖音登录环境；解析完成后自动关闭。下载通过 `chrome.downloads` API 发起。下载前会为抖音 CDN 请求注入页面来源头，并使用小范围 Range 请求校验 MP4/图片文件头，避免把风控 HTML 页面误存为媒体文件。

页面内下载按钮由 `src/content/page-download-button.ts` 管理，只提供入口和状态反馈，解析仍调用现有 `GET_PAGE_MEDIA`，下载仍调用后台 `downloads.ts`。按钮状态包括下载、解析中、下载中、已下载和下载失败；下载失败时可直接重试。

## 参考项目研究结论

- `GGBond-8080/copyvideo`：采用 MV3 MAIN-world 桥接，读取路由数据并监听 fetch/XHR；这是本项目四层解析策略的主要参考。
- `duzhenxun/chrome-douyin`：分享文本提取清晰，但核心解析调用第三方 API，不符合本项目隐私边界。
- `tagword/chrome-ext-douyin-downloader`：直接读取 `<video>/<source>`，实现很轻，但无法覆盖现代抖音常见的 MSE/blob 播放方式。

本项目没有复制上述项目的完整代码或 UI，只借鉴了解析策略，并重新设计了类型、消息协议和字段规范化层。

## 已知边界

- 抖音网页字段和风控可能随时变化；字段适配集中在 `src/douyin/normalize.ts`。
- 私密、地区限制、已删除或版权受限作品可能无法下载。
- 图文原图以页面返回的 `download_url` / `origin_url` 为优先来源；文件实际编码由抖音 CDN 决定。
- 第一阶段不包含用户主页批量下载、收藏、喜欢、评论或直播。
