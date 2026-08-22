import { describe, expect, it } from 'vitest';

import {
  compareGiftsByPriority,
  giftPriorityLabel,
  giftPriorityTone,
  normalizeGiftPriority,
  parsePriceInput,
} from '@/lib/gifts';

describe('parsePriceInput', () => {
  it('parses currency-ish strings', () => {
    expect(parsePriceInput('$24.99')).toBe(24.99);
    expect(parsePriceInput('12')).toBe(12);
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
  });
});

describe('gift priority', () => {
  it('normalizes unknown values to none', () => {
    expect(normalizeGiftPriority(3)).toBe(3);
    expect(normalizeGiftPriority('2')).toBe(2);
    expect(normalizeGiftPriority(99)).toBe(0);
    expect(normalizeGiftPriority(null)).toBe(0);
  });

  it('labels and tones match mockup levels', () => {
    expect(giftPriorityLabel(3)).toBe('High priority');
    expect(giftPriorityTone(3)).toBe('high');
    expect(giftPriorityLabel(2)).toBe('Medium priority');
    expect(giftPriorityTone(2)).toBe('medium');
    expect(giftPriorityLabel(1)).toBe('Low priority');
    expect(giftPriorityTone(1)).toBe('low');
    expect(giftPriorityLabel(0)).toBeNull();
    expect(giftPriorityTone(0)).toBe('none');
  });

  it('sorts high first then newer', () => {
    const rows = [
      { priority: 1 as const, created_at: '2026-01-02' },
      { priority: 3 as const, created_at: '2026-01-01' },
      { priority: 3 as const, created_at: '2026-01-03' },
      { priority: 0 as const, created_at: '2026-01-04' },
    ];
    const sorted = [...rows].sort(compareGiftsByPriority);
    expect(sorted.map((r) => `${r.priority}:${r.created_at}`)).toEqual([
      '3:2026-01-03',
      '3:2026-01-01',
      '1:2026-01-02',
      '0:2026-01-04',
    ]);
  });
});
