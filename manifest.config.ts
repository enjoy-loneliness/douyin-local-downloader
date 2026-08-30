import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: '抖音本地下载助手',
  description: '在浏览器本地解析并下载抖音网页版视频和图文作品。',
  version: '0.1.2',
  minimum_chrome_version: '109',
  action: {
    default_title: '抖音本地下载助手',
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
  ],
});
