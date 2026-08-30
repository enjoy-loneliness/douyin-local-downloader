import { extractAwemeId } from '../douyin';
import type { DouyinMedia, ParseResponse } from '../douyin';
import type { ExtensionRequest } from '../shared/messages';
import { installPageDownloadButton } from './page-download-button';

const BRIDGE_SCOPE = '__DOUYIN_LOCAL_DOWNLOADER_V1__';
const CAPTURE_ATTRIBUTE = 'data-douyin-local-downloader-captures';
const captures = new Map<string, DouyinMedia>();

function readCaptures(): void {
  try {
    const raw = document.documentElement?.getAttribute(CAPTURE_ATTRIBUTE);
    if (!raw) return;
    for (const media of JSON.parse(raw) as DouyinMedia[]) {
      if (media?.awemeId) captures.set(media.awemeId, media);
    }
  } catch {
    // A host-page mutation should not break the extension.
  }
}

function currentAwemeId(): string | null {
  const fromUrl = extractAwemeId(location.href);
  if (fromUrl) return fromUrl;

  const activeVideo = [...document.querySelectorAll('video')]
    .map((video) => ({ video, rect: video.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight)
    .sort((a, b) => {
      const playingA = !a.video.paused && !a.video.ended ? 1 : 0;
      const playingB = !b.video.paused && !b.video.ended ? 1 : 0;
      return playingB - playingA || b.rect.width * b.rect.height - a.rect.width * a.rect.height;
    })[0]?.video;

  let ancestor: HTMLElement | null = activeVideo;
  for (let depth = 0; ancestor && depth < 20; depth += 1, ancestor = ancestor.parentElement) {
    const dataId = ancestor.getAttribute('data-e2e-vid') || ancestor.getAttribute('data-aweme-id');
    if (dataId && /^\d{6,}$/.test(dataId)) return dataId;
    for (const link of ancestor.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"], a[href*="/note/"]')) {
      const id = extractAwemeId(link.href || link.getAttribute('href') || '');
      if (id) return id;
    }
  }
  return null;
}

function postScan(allowRequest: boolean): void {
  window.postMessage(
    {
      scope: BRIDGE_SCOPE,
      type: 'scan',
      awemeId: currentAwemeId(),
      allowRequest,
    },
    '*',
  );
}

async function resolveCurrentMedia(): Promise<ParseResponse> {
  const awemeId = currentAwemeId();
  if (!awemeId) return { ok: false, error: '当前页面不是抖音视频或图文详情页。' };

  const find = (): DouyinMedia | undefined => {
    readCaptures();
    return captures.get(awemeId);
  };

  const existing = find();
  if (existing) return { ok: true, media: existing };

  postScan(false);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const media = find();
    if (media) return { ok: true, media };
  }

  postScan(true);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const media = find();
    if (media) return { ok: true, media };
  }

  return { ok: false, error: '页面已识别，但暂时没有拿到可下载资源。请播放作品后重试。' };
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.data?.scope !== BRIDGE_SCOPE || event.data?.type !== 'capture') return;
  const media = event.data.media as DouyinMedia | undefined;
  if (!media?.awemeId) return;
  captures.set(media.awemeId, media);
  chrome.runtime.sendMessage({ type: 'CONTENT_MEDIA_UPDATE', media }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  if (message.type !== 'GET_PAGE_MEDIA') return false;
  resolveCurrentMedia().then(sendResponse);
  return true;
});

readCaptures();
postScan(false);

installPageDownloadButton({
  getCurrentAwemeId: currentAwemeId,
  resolveCurrentMedia,
});
