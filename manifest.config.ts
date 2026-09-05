import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: '抖音 / X 本地下载助手',
  description: '在浏览器本地解析并下载抖音与 X/Twitter 网页视频。',
  version: '0.2.0',
  minimum_chrome_version: '109',
  action: {
    default_title: '抖音 / X 本地下载助手',
    default_popup: 'popup.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['downloads', 'tabs', 'clipboardWrite', 'declarativeNetRequestWithHostAccess'],
  host_permissions: [
    'https://*.douyin.com/*',
    'https://*.douyinvod.com/*',
    'https://*.douyinpic.com/*',
    'https://*.bytecdntp.com/*',
    'https://*.byteimg.com/*',
    'https://x.com/*',
    'https://*.x.com/*',
    'https://twitter.com/*',
    'https://*.twitter.com/*',
    'https://video.twimg.com/*',
    'https://pbs.twimg.com/*',
    'https://t.co/*',
  ],
  content_scripts: [
    {
      matches: ['https://*.douyin.com/*'],
      js: ['src/content/main-world.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['https://*.douyin.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
      world: 'ISOLATED',
    },
    {
      matches: ['https://x.com/*', 'https://*.x.com/*', 'https://twitter.com/*', 'https://*.twitter.com/*'],
      js: ['src/twitter/main-world.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['https://x.com/*', 'https://*.x.com/*', 'https://twitter.com/*', 'https://*.twitter.com/*'],
      js: ['src/twitter/content.ts'],
      run_at: 'document_start',
      world: 'ISOLATED',
    },
  ],
});
