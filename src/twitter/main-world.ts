import {
  buildTwitterMediaFromPage,
  currentTwitterCoverUrl,
  findCurrentTweetContext,
  normalizeTwitterPayload,
  selectSerializedTwitterMp4,
} from '.';
import type { TwitterMedia, TwitterSource } from '.';

const BRIDGE_SCOPE = '__LOCAL_MEDIA_DOWNLOADER_TWITTER_V1__';
const CAPTURE_ATTRIBUTE = 'data-local-media-downloader-twitter-captures';
const INSTALL_MARKER = '__localTwitterDownloaderInstalled';

type PageWindow = Window &
  typeof globalThis & {
    __INITIAL_STATE__?: unknown;
    __NEXT_DATA__?: unknown;
    __APOLLO_STATE__?: unknown;
    [INSTALL_MARKER]?: boolean;
  };

const pageWindow = window as PageWindow;

if (!pageWindow[INSTALL_MARKER]) {
  pageWindow[INSTALL_MARKER] = true;
  installBridge();
}

function currentTweetId(): string | null {
  return findCurrentTweetContext().tweetId;
}

function saveCapture(media: TwitterMedia): void {
  try {
    const root = document.documentElement;
    if (!root) return;
    const previous = JSON.parse(root.getAttribute(CAPTURE_ATTRIBUTE) || '[]') as TwitterMedia[];
    const next = previous.filter((item) => item?.tweetId !== media.tweetId);
    next.push(media);
    root.setAttribute(CAPTURE_ATTRIBUTE, JSON.stringify(next.slice(-30)));
    window.postMessage({ scope: BRIDGE_SCOPE, type: 'capture', media }, '*');
  } catch {
    // Observation must never affect the X page.
  }
}

function consumePayload(
  payload: unknown,
  source: TwitterSource,
  preferredTweetId = currentTweetId(),
): TwitterMedia | null {
  try {
    const media = normalizeTwitterPayload(payload, {
      pageUrl: location.href,
      source,
      preferredTweetId,
    });
    if (media) saveCapture(media);
    return media;
  } catch {
    return null;
  }
}

function parseJsonScript(script: HTMLScriptElement): unknown {
  const value = script.textContent?.trim();
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function metaContent(selector: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || undefined;
}

function scanSerializedSources(
  sources: Iterable<string>,
  preferredTweetId = currentTweetId(),
): TwitterMedia | null {
  if (!preferredTweetId) return null;
  const coverUrl = currentTwitterCoverUrl();
  const selected = selectSerializedTwitterMp4(sources, coverUrl);
  if (!selected) return null;
  const media = buildTwitterMediaFromPage(preferredTweetId, 'dom-script', selected.url, selected.qualityScore);
  saveCapture(media);
  return media;
}

function scanSerializedPage(preferredTweetId = currentTweetId()): TwitterMedia | null {
  const sources = [...document.querySelectorAll<HTMLScriptElement>('script:not([src])')].map(
    (script) => script.textContent ?? '',
  );
  return scanSerializedSources(sources, preferredTweetId);
}

function scanPageData(preferredTweetId = currentTweetId()): TwitterMedia | null {
  for (const payload of [pageWindow.__INITIAL_STATE__, pageWindow.__NEXT_DATA__, pageWindow.__APOLLO_STATE__]) {
    const media = consumePayload(payload, 'page-data', preferredTweetId);
    if (media) return media;
  }

  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/json"], script:not([src])')) {
    const value = script.textContent ?? '';
    if (!value.includes('video_info') || !value.includes('variants')) continue;
    const payload = parseJsonScript(script);
    if (!payload) continue;
    const media = consumePayload(payload, 'dom-script', preferredTweetId);
    if (media) return media;
  }
  return scanSerializedPage(preferredTweetId);
}

function scanDom(preferredTweetId = currentTweetId()): TwitterMedia | null {
  const context = findCurrentTweetContext();
  const tweetId = preferredTweetId ?? context.tweetId;
  const video = context.video;
  const article = context.article;
  if (!tweetId || !video) return null;

  const directUrl = video.currentSrc || video.src || video.querySelector('source')?.src;
  if (!directUrl?.startsWith('https://video.twimg.com/') || !directUrl.includes('.mp4')) return null;

  const authorBox = article?.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const handle = [...(authorBox?.querySelectorAll('span') ?? [])]
    .map((span) => span.textContent?.trim())
    .find((value) => value?.startsWith('@'));
  const title =
    article?.querySelector<HTMLElement>('[data-testid="tweetText"]')?.innerText.trim() ||
    metaContent('meta[property="og:description"]') ||
    'X 视频';
  const coverUrl = video.poster?.startsWith('https://pbs.twimg.com/') ? video.poster : undefined;
  const media: TwitterMedia = {
    platform: 'twitter',
    tweetId,
    author: {
      nickname:
        authorBox?.innerText.split('\n')[0]?.trim() ||
        metaContent('meta[property="og:title"]')?.match(/^(.+?)\s+on X:/)?.[1] ||
        handle ||
        '未知作者',
      uniqueId: handle?.replace(/^@/, '') || metaContent('meta[name="twitter:creator"]')?.replace(/^@/, ''),
    },
    title,
    coverUrl,
    kind: 'video',
    videoUrl: directUrl,
    videos: [{ index: 1, url: directUrl, bitrate: 0, coverUrl }],
    images: [],
    pageUrl: location.href,
    source: 'dom',
  };
  saveCapture(media);
  return media;
}

const originalFetch = window.fetch.bind(window);

function isApiRequest(value: RequestInfo | URL): boolean {
  try {
    const raw = typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;
    const url = new URL(raw, location.href);
    return (
      (url.hostname === 'x.com' || url.hostname.endsWith('.x.com') || url.hostname.endsWith('.twitter.com')) &&
      /\/(?:i\/api|1\.1|2|graphql)\//.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function installNetworkHooks(): void {
  window.fetch = function patchedFetch(...args: Parameters<typeof fetch>): Promise<Response> {
    const responsePromise = Reflect.apply(originalFetch, window, args) as Promise<Response>;
    try {
      if (isApiRequest(args[0])) {
        responsePromise.then((response) => {
          if (!(response.headers.get('content-type') || '').toLowerCase().includes('json')) return;
          response.clone().json().then((payload) => consumePayload(payload, 'network'), () => undefined);
        }, () => undefined);
      }
    } catch {
      // Passive observer failures must not affect the page request.
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
    const requestUrl = args[1];
    urls.set(this, typeof requestUrl === 'string' ? requestUrl : requestUrl.href);
    Reflect.apply(originalOpen, this, args);
  } as XMLHttpRequest['open'];

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const requestUrl = urls.get(this);
    if (requestUrl && isApiRequest(requestUrl)) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === 'json') consumePayload(this.response, 'network');
          else if (!this.responseType || this.responseType === 'text') consumePayload(JSON.parse(this.responseText), 'network');
        } catch {
          // Ignore non-JSON or malformed responses.
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
    const tweetId = typeof event.data.tweetId === 'string' ? event.data.tweetId : currentTweetId();
    if (!scanPageData(tweetId)) scanDom(tweetId);
  });

  const initialScan = () => {
    const tweetId = currentTweetId();
    if (!scanPageData(tweetId)) scanDom(tweetId);
  };
  const scanHydrationStages = () => {
    initialScan();
    window.setTimeout(initialScan, 1500);
    window.setTimeout(initialScan, 4000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanHydrationStages, { once: true });
  else scanHydrationStages();
}
