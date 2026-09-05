import type { DownloadableMedia } from '../shared/messages';
import { mediaContentId } from '../shared/media';
import { validateRemoteMedia } from './media-validation';

// Chrome filenames must exclude both path separators and ASCII control characters.
// eslint-disable-next-line no-control-regex
const INVALID_FILENAME = /[\\/:*?"<>|\u0000-\u001F]/g;

function safePart(value: string, fallback: string): string {
  const clean = value.replace(INVALID_FILENAME, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  return (clean || fallback).slice(0, 80);
}

export function mediaBaseName(media: DownloadableMedia): string {
  const author = media.platform === 'twitter' ? media.author.uniqueId || media.author.nickname : media.author.nickname;
  const fallbackTitle = media.platform === 'twitter' ? 'X视频' : '抖音作品';
  return [safePart(author, '未知作者'), safePart(media.title, fallbackTitle), mediaContentId(media)].join('_');
}

function imageExtension(url: string, contentType?: string): string {
  const typeExtension = contentType?.match(/^image\/(jpeg|jpg|png|webp|gif)/i)?.[1]?.toLowerCase();
  if (typeExtension) return typeExtension === 'jpeg' ? 'jpg' : typeExtension;
  try {
    const extension = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[1]?.toLowerCase();
    return extension ? (extension === 'jpeg' ? 'jpg' : extension) : 'jpg';
  } catch {
    return 'jpg';
  }
}

function assertHttps(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('拒绝下载非 HTTPS 资源。');
}

export async function downloadVideo(media: DownloadableMedia): Promise<number[]> {
  if (media.kind !== 'video' || !media.videoUrl) throw new Error('当前作品没有可下载的视频地址。');
  const videos = media.platform === 'twitter' ? media.videos : [{ index: 1, url: media.videoUrl }];
  const ids: number[] = [];
  for (const video of videos) {
    assertHttps(video.url);
    await validateRemoteMedia(video.url, 'video');
    const suffix = videos.length > 1 ? `_${video.index}` : '';
    ids.push(
      await chrome.downloads.download({
        url: video.url,
        filename: `${mediaBaseName(media)}${suffix}.mp4`,
        conflictAction: 'uniquify',
        saveAs: false,
      }),
    );
  }
  return ids;
}

export async function downloadImages(media: DownloadableMedia, indexes?: number[]): Promise<number[]> {
  if (media.platform !== 'douyin' || media.kind !== 'image' || media.images.length === 0) {
    throw new Error('当前作品没有可下载的图片。');
  }
  const selected = indexes?.length ? media.images.filter((image) => indexes.includes(image.index)) : media.images;
  const width = String(media.images.length).length;
  const ids: number[] = [];
  for (const image of selected) {
    assertHttps(image.url);
    const contentType = await validateRemoteMedia(image.url, 'image');
    const suffix = String(image.index).padStart(width, '0');
    ids.push(
      await chrome.downloads.download({
        url: image.url,
        filename: `${mediaBaseName(media)}_${suffix}.${imageExtension(image.url, contentType)}`,
        conflictAction: 'uniquify',
        saveAs: false,
      }),
    );
  }
  return ids;
}

function waitForDownload(downloadId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('等待下载完成超时。')), timeoutMs);
    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId || !delta.state?.current) return;
      if (delta.state.current === 'complete') finish();
      if (delta.state.current === 'interrupted') finish(downloadInterruptionError(delta.error?.current));
    };
    const finish = (error?: Error) => {
      clearTimeout(timer);
      chrome.downloads.onChanged.removeListener(listener);
      if (error) reject(error);
      else resolve();
    };
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({ id: downloadId }).then(([item]) => {
      if (item?.state === 'complete') finish();
      else if (item?.state === 'interrupted') finish(downloadInterruptionError(item.error));
    });
  });
}

function downloadInterruptionError(reason?: string): Error {
  if (reason === 'SERVER_BAD_CONTENT') {
    return new Error('平台返回了无效下载内容。请刷新作品页面并重新播放后再试。');
  }
  if (reason === 'SERVER_FORBIDDEN' || reason === 'SERVER_UNAUTHORIZED') {
    return new Error('平台拒绝了下载请求，媒体地址可能已过期。请刷新页面后重试。');
  }
  return new Error(reason ? `下载被中断：${reason}` : '下载被中断。');
}

export async function waitForDownloads(downloadIds: number[], timeoutMs = 10 * 60_000): Promise<void> {
  await Promise.all(downloadIds.map((downloadId) => waitForDownload(downloadId, timeoutMs)));
}
