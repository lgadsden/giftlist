import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
  },
}));

import { loadLikedGiftIds, toggleLikedGift } from './likes';

describe('likes', () => {
  beforeEach(() => {
    store.clear();
  });

  it('toggles liked gift ids per user', async () => {
    expect([...(await loadLikedGiftIds('u1'))]).toEqual([]);
    let next = await toggleLikedGift('u1', 'g1');
    expect([...next]).toEqual(['g1']);
    next = await toggleLikedGift('u1', 'g1');
    expect([...next]).toEqual([]);
    await toggleLikedGift('u1', 'g2');
    await toggleLikedGift('u2', 'g2');
    expect([...(await loadLikedGiftIds('u1'))]).toEqual(['g2']);
    expect([...(await loadLikedGiftIds('u2'))]).toEqual(['g2']);
  });
});
