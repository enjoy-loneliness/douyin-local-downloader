import { describe, expect, it } from 'vitest';

import { extractTweetId, extractTwitterUrl, isTwitterPageUrl, isTwitterShortUrl } from './url';

describe('X/Twitter URL parsing', () => {
  it('extracts x.com and twitter.com status links from share text', () => {
    expect(extractTwitterUrl('看看这个 https://x.com/example/status/2039483174791627069?s=20 ！')).toBe(
      'https://x.com/example/status/2039483174791627069?s=20',
    );
    expect(extractTwitterUrl('twitter.com/example/status/1234567890123456789')).toBe(
      'https://twitter.com/example/status/1234567890123456789',
    );
  });

  it('extracts status identifiers and t.co links', () => {
    expect(extractTweetId('https://x.com/i/status/2039483174791627069/video/1')).toBe('2039483174791627069');
    expect(extractTwitterUrl('share https://t.co/VbuIOl62sY')).toBe('https://t.co/VbuIOl62sY');
    expect(isTwitterShortUrl('https://t.co/VbuIOl62sY')).toBe(true);
  });

  it('recognizes both X host families', () => {
    expect(isTwitterPageUrl('https://x.com/example/status/123456')).toBe(true);
    expect(isTwitterPageUrl('https://mobile.twitter.com/example/status/123456')).toBe(true);
    expect(isTwitterPageUrl('https://example.com/status/123456')).toBe(false);
  });
});
