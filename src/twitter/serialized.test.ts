import { describe, expect, it } from 'vitest';

import { mediaIdFromCoverUrl, selectSerializedTwitterMp4 } from './serialized';

describe('X SSR serialized media extraction', () => {
  const cover = 'https://pbs.twimg.com/amplify_video_thumb/2039483124158267392/img/cover.jpg';

  it('derives the focal media id from the post cover', () => {
    expect(mediaIdFromCoverUrl(cover)).toBe('2039483124158267392');
  });

  it('selects the largest focal MP4 and ignores reply media', () => {
    const source = `
      https://video.twimg.com/amplify_video/2039483124158267392/vid/avc1/320x568/low.mp4?tag=21
      https://video.twimg.com/amplify_video/2039483124158267392/vid/avc1/576x1024/high.mp4?tag=21
      https://video.twimg.com/amplify_video/9999999999999999999/vid/avc1/1920x1080/reply.mp4?tag=21
    `;
    expect(selectSerializedTwitterMp4([source], cover)).toEqual({
      mediaId: '2039483124158267392',
      url: 'https://video.twimg.com/amplify_video/2039483124158267392/vid/avc1/576x1024/high.mp4?tag=21',
      qualityScore: 589824,
    });
  });

  it('normalizes escaped URLs from React Flight payloads', () => {
    const source = String.raw`https:\/\/video.twimg.com\/amplify_video\/2039483124158267392\/vid\/avc1\/576x1024\/high.mp4?tag=21&amp;v=1`;
    expect(selectSerializedTwitterMp4([source], cover)?.url).toBe(
      'https://video.twimg.com/amplify_video/2039483124158267392/vid/avc1/576x1024/high.mp4?tag=21&v=1',
    );
  });
});
