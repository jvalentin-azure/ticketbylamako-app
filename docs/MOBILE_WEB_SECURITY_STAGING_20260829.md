# Mobile web security candidate — staging 2026-08-29

## Scope and decision boundary

- Code candidate: `11bf464` on `feat/client-mobile-web-20260827`.
- Included security commits: `d1f12e2`, `acc108f`, `c050b3a`, `11bf464`.
- Environment: `https://staging.ticketbylamako.com` only.
- Production is excluded.
- No real payment is permitted.
- The WordPress mono-writer must be acquired atomically before any remote write
  and removed in a verified postflight.

The candidate fixes the legacy purchasability/stock overrides and ticket lookup,
binds Rewards routes to the JWT user, makes redemption transactional and
idempotent, and fails Orange Mobile v2 closed until authenticated provider
verification is available.

## Reconciliation with the active staging variants

The active staging plugin files are not byte-identical to the repository
copies. The deployable PHP files were therefore merged from the files actually
active on staging instead of replacing them with the repository variants.

Preflight active SHA-256 values:

| Active staging file | SHA-256 |
|---|---|
| `wp-content/plugins/lamako-mobile-api/lamako-mobile-api/lamako-mobile-api.php` | `356C53B651B96F0363FA59F51290BAED6E40A3A7BB1234F46D7455C80A4756FE` |
| `wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php` | `E5C37320768DBB5F8DAA892CE4C2FA1979CA94338E9368E1FFB6548452E9B45C` |
| `wp-content/plugins/lamako-rewards-api.php` | `901F0051F6DF9B53BBA63E7FB99AFFD1BF10FFEBA3BE3DA962848BD20EDB3A75` |

All transaction tables required by Rewards (`posts`, `postmeta`, `options`,
`usermeta`, `myCRED_log`) were observed as InnoDB during the read-only preflight.

## Candidate artifacts

Local candidate directory:

`C:\Users\jona000044\Documents\Codex\staging-candidates\tbl-web-0827-11bf464`

| Candidate file | SHA-256 |
|---|---|
| merged `mobile/lamako-mobile-api.php` | `8A1C84F37EE33F667A977F1155D5FD32AC95021F2386C3B982A4E7FC70C8FBE1` |
| `mobile/includes/v2-commerce.php` | `05EC456384A6CDE0634F88980CA3248F57CFC271CFF2845B58E4F84FFC91DF92` |
| merged `rewards/lamako-rewards-api.php` | `DD504984290B78587FE7ECC00EE3B15B87F3B31C8860260FB2809886FE538351` |
| `qa/qa-staging-rewards-security.php` | `12E3CD4CF37824A8339CAB46C894C9B01ADC1E5DF8C4618422F0B7E698678DF0` |
| PHP/QA archive | `8A15F57633639FC9146713BF50D64D6259A76BEFEF3DE55B6F4BF1EC4CAD50AA` |
| staging web archive | `FC426D814FAE8D258042211FC96378E7D006FFFDC82EDF47845E1446634F4BFA` |
| web JavaScript entry | `5380D5853D9E82BA7DCB941B51069FFEDD18C31DDEE53C71D1A87F9409EF1EF9` |

The web bundle was produced with `pnpm export:web:staging`,
`EXPO_PUBLIC_SITE_URL=https://staging.ticketbylamako.com` and base path
`/mobile`.

## Exact staging targets

- `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/lamako-mobile-api.php`
- `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php`
- `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-rewards-api.php`
- `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/mobile/`

The active staging plugin `orange/papi-payment-for-woocommerce` must be disabled
for this qualification. Mobile v2 already hides Orange and rejects initiation;
disabling the legacy plugin also removes its unauthenticated state-changing
webhook from the staging test surface. Re-enabling it is the rollback for this
specific state change.

## Deployment and rollback invariants

1. Verify the mono-writer path is absent.
2. Acquire it atomically as `tbl-web-security-11bf464`.
3. Re-check every active preflight hash after lock acquisition.
4. Copy all active targets and the current `/mobile` directory into a private,
   timestamped manifest directory.
5. Upload to private temporary paths, verify hashes and PHP syntax, then use
   same-filesystem atomic renames for each public target.
6. Disable the Orange staging plugin and record its previous state.
7. Run public/API smokes, the Rewards security smoke and browser QA.
8. On any fatal, 5xx, cleanup failure, unexpected payment gateway or artifact
   hash mismatch, restore all backups and the previous Orange plugin state.
9. Verify target hashes, synthetic fixture cleanup and the absence of the lock.

Rollback restores the three backed-up PHP files and previous `/mobile`
directory atomically, reactivates Orange only if it was active before this lot,
runs PHP lint and non-destructive smokes, then purges only staging caches.

## Blocking staging tests

- WordPress desktop remains unchanged and `/mobile/` serves the new immutable
  entry bundle without console errors.
- Public mobile v2 catalog routes return HTTP 200.
- Private profile/orders/Rewards routes reject anonymous access.
- Legacy user-scoped Rewards routes reject API-key-only identity.
- A synthetic JWT user cannot claim another `user_id`.
- One synthetic redemption debits once, creates one email/user-bound coupon,
  returns the same coupon on replay, and rejects reuse of the key for another
  tier.
- The synthetic user, coupon, myCred log and idempotency option are removed in
  postflight.
- Orange is absent from enabled mobile methods, initiation fails closed and no
  Orange callback can complete, cancel or fail an order.
- No payment, order, ticket or seat is created by this lot.

## Local validation evidence

- Vitest: 350 passed, 4 intentionally skipped.
- Transactional AppSec guard suite: 5 passed.
- TypeScript typecheck: passed.
- Expo lint: passed.
- Mobile secret check: passed.
- PHP lint for the complete Mobile/Rewards plugin trees and all three merged
  candidates: passed.
- Staging web export: passed.

## Current decision

`GO under conditions` for a controlled staging deployment after the performance
lot releases the mono-writer. `NO-GO` for production and for re-enabling Orange
until the provider supplies an authenticated status-verification contract with
amount, currency, order-reference and replay validation.
