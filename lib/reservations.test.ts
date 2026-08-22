import { describe, expect, it } from 'vitest';

import { canMarkPurchased, canUndoClaim, reservationBadge } from '@/lib/reservations';

describe('reservationBadge', () => {
  it('labels secret reserved for owner without revealing who', () => {
    expect(
      reservationBadge({ status: 'reserved', isOwner: true, isReserver: false }),
    ).toEqual({ label: 'Reserved', tone: 'reserved' });
  });

  it('shows purchaser their own states', () => {
    expect(
      reservationBadge({ status: 'reserved', isOwner: false, isReserver: true }),
    ).toEqual({ label: 'You claimed', tone: 'yours' });
    expect(
      reservationBadge({ status: 'purchased', isOwner: false, isReserver: true }),
    ).toEqual({ label: 'You purchased', tone: 'yours' });
  });
});

describe('reservation actions', () => {
  it('gates mark purchased / undo', () => {
    expect(canMarkPurchased({ status: 'reserved', isReserver: true })).toBe(true);
    expect(canMarkPurchased({ status: 'purchased', isReserver: true })).toBe(false);
    expect(canUndoClaim({ status: 'purchased', isReserver: true })).toBe(true);
    expect(canUndoClaim({ status: 'reserved', isReserver: false })).toBe(false);
  });
});
