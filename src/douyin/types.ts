import type { BaseMedia, MediaAuthor, MediaImage, MediaKind } from '../shared/media';

export type DouyinMediaKind = MediaKind;

export type DouyinSource = 'page-data' | 'dom-script' | 'network' | 'request' | 'dom';

export type DouyinAuthor = MediaAuthor;

export type DouyinImage = MediaImage;

export interface DouyinMedia extends BaseMedia<'douyin', DouyinSource> {
  platform: 'douyin';
  awemeId: string;
}
