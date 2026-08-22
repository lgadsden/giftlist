/** Extract Open Graph / Twitter / Schema.org product metadata from HTML. */
export type UnfurlResult = {
  title: string | null;
  imageUrl: string | null;
  description: string | null;
  price: number | null;
};

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
        'i',
      ),
    ];
    for (const re of patterns) {
      const match = html.match(re);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return null;
}

function absoluteUrl(raw: string, baseUrl: string): string | null {
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parsePriceValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw !== 'string') return null;
  // Prefer the first $amount when multiple numbers appear (e.g. "was $40 now $24.99")
  const dollar = raw.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (dollar) {
    const n = Number.parseFloat(dollar[1]!);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function priceFromJsonLd(html: string): number | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]!);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const candidates = [node, ...(Array.isArray(node?.['@graph']) ? node['@graph'] : [])];
        for (const item of candidates) {
          if (!item || typeof item !== 'object') continue;
          const type = item['@type'];
          const types = Array.isArray(type) ? type : [type];
          const isProduct = types.some(
            (t) => typeof t === 'string' && /product/i.test(t),
          );
          if (!isProduct && !item.offers) continue;

          const offers = item.offers;
          const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
          for (const offer of offerList) {
            const price =
              parsePriceValue(offer?.price) ??
              parsePriceValue(offer?.lowPrice) ??
              parsePriceValue(offer?.priceSpecification?.price);
            if (price != null) return price;
          }
          const direct = parsePriceValue(item.price);
          if (direct != null) return direct;
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return null;
}

/**
 * Retailer HTML that hides price from OG/JSON-LD (Amazon offscreen spans,
 * Walmart embedded JSON, generic itemprop).
 */
export function priceFromHtmlFallbacks(html: string): number | null {
  const patterns: RegExp[] = [
    /class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>\s*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([0-9,]+)/i,
    /itemprop=["']price["'][^>]+content=["']([0-9]+(?:\.[0-9]{1,2})?)["']/i,
    /content=["']([0-9]+(?:\.[0-9]{1,2})?)["'][^>]+itemprop=["']price["']/i,
    /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /"currentPrice"\s*:\s*\{\s*"price"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /"price"\s*:\s*\{\s*"rawString"\s*:\s*"\$?([0-9]+(?:\.[0-9]{1,2})?)"/i,
    /"current_retail"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /data-seo-id=["']hero-price["'][^>]*>[\s\S]*?\$([0-9]+(?:\.[0-9]{1,2})?)/i,
    /"displayPrice"\s*:\s*"\$?([0-9]+(?:\.[0-9]{1,2})?)"/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) {
      const n = Number.parseFloat(match[1]!.replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 0 && n < 1_000_000) {
        if (/a-price-whole/i.test(re.source)) {
          const frac = html.match(
            /class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*([0-9]{1,2})/i,
          );
          if (frac?.[1]) {
            const withFrac = Number.parseFloat(`${Math.trunc(n)}.${frac[1]}`);
            if (Number.isFinite(withFrac)) return withFrac;
          }
        }
        return n;
      }
    }
  }
  return null;
}

export function parseUnfurlHtml(html: string, pageUrl: string): UnfurlResult {
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
    null;

  const rawImage = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  const imageUrl = rawImage ? absoluteUrl(rawImage, pageUrl) : null;

  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);

  const price =
    priceFromJsonLd(html) ??
    parsePriceValue(metaContent(html, ['product:price:amount', 'og:price:amount'])) ??
    priceFromHtmlFallbacks(html) ??
    null;

  return { title, imageUrl, description, price };
}
