export interface SerializedVideoSelection {
  mediaId: string;
  url: string;
  qualityScore: number;
}

function cleanSerializedUrl(value: string): string {
  return value
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

function resolutionScore(value: string): number {
  const match = value.match(/\/(\d+)x(\d+)\//);
  return match ? Number(match[1]) * Number(match[2]) : 0;
}

export function mediaIdFromCoverUrl(coverUrl?: string): string | null {
  return coverUrl?.match(/\/(?:amplify_video_thumb|ext_tw_video_thumb)\/(\d+)\//)?.[1] ?? null;
}

export function selectSerializedTwitterMp4(
  serializedSources: Iterable<string>,
  coverUrl?: string,
): SerializedVideoSelection | null {
  const mediaId = mediaIdFromCoverUrl(coverUrl);
  if (!mediaId) return null;

  const matches = new Set<string>();
  const pattern = /https:(?:\\\/|\/){2}video\.twimg\.com(?:\\\/|\/)[^"'\s<]+?\.mp4(?:\?[^"'\s<]*)?/g;
  for (const source of serializedSources) {
    if (!source.includes(mediaId) || !source.includes('video.twimg.com')) continue;
    for (const match of source.matchAll(pattern)) {
      const candidate = cleanSerializedUrl(match[0]);
      if (candidate.includes(`/${mediaId}/`)) matches.add(candidate);
    }
  }

  const url = [...matches].sort((a, b) => resolutionScore(b) - resolutionScore(a))[0];
  return url ? { mediaId, url, qualityScore: resolutionScore(url) } : null;
}
