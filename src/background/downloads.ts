import type { DouyinMedia } from '../douyin';

// Chrome filenames must exclude both path separators and ASCII control characters.
// eslint-disable-next-line no-control-regex
const INVALID_FILENAME = /[\\/:*?"<>|\u0000-\u001F]/g;

function safePart(value: string, fallback: string): string {
  const clean = value.replace(INVALID_FILENAME, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  return (clean || fallback).slice(0, 80);
}

export function mediaBaseName(media: DouyinMedia): string {
  return [safePart(media.author.nickname, '未知作者'), safePart(media.title, '抖音作品'), media.awemeId].join('_');
}

function imageExtension(url: string): string {
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

export async function downloadVideo(media: DouyinMedia): Promise<number[]> {
  if (media.kind !== 'video' || !media.videoUrl) throw new Error('当前作品没有可下载的视频地址。');
  assertHttps(media.videoUrl);
  const id = await chrome.downloads.download({
    url: media.videoUrl,
    filename: `${mediaBaseName(media)}.mp4`,
    conflictAction: 'uniquify',
    saveAs: false,
  });
  return [id];
}

export async function downloadImages(media: DouyinMedia, indexes?: number[]): Promise<number[]> {
  if (media.kind !== 'image' || media.images.length === 0) throw new Error('当前作品没有可下载的图片。');
  const selected = indexes?.length ? media.images.filter((image) => indexes.includes(image.index)) : media.images;
  const width = String(media.images.length).length;
  const ids: number[] = [];
  for (const image of selected) {
    assertHttps(image.url);
    const suffix = String(image.index).padStart(width, '0');
    ids.push(
      await chrome.downloads.download({
        url: image.url,
        filename: `${mediaBaseName(media)}_${suffix}.${imageExtension(image.url)}`,
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
      if (delta.state.current === 'interrupted') finish(new Error(delta.error?.current || '下载被中断。'));
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
      else if (item?.state === 'interrupted') finish(new Error(item.error || '下载被中断。'));
    });
  });
}

export async function waitForDownloads(downloadIds: number[], timeoutMs = 10 * 60_000): Promise<void> {
  await Promise.all(downloadIds.map((downloadId) => waitForDownload(downloadId, timeoutMs)));
}
