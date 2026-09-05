import type { MediaAuthor } from '../shared/media';
import type { TwitterMedia, TwitterSource, TwitterVideo } from './types';

type UnknownRecord = Record<string, unknown>;

interface NormalizeOptions {
  pageUrl: string;
  source: TwitterSource;
  preferredTweetId?: string | null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function unwrapResult(value: unknown): UnknownRecord | undefined {
  let current = isRecord(value) ? value : undefined;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const next = current.result ?? current.tweet ?? current.user;
    if (!isRecord(next)) break;
    current = next;
  }
  return current;
}

function url(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate?.startsWith('https://')) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.hostname === 'video.twimg.com' || parsed.hostname === 'pbs.twimg.com' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function extractAuthor(record: UnknownRecord): MediaAuthor {
  const core = isRecord(record.core) ? record.core : undefined;
  const userResult = unwrapResult(core?.user_results ?? record.user_results ?? record.user);
  const userLegacy = isRecord(userResult?.legacy) ? userResult.legacy : userResult;
  const userCore = isRecord(userResult?.core) ? userResult.core : undefined;
  const avatar = isRecord(userResult?.avatar) ? userResult.avatar : undefined;

  return {
    nickname: text(userCore?.name ?? userLegacy?.name) ?? '未知作者',
    uniqueId: text(userCore?.screen_name ?? userLegacy?.screen_name),
    avatarUrl: url(avatar?.image_url ?? userLegacy?.profile_image_url_https ?? userLegacy?.profile_image_url),
  };
}

function mediaItems(record: UnknownRecord): UnknownRecord[] {
  const legacy = isRecord(record.legacy) ? record.legacy : record;
  const extended = isRecord(legacy.extended_entities)
    ? legacy.extended_entities
    : isRecord(record.extended_entities)
      ? record.extended_entities
      : undefined;
  const raw = extended?.media ?? record.mediaDetails;
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

function bestMp4(media: UnknownRecord): Omit<TwitterVideo, 'index'> | null {
  const videoInfo = isRecord(media.video_info) ? media.video_info : undefined;
  const rawVariants = Array.isArray(videoInfo?.variants) ? videoInfo.variants.filter(isRecord) : [];
  const variants = rawVariants
    .map((variant) => ({
      url: url(variant.url),
      bitrate: Number(variant.bitrate ?? 0),
      contentType: text(variant.content_type),
    }))
    .filter(
      (variant): variant is { url: string; bitrate: number; contentType: string } =>
        !!variant.url && variant.contentType === 'video/mp4' && variant.url.includes('.mp4'),
    )
    .sort((a, b) => b.bitrate - a.bitrate);
  const best = variants[0];
  if (!best) return null;

  const sizes = isRecord(media.sizes) ? media.sizes : undefined;
  const large = isRecord(sizes?.large) ? sizes.large : undefined;
  return {
    url: best.url,
    bitrate: best.bitrate,
    coverUrl: url(media.media_url_https ?? media.media_url),
    width: Number(large?.w) || undefined,
    height: Number(large?.h) || undefined,
  };
}

function extractTitle(record: UnknownRecord): string {
  const legacy = isRecord(record.legacy) ? record.legacy : record;
  const noteTweet = isRecord(record.note_tweet) ? record.note_tweet : undefined;
  const noteResults = isRecord(noteTweet?.note_tweet_results) ? noteTweet.note_tweet_results : undefined;
  const noteResult = unwrapResult(noteResults);
  return text(noteResult?.text ?? legacy.full_text ?? legacy.text ?? record.text) ?? 'X 视频';
}

function normalizeCandidate(record: UnknownRecord, options: NormalizeOptions): TwitterMedia | null {
  const tweetId = text(record.rest_id ?? record.id_str ?? record.tweet_id);
  if (!tweetId || !/^\d{6,}$/.test(tweetId)) return null;

  const videos = mediaItems(record)
    .filter((media) => media.type === 'video' || media.type === 'animated_gif' || isRecord(media.video_info))
    .map(bestMp4)
    .filter((video): video is Omit<TwitterVideo, 'index'> => !!video)
    .map((video, index) => ({ ...video, index: index + 1 }));
  if (videos.length === 0) return null;

  return {
    platform: 'twitter',
    tweetId,
    author: extractAuthor(record),
    title: extractTitle(record),
    coverUrl: videos[0].coverUrl,
    kind: 'video',
    videoUrl: videos[0].url,
    videos,
    images: [],
    pageUrl: options.pageUrl,
    source: options.source,
  };
}

export function normalizeTwitterPayload(payload: unknown, options: NormalizeOptions): TwitterMedia | null {
  const candidates: TwitterMedia[] = [];
  const seen = new WeakSet<object>();
  let visited = 0;

  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > 16 || visited > 12_000 || seen.has(value)) return;
    seen.add(value);
    visited += 1;

    if (Array.isArray(value)) {
      for (const child of value) walk(child, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    const candidate = normalizeCandidate(value, options);
    if (candidate) candidates.push(candidate);
    for (const child of Object.values(value)) walk(child, depth + 1);
  };

  walk(payload, 0);
  if (options.preferredTweetId) {
    const exact = candidates.find((candidate) => candidate.tweetId === options.preferredTweetId);
    if (exact) return exact;
  }
  return candidates[0] ?? null;
}
