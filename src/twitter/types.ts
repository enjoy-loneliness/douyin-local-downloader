import type { BaseMedia } from '../shared/media';

export type TwitterSource = 'page-data' | 'dom-script' | 'network' | 'dom';

export interface TwitterVideo {
  index: number;
  url: string;
  bitrate: number;
  coverUrl?: string;
  width?: number;
  height?: number;
}

export interface TwitterMedia extends BaseMedia<'twitter', TwitterSource> {
  platform: 'twitter';
  tweetId: string;
  kind: 'video';
  videos: TwitterVideo[];
}
