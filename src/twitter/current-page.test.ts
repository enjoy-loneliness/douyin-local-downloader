import { describe, expect, it } from 'vitest';

import { selectCurrentTweetId } from './current-page';

describe('current X/Twitter post selection', () => {
  it('prefers the active video post over a lagging SPA URL', () => {
    expect(
      selectCurrentTweetId('2039483174791627069', 'https://x.com/example/status/2000000000000000000'),
    ).toBe('2039483174791627069');
  });

  it('falls back to the status URL', () => {
    expect(selectCurrentTweetId(null, 'https://twitter.com/example/status/2039483174791627069')).toBe(
      '2039483174791627069',
    );
  });
});
