import { describe, expect, it } from 'vitest';

import {
  formatUsDate,
  maskUsDateInput,
  parseUsDateInput,
  toIsoDate,
} from '@/lib/dates';

describe('US date helpers', () => {
  it('formats ISO as MM-DD-YYYY', () => {
    expect(formatUsDate('2026-12-25')).toBe('12-25-2026');
    expect(formatUsDate(null)).toBe('');
  });

  it('parses US typed dates to ISO', () => {
    expect(parseUsDateInput('12-25-2026')).toBe('2026-12-25');
    expect(parseUsDateInput('12/25/2026')).toBe('2026-12-25');
    expect(parseUsDateInput('12252026')).toBe('2026-12-25');
    expect(parseUsDateInput('13-40-2026')).toBeNull();
    expect(parseUsDateInput('')).toBeNull();
  });

  it('masks while typing', () => {
    expect(maskUsDateInput('12')).toBe('12');
    expect(maskUsDateInput('1225')).toBe('12-25');
    expect(maskUsDateInput('12252026')).toBe('12-25-2026');
  });

  it('toIsoDate is local calendar day', () => {
    expect(toIsoDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});
