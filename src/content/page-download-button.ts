import type { ParseResponse } from '../douyin';
import type { ExtensionResponse } from '../shared/messages';

type ButtonState = 'idle' | 'parsing' | 'downloading' | 'success' | 'error';

interface PageDownloadButtonOptions {
  getCurrentAwemeId: () => string | null;
  resolveCurrentMedia: () => Promise<ParseResponse>;
}

const HOST_ID = 'douyin-local-downloader-action';
const ACTION_HINTS = [
  '[data-e2e*="like"]',
  '[data-e2e*="comment"]',
  '[data-e2e*="collect"]',
  '[data-e2e*="favorite"]',
  '[data-e2e*="share"]',
  '[aria-label*="点赞"]',
  '[aria-label*="评论"]',
  '[aria-label*="收藏"]',
  '[aria-label*="分享"]',
].join(',');

const LABELS: Record<ButtonState, string> = {
  idle: '下载',
  parsing: '解析中',
  downloading: '下载中',
  success: '已下载',
  error: '下载失败',
};

const ICONS: Record<ButtonState, string> = {
  idle: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
  parsing: '<path d="M20 12a8 8 0 1 1-2.35-5.65"/>',
  downloading: '<path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
  success: '<path d="m5 12 4 4L19 6"/>',
  error: '<path d="M12 8v5m0 3h.01M4.93 19h14.14a2 2 0 0 0 1.73-3L13.73 4a2 2 0 0 0-3.46 0L3.2 16a2 2 0 0 0 1.73 3Z"/>',
};

function visibleRect(element: Element): DOMRect | null {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  if (rect.width < 1 || rect.height < 1 || style.display === 'none' || style.visibility === 'hidden') return null;
  if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return null;
  return rect;
}

function activeVideo(): HTMLVideoElement | null {
  const videos = [...document.querySelectorAll('video')]
    .map((video) => ({ video, rect: visibleRect(video) }))
    .filter((entry): entry is { video: HTMLVideoElement; rect: DOMRect } => !!entry.rect)
    .sort((a, b) => {
      const playingA = !a.video.paused && !a.video.ended && a.video.readyState >= 2 ? 1 : 0;
      const playingB = !b.video.paused && !b.video.ended && b.video.readyState >= 2 ? 1 : 0;
      const areaA = a.rect.width * a.rect.height;
      const areaB = b.rect.width * b.rect.height;
      return playingB - playingA || areaB - areaA;
    });
  return videos[0]?.video ?? null;
}

