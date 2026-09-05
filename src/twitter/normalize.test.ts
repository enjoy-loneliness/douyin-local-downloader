import { describe, expect, it } from 'vitest';

import { normalizeTwitterPayload } from './normalize';

const pageUrl = 'https://x.com/tester/status/2039483174791627069';

describe('X/Twitter payload normalization', () => {
  it('selects the highest bitrate MP4 variant', () => {
    const media = normalizeTwitterPayload(
      {
        data: {
          tweetResult: {
            result: {
              rest_id: '2039483174791627069',
              core: {
                user_results: {
                  result: {
                    core: { name: 'Test Author', screen_name: 'tester' },
                    avatar: { image_url: 'https://pbs.twimg.com/profile_images/avatar.jpg' },
                  },
                },
              },
              legacy: {
                full_text: 'A test video post',
                extended_entities: {
                  media: [
                    {
                      type: 'video',
                      media_url_https: 'https://pbs.twimg.com/ext_tw_video_thumb/cover.jpg',
                      video_info: {
                        variants: [
                          { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/video.m3u8' },
                          { content_type: 'video/mp4', bitrate: 256000, url: 'https://video.twimg.com/low.mp4' },
                          { content_type: 'video/mp4', bitrate: 2176000, url: 'https://video.twimg.com/high.mp4' },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      { pageUrl, source: 'network', preferredTweetId: '2039483174791627069' },
    );

    expect(media).toMatchObject({
      platform: 'twitter',
      tweetId: '2039483174791627069',
      title: 'A test video post',
      videoUrl: 'https://video.twimg.com/high.mp4',
      author: { nickname: 'Test Author', uniqueId: 'tester' },
    });
  });

  it('normalizes every video in a multi-video post', () => {
    const media = normalizeTwitterPayload(
      {
        id_str: '2039483174791627069',
        text: 'Two videos',
        user: { name: 'Tester', screen_name: 'tester' },
        mediaDetails: [
          { type: 'video', video_info: { variants: [{ content_type: 'video/mp4', bitrate: 1, url: 'https://video.twimg.com/one.mp4' }] } },
          { type: 'animated_gif', video_info: { variants: [{ content_type: 'video/mp4', bitrate: 0, url: 'https://video.twimg.com/two.mp4' }] } },
        ],
      },
      { pageUrl, source: 'page-data' },
    );
    expect(media?.videos.map((video) => video.url)).toEqual([
      'https://video.twimg.com/one.mp4',
      'https://video.twimg.com/two.mp4',
    ]);
  });

  it('selects the requested post from a GraphQL response containing multiple posts', () => {
    const post = (id: string, suffix: string) => ({
      rest_id: id,
      legacy: {
        extended_entities: {
          media: [{ type: 'video', video_info: { variants: [{ content_type: 'video/mp4', bitrate: 1, url: `https://video.twimg.com/${suffix}.mp4` }] } }],
        },
      },
    });
    const result = normalizeTwitterPayload(
      { entries: [post('1111111111111111111', 'old'), post('2039483174791627069', 'current')] },
      { pageUrl, source: 'network', preferredTweetId: '2039483174791627069' },
    );
    expect(result?.videoUrl).toBe('https://video.twimg.com/current.mp4');
  });
});
