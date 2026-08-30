import { describe, expect, it } from 'vitest';

import { normalizeAwemePayload } from './normalize';

const options = { pageUrl: 'https://www.douyin.com/video/7451234567890123456', source: 'page-data' as const };

describe('Douyin payload normalization', () => {
  it('normalizes a video and prefers H.264', () => {
    const media = normalizeAwemePayload(
      {
        aweme_detail: {
          aweme_id: '7451234567890123456',
          desc: '测试标题',
          author: { nickname: '测试作者', unique_id: 'tester' },
          video: {
            play_addr: { url_list: ['https://v.example/play-hevc'] },
            play_addr_h264: { url_list: ['https://v.example/play-h264'] },
            cover: { url_list: ['https://p.example/cover.jpg'] },
          },
        },
      },
      options,
    );
    expect(media).toMatchObject({
      awemeId: '7451234567890123456',
      title: '测试标题',
      kind: 'video',
      videoUrl: 'https://v.example/play-h264',
      author: { nickname: '测试作者', uniqueId: 'tester' },
    });
  });

  it('normalizes all image-post originals', () => {
    const media = normalizeAwemePayload(
      {
        aweme_id: '7451234567890123457',
        desc: '图文标题',
        author: { nickname: '图文作者' },
        images: [
          { download_url: { url_list: ['https://p.example/1.jpg'] }, width: 1080, height: 1440 },
          { origin_url: { url_list: ['https://p.example/2.jpg'] } },
        ],
      },
      { ...options, preferredAwemeId: '7451234567890123457' },
    );
    expect(media?.kind).toBe('image');
    expect(media?.images.map((image) => image.url)).toEqual([
      'https://p.example/1.jpg',
      'https://p.example/2.jpg',
    ]);
  });

  it('selects the current aweme from a feed payload', () => {
    const payload = {
      items: [
        { aweme_id: '7451234567890123000', author: {}, video: { play_addr: { url_list: ['https://v.example/a'] } } },
        { aweme_id: '7451234567890123999', author: {}, video: { play_addr: { url_list: ['https://v.example/b'] } } },
      ],
    };
    expect(normalizeAwemePayload(payload, { ...options, preferredAwemeId: '7451234567890123999' })?.videoUrl).toBe(
      'https://v.example/b',
    );
  });
});
