import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RESERVATION_VISIBILITY,
  eventTypeLabel,
  reservationVisibleToOwner,
  rewriteAffiliateUrl,
} from '../lib/domain';

describe('rewriteAffiliateUrl', () => {
  const merchants = [
    {
      id: 'amazon',
      hostPatterns: ['amazon.com', 'www.amazon.com'],
      tagParam: 'tag',
      tagValue: 'giftlist-20',
      enabled: true,
    },
  ];

  it('tags amazon urls when tag configured', () => {
    const result = rewriteAffiliateUrl(
      'https://www.amazon.com/dp/B000123?psc=1',
      merchants,
    );
    expect(result.tagged).toBe(true);
    expect(result.merchantId).toBe('amazon');
    expect(result.url).toContain('tag=giftlist-20');
  });

  it('passes through unknown hosts', () => {
    const result = rewriteAffiliateUrl('https://example.com/gift', merchants);
    expect(result.tagged).toBe(false);
    expect(result.merchantId).toBeNull();
    expect(result.url).toContain('example.com');
  });

  it('does not tag when tag value missing', () => {
    const result = rewriteAffiliateUrl('https://amazon.com/dp/1', [
      { ...merchants[0], tagValue: null },
    ]);
    expect(result.tagged).toBe(false);
    expect(result.merchantId).toBe('amazon');
  });
});

describe('reservationVisibleToOwner', () => {
  it('hides who from owner when secret', () => {
    const result = reservationVisibleToOwner({
      visibility: 'secret',
      reservedBy: 'gifter',
      ownerId: 'owner',
      viewerId: 'owner',
    });
    expect(result).toEqual({ showReserved: true, showWho: false });
  });

  it('shows who to owner when notify', () => {
    const result = reservationVisibleToOwner({
      visibility: 'notify',
      reservedBy: 'gifter',
      ownerId: 'owner',
      viewerId: 'owner',
    });
    expect(result).toEqual({ showReserved: true, showWho: true });
  });

  it('defaults to secret', () => {
    expect(DEFAULT_RESERVATION_VISIBILITY).toBe('secret');
  });
});

describe('eventTypeLabel', () => {
  it('labels christmas', () => {
    expect(eventTypeLabel('christmas')).toBe('Christmas');
  });
});
