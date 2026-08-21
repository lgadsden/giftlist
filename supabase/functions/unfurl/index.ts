const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BROWSER_HOST_PATTERNS = [
  /(^|\.)amazon\./i,
  /(^|\.)amzn\./i,
  /(^|\.)walmart\./i,
  /(^|\.)target\./i,
];

function hostnameNeedsBrowser(hostname: string): boolean {
  return BROWSER_HOST_PATTERNS.some((re) => re.test(hostname));
}

function looksIncomplete(meta: {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
}): boolean {
  return !meta.title || (!meta.imageUrl && meta.price == null);
}

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

function parsePriceValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw !== 'string') return null;
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
          const isProduct = types.some((t: unknown) => typeof t === 'string' && /product/i.test(t));
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
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function parseUnfurlHtml(html: string, pageUrl: string) {
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
    null;
  const rawImage = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, pageUrl).toString();
    } catch {
      imageUrl = null;
    }
  }
  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  const price =
    priceFromJsonLd(html) ??
    parsePriceValue(metaContent(html, ['product:price:amount', 'og:price:amount'])) ??
    null;
  return { title, imageUrl, description, price };
}

async function fastFetch(url: string) {
  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'GiftlistUnfurl/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!upstream.ok) {
    return {
      title: null as string | null,
      imageUrl: null as string | null,
      description: null as string | null,
      price: null as number | null,
      error: `fetch failed (${upstream.status})`,
    };
  }
  const html = (await upstream.text()).slice(0, 250_000);
  return { ...parseUnfurlHtml(html, url), error: undefined as string | undefined };
}

function browserSidecarUrls(): string[] {
  const configured = Deno.env.get('PLAYWRIGHT_UNFURL_URL');
  const urls = [
    configured,
    'http://127.0.0.1:8787',
    'http://host.docker.internal:8787',
  ].filter(Boolean) as string[];
  return [...new Set(urls)];
}

async function browserFetch(url: string) {
  for (const base of browserSidecarUrls()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/unfurl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      return {
        title: data.title ?? null,
        imageUrl: data.imageUrl ?? null,
        description: data.description ?? null,
        price: typeof data.price === 'number' ? data.price : null,
        mode: 'browser' as const,
        error: data.error,
      };
    } catch {
      // try next host
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'invalid url' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: 'unsupported protocol' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const wantsBrowser = hostnameNeedsBrowser(parsed.hostname);
    let meta = await fastFetch(parsed.toString());
    let mode: 'fast' | 'browser' = 'fast';

    const shouldEscalate = wantsBrowser || looksIncomplete(meta) || Boolean(meta.error);
    if (shouldEscalate) {
      const browserMeta = await browserFetch(parsed.toString());
      if (browserMeta && (browserMeta.title || browserMeta.imageUrl || browserMeta.price != null)) {
        meta = browserMeta;
        mode = 'browser';
      } else if (wantsBrowser && !browserMeta) {
        meta = {
          ...meta,
          error:
            meta.error ??
            'Retailer page needs the Playwright helper (npm run unfurl:browser). You can enter details manually.',
        };
      }
    }

    return new Response(
      JSON.stringify({
        title: meta.title,
        imageUrl: meta.imageUrl,
        description: meta.description,
        price: meta.price,
        mode,
        usedBrowser: mode === 'browser',
        error: meta.error,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'unfurl failed',
        title: null,
        imageUrl: null,
        description: null,
        price: null,
        mode: 'fast',
        usedBrowser: false,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
