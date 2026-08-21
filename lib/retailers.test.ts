import { describe, expect, it } from 'vitest';

import { retailerLabel, unfurlLooksIncomplete, urlNeedsBrowser } from '@/lib/retailers';

describe('retailers', () => {
  it('flags big-box product hosts for browser unfurl', () => {
    expect(urlNeedsBrowser('https://www.amazon.com/dp/B00')).toBe(true);
    expect(urlNeedsBrowser('https://www.walmart.com/ip/123')).toBe(true);
    expect(urlNeedsBrowser('https://www.target.com/p/xyz')).toBe(true);
    expect(urlNeedsBrowser('https://shop.example/mug')).toBe(false);
  });

  it('labels retailers', () => {
    expect(retailerLabel('https://smile.amazon.com/x')).toBe('Amazon');
    expect(retailerLabel('https://www.walmart.com/x')).toBe('Walmart');
  });

  it('detects incomplete metadata', () => {
    expect(unfurlLooksIncomplete({ title: null, imageUrl: null, price: null })).toBe(true);
    expect(unfurlLooksIncomplete({ title: 'Mug', imageUrl: null, price: 10 })).toBe(false);
  });
});
