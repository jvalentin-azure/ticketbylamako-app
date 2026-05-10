# Phase 6 Mobile QA and Build Readiness

Status: local build-readiness updates only. Run this after deploying the v2 WordPress plugin to staging or production.

## Build Profiles

`eas.json` defines three profiles:

- `development`: internal development client with v2 commerce and seating enabled.
- `preview`: internal QA build, Android APK, v2 commerce and seating enabled.
- `production`: store build with auto-incremented version, v2 commerce and seating enabled.

Before submission, verify the App Store bundle ID and Google Play package in `app.config.ts`. Do not change an existing production package ID unless the store listing is being migrated intentionally.

## Required Commands

Run locally before EAS:

```bash
pnpm install
pnpm check:mobile-secrets
pnpm check
pnpm test
pnpm lint
```

Run EAS QA builds:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

Run production builds only after manual QA passes:

```bash
eas build --profile production --platform all
```

## Secret Guard

`pnpm check:mobile-secrets` fails if any of these variables are present in `.env` or the build environment:

- `EXPO_PUBLIC_WC_CONSUMER_KEY`
- `EXPO_PUBLIC_WC_CONSUMER_SECRET`
- `EXPO_PUBLIC_JWT_SECRET`
- `EXPO_PUBLIC_REWARDS_API_KEY`

The same check runs during EAS through `eas-build-pre-install`.

## Manual QA Matrix

Test on one recent iOS device and one recent Android device:

- Login with email/password.
- Login/register through configured social providers.
- Browse events.
- Browse physical/simple products.
- Add a WooCommerce product to native cart.
- Add a non-seated Tickera Bridge ticket to native cart.
- Start native checkout from cart.
- Complete a successful payment and verify the native return screen waits for server status.
- Cancel payment and verify the order is not shown as successful.
- Simulate or observe pending payment and verify the pending state.
- Open orders list and order detail after payment.
- Open tickets tab and QR ticket detail after a ticket order.
- Open rewards balance/history/referral code.
- Redeem rewards points during checkout if balance allows.
- Register push token after login and verify no client-selected user ID is sent.
- Start seated event flow.
- Select one seat.
- Select multiple seats.
- Attempt sold/unavailable seats.
- Complete seated checkout in the same WebView session.
- Verify seated payment return through native status endpoint.
- Cold start the app from `ticketbylamako://payment-return?kind=checkout&token=TEST`.
- Cold start the app from a real gateway return page.

## WordPress Checks Before QA

Verify these are not cached by page cache or CDN:

- `/wp-json/lamako-mobile/v2/*`
- `/lamako-mobile/seat/*`
- `/lamako-mobile/payment-return/*`
- `/lamako-mobile/payment-failed/*`
- `/lamako-mobile/payment-cancel/*`
- `/?lamako_checkout_token=*`

Verify gateway return URLs resolve to the plugin-rendered mobile return pages for `_lamako_mobile_v2=yes` orders.

## Acceptance Criteria

- Preview builds install on iOS and Android.
- No EAS build contains deprecated public WooCommerce/JWT/rewards secrets.
- Native product checkout succeeds and returns to the app only after server verification.
- Non-seated Tickera Bridge checkout succeeds and produces tickets visible in the app and web account.
- Seated checkout preserves the same WebView/WooCommerce session from seat selection through payment.
- Failed, cancelled, pending, and success payment states are displayed distinctly.
- Orders, tickets, rewards, and referral state match between mobile and WordPress account pages.
