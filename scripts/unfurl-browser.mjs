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
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
    null;
  return { title, imageUrl, description, price };
}

async function fetchWithPlaywright(url) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Give JS-rendered price a brief moment on big retailers
    await page.waitForTimeout(1200);
    const html = await page.content();
    await context.close();
    return parseUnfurlHtml(html, url);
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
