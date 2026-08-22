import type { EventType } from '@/lib/domain';

export type EventCoverTheme = {
  background: string;
  accent: string;
  icon: 'balloon' | 'pine-tree' | 'flower' | 'tie' | 'ring' | 'heart' | 'school' | 'gift';
  label: string;
};

export const EVENT_COVERS: Record<EventType, EventCoverTheme> = {
  general: {
    background: '#3D6B5A',
    accent: '#E8F0EC',
    icon: 'gift',
    label: 'Gifts',
  },
  birthday: {
    background: '#C45B8A',
    accent: '#F8E7EE',
    icon: 'balloon',
    label: 'Birthday',
  },
  christmas: {
    background: '#2F5D4A',
    accent: '#E8F0EC',
    icon: 'pine-tree',
    label: 'Christmas',
  },
  mothers_day: {
    background: '#B85C7A',
    accent: '#F8E7EE',
    icon: 'flower',
    label: "Mother's Day",
  },
  fathers_day: {
    background: '#3A5F7A',
    accent: '#E8EEF3',
    icon: 'tie',
    label: "Father's Day",
  },
  wedding: {
    background: '#6B5A7A',
    accent: '#F1ECF5',
    icon: 'ring',
    label: 'Wedding',
  },
  anniversary: {
    background: '#A34E6A',
    accent: '#F8E7EE',
    icon: 'heart',
    label: 'Anniversary',
  },
  graduation: {
    background: '#3D5A80',
    accent: '#E8EEF5',
    icon: 'school',
    label: 'Graduation',
  },
};

export function formatWishlistDate(raw: string | null | undefined): string {
  if (!raw) return 'No date';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Short cover chip: "Today", "In 2 weeks", or formatted date. */
export function coverDateBadge(raw: string | null | undefined): string {
  if (!raw) return 'No date';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatWishlistDate(raw);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 14) return `In ${days} days`;
  if (days >= 14 && days < 60) return `In ${Math.round(days / 7)} weeks`;
  if (days < 0 && days > -14) return `${Math.abs(days)}d ago`;
  return formatWishlistDate(raw);
}

export function firstGiftImage(
  gifts: { image_url: string | null }[] | null | undefined,
): string | null {
  if (!gifts?.length) return null;
  for (const g of gifts) {
    if (g.image_url) return g.image_url;
  }
  return null;
}
