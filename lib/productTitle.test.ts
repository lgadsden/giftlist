import { describe, expect, it } from 'vitest';

import { cleanScrapedTitle, shortProductTitle } from '@/lib/productTitle';

describe('cleanScrapedTitle', () => {
  it('strips Walmart / Amazon site suffixes', () => {
    expect(
      cleanScrapedTitle(
        'Clean People Dishwasher Detergent Pods - Lemon, 60 Pack - No Residue - Walmart.com',
      ),
    ).toBe('Clean People Dishwasher Detergent Pods - Lemon, 60 Pack - No Residue');
    expect(cleanScrapedTitle('Wireless Earbuds | Amazon.com')).toBe('Wireless Earbuds');
    expect(cleanScrapedTitle('Mug - Amazon')).toBe('Mug');
  });

  it('strips Amazon.com: prefix, decodes entities, drops ellipsis', () => {
    expect(cleanScrapedTitle("Amazon.com: Baby Alive Crawl &#x27;n Play…")).toBe(
      "Baby Alive Crawl 'n Play",
    );
    expect(cleanScrapedTitle('Amazon.com: Some Toy &amp; Game...')).toBe('Some Toy & Game');
  });
});

describe('shortProductTitle', () => {
  it('keeps the main product name before variant / pack tails', () => {
    expect(
      shortProductTitle(
        'Clean People Dishwasher Detergent Pods - Lemon, 60 Pack - No Residue, Sparkling Clean - Walmart.com',
      ),
    ).toBe('Clean People Dishwasher Detergent Pods');
  });

  it('shortens Amazon-style titles', () => {
    expect(
      shortProductTitle(
        'Anker USB C Charger, 20W Fast Charging Block - Amazon.com',
      ),
    ).toBe('Anker USB C Charger');
  });

  it('cleans Amazon.com: titles for list display', () => {
    expect(shortProductTitle("Amazon.com: Baby Alive Crawl &#x27;n Play…")).toBe(
      "Baby Alive Crawl 'n Play",
    );
  });

  it('falls back to truncation for very long single segments', () => {
    const long = 'A'.repeat(60) + ' Extra Words Here';
    expect(shortProductTitle(long).endsWith('…')).toBe(true);
    expect(shortProductTitle(long).length).toBeLessThanOrEqual(48);
  });
});
