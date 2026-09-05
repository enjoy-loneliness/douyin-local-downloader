import { extractTweetId } from './url';

export interface CurrentTweetContext {
  tweetId: string | null;
  video: HTMLVideoElement | null;
  article: HTMLElement | null;
}

function visibleArea(rect: DOMRect): number {
  const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

function activeVideo(): HTMLVideoElement | null {
  return (
    [...document.querySelectorAll('video')]
      .map((video) => ({ video, rect: video.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && visibleArea(rect) > 0)
      .sort((a, b) => {
        const playingA = !a.video.paused && !a.video.ended ? 1 : 0;
        const playingB = !b.video.paused && !b.video.ended ? 1 : 0;
        return playingB - playingA || visibleArea(b.rect) - visibleArea(a.rect);
      })[0]?.video ?? null
  );
}

function tweetIdFromArticle(article: HTMLElement | null): string | null {
  if (!article) return null;
  const links = article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]');
  for (const link of links) {
    const id = extractTweetId(link.href || link.getAttribute('href') || '');
    if (id) return id;
  }
  return null;
}

export function selectCurrentTweetId(activeArticleId: string | null, pageUrl: string): string | null {
  return activeArticleId ?? extractTweetId(pageUrl);
}

export function findCurrentTweetContext(pageUrl = location.href): CurrentTweetContext {
  const video = activeVideo();
  const article = video?.closest<HTMLElement>('article[data-testid="tweet"]') ?? null;
  return {
    tweetId: selectCurrentTweetId(tweetIdFromArticle(article), pageUrl),
    video,
    article,
  };
}
