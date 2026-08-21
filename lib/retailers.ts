/** Domains that usually need a real browser (bot walls / JS-rendered price). */
const BROWSER_HOST_PATTERNS = [
  /(^|\.)amazon\./i,
  /(^|\.)amzn\./i,
  /(^|\.)walmart\./i,
  /(^|\.)target\./i,
];

export function hostnameNeedsBrowser(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return BROWSER_HOST_PATTERNS.some((re) => re.test(host));
}

export function urlNeedsBrowser(rawUrl: string): boolean {
  try {
    return hostnameNeedsBrowser(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

export function retailerLabel(rawUrl: string): string | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (/(^|\.)amazon\.|(^|\.)amzn\./i.test(host)) return 'Amazon';
    if (/(^|\.)walmart\./i.test(host)) return 'Walmart';
    if (/(^|\.)target\./i.test(host)) return 'Target';
    return null;
  } catch {
    return null;
  }
}

/** True when fast scrape looks too thin to trust. */
export function unfurlLooksIncomplete(meta: {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
}): boolean {
  return !meta.title || (!meta.imageUrl && meta.price == null);
}
