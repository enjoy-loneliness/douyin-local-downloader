import { describe, expect, it } from 'vitest';

import { selectCurrentAwemeId } from './current-page';

describe('current Douyin work selection', () => {
  it('prefers the active video card when SPA URL is still stale', () => {
    expect(
      selectCurrentAwemeId(
        '7653437664523242794',
        'https://www.douyin.com/video/7650000000000000000',
      ),
    ).toBe('7653437664523242794');
  });

  it('falls back to the detail URL when no active card id is available', () => {
    expect(selectCurrentAwemeId(null, 'https://www.douyin.com/video/7653437664523242794')).toBe(
      '7653437664523242794',
    );
  });
});
