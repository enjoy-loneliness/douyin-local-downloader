import type { DownloadableMedia, ParseResponse } from './media';

export type ExtensionRequest =
  | { type: 'GET_ACTIVE_MEDIA' }
  | { type: 'PARSE_SHARE_TEXT'; text: string }
  | { type: 'GET_PAGE_MEDIA'; fresh?: boolean }
  | { type: 'FETCH_TWITTER_PAGE_HTML'; tweetId: string }
  | { type: 'DOWNLOAD_VIDEO'; media: DownloadableMedia }
  | { type: 'DOWNLOAD_IMAGES'; media: DownloadableMedia; indexes?: number[] }
  | { type: 'DOWNLOAD_PAGE_MEDIA'; media: DownloadableMedia }
  | { type: 'CONTENT_MEDIA_UPDATE'; media: DownloadableMedia };

export type ExtensionResponse =
  | ParseResponse
  | { ok: true; downloadIds?: number[] }
  | { ok: true; html: string }
  | { ok: false; error: string };

export type { DownloadableMedia, ParseResponse } from './media';
