export type ReservationStatus = 'reserved' | 'purchased' | 'cancelled';

export function reservationBadge(input: {
  status: ReservationStatus | string;
  isOwner: boolean;
  isReserver: boolean;
}): { label: string; tone: 'reserved' | 'purchased' | 'yours' | 'none' } {
  if (input.status === 'cancelled') return { label: '', tone: 'none' };
  if (input.status === 'purchased') {
    if (input.isReserver) return { label: 'You purchased', tone: 'yours' };
    return { label: 'Purchased', tone: 'purchased' };
  }
  if (input.status === 'reserved') {
    if (input.isReserver) return { label: 'You claimed', tone: 'yours' };
    if (input.isOwner) return { label: 'Reserved', tone: 'reserved' };
    return { label: 'Claimed', tone: 'reserved' };
  }
  return { label: '', tone: 'none' };
}

export function canMarkPurchased(input: {
  status: ReservationStatus | string;
  isReserver: boolean;
}): boolean {
  return input.isReserver && input.status === 'reserved';
}

export function canUndoClaim(input: {
  status: ReservationStatus | string;
  isReserver: boolean;
}): boolean {
  return input.isReserver && (input.status === 'reserved' || input.status === 'purchased');
}
