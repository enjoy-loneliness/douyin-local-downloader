import { extractAwemeId, extractDouyinUrl, isDouyinPageUrl, isDouyinShortUrl } from '../douyin';
import { extractTweetId, extractTwitterUrl, isTwitterPageUrl, isTwitterShortUrl } from '../twitter';
import type { MediaPlatform } from './media';

export interface SupportedLink {
  platform: MediaPlatform;
  url: string;
}

export function extractSupportedLink(text: string): SupportedLink | null {
  const douyin = extractDouyinUrl(text);
  if (douyin) return { platform: 'douyin', url: douyin };
  const twitter = extractTwitterUrl(text);
  return twitter ? { platform: 'twitter', url: twitter } : null;
}

export function isSupportedPageUrl(url?: string): boolean {
  return isDouyinPageUrl(url) || isTwitterPageUrl(url);
}

export function contentIdFromUrl(url: string): string | null {
  return extractAwemeId(url) ?? extractTweetId(url);
}

export function isShortPlatformUrl(url: string): boolean {
  return isDouyinShortUrl(url) || isTwitterShortUrl(url);
}

export function platformForUrl(url?: string): MediaPlatform | null {
  if (isDouyinPageUrl(url)) return 'douyin';
  if (isTwitterPageUrl(url)) return 'twitter';
  return null;
}
