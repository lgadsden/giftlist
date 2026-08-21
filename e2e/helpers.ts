import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

/** Load EXPO_PUBLIC_* from .env into process.env if missing. */
export function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2] ?? '';
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // CI may inject env another way
  }
}

export function uniqueUser(prefix: string) {
  const stamp = Date.now().toString(36);
  return {
    email: `${prefix}.${stamp}@example.com`,
    password: 'Password123!',
    displayName: `${prefix} ${stamp}`,
    username: `${prefix}${stamp}`.replace(/[^a-z0-9]/gi, '').slice(0, 24).toLowerCase(),
  };
}

export async function signUp(page: Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto('/');
  await page.getByTestId('auth-toggle-mode').click();
  await page.getByTestId('auth-display-name').fill(user.displayName);
  await page.getByTestId('auth-email').fill(user.email);
  await page.getByTestId('auth-password').fill(user.password);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('create-wishlist-fab').or(page.getByText('Giftlist').first())).toBeVisible({
    timeout: 30_000,
  });
}

export async function goTab(page: Page, name: 'Home' | 'Lists' | 'Friends' | 'Profile') {
  // Wishlist detail is a stack screen — leave it before switching tabs.
  const back = page.getByRole('link', { name: /back/i }).or(page.getByRole('button', { name: /back/i }));
  if (await back.first().isVisible().catch(() => false)) {
    await back.first().click();
    await page.getByTestId('create-wishlist-fab').waitFor({ state: 'visible', timeout: 10_000 });
  }

  const tab = page.getByRole('tab', { name });
  if ((await tab.count()) > 0 && (await tab.first().isVisible().catch(() => false))) {
    await tab.first().click();
    return;
  }

  await page.getByRole('link', { name }).or(page.getByText(name, { exact: true })).last().click();
}

export function supabaseEnv() {
  loadEnv();
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const api = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  if (!anon) throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required for e2e helpers');
  return { anon, api };
}
