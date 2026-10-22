import { expect, test } from '@playwright/test';

import { goTab, signUp, uniqueUser } from './helpers';

test.describe('UI verification — core flows', () => {
  test('create user, wishlist, items, groups, unfurl preview, remove item', async ({
    browser,
  }) => {
    const owner = uniqueUser('owner');
    const friendSeed = uniqueUser('friend');

    const page = await browser.newPage();
    const friendPage = await browser.newPage();

    await signUp(page, owner);
    await signUp(friendPage, friendSeed);

    await page.route('**/functions/v1/unfurl', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Scraped Gift Title',
          imageUrl: 'https://placehold.co/200x200/png',
          description: 'From Open Graph',
          price: 24.99,
        }),
      });
    });

    await goTab(page, 'Home');
    await page.getByTestId('create-wishlist-fab').click();
    await page.getByTestId('wishlist-title-input').fill('Birthday List');
    await page.getByTestId('create-wishlist-submit').click();
    await expect(page.getByText('Birthday List')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('open-add-gift').click();
    await page.getByTestId('gift-url-input').fill('https://shop.example/item/cozy-mug');
    await page.getByTestId('fetch-gift-button').click();
    await expect(page.getByTestId('gift-preview-image')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gift-title-input')).toHaveValue('Scraped Gift Title');
    await page.getByTestId('gift-price-input').fill('24.99');
    await page.getByTestId('add-gift-button').click();
    await expect(page.getByTestId('gift-title-Scraped Gift Title')).toBeVisible();

    await page.getByTestId('open-add-gift').click();
    await page.getByTestId('manual-gift-button').click();
    await page.getByTestId('gift-title-input').fill('Extra Candle');
    await page.getByTestId('add-gift-button').click();
    await expect(page.getByTestId('gift-title-Extra Candle')).toBeVisible();
    await page.getByTestId('gift-menu-Extra Candle').click();
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByTestId('gift-menu-delete').click();
    await expect(page.getByTestId('gift-title-Extra Candle')).toHaveCount(0);

    await goTab(page, 'Friends');
    await page.getByTestId('friend-search').click();
    await page.getByTestId('friend-search').pressSequentially(friendSeed.username, { delay: 40 });
    await expect(page.getByTestId(`add-friend-${friendSeed.username}`)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId(`add-friend-${friendSeed.username}`).click();

    await goTab(friendPage, 'Friends');
    await expect(friendPage.getByTestId(`accept-friend-${owner.username}`)).toBeVisible({
      timeout: 20_000,
    });
    await friendPage.getByTestId(`accept-friend-${owner.username}`).click();
    await expect(friendPage.getByTestId(`friend-row-${owner.username}`)).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await goTab(page, 'Friends');
    await expect(page.getByTestId(`friend-row-${friendSeed.username}`)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId('new-group-input').fill('Family');
    await page.getByTestId('create-group-button').click();
    await expect(page.getByTestId('group-card-Family')).toBeVisible({ timeout: 15_000 });
    // createGroup auto-expands; only toggle if the members panel is hidden
    if (!(await page.getByTestId('group-members-Family').isVisible().catch(() => false))) {
      await page.getByTestId('group-toggle-Family').click();
    }
    await expect(page.getByTestId(`add-member-Family-${friendSeed.username}`)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId(`add-member-Family-${friendSeed.username}`).click();
    await expect(page.getByTestId(`remove-member-Family-${friendSeed.username}`)).toBeVisible();
    await page.getByTestId(`remove-member-Family-${friendSeed.username}`).click();
    await expect(page.getByTestId(`remove-member-Family-${friendSeed.username}`)).toHaveCount(0);

    await goTab(page, 'Lists');
    await expect(page.getByTestId('wishlist-row-Birthday List')).toBeVisible();

    await page.close();
    await friendPage.close();
  });
});
