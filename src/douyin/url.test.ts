import { describe, expect, it } from 'vitest';

import { extractAwemeId, extractDouyinUrl, isDouyinShortUrl } from './url';

describe('Douyin URL parsing', () => {
  it('extracts a short URL from complete share text', () => {
    const text = '3.21 复制打开抖音 https://v.douyin.com/AbC_123/ 一起看！';
    expect(extractDouyinUrl(text)).toBe('https://v.douyin.com/AbC_123/');
  });

  it('extracts and normalizes a detail URL', () => {
    expect(extractDouyinUrl('douyin.com/video/7451234567890123456，')).toBe(
      'https://douyin.com/video/7451234567890123456',
    );
  });

  it('extracts video and note identifiers', () => {
    expect(extractAwemeId('https://www.douyin.com/video/7451234567890123456')).toBe('7451234567890123456');
    expect(extractAwemeId('https://www.douyin.com/note/7451234567890123457')).toBe('7451234567890123457');
  });

  it('rejects unrelated links', () => {
    expect(extractDouyinUrl('https://example.com/video/123')).toBeNull();
    expect(isDouyinShortUrl('https://www.douyin.com/video/123456')).toBe(false);
  });
});
