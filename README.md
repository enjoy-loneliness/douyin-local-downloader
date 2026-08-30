# 抖音本地下载助手

[![Chrome 109+](https://img.shields.io/badge/Chrome-109%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)

一个纯浏览器本地运行的 Chrome Manifest V3 扩展，用于解析和下载抖音网页版的单视频与图文作品。

无需后端，不调用第三方解析 API，不会把 Cookie、Token、作品信息或媒体地址发送到无关服务器。扩展优先复用用户当前浏览器中的抖音页面环境和登录状态。

> 当前版本：`0.1.1`。第一阶段聚焦单视频、图文、分享链接解析和下载。

## 功能

- 自动识别 `douyin.com/video/*` 当前作品；
- 在当前播放视频右侧原生操作栏增加“一键下载”按钮；
- 页面按钮支持：下载、解析中、下载中、已下载、下载失败；
- 支持抖音 SPA 页面，上下切换视频或动态跳转后自动重新绑定；
- Popup 展示 aweme_id、作者、标题、封面和作品类型；
- 下载无水印 MP4，并支持复制视频直链；
- 支持粘贴详情链接、`v.douyin.com` 短链接和完整分享文本；
- 支持抖音图文，展示全部原图并提供单张或批量下载；
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
5. 刷新已经打开的抖音页面。

代码或扩展更新后，需要在扩展管理页点击扩展卡片上的刷新按钮，然后再次刷新抖音页面。

## 使用方法

### 当前页面一键下载

1. 打开一个抖音视频详情页，或进入包含正在播放视频的抖音页面；
2. 在点赞、评论、收藏、分享按钮附近找到“下载”；
3. 点击后等待状态依次变为“解析中”“下载中”“已下载”；
4. 下载失败时可直接再次点击。

按钮由单例控制器管理。抖音 DOM 更新、视频切换或 SPA URL 变化后，扩展会节流检查当前视频并恢复按钮，避免重复插入和下载上一个作品。

### 使用 Popup

1. 打开抖音作品页面；
2. 点击 Chrome 工具栏中的扩展图标；
3. 查看当前作品的作者、标题、aweme_id、封面和资源类型；
4. 选择“下载无水印视频”或“复制视频地址”。

### 解析分享文本

下列输入都可以直接粘贴到 Popup：

```text
https://www.douyin.com/video/xxxxxxxxxxxxxxxxxxx
https://v.douyin.com/xxxxxxx/
3.21 复制打开抖音…… https://v.douyin.com/xxxxxxx/ ……
```

短链接会在一个临时非活动标签页中解析，以复用当前 Chrome 的抖音环境；解析完成后标签页自动关闭。

### 下载图文

识别到图文作品后，Popup 会显示全部原图。可以：

- 点击缩略图查看原图；
- 单独下载某张图片；
- 批量下载全部图片。

## 文件名

视频：

```text
作者_标题_awemeId.mp4
```

图文：

```text
作者_标题_awemeId_1.jpg
作者_标题_awemeId_2.webp
```

扩展会清理文件名中的路径分隔符、控制字符和系统不允许的字符。

## 解析与下载架构

```text
Douyin Page
├─ MAIN world bridge
│  ├─ 页面现有数据
│  ├─ Router / Hydration data
│  └─ fetch / XHR JSON observation
├─ Isolated content script
│  ├─ 当前作品识别
│  ├─ SPA / DOM 变化管理
│  └─ 页面一键下载按钮
├─ src/douyin/
│  ├─ URL 与分享文本解析
│  ├─ 抖音字段规范化
│  └─ 统一 DouyinMedia 数据模型
├─ Background service worker
│  ├─ 临时标签页分享链接解析
│  ├─ CDN 请求头规则
│  ├─ 媒体 Range 预检
│  └─ chrome.downloads 下载与状态监听
└─ React Popup
   ├─ 作品信息展示
   ├─ 视频下载 / 地址复制
   └─ 图文预览 / 批量下载
```

UI、下载管线与抖音解析层相互解耦。抖音字段变化时，主要修改 `src/douyin/`，不需要重写 Popup 或下载模块。

### 解析优先级

1. 页面已有数据：`_ROUTER_DATA`、`SSR_HYDRATED_DATA`、`__INITIAL_STATE__`、`__NEXT_DATA__`；
2. DOM 与内联 JSON script，包括旧版 `RENDER_DATA`；
3. MAIN world 只读观察抖音页面自身的 fetch/XHR JSON 响应；
4. 前三层未命中时，在当前抖音页面环境中请求同源 `aweme/detail`。

解析结果统一规范化为视频或图文作品，不依赖第三方解析服务。

### CDN 下载保护

抖音媒体 CDN 会校验请求来源。扩展通过 Manifest V3 `declarativeNetRequest` 为扩展自己的 CDN 请求设置 `Referer`，不会修改抖音页面正常发出的网络请求。

正式下载前会执行一个很小的 Range 请求：

- 视频必须返回 MP4 `ftyp` 文件头；
- 图片必须匹配 JPEG、PNG、WebP 或 GIF 文件签名；
- HTML、JSON、过期地址、403 和异常短响应会在下载前被拒绝；
- 验证通过后再交给 `chrome.downloads` 流式保存。

## 隐私与权限

| 权限 | 用途 |
| --- | --- |
| `downloads` | 使用 Chrome 下载管理器保存视频和图片 |
| `tabs` | 读取当前抖音标签页，并在解析分享链接时创建临时非活动标签页 |
| `clipboardWrite` | 复制视频直链 |
| `declarativeNetRequestWithHostAccess` | 仅为声明的抖音/字节 CDN 下载请求设置来源头 |
| 抖音及媒体 CDN host permissions | 解析作品并下载对应媒体文件 |

扩展不会：

- 访问或上传浏览器 Cookie 内容；
- 把 Token、作品信息或媒体地址发送给第三方解析网站；
- 收集账号、浏览历史或下载历史；
- 运行远程 JavaScript；
- 使用任何后端数据库或云服务。

网络请求只发生在抖音页面、抖音接口和作品所使用的字节系媒体 CDN 之间。

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
│  ├─ request-rules.ts      # 抖音 CDN Referer 规则
│  └─ index.ts              # Service Worker 消息协调
├─ content/
│  ├─ main-world.ts         # 页面数据和网络响应桥接
│  ├─ index.ts              # 当前作品解析入口
│  └─ page-download-button.ts
├─ douyin/
│  ├─ normalize.ts          # 抖音字段适配与统一模型
│  ├─ url.ts                # 链接和分享文本提取
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

### 下载结果是 `.html` 或提示无法提取文件

这通常代表媒体地址已过期，或者 CDN 返回了风控页面。0.1.1 及后续版本会在下载前校验响应并设置正确的来源头。请先更新扩展、刷新抖音页面，再重新播放并下载。

### 某个作品仍然无法下载

私密作品、已删除作品、地区限制内容和平台限制下载的内容可能不可用。可以在 Issues 中提供作品页面类型、错误状态和复现步骤，请勿提交 Cookie、Token 或个人账号信息。

## 参考项目

实现前研究了以下项目的解析思路：

- [GGBond-8080/copyvideo](https://github.com/GGBond-8080/copyvideo)：MAIN-world 桥接、页面网络数据和 CDN 下载处理；
- [duzhenxun/chrome-douyin](https://github.com/duzhenxun/chrome-douyin)：分享文本提取和 Popup 信息结构；
- [tagword/chrome-ext-douyin-downloader](https://github.com/tagword/chrome-ext-douyin-downloader)：页面播放器 DOM 识别。

本项目没有复制上述项目的完整代码或 UI，而是重新实现了类型模型、解析优先级、消息协议、下载校验和 React 界面。

## 参与贡献

欢迎提交 Issue 或 Pull Request。与抖音字段变化相关的修复请尽量附带：

- 页面类型和 URL 结构；
- 可脱敏的字段形状或错误信息；
- 是否登录；
- 视频、图文或分享链接场景；
- 浏览器版本和扩展版本。

请勿在 Issue、日志或截图中公开 Cookie、Token、账号隐私或带签名的长期有效资源地址。

## 使用说明

请尊重平台服务条款和原作者版权，仅下载你有权保存和使用的内容。使用者需自行承担下载、保存和传播内容所产生的责任。

当前仓库尚未附加开源许可证。源码公开不代表自动授予复制、修改或再分发权限。
