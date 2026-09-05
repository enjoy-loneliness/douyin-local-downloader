import { findCurrentPageWork, normalizeAwemePayload } from '../douyin';
import type { DouyinMedia, DouyinSource } from '../douyin';

const BRIDGE_SCOPE = '__DOUYIN_LOCAL_DOWNLOADER_V1__';
const CAPTURE_ATTRIBUTE = 'data-douyin-local-downloader-captures';
const INSTALL_MARKER = '__douyinLocalDownloaderInstalled';

type PageWindow = Window &
  typeof globalThis & {
    _ROUTER_DATA?: unknown;
    SSR_HYDRATED_DATA?: unknown;
    __INITIAL_STATE__?: unknown;
    __NEXT_DATA__?: unknown;
    [INSTALL_MARKER]?: boolean;
  };

const pageWindow = window as PageWindow;

if (!pageWindow[INSTALL_MARKER]) {
  pageWindow[INSTALL_MARKER] = true;
  installBridge();
}

function currentAwemeId(): string | null {
  return findCurrentPageWork().awemeId;
}

function saveCapture(media: DouyinMedia): void {
  try {
    const root = document.documentElement;
    if (!root) return;
    const previous = JSON.parse(root.getAttribute(CAPTURE_ATTRIBUTE) || '[]') as DouyinMedia[];
    const next = previous.filter((item) => item?.awemeId !== media.awemeId);
    next.push(media);
    root.setAttribute(CAPTURE_ATTRIBUTE, JSON.stringify(next.slice(-20)));
    window.postMessage({ scope: BRIDGE_SCOPE, type: 'capture', media }, '*');
  } catch {
    // Parsing is best-effort and must never affect the host page.
  }
}

function consumePayload(payload: unknown, source: DouyinSource, preferredAwemeId = currentAwemeId()): DouyinMedia | null {
  try {
    const media = normalizeAwemePayload(payload, {
      pageUrl: location.href,
      source,
      preferredAwemeId,
    });
    if (media) saveCapture(media);
    return media;
  } catch {
    return null;
  }
}

function parseScript(script: HTMLScriptElement): unknown {
  const text = script.textContent?.trim();
  if (!text) return null;
  const decoded = script.id === 'RENDER_DATA' ? decodeURIComponent(text) : text;
  try {
    return JSON.parse(decoded);
  } catch {
    const assignment = decoded.match(/(?:window\.)?(?:__INITIAL_STATE__|SSR_HYDRATED_DATA|_ROUTER_DATA)\s*=\s*(\{[\s\S]+\})\s*;?$/);
    if (!assignment?.[1]) return null;
    try {
      return JSON.parse(assignment[1]);
    } catch {
      return null;
    }
  }
}

function scanPageData(preferredAwemeId = currentAwemeId()): DouyinMedia | null {
  const globals: unknown[] = [
    pageWindow._ROUTER_DATA,
    pageWindow.SSR_HYDRATED_DATA,
    pageWindow.__INITIAL_STATE__,
    pageWindow.__NEXT_DATA__,
  ];
  for (const value of globals) {
    const media = consumePayload(value, 'page-data', preferredAwemeId);
    if (media) return media;
  }

  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script#RENDER_DATA, script#__NEXT_DATA__, script[type="application/json"], script:not([src])',
  );
  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (!/(?:aweme_id|awemeId|play_addr|image_post_info)/.test(text)) continue;
    const parsed = parseScript(script);
    if (!parsed) continue;
    const media = consumePayload(parsed, 'dom-script', preferredAwemeId);
    if (media) return media;
  }
  return null;
}

function scanDom(preferredAwemeId = currentAwemeId()): DouyinMedia | null {
  if (!preferredAwemeId) return null;
  const video = findCurrentPageWork().video;
  const videoUrl = video?.currentSrc || video?.src || video?.querySelector('source')?.src;
  if (!videoUrl || videoUrl.startsWith('blob:')) return null;
  try {
    const hostname = new URL(videoUrl).hostname.toLowerCase();
    if (!hostname.endsWith('.douyinvod.com') && !hostname.endsWith('.bytecdntp.com')) return null;
  } catch {
    return null;
  }

  const title =
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ||
    document.querySelector<HTMLElement>('[data-e2e="video-desc"]')?.innerText ||
    document.title;
  const coverUrl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
  const author =
    document.querySelector<HTMLMetaElement>('meta[name="author"]')?.content ||
    document.querySelector<HTMLElement>('[data-e2e="video-author-name"]')?.innerText ||
    '未知作者';

  const media: DouyinMedia = {
    platform: 'douyin',
    awemeId: preferredAwemeId,
    author: { nickname: author.trim() },
    title: title.trim() || '抖音作品',
    coverUrl,
    kind: 'video',
    videoUrl,
    images: [],
    pageUrl: location.href,
    source: 'dom',
  };
  saveCapture(media);
  return media;
}

async function requestAwemeDetail(awemeId: string): Promise<DouyinMedia | null> {
  const params = new URLSearchParams({
    device_platform: 'webapp',
    aid: '6383',
    channel: 'channel_pc_web',
    aweme_id: awemeId,
    pc_client_type: '1',
    version_code: '190500',
    version_name: '19.5.0',
    cookie_enabled: 'true',
    browser_language: navigator.language || 'zh-CN',
    browser_platform: navigator.platform || 'MacIntel',
    browser_name: 'Chrome',
    browser_online: String(navigator.onLine),
    engine_name: 'Blink',
  });
  try {
    const response = await originalFetch(`/aweme/v1/web/aweme/detail/?${params}`, {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    return consumePayload(await response.json(), 'request', awemeId);
  } catch {
    return null;
  }
}

const originalFetch = window.fetch.bind(window);

function installNetworkHooks(): void {
  window.fetch = function patchedFetch(...args: Parameters<typeof fetch>): Promise<Response> {
    const responsePromise = Reflect.apply(originalFetch, window, args) as Promise<Response>;
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (/douyin\.com/i.test(url) && !/\.(?:js|css|png|jpe?g|svg|woff2?)(?:\?|$)/i.test(url)) {
        responsePromise.then((response) => {
          if (!(response.headers.get('content-type') || '').toLowerCase().includes('json')) return;
          response.clone().json().then((payload) => consumePayload(payload, 'network'), () => undefined);
        }, () => undefined);
      }
    } catch {
      // Observer failures must not leak into the page request.
    }
    return responsePromise;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const urls = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['open']>
  ): void {
    const url = args[1];
    urls.set(this, typeof url === 'string' ? url : url.href);
    Reflect.apply(originalOpen, this, args);
  } as XMLHttpRequest['open'];

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const url = urls.get(this);
    if (url && /douyin\.com/i.test(url)) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === 'json') consumePayload(this.response, 'network');
          else if (!this.responseType || this.responseType === 'text') consumePayload(JSON.parse(this.responseText), 'network');
        } catch {
          // Ignore non-JSON responses.
        }
      });
    }
    Reflect.apply(originalSend, this, args);
  } as XMLHttpRequest['send'];
}

function installBridge(): void {
  installNetworkHooks();

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.data?.scope !== BRIDGE_SCOPE || event.data?.type !== 'scan') return;
    const awemeId = typeof event.data.awemeId === 'string' ? event.data.awemeId : currentAwemeId();
    const found = scanPageData(awemeId) ?? scanDom(awemeId);
    if ((event.data.forceRequest || (!found && event.data.allowRequest)) && awemeId) void requestAwemeDetail(awemeId);
  });

  const runInitialScan = () => scanPageData() ?? scanDom();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialScan, { once: true });
  } else {
    runInitialScan();
  }
}
