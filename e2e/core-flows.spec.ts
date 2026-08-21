import { expect, test } from '@playwright/test';

import { goTab, signUp, supabaseEnv, uniqueUser } from './helpers';

async function createUserViaApi(user: ReturnType<typeof uniqueUser>) {
  const { anon, api } = supabaseEnv();
  const signup = await fetch(`${api}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      data: { display_name: user.displayName, username: user.username },
    }),
  }).then((r) => r.json());
  const token = signup.access_token as string;
  const id = signup.user?.id as string;
  expect(token).toBeTruthy();
  expect(id).toBeTruthy();

  const profiles = await fetch(`${api}/rest/v1/profiles?id=eq.${id}&select=username,display_name`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  return {
    ...user,
    id,
    token,
    username: profiles[0]?.username as string,
    displayName: profiles[0]?.display_name as string,
  };
}

test.describe('UI verification — core flows', () => {
  test('create user, wishlist, items, groups, unfurl preview, remove item', async ({ page }) => {
    const { anon, api } = supabaseEnv();
    const owner = uniqueUser('owner');
    const friendSeed = uniqueUser('friend');
    const friend = await createUserViaApi(friendSeed);

    await signUp(page, owner);

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
    await page.getByTestId('remove-gift-Extra Candle').click();
    await expect(page.getByTestId('gift-title-Extra Candle')).toHaveCount(0);

    await goTab(page, 'Friends');
    await page.getByTestId('friend-search').click();
    await page.getByTestId('friend-search').pressSequentially(friend.username, { delay: 40 });
    await expect(page.getByTestId(`add-friend-${friend.username}`)).toBeVisible({ timeout: 15_000 });
    page.once('dialog', (d) => d.accept());
    await page.getByTestId(`add-friend-${friend.username}`).click();

    const pendingForFriend = await fetch(
      `${api}/rest/v1/friendships?status=eq.pending&select=id,requester_id`,
      { headers: { apikey: anon, Authorization: `Bearer ${friend.token}` } },
    ).then((r) => r.json());

    const toAccept = (pendingForFriend as { id: string; requester_id: string }[]).find(
      (f) => f.requester_id !== friend.id,
    );
    expect(toAccept).toBeTruthy();
    const acceptRes = await fetch(`${api}/rest/v1/friendships?id=eq.${toAccept!.id}`, {
      method: 'PATCH',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${friend.token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'accepted' }),
    });
    expect(acceptRes.ok).toBeTruthy();

    await page.reload();
    await goTab(page, 'Friends');
    await expect(page.getByTestId(`friend-row-${friend.username}`)).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('new-group-input').fill('Family');
    await page.getByTestId('create-group-button').click();
    await expect(page.getByTestId('group-card-Family')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('group-toggle-Family').click();
    await page.getByTestId(`add-member-Family-${friend.username}`).click();
    await expect(page.getByTestId(`remove-member-Family-${friend.username}`)).toBeVisible();
    await page.getByTestId(`remove-member-Family-${friend.username}`).click();
    await expect(page.getByTestId(`remove-member-Family-${friend.username}`)).toHaveCount(0);

    await goTab(page, 'Lists');
    await expect(page.getByTestId('wishlist-row-Birthday List')).toBeVisible();
  });
});