function actionContainerFor(video: HTMLVideoElement): HTMLElement | null {
  const videoRect = visibleRect(video);
  if (!videoRect) return null;

  const scopes: Element[] = [];
  let ancestor: Element | null = video.parentElement;
  for (let depth = 0; ancestor && depth < 12; depth += 1, ancestor = ancestor.parentElement) scopes.push(ancestor);

  const scored = new Map<HTMLElement, number>();
  for (const scope of scopes) {
    for (const action of scope.querySelectorAll(ACTION_HINTS)) {
      if (!visibleRect(action)) continue;
      let group = action.parentElement;
      for (let depth = 0; group && depth < 4; depth += 1, group = group.parentElement) {
        const rect = visibleRect(group);
        if (!rect || rect.width > 180 || rect.height < 70) continue;
        const hintCount = group.querySelectorAll(ACTION_HINTS).length;
        if (hintCount < 2) continue;
        const rightSideBonus = rect.left >= videoRect.left + videoRect.width * 0.55 ? 8 : 0;
        const narrowBonus = Math.max(0, 6 - rect.width / 30);
        scored.set(group, Math.max(scored.get(group) ?? 0, hintCount * 4 + rightSideBonus + narrowBonus - depth));
      }
    }
    if (scored.size) break;
  }

  return [...scored.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function createHost(onClick: () => void): HTMLElement {
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.dataset.douyinLocalDownload = 'true';
  host.style.cssText = 'display:flex;justify-content:center;align-items:center;flex:0 0 auto;position:relative;z-index:2;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { color: var(--douyin-download-color, #fff); font-family: -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
      button { all: unset; box-sizing: border-box; display: flex; width: 58px; min-height: 66px; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: inherit; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
      .icon { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 50%; background: rgba(22,24,35,.34); transition: transform 120ms ease, background 120ms ease; }
      button:hover .icon { transform: scale(1.06); background: rgba(22,24,35,.48); }
      button:focus-visible .icon { outline: 2px solid #25f4ee; outline-offset: 2px; }
      button:disabled { cursor: progress; opacity: .82; }
      svg { width: 25px; height: 25px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
      .label { max-width: 58px; overflow: hidden; font-size: 12px; font-weight: 600; line-height: 16px; text-align: center; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.38); }
      :host([data-state="parsing"]) svg { animation: spin 900ms linear infinite; }
      :host([data-state="downloading"]) .icon { animation: pulse 900ms ease-in-out infinite alternate; }
      :host([data-state="success"]) .icon { color: #25f4a6; }
      :host([data-state="error"]) .icon { color: #ff536c; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { to { transform: translateY(2px); opacity: .68; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
    </style>
    <button type="button" aria-label="下载当前抖音作品">
      <span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true"></svg></span>
      <span class="label">下载</span>
    </button>
  `;
  shadow.querySelector('button')?.addEventListener('click', onClick);
  return host;
}

export function installPageDownloadButton(options: PageDownloadButtonOptions): () => void {
  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  let state: ButtonState = 'idle';
  let boundAwemeId: string | null = null;
  let busy = false;
  let syncFrame = 0;
  let syncTimer: number | undefined;
  let lastSyncAt = 0;
  let successTimer: ReturnType<typeof setTimeout> | undefined;

  const setState = (next: ButtonState) => {
    state = next;
    if (!host?.shadowRoot) return;
    host.dataset.state = next;
    const label = host.shadowRoot.querySelector<HTMLElement>('.label');
    const svg = host.shadowRoot.querySelector<SVGElement>('svg');
    const button = host.shadowRoot.querySelector<HTMLButtonElement>('button');
    if (label) label.textContent = LABELS[next];
    if (svg) svg.innerHTML = ICONS[next];
    if (button) {
      button.disabled = next === 'parsing' || next === 'downloading';
      button.setAttribute('aria-label', `${LABELS[next]}当前抖音作品`);
      button.setAttribute('aria-live', 'polite');
    }
  };

  const handleClick = async () => {
    if (busy) return;
    const clickedAwemeId = options.getCurrentAwemeId();
    if (!clickedAwemeId) {
      setState('error');
      return;
    }

    busy = true;
    clearTimeout(successTimer);
    setState('parsing');
    try {
      const parsed = await options.resolveCurrentMedia();
      if (!parsed.ok || !parsed.media) throw new Error(parsed.error || '解析失败');
      if (options.getCurrentAwemeId() !== clickedAwemeId || parsed.media.awemeId !== clickedAwemeId) {
        throw new Error('作品已切换，请重新点击下载');
      }

      setState('downloading');
      const response = (await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_PAGE_MEDIA',
        media: parsed.media,
      })) as ExtensionResponse;
      if (!response.ok) throw new Error(response.error);
      setState('success');
      successTimer = setTimeout(() => {
        if (options.getCurrentAwemeId() === clickedAwemeId) setState('idle');
      }, 2400);
    } catch {
      setState('error');
    } finally {
      busy = false;
    }
  };

  const sync = () => {
    syncFrame = 0;
    lastSyncAt = performance.now();
    const awemeId = options.getCurrentAwemeId();
    const video = activeVideo();
    const container = video ? actionContainerFor(video) : null;

    if (!awemeId || !container) {
      host?.remove();
      return;
    }

    if (!host) {
      host = createHost(handleClick);
      setState(state);
    }

    if (boundAwemeId !== awemeId) {
      boundAwemeId = awemeId;
      busy = false;
      clearTimeout(successTimer);
      setState('idle');
    }

    const nativeAction = container.querySelector<HTMLElement>(ACTION_HINTS);
    const color = nativeAction ? getComputedStyle(nativeAction).color : getComputedStyle(container).color;
    if (color) host.style.setProperty('--douyin-download-color', color);
    if (host.parentElement !== container) container.append(host);

    for (const duplicate of document.querySelectorAll<HTMLElement>(`#${HOST_ID}`)) {
      if (duplicate !== host) duplicate.remove();
    }
  };

  const scheduleSync = () => {
    if (syncFrame || syncTimer) return;
    const delay = Math.max(0, 220 - (performance.now() - lastSyncAt));
    if (delay > 0) {
      syncTimer = window.setTimeout(() => {
        syncTimer = undefined;
        syncFrame = requestAnimationFrame(sync);
      }, delay);
      return;
    }
    syncFrame = requestAnimationFrame(sync);
  };

  const observer = new MutationObserver(scheduleSync);
  const begin = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('play', scheduleSync, true);
    window.addEventListener('popstate', scheduleSync);
    window.addEventListener('hashchange', scheduleSync);
    scheduleSync();
  };
  if (document.body) begin();
  else document.addEventListener('DOMContentLoaded', begin, { once: true });

  const interval = window.setInterval(scheduleSync, 1000);
  return () => {
    observer.disconnect();
    document.removeEventListener('play', scheduleSync, true);
    window.removeEventListener('popstate', scheduleSync);
    window.removeEventListener('hashchange', scheduleSync);
    window.clearInterval(interval);
    if (syncFrame) cancelAnimationFrame(syncFrame);
    if (syncTimer) window.clearTimeout(syncTimer);
    clearTimeout(successTimer);
    host?.remove();
  };
}
