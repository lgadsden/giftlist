import { expect, test, type Browser, type Page } from '@playwright/test';

import { goTab, loadEnv, signUp, supabaseEnv, uniqueUser } from './helpers';

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

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/');
  await page.getByTestId('auth-email').fill(user.email);
  await page.getByTestId('auth-password').fill(user.password);
  await page.getByTestId('auth-submit').click();
  await expect(
    page.getByTestId('create-wishlist-fab').or(page.getByText('Giftlist').first()),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('Social, edit gift, claim', () => {
  test('accept friend in UI, invite claim, edit gift, claim + purchased', async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    loadEnv();
    const ownerUser = uniqueUser('owner');
    const friendUser = uniqueUser('friend');

    const ownerPage = await browser.newPage();
    const friendPage = await browser.newPage();

    await signUp(ownerPage, ownerUser);
    await signUp(friendPage, friendUser);

    // Owner sends friend request; friend accepts in UI
    await goTab(ownerPage, 'Friends');
    await ownerPage.getByTestId('friend-search').click();
    await ownerPage
      .getByTestId('friend-search')
      .pressSequentially(friendUser.username, { delay: 40 });
    await expect(ownerPage.getByTestId(`add-friend-${friendUser.username}`)).toBeVisible({
      timeout: 15_000,
    });
    await ownerPage.getByTestId(`add-friend-${friendUser.username}`).click();

    await goTab(friendPage, 'Friends');
    await expect(friendPage.getByTestId(`accept-friend-${ownerUser.username}`)).toBeVisible({
      timeout: 20_000,
    });
    await friendPage.getByTestId(`accept-friend-${ownerUser.username}`).click();
    await expect(friendPage.getByTestId(`friend-row-${ownerUser.username}`)).toBeVisible({
      timeout: 15_000,
    });

    await goTab(ownerPage, 'Friends');
    await ownerPage.reload();
    await goTab(ownerPage, 'Friends');
    await expect(ownerPage.getByTestId(`friend-row-${friendUser.username}`)).toBeVisible({
      timeout: 20_000,
    });

    // Invite link claim with a third user (Alert.alert is a no-op on web)
    await ownerPage.getByTestId('copy-invite-link').click();
    await expect(ownerPage.getByTestId('invite-url')).toBeVisible({ timeout: 10_000 });
    const inviteUrl = await ownerPage.getByTestId('invite-url').innerText();
    const tokenMatch = inviteUrl.match(/invite\/([a-f0-9]+)/i);
    expect(tokenMatch?.[1]).toBeTruthy();
    const inviteToken = tokenMatch![1];

    const invitee = await createUserViaApi(uniqueUser('invitee'));
    const inviteePage = await browser.newPage();
    await signIn(inviteePage, invitee);
    await inviteePage.goto(`/invite/${inviteToken}`);
    await expect(inviteePage.getByTestId('invite-claim-success')).toBeVisible({ timeout: 20_000 });
    await inviteePage.getByTestId('invite-go-friends').click();
    await expect(inviteePage.getByTestId(`friend-row-${ownerUser.username}`)).toBeVisible({
      timeout: 15_000,
    });

    // Owner creates shared wishlist with gift, edits it
    await goTab(ownerPage, 'Home');
    await ownerPage.getByTestId('create-wishlist-fab').click();
    await ownerPage.getByTestId('wishlist-title-input').fill('Shared Birthday');
    await expect(ownerPage.getByTestId(`share-friend-${friendUser.displayName}`)).toBeVisible({
      timeout: 15_000,
    });
    await ownerPage.getByTestId(`share-friend-${friendUser.displayName}`).click();
    await ownerPage.getByTestId('create-wishlist-submit').click();
    await expect(ownerPage.getByText('Shared Birthday')).toBeVisible({ timeout: 20_000 });

    await ownerPage.getByTestId('open-add-gift').click();
    await ownerPage.getByTestId('manual-gift-button').click();
    await ownerPage.getByTestId('gift-title-input').fill('Cozy Socks');
    await ownerPage.getByTestId('gift-price-input').fill('18');
    await ownerPage.getByTestId('gift-priority-high').click();
    await ownerPage.getByTestId('gift-notes-input').fill('Size M');
    await ownerPage.getByTestId('add-gift-button').click();
    await expect(ownerPage.getByTestId('gift-title-Cozy Socks')).toBeVisible();
    await expect(ownerPage.getByTestId('gift-priority-Cozy Socks')).toContainText('High');

    await ownerPage.getByTestId('gift-menu-Cozy Socks').click();
    await ownerPage.getByTestId('gift-menu-edit').click();
    await expect(ownerPage.getByTestId('edit-gift-sheet')).toBeVisible();
    await ownerPage.getByTestId('gift-title-input').fill('Cozy Wool Socks');
    await ownerPage.getByTestId('gift-price-input').fill('22.50');
    await ownerPage.getByTestId('gift-notes-input').fill('Size L preferred');
    await ownerPage.getByTestId('save-gift-button').click();
    await expect(ownerPage.getByTestId('gift-title-Cozy Wool Socks')).toBeVisible();
    await expect(ownerPage.getByTestId('gift-price-Cozy Wool Socks')).toHaveText('$22.50');

    // Friend opens owner's wishlist via Friends → View Wishlist
    await goTab(friendPage, 'Friends');
    await friendPage.reload();
    await goTab(friendPage, 'Friends');
    await expect(friendPage.getByTestId(`view-wishlist-${ownerUser.username}`)).toBeVisible({
      timeout: 20_000,
    });
    await friendPage.getByTestId(`view-wishlist-${ownerUser.username}`).click();
    await expect(friendPage.getByTestId('friend-wishlist-row-Shared Birthday')).toBeVisible({
      timeout: 20_000,
    });
    await friendPage.getByTestId('friend-wishlist-row-Shared Birthday').click();
    await expect(friendPage.getByTestId('gift-title-Cozy Wool Socks')).toBeVisible({
      timeout: 15_000,
    });
    await friendPage.getByTestId('claim-gift-Cozy Wool Socks').click();
    await expect(friendPage.getByTestId('claim-gift-sheet')).toBeVisible();
    await friendPage.getByTestId('claim-visibility-secret').click();
    await friendPage.getByTestId('confirm-claim-gift').click();
    await expect(friendPage.getByTestId('gift-status-Cozy Wool Socks')).toContainText(/claimed/i, {
      timeout: 15_000,
    });
    await friendPage.getByTestId('mark-purchased-Cozy Wool Socks').click();
    await expect(friendPage.getByTestId('gift-status-Cozy Wool Socks')).toContainText(/purchased/i);

    await ownerPage.reload();
    await expect(ownerPage.getByTestId('gift-status-Cozy Wool Socks')).toBeVisible({
      timeout: 15_000,
    });

    await ownerPage.close();
    await friendPage.close();
    await inviteePage.close();
  });
});
