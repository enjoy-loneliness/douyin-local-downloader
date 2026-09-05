import { extractAwemeId } from './url';

export interface CurrentPageWork {
  awemeId: string | null;
  video: HTMLVideoElement | null;
}

export function selectCurrentAwemeId(activeVideoId: string | null, pageUrl: string): string | null {
  const pageId = extractAwemeId(pageUrl);
  try {
    const pathname = new URL(pageUrl).pathname;
    if (/\/(?:video|note)\/\d{6,}/.test(pathname)) return pageId;
  } catch {
    // Fall through to active-card selection for malformed or relative URLs.
  }
  return activeVideoId ?? pageId;
}

function visibleArea(rect: DOMRect): number {
  const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

export function findActiveVideo(): HTMLVideoElement | null {
  return (
    [...document.querySelectorAll('video')]
      .map((video) => ({ video, rect: video.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && visibleArea(rect) > 0)
      .sort((a, b) => {
        const playingA = !a.video.paused && !a.video.ended && a.video.readyState >= 2 ? 1 : 0;
        const playingB = !b.video.paused && !b.video.ended && b.video.readyState >= 2 ? 1 : 0;
        return playingB - playingA || visibleArea(b.rect) - visibleArea(a.rect);
      })[0]?.video ?? null
  );
}

function idFromElement(element: Element): string | null {
  for (const attribute of ['data-e2e-vid', 'data-aweme-id', 'data-item-id']) {
    const value = element.getAttribute(attribute);
    if (value && /^\d{6,}$/.test(value)) return value;
  }
  if (element instanceof HTMLAnchorElement) return extractAwemeId(element.href || element.getAttribute('href') || '');
  return null;
}

function distanceToVideo(element: Element, videoRect: DOMRect): number {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2 - (videoRect.left + videoRect.width / 2);
  const y = rect.top + rect.height / 2 - (videoRect.top + videoRect.height / 2);
  return x * x + y * y;
}

function idNearVideo(video: HTMLVideoElement): string | null {
  const directLink = video.closest<HTMLAnchorElement>('a[href*="/video/"], a[href*="/note/"]');
  const directId = directLink ? idFromElement(directLink) : null;
  if (directId) return directId;

  const videoRect = video.getBoundingClientRect();
  let ancestor: HTMLElement | null = video;
  for (let depth = 0; ancestor && depth < 20; depth += 1, ancestor = ancestor.parentElement) {
    const ownId = idFromElement(ancestor);
    if (ownId) return ownId;

    const candidates = [...ancestor.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"], a[href*="/note/"]')]
      .map((link) => ({ link, id: idFromElement(link) }))
      .filter((candidate): candidate is { link: HTMLAnchorElement; id: string } => !!candidate.id);
    const uniqueIds = new Set(candidates.map((candidate) => candidate.id));
    if (uniqueIds.size === 1) return candidates[0].id;
    if (uniqueIds.size > 1) {
      candidates.sort((a, b) => distanceToVideo(a.link, videoRect) - distanceToVideo(b.link, videoRect));
      return candidates[0].id;
    }
  }
  return null;
}

export function findCurrentPageWork(pageUrl = location.href): CurrentPageWork {
  const video = findActiveVideo();
  // Douyin can update the playing card before it updates the SPA URL. The
  // active video's own card is therefore authoritative; URL is fallback only.
  return {
    awemeId: selectCurrentAwemeId(video ? idNearVideo(video) : null, pageUrl),
    video,
  };
}
