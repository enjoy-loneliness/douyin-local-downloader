import { describe, expect, it } from 'vitest';

import { selectCurrentAwemeId } from './current-page';

describe('current Douyin work selection', () => {
  it('prefers the active video card on feed-style pages', () => {
    expect(
      selectCurrentAwemeId(
        '7653437664523242794',
        'https://www.douyin.com/?modal_id=7650000000000000000',
      ),
    ).toBe('7653437664523242794');
  });

  it('keeps the canonical detail id even when nearby recommendation videos exist', () => {
    expect(
      selectCurrentAwemeId('7587011542186380602', 'https://www.douyin.com/video/7653437664523242794'),
    ).toBe(
      '7653437664523242794',
    );
  });
});
