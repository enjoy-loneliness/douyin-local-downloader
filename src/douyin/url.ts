const DOUYIN_URL_PATTERN = /(?:https?:\/\/)?(?:(?:www\.)?douyin\.com\/(?:video|note)\/\d+(?:[^\s]*)?|v\.douyin\.com\/[A-Za-z0-9_-]+\/?(?:[^\s]*)?)/i;

const TRAILING_PUNCTUATION = /[，。！？、；：）】》〉」』”’.,!?;:)}\]>]+$/;

export function extractDouyinUrl(input: string): string | null {
  const match = input.match(DOUYIN_URL_PATTERN)?.[0];
  if (!match) return null;

  const cleaned = match.replace(TRAILING_PUNCTUATION, '');
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

export function extractAwemeId(input: string): string | null {
  return input.match(/\/(?:video|note)\/(\d{6,})/i)?.[1] ?? input.match(/[?&]modal_id=(\d{6,})/i)?.[1] ?? null;
}

export function isDouyinPageUrl(input?: string): boolean {
  if (!input) return false;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && (url.hostname === 'douyin.com' || url.hostname.endsWith('.douyin.com'));
  } catch {
    return false;
  }
}

export function isDouyinShortUrl(input: string): boolean {
  try {
    return new URL(input).hostname === 'v.douyin.com';
  } catch {
    return false;
  }
}
