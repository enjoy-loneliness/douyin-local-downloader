import type { DouyinImage, DouyinMedia, DouyinSource } from './types';

type UnknownRecord = Record<string, unknown>;

interface NormalizeOptions {
  pageUrl: string;
  source: DouyinSource;
  preferredAwemeId?: string | null;
}

const VIDEO_ADDRESS_PRIORITY = [
  'play_addr_h264',
  'h264_play_addr',
  'play_addr',
  'download_addr',
  'play_addr_lowbr',
];

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function firstUrl(value: unknown): string | undefined {
  if (typeof value === 'string' && /^https:\/\//i.test(value)) return cleanMediaUrl(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstUrl(entry);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  for (const key of ['url_list', 'urlList', 'uri', 'url']) {
    const found = firstUrl(value[key]);
    if (found) return found;
  }
  return undefined;
}

function cleanMediaUrl(url: string): string {
  return url
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/^http:\/\//i, 'https://')
    .replace('/playwm/', '/play/');
}

function findVideoUrl(record: UnknownRecord): string | undefined {
  const video = isRecord(record.video) ? record.video : record;

  for (const key of VIDEO_ADDRESS_PRIORITY) {
    const found = firstUrl(video[key]);
    if (found) return found;
  }

  if (Array.isArray(video.bit_rate)) {
    const variants = [...video.bit_rate].filter(isRecord).sort((a, b) => {
      const codecA = String(a.gear_name ?? a.format ?? '').toLowerCase().includes('h264') ? 1 : 0;
      const codecB = String(b.gear_name ?? b.format ?? '').toLowerCase().includes('h264') ? 1 : 0;
      const rateA = Number(a.bit_rate ?? 0);
      const rateB = Number(b.bit_rate ?? 0);
      return codecB - codecA || rateB - rateA;
    });
    for (const variant of variants) {
      const found = firstUrl(variant.play_addr ?? variant.playAddr);
      if (found) return found;
    }
  }

  return undefined;
}

function extractImageList(record: UnknownRecord): DouyinImage[] {
  const postInfo = isRecord(record.image_post_info) ? record.image_post_info : undefined;
  const raw = record.images ?? postInfo?.images ?? record.photos;
  if (!Array.isArray(raw)) return [];

  const urls = new Set<string>();
  const images: DouyinImage[] = [];
  for (const item of raw) {
    const rec = isRecord(item) ? item : undefined;
    const url = firstUrl(
      rec?.download_url ?? rec?.origin_url ?? rec?.display_image ?? rec?.url_list ?? rec?.url ?? item,
    );
    if (!url || urls.has(url)) continue;
    urls.add(url);
    images.push({
      index: images.length + 1,
      url,
      width: Number(rec?.width) || undefined,
      height: Number(rec?.height) || undefined,
    });
  }
  return images;
}

function extractCover(record: UnknownRecord, images: DouyinImage[]): string | undefined {
  const video = isRecord(record.video) ? record.video : undefined;
  return (
    firstUrl(video?.origin_cover) ??
    firstUrl(video?.cover) ??
    firstUrl(video?.dynamic_cover) ??
    firstUrl(record.cover) ??
    images[0]?.url
  );
}

function normalizeCandidate(record: UnknownRecord, options: NormalizeOptions): DouyinMedia | null {
  const awemeId = asText(record.aweme_id ?? record.awemeId ?? record.item_id ?? record.itemId);
  if (!awemeId || !/^\d{6,}$/.test(awemeId)) return null;

  const authorRecord = isRecord(record.author) ? record.author : {};
  const images = extractImageList(record);
  const videoUrl = findVideoUrl(record);
  if (!videoUrl && images.length === 0) return null;

  const nickname = asText(authorRecord.nickname ?? authorRecord.name) ?? '未知作者';
  return {
    awemeId,
    author: {
      nickname,
      uniqueId: asText(authorRecord.unique_id ?? authorRecord.uniqueId ?? authorRecord.short_id),
      avatarUrl: firstUrl(authorRecord.avatar_thumb ?? authorRecord.avatar_medium ?? authorRecord.avatar_larger),
    },
    title: asText(record.desc ?? record.title) ?? '抖音作品',
    coverUrl: extractCover(record, images),
    kind: images.length > 0 ? 'image' : 'video',
    videoUrl: images.length > 0 ? undefined : videoUrl,
    images,
    pageUrl: options.pageUrl,
    source: options.source,
  };
}

export function normalizeAwemePayload(payload: unknown, options: NormalizeOptions): DouyinMedia | null {
  const candidates: DouyinMedia[] = [];
  const seen = new WeakSet<object>();
  let visited = 0;

  const walk = (value: unknown, depth: number): void => {
    if (depth > 14 || visited > 10_000 || !value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    visited += 1;

    if (isRecord(value)) {
      const candidate = normalizeCandidate(value, options);
      if (candidate) candidates.push(candidate);
      for (const child of Object.values(value)) walk(child, depth + 1);
    } else if (Array.isArray(value)) {
      for (const child of value) walk(child, depth + 1);
    }
  };

  walk(payload, 0);
  if (candidates.length === 0) return null;
  if (options.preferredAwemeId) {
    const exact = candidates.find((candidate) => candidate.awemeId === options.preferredAwemeId);
    if (exact) return exact;
  }
  return candidates[0];
}
