# TicketByLamako Phase 0/1 Rollout Notes

Status: local implementation scaffold only. Do not deploy to production until manual WordPress checks and app QA are complete.

## Phase 0 guardrails

- Keep the legacy `lamako-mobile/v1` routes active during migration.
- Add new `lamako-mobile/v2` routes beside v1 instead of replacing v1.
- Do not expose WooCommerce consumer secrets, JWT secrets, or rewards API keys in Expo public variables.
- Do not switch mobile screens to v2 until the v2 plugin is deployed and verified on staging/production.
- Keep native browsing/cart UX for WooCommerce products and non-seated Tickera Bridge ticket products.
- Keep seated ticket selection in WordPress/Tickera WebView; do not rebuild seating charts natively.

## Phase 1 scope

Implemented locally:

- JWT-authenticated v2 checkout creation for native cart items.
- Server-side validation for product publication, stock, ticket event linkage, Tickera sales availability, and seating exclusion.
- Short-lived checkout token that maps to a WooCommerce pending order without returning the WooCommerce order key to the app.
- Checkout status endpoint that requires the authenticated order owner.
- User-owned order and ticket endpoints.
- JWT-authenticated push token endpoint.
- JWT-authenticated rewards balance/history/redeem/referral endpoints as the target replacement for public rewards API keys.
- Mobile TypeScript API client for the new v2 routes.

## Phase 2 scope

Implemented locally:

- Native cart checkout now uses `lamako-mobile/v2/checkouts` for WooCommerce products and non-seated Tickera Bridge ticket products.
- The old `EXPO_PUBLIC_ENABLE_MOBILE_V2_COMMERCE=false` app rollback switch has been removed; checkout is v2-only in current app builds.
- Checkout no longer treats a WebView success URL or `postMessage` as final when v2 is enabled. It calls the v2 checkout status endpoint before showing success.
- Native checkout blocks cart items with `seatLabel`, because numbered seats must go through the dedicated seating chart WebView flow.
- Local cart clearing no longer calls the legacy v1 server cart clear endpoint. Explicit server-side seat cleanup remains isolated to the current seating flow until Phase 3 replaces it.

## Phase 3 scope

Implemented locally:

- Added `POST /wp-json/lamako-mobile/v2/seating-sessions` to create short-lived seating flow tokens over JWT.
- Added `GET /wp-json/lamako-mobile/v2/seating-sessions/{token}/status` so the app can verify seated payment results server-side.
- Added `/lamako-mobile/seat/{token}` as a plugin-rendered clean seating page that sets the WordPress/WooCommerce WebView session without placing the JWT in the URL.
- Seating orders created during that WebView session are marked with `_lamako_mobile_v2`, `_lamako_checkout_source=seating`, event/chart IDs, and the seating flow hash.
- Added `components/seating/SeatPurchaseFlow.tsx` and switched seated event CTAs to v2 by default.
- `EXPO_PUBLIC_ENABLE_MOBILE_V2_SEATING=false` remains as a temporary rollback switch to the legacy event-page/auto-login seating WebView.

Deferred to later phases:

- Removing v1 routes and legacy WooCommerce consumer key paths after migration.

## Phase 4 scope

Implemented locally:

- Added plugin-rendered v2 payment return pages:
  - `/lamako-mobile/payment-return/{token}?kind=checkout|seating`
  - `/lamako-mobile/payment-failed/{token}?kind=checkout|seating`
  - `/lamako-mobile/payment-cancel/{token}?kind=checkout|seating`
- Added `GET /wp-json/lamako-mobile/v2/payment-return/{token}/status?kind=checkout|seating` as the authenticated server verification endpoint used by the native return screen.
- v2 native checkout WebView sessions now set a short-lived `lamako_mobile_checkout_token` cookie so WooCommerce gateway return URLs can be mapped back to the v2 checkout token without exposing the WooCommerce order key to the app.
- v2 seating WebView sessions continue to use `lamako_mobile_seat_flow`; seating gateway returns are mapped back to the same seating flow token when possible.
- WooCommerce return and cancel URLs are overridden only for orders marked `_lamako_mobile_v2=yes`.
- The return page posts the standard `lamako-mobile-web` WebView envelope, then attempts the stable deep link `ticketbylamako://payment-return?kind=...&token=...&status=...`.
- Added `app/payment-return.tsx`, which verifies checkout/seating status through authenticated v2 REST endpoints before showing success, pending, or failure.
- Native checkout and seating WebViews intercept both `/lamako-mobile/payment-*` URLs and `ticketbylamako://payment-return` links and route them to the verified native return screen.
- `app.config.ts` now uses the stable app scheme `ticketbylamako` with an Android payment-return intent filter.

