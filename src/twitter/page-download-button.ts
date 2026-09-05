import type { ParseResponse } from '../shared/messages';
import type { ExtensionResponse } from '../shared/messages';
import { findCurrentTweetContext } from '.';

type ButtonState = 'idle' | 'parsing' | 'downloading' | 'success' | 'error';

interface ButtonOptions {
  resolveTweetMedia: (tweetId: string) => Promise<ParseResponse>;
}

const HOST_ID = 'local-twitter-video-download-action';
const LABELS: Record<ButtonState, string> = {
  idle: '下载视频',
  parsing: '正在解析视频',
  downloading: '正在下载视频',
  success: '视频已下载',
  error: '下载失败，点击重试',
};

const ICONS: Record<ButtonState, string> = {
  idle: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
  parsing: '<path d="M20 12a8 8 0 1 1-2.35-5.65"/>',
  downloading: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
  success: '<path d="m5 12 4 4L19 6"/>',
  error: '<path d="M12 8v5m0 3h.01M4.93 19h14.14a2 2 0 0 0 1.73-3L13.73 4a2 2 0 0 0-3.46 0L3.2 16a2 2 0 0 0 1.73 3Z"/>',
};

function actionGroup(article: HTMLElement | null, tweetId: string): HTMLElement | null {
  const actionSelectors = ['reply', 'retweet', 'unretweet', 'like', 'unlike', 'bookmark', 'removeBookmark', 'share'];
  const standard = article
    ? [...article.querySelectorAll<HTMLElement>('[role="group"]')]
      .map((group) => ({
        group,
        score: actionSelectors.filter((testId) => group.querySelector(`[data-testid="${testId}"]`)).length,
      }))
      .sort((a, b) => b.score - a.score)
      .find((candidate) => candidate.score >= 3)?.group
    : undefined;
  if (standard) return standard;

  const reply = document.querySelector<HTMLElement>(`a[aria-label^="Reply"][href*="${tweetId}"]`);
  let ancestor = reply?.parentElement ?? null;
  for (let depth = 0; ancestor && depth < 7; depth += 1, ancestor = ancestor.parentElement) {
    const count = ancestor.querySelectorAll(
      '[aria-label^="Reply"], [aria-label^="Repost"], [aria-label^="Like"], [aria-label^="Share"]',
    ).length;
    if (count >= 3) return ancestor;
  }
  return null;
}

function createHost(onClick: (event: MouseEvent) => void): HTMLElement {
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'display:flex;align-items:center;justify-content:center;flex:1 1 0;min-width:40px;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { color: rgb(83,100,113); font-family: TwitterChirp,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      button { all: unset; display:grid; width:34px; height:34px; place-items:center; border-radius:9999px; color:inherit; cursor:pointer; transition:color 120ms ease,background 120ms ease; }
      button:hover { color:rgb(29,155,240); background:rgba(29,155,240,.1); }
      button:focus-visible { outline:2px solid rgb(29,155,240); outline-offset:2px; }
      button:disabled { cursor:progress; opacity:.75; }
      svg { width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }
      :host([data-state="parsing"]) svg { animation:spin 900ms linear infinite; }
      :host([data-state="downloading"]) button { color:rgb(29,155,240); }
      :host([data-state="success"]) button { color:rgb(0,186,124); background:rgba(0,186,124,.1); }
      :host([data-state="error"]) button { color:rgb(244,33,46); background:rgba(244,33,46,.1); }
      @keyframes spin { to { transform:rotate(360deg); } }
      @media (prefers-reduced-motion:reduce) { * { animation:none!important; transition:none!important; } }
    </style>
    <button type="button" aria-label="下载视频" title="下载视频"><svg viewBox="0 0 24 24" aria-hidden="true"></svg></button>
  `;
  shadow.querySelector('button')?.addEventListener('click', onClick as EventListener);
  return host;
}

export function installTwitterDownloadButton(options: ButtonOptions): () => void {
  let host: HTMLElement | null = null;
  let boundTweetId: string | null = null;
  let busy = false;
  let state: ButtonState = 'idle';
  let frame = 0;
  let timer: number | undefined;
  let lastSync = 0;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const setState = (next: ButtonState) => {
    state = next;
    if (!host?.shadowRoot) return;
    host.dataset.state = next;
    const button = host.shadowRoot.querySelector<HTMLButtonElement>('button');
    const svg = host.shadowRoot.querySelector<SVGElement>('svg');
    if (button) {
      button.disabled = next === 'parsing' || next === 'downloading';
      button.setAttribute('aria-label', LABELS[next]);
      button.title = LABELS[next];
    }
    if (svg) svg.innerHTML = ICONS[next];
  };

  const onClick = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !boundTweetId) return;
    const clickedTweetId = boundTweetId;
    busy = true;
    clearTimeout(resetTimer);
    setState('parsing');
    try {
      const parsed = await options.resolveTweetMedia(clickedTweetId);
      if (!parsed.ok || !parsed.media || parsed.media.platform !== 'twitter') {
        throw new Error(parsed.error || '解析失败');
      }
      if (findCurrentTweetContext().tweetId !== clickedTweetId || parsed.media.tweetId !== clickedTweetId) {
        throw new Error('帖子已切换');
      }
      setState('downloading');
      const response = (await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_PAGE_MEDIA',
        media: parsed.media,
      })) as ExtensionResponse;
      if (!response.ok) throw new Error(response.error);
      setState('success');
      resetTimer = setTimeout(() => {
        if (boundTweetId === clickedTweetId) setState('idle');
      }, 2400);
    } catch {
      setState('error');
    } finally {
      busy = false;
    }
  };

  const sync = () => {
    frame = 0;
    lastSync = performance.now();
    const context = findCurrentTweetContext();
    const group = context.tweetId ? actionGroup(context.article, context.tweetId) : null;
    if (!context.tweetId || !context.video || !group) {
      host?.remove();
      return;
    }

    if (!host) host = createHost(onClick);
    if (boundTweetId !== context.tweetId) {
      boundTweetId = context.tweetId;
      busy = false;
      clearTimeout(resetTimer);
      setState('idle');
    } else setState(state);
    host.dataset.tweetId = context.tweetId;
    if (host.parentElement !== group) group.append(host);
    for (const duplicate of document.querySelectorAll<HTMLElement>(`#${HOST_ID}`)) {
      if (duplicate !== host) duplicate.remove();
    }
  };

  const schedule = () => {
    if (frame || timer) return;
    const delay = Math.max(0, 260 - (performance.now() - lastSync));
    if (delay > 0) {
      timer = window.setTimeout(() => {
        timer = undefined;
        frame = requestAnimationFrame(sync);
      }, delay);
    } else frame = requestAnimationFrame(sync);
  };

  const observer = new MutationObserver(schedule);
  const begin = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('play', schedule, true);
    window.addEventListener('popstate', schedule);
    schedule();
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });
  const interval = window.setInterval(schedule, 1200);

  return () => {
    observer.disconnect();
    document.removeEventListener('play', schedule, true);
    window.removeEventListener('popstate', schedule);
    window.clearInterval(interval);
    if (frame) cancelAnimationFrame(frame);
    if (timer) window.clearTimeout(timer);
    clearTimeout(resetTimer);
    host?.remove();
  };
}
