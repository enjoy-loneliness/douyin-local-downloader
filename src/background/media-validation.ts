import { ensureMediaRequestRules } from './request-rules';

export type RemoteMediaKind = 'video' | 'image';

export interface MediaPrefixInspection {
  ok: boolean;
  error?: string;
}

const decodePrefix = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes.slice(0, 64));

export function inspectMediaPrefix(
  kind: RemoteMediaKind,
  contentType: string,
  bytes: Uint8Array,
): MediaPrefixInspection {
  const normalizedType = contentType.toLowerCase();
  const prefix = decodePrefix(bytes);
  const trimmed = prefix.trimStart().toLowerCase();

  if (
    normalizedType.includes('text/html') ||
    normalizedType.includes('application/json') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('{"')
  ) {
    return { ok: false, error: '平台返回了网页拦截内容，而不是媒体文件。请刷新作品页面并重新播放后再试。' };
  }

  if (kind === 'video') {
    const hasIsoBmffHeader = prefix.slice(4, 16).includes('ftyp');
    if (!hasIsoBmffHeader) {
      return { ok: false, error: `下载地址没有返回有效 MP4 文件（Content-Type: ${contentType || '未知'}）。` };
    }
    return { ok: true };
  }

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp = prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
  const isGif = prefix.startsWith('GIF87a') || prefix.startsWith('GIF89a');
  if (!isJpeg && !isPng && !isWebp && !isGif) {
    return { ok: false, error: `下载地址没有返回有效图片（Content-Type: ${contentType || '未知'}）。` };
  }
  return { ok: true };
}

export async function validateRemoteMedia(url: string, kind: RemoteMediaKind): Promise<string> {
  await ensureMediaRequestRules();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: kind === 'video' ? 'video/mp4,video/*;q=0.9,*/*;q=0.1' : 'image/avif,image/webp,image/*,*/*;q=0.1',
        Range: 'bytes=0-63',
      },
    });
  } catch (error) {
    throw new Error(`无法访问媒体地址：${error instanceof Error ? error.message : String(error)}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`媒体地址已过期或拒绝访问（HTTP ${response.status}），请刷新页面后重试。`);
  }
  if (!response.ok) throw new Error(`媒体预检失败（HTTP ${response.status}）。`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('浏览器没有返回可读取的媒体响应。');
  let bytes = new Uint8Array();
  try {
    const firstChunk = await reader.read();
    bytes = firstChunk.value?.slice(0, 64) ?? new Uint8Array();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (bytes.length < 12) throw new Error('媒体响应过短，可能是失效地址。');

  const contentType = response.headers.get('content-type') || '';
  const inspection = inspectMediaPrefix(kind, contentType, bytes);
  if (!inspection.ok) throw new Error(inspection.error);
  return contentType;
}
