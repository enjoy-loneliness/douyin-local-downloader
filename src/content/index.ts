import { findCurrentPageWork } from '../douyin';
import type { DouyinMedia, ParseResponse } from '../douyin';
import type { ExtensionRequest } from '../shared/messages';
import { installPageDownloadButton } from './page-download-button';

const BRIDGE_SCOPE = '__DOUYIN_LOCAL_DOWNLOADER_V1__';
const CAPTURE_ATTRIBUTE = 'data-douyin-local-downloader-captures';
const captures = new Map<string, DouyinMedia>();
const captureVersions = new Map<string, number>();

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
  return findCurrentPageWork().awemeId;
}

function postScan(allowRequest: boolean, forceRequest = false): void {
  window.postMessage(
    {
      scope: BRIDGE_SCOPE,
      type: 'scan',
      awemeId: currentAwemeId(),
      allowRequest,
      forceRequest,
    },
    '*',
  );
}

async function resolveCurrentMedia(forceFresh = false): Promise<ParseResponse> {
  const awemeId = currentAwemeId();
  if (!awemeId) return { ok: false, error: '当前页面不是抖音视频或图文详情页。' };

  const find = (): DouyinMedia | undefined => {
    readCaptures();
    return captures.get(awemeId);
  };

  if (!forceFresh) {
    const existing = find();
    if (existing) return { ok: true, media: existing };
  } else {
    const previousVersion = captureVersions.get(awemeId) ?? 0;
    postScan(true, true);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (currentAwemeId() !== awemeId) return { ok: false, error: '作品已切换，请重新点击下载。' };
      const media = captures.get(awemeId);
      const version = captureVersions.get(awemeId) ?? 0;
      if (media && version > previousVersion && (media.source === 'request' || media.source === 'network')) {
        return { ok: true, media };
      }
    }
    return { ok: false, error: '无法刷新当前作品的下载地址，请继续播放几秒后重试。' };
  }

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
  captureVersions.set(media.awemeId, (captureVersions.get(media.awemeId) ?? 0) + 1);
  chrome.runtime.sendMessage({ type: 'CONTENT_MEDIA_UPDATE', media }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  if (message.type !== 'GET_PAGE_MEDIA') return false;
  resolveCurrentMedia(message.fresh === true).then(sendResponse);
  return true;
});

readCaptures();
postScan(false);

installPageDownloadButton({
  getCurrentAwemeId: currentAwemeId,
  resolveCurrentMedia,
});
