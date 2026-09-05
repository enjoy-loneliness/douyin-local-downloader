# 更新日志

本项目遵循语义化版本思路记录用户可感知的功能、修复和兼容性变化。

## 0.2.0 - 2026-09-05

### 新增

- 支持 `x.com/*/status/*` 与 `twitter.com/*/status/*` 视频帖子；
- 支持 `t.co`、直接帖子链接及包含链接的完整分享文本；
- 新增独立 `src/twitter/` 平台解析层；
- 观察页面已有 GraphQL/REST JSON，从 `video_info.variants` 选择最高 bitrate MP4；
- 兼容 X 新版未登录 SSR/React Flight 页面，通过封面媒体 ID过滤回复视频并选择最大分辨率 MP4；
- X/Twitter 帖子原生操作栏一键下载按钮；
- X 多媒体 GraphQL 数据中每个视频选择最高画质并依次下载；
- Popup 增加平台标识、tweet_id 和 X/Twitter 分享链接解析；
- `video.twimg.com` CDN Referer 规则及 MP4 Range 文件头验证。

### 修复

- 抖音详情页不再把推荐视频 ID误认为当前主作品；
- 抖音 DOM 回退不再接受 `douyinstatic.com/uuu_265.mp4` 等播放器占位文件；
- 下载层、消息协议和 Popup 改为跨平台判别联合模型，同时保留原有抖音视频与图文行为。

### 验证

- X 真实公开帖子：正确识别 tweet_id、焦点媒体 ID、作者、正文、封面和最高画质 MP4；
- X CDN：HTTP 206、`video/mp4`、ISO BMFF `ftypisom` 文件头；
- X 完整分享文本：临时标签页解析闭环通过；
- 抖音真实公开作品：正确识别 aweme_id、作者和 VOD 地址；
- 23 项单元测试、ESLint、TypeScript 和 Vite 生产构建通过。

## 0.1.2 - 2026-08-30

- 当前作品 ID优先级和 SPA 切换一致性修复；
- 页面下载每次按当前 aweme_id 刷新详情地址；
- 增加 `no-store`、捕获版本和下载前 ID复核。

## 0.1.1 - 2026-08-30

- 修复抖音 CDN 返回 HTML 导致下载失败；
- 增加 Referer 网络规则、Range 预检和媒体签名验证；
- 增加 NC-RTL-1.0 非商业研究与测试许可证及免责声明。

## 0.1.0 - 2026-08-30

- 首次实现抖音单视频、图文、分享链接、Popup 和页面一键下载。
