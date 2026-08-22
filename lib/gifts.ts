export type GiftPriority = 0 | 1 | 2 | 3;

export const GIFT_PRIORITIES: { value: GiftPriority; label: string }[] = [
  { value: 3, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 1, label: 'Low' },
  { value: 0, label: 'None' },
];

export function normalizeGiftPriority(raw: unknown): GiftPriority {
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return 0;
}

export function giftPriorityLabel(priority: GiftPriority): string | null {
  if (priority === 3) return 'High priority';
  if (priority === 2) return 'Medium priority';
  if (priority === 1) return 'Low priority';
  return null;
}

export function giftPriorityTone(
  priority: GiftPriority,
): 'high' | 'medium' | 'low' | 'none' {
  if (priority === 3) return 'high';
  if (priority === 2) return 'medium';
  if (priority === 1) return 'low';
  return 'none';
}

export function compareGiftsByPriority(
  a: { priority: GiftPriority; created_at?: string },
  b: { priority: GiftPriority; created_at?: string },
): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const aAt = a.created_at ?? '';
  const bAt = b.created_at ?? '';
  return bAt.localeCompare(aAt);
}

export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatPriceInput(price: number | null): string {
  if (price == null) return '';
  return String(price);
}
