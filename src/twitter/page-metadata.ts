import type { TwitterMedia, TwitterSource } from './types';

function metaContent(selector: string): string | undefined {
  return document.querySelector<HTMLMetaElement>(selector)?.content?.trim() || undefined;
}

export function currentTwitterCoverUrl(): string | undefined {
  return metaContent('meta[property="og:image"]') ?? metaContent('meta[name="twitter:image"]');
}

export function buildTwitterMediaFromPage(
  tweetId: string,
  source: TwitterSource,
  videoUrl: string,
  qualityScore: number,
): TwitterMedia {
  const coverUrl = currentTwitterCoverUrl();
  const handle = metaContent('meta[name="twitter:creator"]')?.replace(/^@/, '');
  const socialTitle = metaContent('meta[property="og:title"]') ?? document.title;
  const nickname = socialTitle.match(/^(.+?)\s+on X:/)?.[1]?.trim() || handle || '未知作者';
  const title = metaContent('meta[property="og:description"]') ?? socialTitle.replace(/\s*\/ X\s*$/, '');
  return {
    platform: 'twitter',
    tweetId,
    author: { nickname, uniqueId: handle },
    title,
    coverUrl,
    kind: 'video',
    videoUrl,
    videos: [{ index: 1, url: videoUrl, bitrate: qualityScore, coverUrl }],
    images: [],
    pageUrl: location.href,
    source,
  };
}
