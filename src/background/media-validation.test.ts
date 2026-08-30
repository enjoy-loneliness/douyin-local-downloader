import { describe, expect, it } from 'vitest';

import { inspectMediaPrefix } from './media-validation';

describe('download response validation', () => {
  it('accepts an ISO BMFF MP4 prefix', () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(inspectMediaPrefix('video', 'video/mp4', bytes)).toEqual({ ok: true });
  });

  it('rejects the HTML interception page seen by Chrome downloads', () => {
    const bytes = new TextEncoder().encode('<!doctype html><html><body>access denied</body></html>');
    expect(inspectMediaPrefix('video', 'text/html; charset=utf-8', bytes)).toMatchObject({ ok: false });
  });

  it('accepts JPEG, PNG and WebP image signatures', () => {
    expect(inspectMediaPrefix('image', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, ...Array(16).fill(0)]))).toEqual({
      ok: true,
    });
    expect(
      inspectMediaPrefix('image', 'image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...Array(16).fill(0)])),
    ).toEqual({ ok: true });
    expect(inspectMediaPrefix('image', 'image/webp', new TextEncoder().encode('RIFFxxxxWEBPxxxx'))).toEqual({
      ok: true,
    });
  });
});
