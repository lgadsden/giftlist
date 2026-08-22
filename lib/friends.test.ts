import { describe, expect, it } from 'vitest';

import {
  claimInviteErrorMessage,
  orderedPair,
  parseClaimInvitePayload,
} from '@/lib/friends';

describe('friends helpers', () => {
  it('orders uuid pairs stably', () => {
    expect(orderedPair('b', 'a')).toEqual(['a', 'b']);
    expect(orderedPair('a', 'b')).toEqual(['a', 'b']);
  });

  it('parses claim invite payload', () => {
    expect(parseClaimInvitePayload({ ok: true, friend_id: 'abc' })).toEqual({
      ok: true,
      friendId: 'abc',
    });
    expect(parseClaimInvitePayload(null).ok).toBe(false);
  });

  it('cleans claim errors', () => {
    expect(claimInviteErrorMessage('ERROR: invite expired')).toContain('invite expired');
  });
});
