export type DouyinMediaKind = 'video' | 'image';

export type DouyinSource = 'page-data' | 'dom-script' | 'network' | 'request' | 'dom';

export interface DouyinAuthor {
  nickname: string;
  uniqueId?: string;
  avatarUrl?: string;
}

export interface DouyinImage {
  index: number;
  url: string;
  width?: number;
  height?: number;
}

export interface DouyinMedia {
  awemeId: string;
  author: DouyinAuthor;
  title: string;
  coverUrl?: string;
  kind: DouyinMediaKind;
  videoUrl?: string;
  images: DouyinImage[];
  pageUrl: string;
  source: DouyinSource;
}

export interface ParseResponse {
  ok: boolean;
  media?: DouyinMedia;
  error?: string;
}
