import type { ParseResponse } from '../shared/messages';
import type { ExtensionRequest } from '../shared/messages';
import { buildTwitterMediaFromPage, currentTwitterCoverUrl, findCurrentTweetContext, selectSerializedTwitterMp4 } from '.';
import type { TwitterMedia } from '.';
import { installTwitterDownloadButton } from './page-download-button';

const BRIDGE_SCOPE = '__LOCAL_MEDIA_DOWNLOADER_TWITTER_V1__';
const CAPTURE_ATTRIBUTE = 'data-local-media-downloader-twitter-captures';
const captures = new Map<string, TwitterMedia>();

function readCaptures(): void {
  try {
    const raw = document.documentElement?.getAttribute(CAPTURE_ATTRIBUTE);
    if (!raw) return;
    for (const media of JSON.parse(raw) as TwitterMedia[]) {
      if (media?.tweetId) captures.set(media.tweetId, media);
    }
  } catch {
    // A host-page DOM mutation must not break the extension.
  }
}

function postScan(tweetId: string | null): void {
  window.postMessage({ scope: BRIDGE_SCOPE, type: 'scan', tweetId }, '*');
}

async function resolveTweetMedia(requestedTweetId?: string | null): Promise<ParseResponse> {
  const tweetId = requestedTweetId ?? findCurrentTweetContext().tweetId;
  if (!tweetId) return { ok: false, error: '当前页面没有识别到带视频的 X 帖子。' };

  readCaptures();
  const existing = captures.get(tweetId);
  if (existing) return { ok: true, media: existing };

  postScan(tweetId);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    readCaptures();
    const media = captures.get(tweetId);
    if (media) return { ok: true, media };
  }

  const pageResponse = await chrome.runtime.sendMessage({
    type: 'FETCH_TWITTER_PAGE_HTML',
    tweetId,
  } satisfies ExtensionRequest);
  if (pageResponse?.ok && typeof pageResponse.html === 'string') {
    const selected = selectSerializedTwitterMp4([pageResponse.html], currentTwitterCoverUrl());
    if (selected) {
      const media = buildTwitterMediaFromPage(tweetId, 'dom-script', selected.url, selected.qualityScore);
      captures.set(tweetId, media);
      chrome.runtime.sendMessage({ type: 'CONTENT_MEDIA_UPDATE', media }).catch(() => undefined);
      return { ok: true, media };
    }
  }
  return { ok: false, error: '没有取得该帖子的 MP4 地址。请播放视频后重试。' };
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.data?.scope !== BRIDGE_SCOPE || event.data?.type !== 'capture') return;
  const media = event.data.media as TwitterMedia | undefined;
  if (!media?.tweetId) return;
  captures.set(media.tweetId, media);
  chrome.runtime.sendMessage({ type: 'CONTENT_MEDIA_UPDATE', media }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: ExtensionRequest, _sender, sendResponse) => {
  if (message.type !== 'GET_PAGE_MEDIA') return false;
  resolveTweetMedia().then(sendResponse);
  return true;
});

readCaptures();
postScan(findCurrentTweetContext().tweetId);
installTwitterDownloadButton({ resolveTweetMedia });
