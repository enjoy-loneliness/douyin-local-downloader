# 抖音 / X 本地下载助手

[![Chrome 109+](https://img.shields.io/badge/Chrome-109%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/License-NC--RTL--1.0-red)](./LICENSE)

一个纯浏览器本地运行的 Chrome Manifest V3 扩展，用于解析和下载抖音网页版视频、图文作品，以及 X/Twitter 帖子视频。

无需后端，不调用第三方解析 API，不读取或上传 Cookie/Bearer Token，也不会把作品信息或媒体地址发送到无关服务器。扩展优先利用当前浏览器页面已经取得的数据。

> 当前版本：`0.2.0`。支持抖音单视频/图文和 X/Twitter 帖子视频。

> [!WARNING]
> 本项目仅允许个人非商业研究与测试，禁止商用、收费服务、广告变现、组织内部生产使用、应用商店发布和构建产物再分发。使用者只能处理其依法有权保存的内容。使用前请阅读 [`LICENSE`](./LICENSE) 和 [`DISCLAIMER.md`](./DISCLAIMER.md)。

版本变化见 [`CHANGELOG.md`](./CHANGELOG.md)。

## 功能

- 自动识别 `douyin.com/video/*` 当前作品；
- 在当前播放视频右侧原生操作栏增加“一键下载”按钮；
- 页面按钮支持：下载、解析中、下载中、已下载、下载失败；
- 支持抖音 SPA 页面，上下切换视频或动态跳转后自动重新绑定；
- 页面下载每次都按当前 aweme_id 刷新详情和媒体地址，不复用上一次下载缓存；
- Popup 展示 aweme_id、作者、标题、封面和作品类型；
- 下载无水印 MP4，并支持复制视频直链；
- 支持粘贴详情链接、`v.douyin.com` 短链接和完整分享文本；
- 支持抖音图文，展示全部原图并提供单张或批量下载；
- 支持 `x.com/*/status/*`、`twitter.com/*/status/*` 和 `t.co` 分享链接；
- 从 X 页面已有 GraphQL 响应中提取 `video_info.variants`，选择最高 bitrate 的 MP4；
- X 页面数据包含多个媒体对象时，会按顺序下载每个视频的最高画质 MP4；
- 在 X 帖子回复/转推/点赞/分享操作栏中增加原生风格下载按钮；
- 下载前校验响应类型和媒体文件头，避免把 HTML 风控页面保存为 `.mp4`；
- 视频通过 `chrome.downloads` 流式下载，不会把长视频整体读入扩展内存。

## 支持范围

| 类型 | 状态 |
| --- | --- |
| `douyin.com/video/*` 视频详情页 | 支持 |
| 当前正在播放的视频 | 支持 |
| `douyin.com/note/*` / 图文作品 | 支持 |
| `v.douyin.com` 短链接 | 支持 |
| 包含抖音链接的完整分享文本 | 支持 |
| `x.com/*/status/*` 帖子视频 | 支持 |
| `twitter.com/*/status/*` 帖子视频 | 支持 |
| `t.co` 或包含 X/Twitter 链接的分享文本 | 支持 |
| X 单帖子多视频 | GraphQL 页面数据完整时支持全部；SSR 回退至少下载主视频 |
| 用户主页批量下载 | 暂不支持 |
| 收藏、喜欢、评论 | 暂不支持 |
| 直播 | 暂不支持 |

## 安装

### 从源码构建

环境要求：

- Node.js 20 或更高版本；
- npm；
- Chrome 109 或更高版本。

```bash
git clone https://github.com/enjoy-loneliness/douyin-local-downloader.git
cd douyin-local-downloader
npm install
npm run build
```

构建成功后，扩展产物位于 `dist/`。

### 加载到 Chrome

1. 打开 `chrome://extensions/`；
2. 开启右上角“开发者模式”；
3. 点击“加载已解压的扩展程序”；
4. 选择项目中的 `dist/` 文件夹；
5. 刷新已经打开的抖音或 X/Twitter 页面。

代码或扩展更新后，需要在扩展管理页点击扩展卡片上的刷新按钮，然后再次刷新目标页面。

## 使用方法

### 抖音当前页面一键下载

1. 打开一个抖音视频详情页，或进入包含正在播放视频的抖音页面；
2. 在点赞、评论、收藏、分享按钮附近找到“下载”；
3. 点击后等待状态依次变为“解析中”“下载中”“已下载”；
4. 下载失败时可直接再次点击。

按钮由单例控制器管理。抖音 DOM 更新、视频切换或 SPA URL 变化后，扩展会节流检查当前视频并恢复按钮，避免重复插入和下载上一个作品。

### X/Twitter 帖子一键下载

1. 打开 `x.com` 或 `twitter.com` 的视频帖子；
2. 在回复、转推、点赞、收藏、分享操作栏附近找到下载箭头；
3. 点击后扩展从该帖子的页面数据中选择最高 bitrate MP4；
4. 帖子包含多个视频时，会依次下载全部视频；
5. 图标会反馈解析中、下载中、已下载或下载失败状态。

X 页面按钮同样采用单例、节流 MutationObserver 和 SPA/播放事件监听，不会向任何第三方解析网站发送帖子 URL 或登录信息。

### 使用 Popup

1. 打开抖音作品页面或 X/Twitter 视频帖子；
2. 点击 Chrome 工具栏中的扩展图标；
3. 查看作者、标题、平台、aweme_id/tweet_id、封面和资源类型；
4. 选择下载最高画质视频、下载图文或复制视频地址。

### 解析分享文本

下列输入都可以直接粘贴到 Popup：

```text
https://www.douyin.com/video/xxxxxxxxxxxxxxxxxxx
https://v.douyin.com/xxxxxxx/
3.21 复制打开抖音…… https://v.douyin.com/xxxxxxx/ ……
https://x.com/username/status/xxxxxxxxxxxxxxxxxxx
https://twitter.com/username/status/xxxxxxxxxxxxxxxxxxx
看看这个视频：https://t.co/xxxxxxxxxx
```

短链接会在一个临时非活动标签页中解析，以复用当前 Chrome 页面环境；解析完成后标签页自动关闭。

### 下载图文

识别到图文作品后，Popup 会显示全部原图。可以：

- 点击缩略图查看原图；
- 单独下载某张图片；
- 批量下载全部图片。

## 文件名

视频：

```text
作者_标题_awemeId.mp4
username_帖子正文_tweetId.mp4
username_帖子正文_tweetId_1.mp4
username_帖子正文_tweetId_2.mp4
```

图文：

```text
作者_标题_awemeId_1.jpg
作者_标题_awemeId_2.webp
```

扩展会清理文件名中的路径分隔符、控制字符和系统不允许的字符。

## 解析与下载架构

```text
Douyin Page                         X / Twitter Page
├─ MAIN world bridge               ├─ MAIN world GraphQL observer
├─ Router / hydration / API data   ├─ video_info.variants normalizer
├─ Active-video SPA binding        ├─ Active-post SPA binding
└─ Native-adjacent page button     └─ Native action-bar button
                │                                  │
                └────────── DownloadableMedia ─────┘
                                   │
                        Background service worker
                        ├─ Share-link temporary tab
                        ├─ Platform CDN header rules
                        ├─ Range + MP4 signature check
                        └─ chrome.downloads streaming
                                   │
                              React Popup
```

UI、下载管线与两个平台解析层相互解耦。抖音字段变化只修改 `src/douyin/`，X/Twitter 字段变化只修改 `src/twitter/`，共享 UI 和下载模块不需要复制。

### 抖音解析优先级

1. 页面已有数据：`_ROUTER_DATA`、`SSR_HYDRATED_DATA`、`__INITIAL_STATE__`、`__NEXT_DATA__`；
2. DOM 与内联 JSON script，包括旧版 `RENDER_DATA`；
3. MAIN world 只读观察抖音页面自身的 fetch/XHR JSON 响应；
4. 前三层未命中时，在当前抖音页面环境中请求同源 `aweme/detail`。

解析结果统一规范化为视频或图文作品，不依赖第三方解析服务。

### X/Twitter 解析优先级

1. 页面已经取得的 GraphQL / REST JSON 响应；
2. 页面现有状态和内联 JSON script；
3. 当前视频帖子的 DOM、poster 和直接 `video.twimg.com` MP4；
4. 从 `extended_entities.media[].video_info.variants[]` 筛选 MP4，并按 bitrate 选择最高画质；
5. 新版未登录 SSR 页面通过受限后台请求重新读取公开 status HTML，使用封面媒体 ID过滤回复视频并选择最大分辨率 MP4。

扩展不提取 Bearer Token，不调用需要自行拼装认证头的私有 API，也不把 Cookie 或帖子地址交给后端解析。

### CDN 下载保护

媒体 CDN 可能校验请求来源。扩展通过 Manifest V3 `declarativeNetRequest` 为自己的抖音和 `video.twimg.com` 下载请求设置对应 `Referer`，不会修改平台页面正常发出的网络请求。

正式下载前会执行一个很小的 Range 请求：

- 视频必须返回 MP4 `ftyp` 文件头；
- 图片必须匹配 JPEG、PNG、WebP 或 GIF 文件签名；
- HTML、JSON、过期地址、403 和异常短响应会在下载前被拒绝；
- 验证通过后再交给 `chrome.downloads` 流式保存。

## 隐私与权限

| 权限 | 用途 |
| --- | --- |
| `downloads` | 使用 Chrome 下载管理器保存视频和图片 |
| `tabs` | 读取当前支持的平台标签页，并在解析分享链接时创建临时非活动标签页 |
| `clipboardWrite` | 复制视频直链 |
| `declarativeNetRequestWithHostAccess` | 仅为声明的抖音/字节和 X 媒体 CDN 下载请求设置来源头 |
| 抖音、X/Twitter 及媒体 CDN host permissions | 解析作品并下载对应媒体文件 |

扩展不会：

- 访问或上传浏览器 Cookie 内容；
- 把 Token、作品信息或媒体地址发送给第三方解析网站；
- 收集账号、浏览历史或下载历史；
- 运行远程 JavaScript；
- 使用任何后端数据库或云服务。

网络请求只发生在用户访问的平台页面、平台自身接口和对应媒体 CDN 之间。

## 开发

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` 会连续执行：

1. ESLint；
2. TypeScript 类型检查；
3. Vitest 单元测试；
4. Vite 生产构建。

当前测试覆盖分享文本 URL 提取、视频/图文字段规范化、当前作品选择，以及 MP4/图片文件头和 HTML 拦截页识别。

## 项目结构

```text
src/
├─ background/
│  ├─ downloads.ts          # 文件名、下载启动和完成状态
│  ├─ media-validation.ts   # Range 预检与媒体签名检查
│  ├─ request-rules.ts      # 平台 CDN Referer 规则
│  └─ index.ts              # Service Worker 消息协调
├─ content/
│  ├─ main-world.ts         # 页面数据和网络响应桥接
│  ├─ index.ts              # 当前作品解析入口
│  └─ page-download-button.ts
├─ douyin/
│  ├─ normalize.ts          # 抖音字段适配与统一模型
│  ├─ url.ts                # 链接和分享文本提取
│  └─ types.ts
├─ twitter/
│  ├─ normalize.ts          # GraphQL/REST 视频变体规范化
│  ├─ current-page.ts       # 当前视频帖子识别
│  ├─ main-world.ts         # 页面 API 响应观察
│  ├─ content.ts            # X/Twitter 内容脚本入口
│  ├─ page-download-button.ts
│  ├─ url.ts
│  └─ types.ts
├─ popup/
│  ├─ App.tsx
│  └─ styles.css
└─ shared/
   └─ messages.ts           # UI / Content / Background 消息协议
```

## 常见问题

### 扩展管理页找不到扩展

执行 `npm run build` 不会自动安装扩展。需要在 `chrome://extensions/` 中手动选择 `dist/`。不要选择 ZIP、项目根目录或 `src/`。

### 抖音页面没有“下载”按钮

1. 在扩展管理页点击扩展刷新按钮；
2. 刷新抖音页面；
3. 让当前视频开始播放；
4. 确认扩展拥有 `douyin.com` 网站访问权限。

### X/Twitter 帖子没有下载按钮

1. 确认当前帖子包含原生上传的视频或 GIF；
2. 播放视频，让页面取得媒体数据；
3. 确认扩展拥有 `x.com` / `twitter.com` 网站访问权限；
4. 更新扩展后，先刷新扩展卡片，再刷新 X/Twitter 页面。

第一版不处理直播、Spaces、外部嵌入播放器或只有 HLS/VMAP 而没有 MP4 变体的广告卡片。

### 下载结果是 `.html` 或提示无法提取文件

这通常代表媒体地址已过期，或者 CDN 返回了风控页面。0.1.1 及后续版本会在下载前校验响应并设置正确的来源头。请先更新扩展、刷新抖音页面，再重新播放并下载。

### 某个作品仍然无法下载

私密作品、已删除作品、地区限制内容和平台限制下载的内容可能不可用。可以在 Issues 中提供作品页面类型、错误状态和复现步骤，请勿提交 Cookie、Token 或个人账号信息。

## 参考项目

实现前研究了以下项目的解析思路：

- [GGBond-8080/copyvideo](https://github.com/GGBond-8080/copyvideo)：MAIN-world 桥接、页面网络数据和 CDN 下载处理；
- [duzhenxun/chrome-douyin](https://github.com/duzhenxun/chrome-douyin)：分享文本提取和 Popup 信息结构；
- [tagword/chrome-ext-douyin-downloader](https://github.com/tagword/chrome-ext-douyin-downloader)：页面播放器 DOM 识别。
- [X 官方媒体数据字典](https://docs.x.com/x-api/enterprise-gnip-2.0/fundamentals/data-dictionary)：`video_info.variants` 和 MP4 bitrate 字段；
- [Teylersf/x-video-downloader](https://github.com/Teylersf/x-video-downloader)：X 操作栏按钮和最高码率选择思路。

本项目没有复制上述项目的完整代码或 UI，而是重新实现了类型模型、解析优先级、消息协议、下载校验和 React 界面。

## 参与贡献

欢迎在遵守非商业许可证的前提下提交 Issue 或 Pull Request。与平台字段变化相关的修复请尽量附带：

- 页面类型和 URL 结构；
- 可脱敏的字段形状或错误信息；
- 是否登录；
- 视频、图文或分享链接场景；
- 浏览器版本和扩展版本。

请勿在 Issue、日志或截图中公开 Cookie、Token、账号隐私或带签名的长期有效资源地址。

## 许可证与使用说明

本项目采用自定义的 [非商业研究与测试许可证 1.0（NC-RTL-1.0）](./LICENSE)：

- 仅允许个人非商业研究、学习和测试；
- 禁止商业使用、组织内部生产使用、收费服务、广告变现和商店上架；
- 禁止未经书面许可分发构建产物或衍生产品；
- 所有商业授权和例外必须取得权利人的事先书面许可；
- 违规时授权自动终止。

本项目是 Source Available 软件，不是 OSI 定义的开放源代码软件。GitHub 的公开可见性和 Fork 功能不构成额外商业授权。

请同时阅读完整的 [`DISCLAIMER.md`](./DISCLAIMER.md)。任何许可证或免责声明都不能排除适用法律明确规定不得排除的责任；如需针对具体商业或法律场景作出决定，请咨询合格律师。
