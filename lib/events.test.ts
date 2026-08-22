import { describe, expect, it } from 'vitest';

import { drawSecretSantaPairs, parseBudgetInput } from '@/lib/events';

describe('drawSecretSantaPairs', () => {
  it('rejects fewer than 2 people', () => {
    expect(() => drawSecretSantaPairs(['a'])).toThrow(/at least 2/i);
  });

  it('produces a derangement with unique receivers', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const pairs = drawSecretSantaPairs(ids, () => 0.42);
    expect(pairs).toHaveLength(5);
    const givers = pairs.map((p) => p.giverId).sort();
    const receivers = pairs.map((p) => p.receiverId).sort();
    expect(givers).toEqual([...ids].sort());
    expect(receivers).toEqual([...ids].sort());
    for (const p of pairs) {
      expect(p.giverId).not.toBe(p.receiverId);
    }
  });

  it('works for two people (swap)', () => {
    const pairs = drawSecretSantaPairs(['x', 'y']);
    expect(pairs).toHaveLength(2);
    expect(pairs.find((p) => p.giverId === 'x')?.receiverId).toBe('y');
    expect(pairs.find((p) => p.giverId === 'y')?.receiverId).toBe('x');
  });
});

describe('parseBudgetInput', () => {
  it('parses dollar amounts', () => {
    expect(parseBudgetInput('$25')).toBe(25);
    expect(parseBudgetInput('40.5')).toBe(40.5);
    expect(parseBudgetInput('')).toBeNull();
  });
});
