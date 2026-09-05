import type { DouyinMedia } from '../douyin/types';
import type { TwitterMedia } from '../twitter/types';

export type MediaPlatform = 'douyin' | 'twitter';
export type MediaKind = 'video' | 'image';

export interface MediaAuthor {
  nickname: string;
  uniqueId?: string;
  avatarUrl?: string;
}

export interface MediaImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

export interface BaseMedia<Platform extends MediaPlatform, Source extends string> {
  platform: Platform;
  author: MediaAuthor;
  title: string;
  coverUrl?: string;
  kind: MediaKind;
  videoUrl?: string;
  images: MediaImage[];
  pageUrl: string;
  source: Source;
}

export type DownloadableMedia = DouyinMedia | TwitterMedia;

export interface ParseResponse {
  ok: boolean;
  media?: DownloadableMedia;
  error?: string;
}

export function mediaContentId(media: DownloadableMedia): string {
  return media.platform === 'douyin' ? media.awemeId : media.tweetId;
}
