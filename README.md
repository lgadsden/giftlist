# Giftlist

Mobile-first gift wishlist app (Expo + local Supabase). Design: sage + pink.

## Prerequisites

- Node 22+
- Docker Desktop running (for local Supabase)

## Setup

```bash
npm install
npx supabase start
cp .env.example .env   # or use the committed local defaults in .env
# Fill EXPO_PUBLIC_SUPABASE_ANON_KEY from: npx supabase status
npm run web
```

Studio: http://127.0.0.1:54323

## Run on web, iOS, and Android

Prerequisites: Docker (Supabase), Xcode Simulator (iOS), Android Studio emulator (Android).

```bash
npx supabase start
npm start
```

In the Expo terminal:
- press `i` for **iOS Simulator** (installs Expo Go if needed)
- press `a` for **Android emulator** (installs Expo Go if needed)
- press `w` for web

Or:

```bash
npm run ios
npm run android
npm run web
```

## Verification

```bash
npx supabase start          # local backend required for e2e
npm run typecheck
npm test                    # unit (domain + unfurl parser)
npm run test:e2e            # Playwright UI flows against Expo web
# or: npm run verify
```

UI e2e covers: sign up, create wishlist, add gifts, URL image preview (unfurl), remove gift, friend request, create group, add/remove group members.

**Android emulator storage:** if Expo Go install fails with `INSTALL_FAILED_INSUFFICIENT_STORAGE`, wipe the AVD once:

```bash
emulator -avd Medium_Phone_API_36.1 -wipe-data
```

**Android → local Supabase:** the app rewrites `127.0.0.1` → `10.0.2.2` automatically.

Physical devices: Expo Go + same Wi‑Fi; set `EXPO_PUBLIC_SUPABASE_URL` to your Mac’s LAN IP.


## v1 features in progress

Auth, friends/groups, wishlists + list sharing, manual gifts, secret reservations, affiliate click logging.

## Notes

- Google OAuth works after you add a client in Google Cloud and enable the provider in Supabase (local config or hosted).
- Affiliate Amazon tag is optional; Shop still opens URLs and logs clicks.
