export type AffiliateMerchant = {
  id: string;
  hostPatterns: string[];
  tagParam: string | null;
  tagValue: string | null;
  enabled: boolean;
};

export type AffiliateRewriteResult = {
  url: string;
  merchantId: string | null;
  tagged: boolean;
};

function hostMatches(hostname: string, patterns: string[]): boolean {
  const host = hostname.toLowerCase();
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    return host === p || host.endsWith(`.${p}`);
  });
}

/** Rewrite known merchant URLs with affiliate tags; otherwise pass through. */
export function rewriteAffiliateUrl(
  rawUrl: string,
  merchants: AffiliateMerchant[],
): AffiliateRewriteResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { url: rawUrl, merchantId: null, tagged: false };
  }

  const merchant = merchants.find(
    (m) => m.enabled && hostMatches(parsed.hostname, m.hostPatterns),
  );

  if (!merchant || !merchant.tagParam || !merchant.tagValue) {
    return {
      url: parsed.toString(),
      merchantId: merchant?.id ?? null,
      tagged: false,
    };
  }

  parsed.searchParams.set(merchant.tagParam, merchant.tagValue);
  return {
    url: parsed.toString(),
    merchantId: merchant.id,
    tagged: true,
  };
}

export type ReservationVisibility = 'secret' | 'notify';

/** What the wishlist owner is allowed to see about a reservation. */
export function reservationVisibleToOwner(input: {
  visibility: ReservationVisibility;
  reservedBy: string;
  ownerId: string;
  viewerId: string;
}): { showReserved: boolean; showWho: boolean } {
  const isOwner = input.viewerId === input.ownerId;
  if (!isOwner) {
    return { showReserved: true, showWho: input.viewerId === input.reservedBy };
  }

  if (input.visibility === 'secret') {
    return { showReserved: true, showWho: false };
  }

  return { showReserved: true, showWho: true };
}

export const DEFAULT_RESERVATION_VISIBILITY: ReservationVisibility = 'secret';

export const EVENT_TYPES = [
  'general',
  'birthday',
  'christmas',
  'mothers_day',
  'fathers_day',
  'wedding',
  'anniversary',
  'graduation',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function eventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    general: 'General',
    birthday: 'Birthday',
    christmas: 'Christmas',
    mothers_day: "Mother's Day",
    fathers_day: "Father's Day",
    wedding: 'Wedding',
    anniversary: 'Anniversary',
    graduation: 'Graduation',
  };
  return labels[type];
}
