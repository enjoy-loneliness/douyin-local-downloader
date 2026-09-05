const TWITTER_STATUS_URL =
  /(?:https?:\/\/)?(?:(?:www\.|mobile\.)?(?:x\.com|twitter\.com))\/(?:i\/status|[A-Za-z0-9_]{1,20}\/status)\/(\d+)(?:\/video\/\d+)?(?:[^\s]*)?/i;
const TCO_URL = /https?:\/\/t\.co\/[A-Za-z0-9]+(?:[^\s]*)?/i;
const TRAILING_PUNCTUATION = /[，。！？、；：）】》〉」』”’.,!?;:)}\]>]+$/;

export function extractTwitterUrl(input: string): string | null {
  const match = input.match(TWITTER_STATUS_URL)?.[0] ?? input.match(TCO_URL)?.[0];
  if (!match) return null;
  const cleaned = match.replace(TRAILING_PUNCTUATION, '');
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

export function extractTweetId(input: string): string | null {
  return input.match(TWITTER_STATUS_URL)?.[1] ?? null;
}

export function isTwitterPageUrl(input?: string): boolean {
  if (!input) return false;
  try {
    const hostname = new URL(input).hostname.toLowerCase();
    return hostname === 'x.com' || hostname.endsWith('.x.com') || hostname === 'twitter.com' || hostname.endsWith('.twitter.com');
  } catch {
    return false;
  }
}

export function isTwitterShortUrl(input: string): boolean {
  try {
    return new URL(input).hostname.toLowerCase() === 't.co';
  } catch {
    return false;
  }
}
