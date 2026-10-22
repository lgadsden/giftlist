export type GiftingEventKind = 'secret_santa';
export type GiftingEventStatus = 'open' | 'drawn' | 'locked';
export type GiftingEventMemberStatus = 'invited' | 'joined';

export function giftingEventStatusLabel(status: GiftingEventStatus): string {
  if (status === 'open') return 'Open';
  if (status === 'drawn') return 'Drawn';
  return 'Locked';
}

export function giftingEventKindLabel(kind: GiftingEventKind): string {
  if (kind === 'secret_santa') return 'Secret Santa';
  return kind;
}

/** Fisher–Yates shuffle (mutates a copy). */
export function shuffleInPlace<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export type SecretSantaPair = { giverId: string; receiverId: string };

/**
 * Build a random derangement: everyone gives to someone else, each person receives once.
 * Requires at least 2 participants.
 */
export function drawSecretSantaPairs(
  memberIds: string[],
  random: () => number = Math.random,
): SecretSantaPair[] {
  const unique = [...new Set(memberIds)];
  if (unique.length < 2) {
    throw new Error('Need at least 2 participants to draw');
  }

  const givers = [...unique];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const receivers = shuffleInPlace([...unique], random);
    if (givers.every((g, i) => g !== receivers[i])) {
      return givers.map((giverId, i) => ({
        giverId,
        receiverId: receivers[i]!,
      }));
    }
  }

  // Guaranteed derangement: cycle on a shuffled order
  const order = shuffleInPlace([...unique], random);
  return order.map((giverId, i) => ({
    giverId,
    receiverId: order[(i + 1) % order.length]!,
  }));
}

export function parseBudgetInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
