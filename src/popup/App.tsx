import { useEffect, useMemo, useState } from 'react';

import type { DownloadableMedia, ExtensionRequest, ExtensionResponse, ParseResponse } from '../shared/messages';
import { mediaContentId } from '../shared/media';

function sendMessage(request: ExtensionRequest): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(request);
}

function sourceLabel(source: DownloadableMedia['source']): string {
  return {
    'page-data': '页面数据',
    'dom-script': '页面脚本',
    network: '页面网络',
    request: '同源请求',
    dom: '播放器 DOM',
  }[source];
}

export function App() {
  const [media, setMedia] = useState<DownloadableMedia | null>(null);
  const [shareText, setShareText] = useState('');
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('正在识别当前页面…');
  const [error, setError] = useState('');

  const primaryLabel = useMemo(() => {
    if (!media) return '下载';
    if (media.kind === 'image') return `批量下载 ${media.images.length} 张原图`;
    if (media.platform === 'twitter' && media.videos.length > 1) return `下载 ${media.videos.length} 个视频`;
    return media.platform === 'douyin' ? '下载无水印视频' : '下载最高画质视频';
  }, [media]);

  const applyResponse = (response: ParseResponse) => {
    if (!response.ok || !response.media) {
      setMedia(null);
      setError(response.error || '解析失败。');
      setStatus('');
      return;
    }
    setMedia(response.media);
    setError('');
    setStatus(`已通过${sourceLabel(response.media.source)}识别`);
  };

  useEffect(() => {
    sendMessage({ type: 'GET_ACTIVE_MEDIA' })
      .then((response) => applyResponse(response as ParseResponse))
      .catch(() => setError('扩展后台未响应，请重新打开 Popup。'))
      .finally(() => setBusy(false));
  }, []);

  const parseShare = async () => {
    if (!shareText.trim()) {
      setError('请粘贴抖音或 X/Twitter 作品链接、短链接或完整分享文本。');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('正在本地打开并解析分享链接…');
    try {
      applyResponse((await sendMessage({ type: 'PARSE_SHARE_TEXT', text: shareText })) as ParseResponse);
    } catch {
      setError('分享链接解析失败。');
    } finally {
      setBusy(false);
    }
  };

  const download = async (indexes?: number[]) => {
    if (!media) return;
    setBusy(true);
    setError('');
    try {
      const response = await sendMessage(
        media.kind === 'video' ? { type: 'DOWNLOAD_VIDEO', media } : { type: 'DOWNLOAD_IMAGES', media, indexes },
      );
      if (!response.ok) throw new Error(response.error);
      setStatus(indexes?.length === 1 ? '图片已加入下载队列' : '作品已加入下载队列');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '下载启动失败。');
    } finally {
      setBusy(false);
    }
  };

  const copyVideoUrl = async () => {
    if (!media?.videoUrl) return;
    try {
      await navigator.clipboard.writeText(media.videoUrl);
      setStatus('视频地址已复制');
    } catch {
      setError('复制失败，请检查剪贴板权限。');
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="logo-mark" aria-hidden="true">↓</div>
        <div>
          <h1>抖音 / X 本地下载助手</h1>
          <p>仅在你的浏览器中解析</p>
        </div>
        <span className="privacy-dot" title="不发送到第三方服务器" />
      </header>

      <section className="paste-card">
        <label htmlFor="share-text">分享链接或分享文本</label>
        <textarea
          id="share-text"
          value={shareText}
          onChange={(event) => setShareText(event.target.value)}
          placeholder="粘贴抖音、x.com、twitter.com、t.co 链接或分享文本"
          rows={3}
        />
        <button className="secondary-button" type="button" onClick={parseShare} disabled={busy}>
          解析分享内容
        </button>
      </section>

      {busy && !media && <div className="loading-card"><span className="spinner" />{status || '正在解析…'}</div>}
      {error && <div className="error-card">{error}</div>}

      {media && (
        <section className="media-card">
          <div className="cover-wrap">
            {media.coverUrl ? <img src={media.coverUrl} alt={media.title} /> : <div className="cover-fallback">无封面</div>}
            <span className={`platform-badge platform-${media.platform}`}>
              {media.platform === 'douyin' ? '抖音' : 'X / Twitter'}
            </span>
            <span className="kind-badge">
              {media.kind === 'image'
                ? `图文 · ${media.images.length} 张`
                : media.platform === 'twitter' && media.videos.length > 1
                  ? `${media.videos.length} 个视频`
                  : '视频'}
            </span>
          </div>
          <div className="media-meta">
            <div className="author-row">
              {media.author.avatarUrl && <img className="avatar" src={media.author.avatarUrl} alt="" />}
              <strong>{media.author.nickname}</strong>
            </div>
            <h2>{media.title}</h2>
            <div className="id-row">
              <span>{media.platform === 'douyin' ? 'aweme_id' : 'tweet_id'}</span>
              <code>{mediaContentId(media)}</code>
            </div>
          </div>

          {media.kind === 'image' && (
            <div className="image-grid">
              {media.images.map((image) => (
                <div className="image-item" key={image.index}>
                  <a href={image.url} target="_blank" rel="noreferrer" title={`查看第 ${image.index} 张原图`}>
                    <img src={image.url} alt={`原图 ${image.index}`} />
                    <span>{image.index}</span>
                  </a>
                  <button type="button" onClick={() => download([image.index])} disabled={busy}>下载</button>
                </div>
              ))}
            </div>
          )}

          <div className="action-stack">
            <button className="primary-button" type="button" onClick={() => download()} disabled={busy}>
              {busy ? '处理中…' : primaryLabel}
            </button>
            {media.kind === 'video' && (
              <button className="ghost-button" type="button" onClick={copyVideoUrl} disabled={!media.videoUrl}>
                复制视频地址
              </button>
            )}
          </div>
          <p className="source-note">{status} · 文件不会上传到第三方服务</p>
        </section>
      )}

      <footer>请尊重作者版权，仅下载你有权保存的内容。</footer>
    </main>
  );
}
