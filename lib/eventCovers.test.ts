import { describe, expect, it } from 'vitest';

import { coverDateBadge, firstGiftImage, formatWishlistDate } from '@/lib/eventCovers';

describe('formatWishlistDate', () => {
  it('formats ISO dates', () => {
    expect(formatWishlistDate('2026-12-25')).toMatch(/Dec/);
    expect(formatWishlistDate(null)).toBe('No date');
  });
});

describe('coverDateBadge', () => {
  it('returns No date when missing', () => {
    expect(coverDateBadge(null)).toBe('No date');
  });
});

describe('firstGiftImage', () => {
  it('returns the first gift with an image', () => {
    expect(firstGiftImage([{ image_url: null }, { image_url: 'https://x/a.jpg' }])).toBe(
      'https://x/a.jpg',
    );
    expect(firstGiftImage([])).toBeNull();
  });
});
