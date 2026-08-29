# Orange Money shared gateway — staging 2026-08-29

## Scope

- Code candidate: `9f980a60b7772aeb33adc5de7feb076f076a0f5d`.
- Branch: `feat/client-mobile-web-20260827`.
- Environment: `https://staging.ticketbylamako.com` only.
- Production is excluded.
- No OTP, payment submission, paid order, ticket issuance or stock mutation is
  permitted during this qualification.

The WordPress web checkout and Lamako Mobile v2 now use the same Orange gateway.
Mobile v2 no longer owns an independent Orange API client or stores raw
`pay_token`/`notif_token` values. It invokes the shared WooCommerce gateway and
uses the canonical `/wp-json/papi/v1/webhook` callback.

## Security model

The installed Orange merchant contract returns a high-entropy `notif_token`
during a server-authenticated transaction initiation. The callback is therefore
authenticated as a bearer capability tied to exactly one order. The guard adds:

- HMAC storage for notification and payment tokens; raw values are removed;
- an immutable initiation snapshot for amount, currency and request reference;
- a two-hour maximum callback window;
- per-token and global callback rate limits;
- a cross-process MySQL named lock around each order transition;
- callback fingerprinting and idempotent replay responses;
- rejection of amount, currency, reference and current-order mismatches;
- rejection of any downgrade after payment;
- rejection of late success after failed/cancelled/refunded states, avoiding
  ticket issuance after stock restoration;
- a stable initiation reference after uncertain HTTP outcomes, avoiding two
  provider transactions for one WooCommerce order;
- generic logs with request/order identifiers and no token or provider payload;
- a host/credential-environment gate: staging requires the explicit `test`
  credential class and the public production domains require `production`;
- WooCommerce `payment_complete()` as the sole successful transition, without
  forcing `completed` and without manually restoring stock twice.

Compatibility with already-started legacy orders is restricted to orders less
than two hours old. Their raw notification token is HMACed and deleted on first
accepted callback.

## Residual risk and decision boundary

The public Orange material available for this integration does not document a
separate callback signature or a transaction-status read API. When callback
payloads omit amount/currency/reference, those values cannot be re-read from the
provider; the proof is possession of the transaction-specific notification
token returned by the authenticated initiation.

This is materially safer than the production v3.2 plugin because new tokens are
not logged, written to order notes or retained in raw order metadata, and because
replay, expiry and order invariants are enforced. A future Orange contract that
provides HMAC signatures or authenticated status lookup should be added as a
second verification factor. Production promotion still requires explicit user
authorization and one controlled real-payment E2E with reconciliation.

## Candidate artifacts

| File | SHA-256 |
|---|---|
| `scripts/tbl-orange-callback-guard.php` | `BE007BB6D7073A491BFCA5353BA2B83552F1571ACD9A4276CB90B94B23C0A7CE` |
| `scripts/lamako-mobile-api/includes/v2-commerce.php` | `4417AA27E7A39A99769E667268B406354DEABE32BBBD05E28E5D9A27EE4F53FA` |
| `scripts/qa-staging-orange-security.php` | `794D89413D625A74402125641429012B5CDC2C36D95960FE31406566B4F4778C` |
| `scripts/qa-staging-orange-structural.php` | `8C80ABDF75B2D16D1F426A0FBB1003C16D0649EE6A50E4B58FB47F41608DC792` |
| `tests/php/orange-callback-guard-harness.php` | `486FB981C00D295F04C0407625EA910E25BB78527C58433F7631686F55379361` |

## Exact staging targets and order

1. `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/mu-plugins/tbl-orange-callback-guard.php`
2. `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/v2-commerce.php`

The guard must be deployed first. Until both files are active and the hardened
gateway configuration passes, Mobile v2 hides Orange and rejects initiation.
The QA script is copied only into the private deployment manifest and executed
with WP-CLI; it is never a public application file.

## Staging qualification

Before write:

1. verify the shared mono-writer directory is absent;
2. acquire it atomically as `tbl-orange-shared-9f980a6`;
3. recompute both active target hashes under the lock;
4. snapshot the targets in a timestamped private manifest;
5. upload private temporary candidates, verify SHA-256 and PHP lint;
6. atomically replace the guard, then Mobile v2.

