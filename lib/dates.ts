/** Calendar date helpers — UI uses US MM-DD-YYYY; DB uses ISO YYYY-MM-DD. */

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format ISO date as US MM-DD-YYYY for input display. */
export function formatUsDate(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${d.getFullYear()}`;
}

/**
 * Parse typed US dates: 12-25-2026, 12/25/2026, 12252026.
 * Returns ISO YYYY-MM-DD or null.
 */
export function parseUsDateInput(raw: string): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const digits = cleaned.replace(/\D/g, '');
  let mm: number;
  let dd: number;
  let yyyy: number;

  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(cleaned)) {
    const parts = cleaned.split(/[-/]/).map(Number);
    mm = parts[0]!;
    dd = parts[1]!;
    yyyy = parts[2]!;
  } else if (digits.length === 8) {
    mm = Number(digits.slice(0, 2));
    dd = Number(digits.slice(2, 4));
    yyyy = Number(digits.slice(4, 8));
  } else {
    return null;
  }

  if (yyyy < 1900 || yyyy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(yyyy, mm - 1, dd);
  if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) {
    return null;
  }
  return toIsoDate(date);
}

/** Soft mask while typing toward MM-DD-YYYY. */
export function maskUsDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}
