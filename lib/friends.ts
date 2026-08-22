export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type ClaimInviteResult =
  | { ok: true; friendId: string }
  | { ok: false; error: string };

/** Normalize RPC / PostgREST errors into a short message. */
export function claimInviteErrorMessage(raw: unknown): string {
  if (!raw) return 'Could not claim invite';
  if (typeof raw === 'string') return raw.replace(/^.*exception:\s*/i, '').trim() || raw;
  if (typeof raw === 'object' && raw && 'message' in raw) {
    return claimInviteErrorMessage((raw as { message: unknown }).message);
  }
  return 'Could not claim invite';
}

export function parseClaimInvitePayload(data: unknown): ClaimInviteResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Unexpected response' };
  }
  const row = data as { ok?: boolean; friend_id?: string };
  if (row.ok && row.friend_id) {
    return { ok: true, friendId: row.friend_id };
  }
  return { ok: false, error: 'Invite claim failed' };
}
