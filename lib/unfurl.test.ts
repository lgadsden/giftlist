import { describe, expect, it } from 'vitest';

import { parseUnfurlHtml } from '@/lib/unfurl';

describe('parseUnfurlHtml', () => {
  it('reads og:title and og:image', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Cozy Mug" />
        <meta property="og:image" content="/images/mug.jpg" />
        <meta property="og:description" content="A nice mug" />
      </head></html>
    `;
    expect(parseUnfurlHtml(html, 'https://shop.example/item/1')).toEqual({
      title: 'Cozy Mug',
      imageUrl: 'https://shop.example/images/mug.jpg',
      description: 'A nice mug',
      price: null,
    });
  });

  it('falls back to title tag and twitter image', () => {
    const html = `
      <html><head>
        <title>Fallback Title</title>
        <meta name="twitter:image" content="https://cdn.example/a.png" />
      </head></html>
    `;
    expect(parseUnfurlHtml(html, 'https://shop.example')).toEqual({
      title: 'Fallback Title',
      imageUrl: 'https://cdn.example/a.png',
      description: null,
      price: null,
    });
  });

  it('reads price from JSON-LD Product offers', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type":"Product","name":"Headphones","offers":{"@type":"Offer","price":"129.99","priceCurrency":"USD"}}
        </script>
        <meta property="og:title" content="Headphones" />
      </head></html>
    `;
    expect(parseUnfurlHtml(html, 'https://shop.example/h')).toMatchObject({
      title: 'Headphones',
      price: 129.99,
    });
  });

  it('reads product:price:amount meta', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Mug" />
        <meta property="product:price:amount" content="24.50" />
      </head></html>
    `;
    expect(parseUnfurlHtml(html, 'https://shop.example/m').price).toBe(24.5);
  });

  it('reads Amazon a-offscreen price when OG omits it', () => {
    const html = `
      <html><body>
        <span class="a-price"><span class="a-offscreen">$42.99</span></span>
      </body></html>
    `;
    expect(parseUnfurlHtml(html, 'https://www.amazon.com/dp/B00').price).toBe(42.99);
  });

  it('reads Walmart currentPrice JSON', () => {
    const html = `
      <html><body>
        <script>window.__WML={"currentPrice":{"price":17.84,"currency":"USD"}}</script>
      </body></html>
    `;
    expect(parseUnfurlHtml(html, 'https://www.walmart.com/ip/1').price).toBe(17.84);
  });

  it('reads itemprop price content', () => {
    const html = `<span itemprop="price" content="9.50"></span>`;
    expect(parseUnfurlHtml(html, 'https://shop.example/x').price).toBe(9.5);
  });
});
