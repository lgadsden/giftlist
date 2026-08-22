const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode common HTML entities in scraped titles (`&#x27;` → `'`). */
export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#([0-9]+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    });
}

/** Strip retailer / marketplace prefixes & suffixes from scraped titles. */
export function cleanScrapedTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  let title = decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim();

  const sitePrefixes = [
    /^amazon\.com\s*:\s*/i,
    /^amazon\.ca\s*:\s*/i,
    /^amazon\s*:\s*/i,
    /^walmart\.com\s*:\s*/i,
    /^walmart\s*:\s*/i,
    /^target\.com\s*:\s*/i,
    /^target\s*:\s*/i,
  ];
  for (const re of sitePrefixes) {
    title = title.replace(re, '').trim();
  }

  const siteSuffixes = [
    /\s*[-–—|]\s*amazon\.com\s*$/i,
    /\s*[-–—|]\s*amazon\.ca\s*$/i,
    /\s*[-–—|]\s*walmart\.com\s*$/i,
    /\s*[-–—|]\s*target\.com\s*$/i,
    /\s*[-–—|]\s*amazon\s*$/i,
    /\s*[-–—|]\s*walmart\s*$/i,
    /\s*[-–—|]\s*target\s*$/i,
    /\s*\|\s*amazon\.com\s*$/i,
    /\s+on\s+amazon\s*$/i,
  ];
  for (const re of siteSuffixes) {
    title = title.replace(re, '').trim();
  }

  // Amazon often truncates OG titles with an ellipsis
  title = title.replace(/(?:\u2026|\.{2,})\s*$/u, '').trim();

  return title;
}

/**
 * Short label for compact list rows — keep the main product name,
 * drop variant / pack / marketing tails after " - " or " | ".
 */
export function shortProductTitle(raw: string | null | undefined, maxLen = 48): string {
  const cleaned = cleanScrapedTitle(raw);
  if (!cleaned) return '';

  const parts = cleaned.split(/\s+[-–—|]\s+/);
  let short = parts[0]?.trim() || cleaned;

  // "Name, 20W …" / "Name, Pack of 60" — keep before first comma-spec cue
  const commaCut = short.match(
    /^(.+?)(?:,\s*(?:\d|(?:pack(?:\s+of)?|count|lemon|lavender|scent|size|color|assorted)\b))/i,
  );
  if (commaCut?.[1] && commaCut[1].length >= 8) {
    short = commaCut[1].trim();
  }

  if (short.length > maxLen) {
    const clipped = short.slice(0, maxLen - 1);
    const lastSpace = clipped.lastIndexOf(' ');
    short = `${(lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
  }

  return short;
}