## Phase 5 scope

Implemented locally:

- Customer order list, order detail, ticket detail, and the tickets tab now use JWT-authenticated `lamako-mobile/v2` order/ticket endpoints instead of client-side WooCommerce REST credentials.
- v2 order summaries now include line items, billing, totals, payment metadata, transaction ID, and customer note for the authenticated owner only.
- v2 ticket responses now include ticket price plus event date/location fields for QR ticket rendering.
- Added `lib/order-adapters.ts` so existing order/ticket UI can render v2 payloads without returning to the legacy WooCommerce key path.
- Rewards balance, history, redemption, referral code, referral validation, and referral registration now use `lamako-mobile/v2` through WordPress JWT.
- Added v2 referral endpoints:
  - `POST /wp-json/lamako-mobile/v2/referral/validate`
  - `POST /wp-json/lamako-mobile/v2/referral/register`
- Push token registration now uses `POST /wp-json/lamako-mobile/v2/push-token`; the app no longer sends a client-selected user ID for push ownership.
- Added icon mappings used by rewards and order status screens.

## Phase 6 scope

Implemented locally:

- Added `eas.json` with development, preview, and production build profiles using v2 commerce and seating flags.
- Added `scripts/check-mobile-secrets.mjs` to block mobile builds when deprecated public WooCommerce/JWT/rewards secrets are present in `.env` or the build environment.
- Added `check:mobile-secrets`, `qa:mobile`, and `eas-build-pre-install` package scripts so the secret guard runs locally and during EAS builds.
- Added `docs/phase-6-mobile-qa.md` with the iOS/Android QA matrix, EAS commands, WordPress cache checks, and acceptance criteria.

## Phase 7 scope

Implemented locally:

- Added public read-only v2 endpoints for native browse surfaces:
  - `GET /wp-json/lamako-mobile/v2/public/home-data`
  - `GET /wp-json/lamako-mobile/v2/public/events-data`
  - `GET /wp-json/lamako-mobile/v2/public/shop-data`
  - `GET /wp-json/lamako-mobile/v2/public/products/{product_id}`
- Native home, events, search, shop, and product detail data now prefer v2 public endpoints that do not require WooCommerce consumer credentials.
- Added `lib/api/catalog.ts` as the native catalog facade and moved home/events/shop/event detail/product detail/search imports away from the legacy WooCommerce module.
- Legacy WooCommerce REST reads remain only as fallback paths when legacy credentials are explicitly present, which production mobile builds now block through `check:mobile-secrets`.

## Cache and security requirements before deploy

Exclude these from page cache and CDN cache:

- `/wp-json/lamako-mobile/v2/*`
- `/lamako-mobile/seat/*`
- `/lamako-mobile/payment-return/*`
- `/lamako-mobile/payment-failed/*`
- `/lamako-mobile/payment-cancel/*`
- `/?lamako_checkout_token=*`
- `/?lamako_checkout=1*`
- future `/lamako-mobile/*` virtual pages

Rotate and remove from mobile build configuration:

- `EXPO_PUBLIC_WC_CONSUMER_SECRET`
- `EXPO_PUBLIC_JWT_SECRET`
- `EXPO_PUBLIC_REWARDS_API_KEY`

Keep secrets only in WordPress/server configuration:

- WooCommerce REST consumer secret, if a server-side integration still needs it.
- JWT auth secret in WordPress configuration.
- Rewards internal API key, if legacy rewards v1 remains temporarily active.

## Rollback

If v2 deployment fails:

- Roll back to the previous app build or restore the pre-v2 checkout screen from source control.
- Keep legacy v1 plugin routes available until all commerce lanes have passed production QA.
- Remove or comment the v2 include from `scripts/lamako-mobile-api/lamako-mobile-api.php` only if the plugin itself causes server errors.
- Do not delete legacy v1 routes until all commerce lanes have passed production QA.
