import { extractAwemeId, extractDouyinUrl, isDouyinPageUrl, isDouyinShortUrl } from '../douyin';
import type { DouyinMedia, ParseResponse } from '../douyin';
import type { ExtensionRequest, ExtensionResponse } from '../shared/messages';
import { downloadImages, downloadVideo, waitForDownloads } from './downloads';

const mediaByTab = new Map<number, DouyinMedia>();

function sendToTab(tabId: number): Promise<ParseResponse> {
  return chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_MEDIA' } satisfies ExtensionRequest);
}

async function getActiveMedia(): Promise<ParseResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isDouyinPageUrl(tab.url)) return { ok: false, error: '请打开 douyin.com/video/* 作品详情页。' };
  try {
    const response = await sendToTab(tab.id);
    if (response.ok && response.media) mediaByTab.set(tab.id, response.media);
    return response;
  } catch {
    const cached = mediaByTab.get(tab.id);
    return cached ? { ok: true, media: cached } : { ok: false, error: '无法连接页面，请刷新抖音页面后重试。' };
  }
}

async function resolveShortUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', credentials: 'include' });
    if (isDouyinPageUrl(response.url)) return response.url;
  } catch {
    // The temporary-tab path below also follows browser redirects.
  }
  return url;
}

function waitUntilComplete(tabId: number, timeoutMs = 20_000): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('打开分享链接超时。'));
    }, timeoutMs);
    const listener: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (updatedId, info, tab) => {
      if (updatedId !== tabId || info.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(tab);
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    });
  });
}

async function parseInTemporaryTab(url: string): Promise<ParseResponse> {
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab.id) return { ok: false, error: '无法创建解析标签页。' };
  try {
    const loaded = await waitUntilComplete(tab.id);
    if (!isDouyinPageUrl(loaded.url)) return { ok: false, error: '分享链接没有跳转到有效的抖音作品页。' };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await sendToTab(tab.id);
        if (result.ok) return result;
      } catch {
        // Content script may still be starting after the redirect.
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    return { ok: false, error: '已打开作品页，但没有识别到可下载资源。' };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

async function parseShareText(text: string): Promise<ParseResponse> {
  const extracted = extractDouyinUrl(text);
  if (!extracted) return { ok: false, error: '分享文本中没有找到有效的抖音链接。' };

  const resolved = isDouyinShortUrl(extracted) ? await resolveShortUrl(extracted) : extracted;
  const targetId = extractAwemeId(resolved);
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id && isDouyinPageUrl(active.url) && targetId && extractAwemeId(active.url ?? '') === targetId) {
    return sendToTab(active.id);
  }
  return parseInTemporaryTab(resolved);
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionRequest, sender, sendResponse: (response: ExtensionResponse) => void): boolean => {
    const run = async (): Promise<ExtensionResponse> => {
      switch (message.type) {
        case 'GET_ACTIVE_MEDIA':
          return getActiveMedia();
        case 'PARSE_SHARE_TEXT':
          return parseShareText(message.text);
        case 'DOWNLOAD_VIDEO':
          return { ok: true, downloadIds: await downloadVideo(message.media) };
        case 'DOWNLOAD_IMAGES':
          return { ok: true, downloadIds: await downloadImages(message.media, message.indexes) };
        case 'DOWNLOAD_PAGE_MEDIA': {
          const downloadIds =
            message.media.kind === 'video' ? await downloadVideo(message.media) : await downloadImages(message.media);
          await waitForDownloads(downloadIds);
          return { ok: true, downloadIds };
        }
        case 'CONTENT_MEDIA_UPDATE':
          if (sender.tab?.id) mediaByTab.set(sender.tab.id, message.media);
          return { ok: true };
        default:
          return { ok: false, error: '未知请求。' };
      }
    };

    run().then(sendResponse, (error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : '操作失败。' });
    });
    return true;
  },
);

chrome.tabs.onRemoved.addListener((tabId) => mediaByTab.delete(tabId));
