import type { DouyinMedia, ParseResponse } from '../douyin';

export type ExtensionRequest =
  | { type: 'GET_ACTIVE_MEDIA' }
  | { type: 'PARSE_SHARE_TEXT'; text: string }
  | { type: 'GET_PAGE_MEDIA'; fresh?: boolean }
  | { type: 'DOWNLOAD_VIDEO'; media: DouyinMedia }
  | { type: 'DOWNLOAD_IMAGES'; media: DouyinMedia; indexes?: number[] }
  | { type: 'DOWNLOAD_PAGE_MEDIA'; media: DouyinMedia }
  | { type: 'CONTENT_MEDIA_UPDATE'; media: DouyinMedia };

export type ExtensionResponse = ParseResponse | { ok: true; downloadIds?: number[] } | { ok: false; error: string };