Blocking QA:

- before any provider initiation, independently confirm that the staging
  credentials are test/non-production and set both one-shot QA environment
  gates; if that cannot be proven, do not call Orange and keep the provider
  initiation test blocked;
- always run the separate structural WP-CLI smoke, which verifies the active
  class, configuration readiness, canonical routes and Mobile v2 exposure with
  zero provider calls and zero WordPress writes;
- with no independently confirmed test credentials, the expected staging result
  is `fail-closed`: Orange absent from Mobile v2 and `process_payment()` blocked;
- MU-plugin version is `1.1.0` and the active gateway class is
  `TBL_Secure_Orange_Gateway`;
- gateway configuration readiness passes without displaying credentials;
- Mobile v2 lists Orange only while that hardened gateway is active;
- legacy Mobile v2 callback delegates to the canonical secure callback;
- a fee-only synthetic order receives an HTTPS payment URL without opening it;
- the synthetic order contains only token hashes, expected amount `100`,
  currency `MGA`, request reference and expiry; it remains unpaid;
- the synthetic order is permanently removed in `finally`;
- total WooCommerce order count returns to its exact pre-test value;
- no product line, stock, ticket, seat, user, coupon or real payment is created;
- public site and Mobile v2 method/status routes have no new 5xx;
- active hashes equal the candidate and the mono-writer is absent postflight.

Rollback restores both private snapshots in reverse order, lints them, verifies
their original hashes and re-runs the read-only route/gateway checks. The
synthetic provider payment URL is never opened and expires at Orange.

## Local validation

- PHP lint: shared guard, Mobile v2, staging QA and callback harness passed.
- Callback behavior harness: success, idempotent success replay, paid downgrade,
  amount mismatch, expiry, failed-to-success resurrection, legacy migration and
  unknown token passed.
- TypeScript: `pnpm check` passed.
- Expo lint: `pnpm lint` passed.
- Vitest: 351 passed, 4 intentionally skipped before adding the final Orange QA
  static assertion; focused transactional suite then passed 6/6.

## Staging result

Qualified on staging in fail-closed mode on 2026-08-29. Production was not
touched.

- Active guard SHA-256:
  `BE007BB6D7073A491BFCA5353BA2B83552F1571ACD9A4276CB90B94B23C0A7CE`.
- Active Mobile v2 SHA-256:
  `4417AA27E7A39A99769E667268B406354DEABE32BBBD05E28E5D9A27EE4F53FA`.
- Private manifest:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-orange-shared-20260829T111411Z-3873fd3/`.
- SHA-256 of `manifest.sha256`:
  `7FC63278E750BB9C13F4DD26689C88E8BCCF5D012B01CE9C7D0C2FFCDCB8F5AB`.
- Structural WP-CLI smoke passed guard `1.1.0`, hardened gateway class,
  canonical callbacks and `readiness=fail-closed`; provider calls and
  WordPress writes were both zero.
- Staging consumer/merchant credentials were present but byte-identical to the
  production configuration, the endpoints were the production
  `api.orange.com` endpoints, and the credential environment was unconfigured.
  Provider QA was therefore blocked and no transaction URL was requested.
- Orange remained absent from Mobile v2 methods. The legacy Orange plugin
  remained inactive.
- HPOS orders stayed `1843 -> 1843`; legacy orders stayed `715 -> 715`.
  Initiation markers created since deploy were `0` in both stores.
- Public site, `/mobile/`, Mobile v2 home/shop data and REST index returned
  HTTP 200.
- Neighboring Mobile main, Rewards and Breeze guard hashes remained unchanged.
- PHP lint passed and the recent relevant error-log window contained no Orange,
  parse, uncaught or fatal entry.
- Rollback snapshots `guard-before.php` and `v2-before.php` are retained in the
  private manifest.
- The mono-writer was removed and independently verified absent after
  postflight.

This result is `GO` for the deployed staging fail-closed guard and shared-code
integration. It is not a functional Orange payment E2E. Enabling staging still
requires separate test credentials plus `TBL_ORANGE_PAYMENT_ENVIRONMENT=test`.
Production promotion requires explicit authorization, a production environment
gate, controlled real-payment E2E and reconciliation.
