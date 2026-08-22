/**
 * Local Playwright unfurl sidecar.
 * Used when OG/JSON-LD fetch is blocked or the URL is Amazon / Walmart / Target.
 *
 *   npm run unfurl:browser
 */
import http from 'node:http';
import { chromium } from 'playwright';

const PORT = Number(process.env.UNFURL_BROWSER_PORT ?? 8787);

function metaContent(html, keys) {
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

function parsePriceValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return sanitizeMoney(raw);
  }
  if (typeof raw !== 'string') return null;
  const dollar = raw.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
  if (dollar) {
    return sanitizeMoney(Number.parseFloat(dollar[1].replace(/,/g, '')));
  }
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  return sanitizeMoney(Number.parseFloat(cleaned));
}

/** Accept normal currency amounts only (rejects Amazon junk floats). */
function sanitizeMoney(n) {
  if (!Number.isFinite(n) || n <= 0 || n >= 1_000_000) return null;
  const cents = Math.round(n * 100);
  if (Math.abs(n * 100 - cents) > 0.001) return null;
  return cents / 100;
}

function priceFromJsonLd(html) {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const candidates = [node, ...(Array.isArray(node?.['@graph']) ? node['@graph'] : [])];
        for (const item of candidates) {
          if (!item || typeof item !== 'object') continue;
          const type = item['@type'];
          const types = Array.isArray(type) ? type : [type];
          const isProduct = types.some((t) => typeof t === 'string' && /product/i.test(t));
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

function priceFromHtmlFallbacks(html) {
  const patterns = [
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
      const n = Number.parseFloat(match[1].replace(/,/g, ''));
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

function parseUnfurlHtml(html, pageUrl) {
  const title =
    metaContent(html, ['og:title', 'twitter:title']) ??
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
    null;
  const rawImage = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  let imageUrl = null;
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
    priceFromHtmlFallbacks(html) ??
    null;
  return { title, imageUrl, description, price };
}

/** Live DOM scrape after JS renders — Amazon / Walmart often omit price from OG. */
async function scrapeDomMeta(page) {
  return page.evaluate(() => {
    const parsePrice = (raw) => {
      if (raw == null) return null;
      const text = String(raw);
      const dollar = text.match(
        /\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/,
      );
      const sanitize = (n) => {
        if (!Number.isFinite(n) || n <= 0 || n >= 1_000_000) return null;
        const cents = Math.round(n * 100);
        if (Math.abs(n * 100 - cents) > 0.001) return null;
        return cents / 100;
      };
      if (dollar) return sanitize(Number.parseFloat(dollar[1].replace(/,/g, '')));
      const cleaned = text.replace(/[^0-9.]/g, '');
      if (!cleaned) return null;
      return sanitize(Number.parseFloat(cleaned));
    };

    const priceFromRoot = (root) => {
      if (!root) return null;
      const offscreen = root.querySelector(
        '.a-price .a-offscreen, .aok-offscreen, .price-characteristic',
      );
      const fromOff = parsePrice(offscreen?.textContent);
      if (fromOff != null) return fromOff;

      const whole = root.querySelector('.a-price-whole');
      if (whole) {
        const w = whole.textContent.replace(/[^0-9]/g, '');
        const frac = root.querySelector('.a-price-fraction');
        const f = (frac?.textContent || '00').replace(/[^0-9]/g, '').slice(0, 2) || '00';
        return parsePrice(`${w}.${f}`);
      }
      return (
        parsePrice(root.getAttribute?.('content')) ??
        parsePrice(root.getAttribute?.('value')) ??
        parsePrice(root.textContent)
      );
    };

    // Prefer buy-box / hero price when present; else first on-page price.
    const buyboxRoots = [
      '#corePrice_feature_div',
      '#corePriceDisplay_desktop_feature_div',
      '#apex_desktop_newAccordionRow',
      '#apex_desktop',
      '#tp_price_block_total_price_ww',
      '#desktop_buybox',
      '#ppd',
      '#centerCol',
      '#price',
      '[data-seo-id="hero-price"]',
      '[data-testid="price-wrap"]',
      '[data-automation-id="product-price"]',
      'span[itemprop="price"]',
      '[itemprop="price"]',
    ];

    let price = null;
    for (const sel of buyboxRoots) {
      price = priceFromRoot(document.querySelector(sel));
      if (price != null) break;
    }

    // Amazon often omits buy-box ids for bots — pick the first $-prefixed a-price.
    if (price == null) {
      const offs = [...document.querySelectorAll('.a-price .a-offscreen')]
        .map((el) => parsePrice(el.textContent))
        .filter((n) => n != null && n >= 1);
      price = offs[0] ?? null;
    }
    if (price == null) {
      const whole = document.querySelector('.a-price-whole');
      const frac = document.querySelector('.a-price-fraction');
      if (whole) {
        const w = whole.textContent.replace(/[^0-9]/g, '');
        const f = (frac?.textContent || '00').replace(/[^0-9]/g, '').slice(0, 2) || '00';
        price = parsePrice(`$${w}.${f}`);
      }
    }

    const imageFromEl = (el) => {
      if (!el) return null;
      const dynamic = el.getAttribute('data-a-dynamic-image');
      if (dynamic) {
        try {
          const map = JSON.parse(dynamic);
          const urls = Object.keys(map);
          if (urls.length) {
            urls.sort((a, b) => (map[b]?.[0] ?? 0) - (map[a]?.[0] ?? 0));
            return urls[0];
          }
        } catch {
          // ignore
        }
      }
      const src =
        el.getAttribute('data-old-hires') ||
        el.getAttribute('data-src') ||
        el.getAttribute('src') ||
        el.currentSrc;
      if (src && /^https?:\/\//i.test(src) && !/pixel|spacer|1x1/i.test(src)) return src;
      return null;
    };

    const imageSelectors = [
      '#landingImage',
      '#imgTagWrapperId img',
      '#main-image',
      '#imgBlkFront',
      '[data-testid="hero-image"] img',
      '[data-testid="media-thumbnail"] img',
      'img[data-old-hires]',
    ];
    let imageUrl = null;
    for (const sel of imageSelectors) {
      imageUrl = imageFromEl(document.querySelector(sel));
      if (imageUrl) break;
    }

    return { price, imageUrl };
  });
}

async function fetchWithPlaywright(url) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled'],
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1365, height: 900 },
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      // Keep scripts so price/hydration can run; drop heavy media.
      if (['image', 'media', 'font'].includes(type)) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Poll for price nodes — Amazon hydrates buy-box asynchronously.
    for (let i = 0; i < 12; i++) {
      const ready = await page.$(
        [
          '#corePrice_feature_div .a-offscreen',
          '#corePrice_feature_div .a-price-whole',
          '.a-price .a-offscreen',
          '.a-price-whole',
          '[data-seo-id="hero-price"]',
          '[data-testid="price-wrap"]',
          '[itemprop="price"]',
        ].join(', '),
      );
      if (ready) break;
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(600);

    const html = await page.content();
    const fromHtml = parseUnfurlHtml(html, url);
    const fromDom = await scrapeDomMeta(page);

    await context.close();
    return {
      title: fromHtml.title,
      description: fromHtml.description,
      imageUrl: fromDom.imageUrl || fromHtml.imageUrl,
      price: fromDom.price ?? fromHtml.price,
    };
  } finally {
    await browser.close();
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/unfurl') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  let url;
  try {
    url = JSON.parse(body).url;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid json' }));
    return;
  }

  if (!url || typeof url !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'url required' }));
    return;
  }

  try {
    const meta = await fetchWithPlaywright(url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...meta, mode: 'browser' }));
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        title: null,
        imageUrl: null,
        description: null,
        price: null,
        mode: 'browser',
        error: e instanceof Error ? e.message : 'playwright failed',
      }),
    );
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Playwright unfurl listening on http://127.0.0.1:${PORT}`);
});
