# Mobile router staging R2 protocol

## Decision and authority

Status: **READY_FOR_READ_ONLY_PREFLIGHT_AFTER_POS**.

This document does not authorize a lock, upload, flag change, cache change or
retry. The POS staging window has priority under owner
`tbl-pos-dashboard-job-v2-staging-20260830T113519Z-976eaf1`. R2 may perform its
fresh read-only preflight only after the POS postflight proves its own rollback
or active state, business invariants and independent absence of the staging
mono-writer. Acquisition and writes then require a separate explicit R2 GO.

No remote preflight was run while preparing this protocol: it would be stale
before the POS postflight. All hashes below are expected baselines restored and
sealed by R1, not a claim about the future preflight state.

## Immutable inputs and fresh names

- Application/router source commit:
  `8d1cb2b94e4f1b886494991bc3c3cb9f83e739f3`
- QA tooling commit:
  `e82933e354056c8df5347dcbaa758fde887d1b0f`
- Router candidate SHA-256:
  `85283d8fe9a8e10b57d6691e0f21b440f506dfa4e129b6ae132fb0acc2ea389f`
- Expected `wp-config.php` candidate SHA-256:
  `58ef28151966c341a2bdd58642a0230088d79c52bb17285bd4b0c9b477cd21fd`
- Proposed owner, not yet created:
  `tbl-mobile-router-staging-e82933e-r2`
- Proposed manifest basename, not yet created:
  `tbl-mobile-router-staging-20260830T113645Z-e82933e-r2`
- Shared lock:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/.mono-writer.lock/`
- Proposed private manifest:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-mobile-router-staging-20260830T113645Z-e82933e-r2/`

All R2 paths must be absent during the fresh preflight. They must not reuse any
R1 file or directory.

## Exclusive targets and fresh siblings

Application root:
`/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html`

Router target:
`/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/mobile-web-router.php`

Router next and rollback siblings:

- `.../includes/.tbl-mobile-web-router-next-e82933e-r2.php`
- `.../includes/.tbl-mobile-web-router-rollback-e82933e-r2.php`

Configuration target:
`/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-config.php`

Configuration next and rollback siblings:

- `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.tbl-mobile-routing-config-next-e82933e-r2.php`
- `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.tbl-mobile-routing-config-rollback-e82933e-r2.php`

Exact root Breeze cache target:
`/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/cache/breeze/2d9cc3f7bf1acaa66f61a623a9977b6fbd078a731059e5f513ff635ea73db9ce/c4930403fd08fe6dd1053784a5926f5928f4143207978d20f502360a038b2e27.html`

Cache rollback sibling:
`.../2d9cc3f7bf1acaa66f61a623a9977b6fbd078a731059e5f513ff635ea73db9ce/.tbl-mobile-root-cache-rollback-e82933e-r2.html`

Private mode-600 snapshots:

- `snapshot/mobile-web-router.php.before`
- `snapshot/wp-config.php.before`
- `snapshot/root-cache.html.before`
- `snapshot/baseline.sha256`
- `snapshot/stat.txt`

No PHP file other than the router and `wp-config.php` is in scope. No other
cache object is in scope.

## Expected baseline to revalidate

| Surface                                                                                             | Expected SHA-256                                                   | Expected owner/mode              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| Router                                                                                              | `5733800c463340be519e9661c6851e447ef617983df861b0a1d398dda7f92232` | `master_nqpwygdfqp:www-data:644` |
| `wp-config.php`                                                                                     | `3e1b6e68874f3784e35df8944a9e96eef82f318736eaa3c4ad010e3290f46227` | `master_nqpwygdfqp:www-data:664` |
| Root Breeze cache                                                                                   | `d96488e62537b1ec9465610ab8a6f1cfcee68b06a527da9546865f8f1b15a750` | `wvvtwdcenn:www-data:664`        |
| Mobile v2 commerce neighbor                                                                         | `4417aa27e7a39a99769e667268b406354deabe32bbbd05e28e5d9a27ee4f53fa` | revalidate without modification  |
| Active Mobile API bootstrap neighbor (`wp-content/plugins/lamako-mobile-api/lamako-mobile-api.php`) | `0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11` | revalidate without modification  |
| REST/cookie MU guard neighbor                                                                       | `ebed8d97dd9336dc6332844fc43ef417db1eb929f344d1f15c950f559a32d06e` | revalidate without modification  |

Both mobile routing flags must still be absent before R2. The expected
candidate configuration adds only:

```php
define( 'LAMAKO_MOBILE_WEB_ENABLED', true );
define( 'LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT', 100 );
```

Expected business invariants are orders `715 / max 13357`, HPOS
`1843 / max 14547`, and product `13845` stock `46`. They are reference values
only; the fresh preflight must reconcile any natural drift with the POS
postflight and stop on unexplained divergence.

## Fresh read-only preflight after POS

The preflight must not create a manifest, sibling or lock.

1. Record the exact POS candidate, final active or rollback state, postflight
   manifest hash and independent lock-absence proof.
2. Observe the shared lock as absent through master and a second application
   SFTP connection. Fingerprint the deployment directory and verify every R2
   path above is absent.
3. Rehash and stat the router, configuration, exact root cache and all three
   neighbors. Prove both routing flags remain absent without disclosing any
   configuration value or secret.
4. Reconcile order, HPOS and stock counters with the POS postflight. Perform no
   stateful manager request and no mutation.
5. Prove the application credential can list/read `public_html` and
   `private_html/tbl-deploy`; use master only for read-only hashes, stats and
   later owner-preserving swaps. Do not test write access.
6. Capture GET/HEAD/OPTIONS baselines for iPhone root, desktop root,
   `/mobile/`, the event/shop deep links, `/paiement/`, `/checkout/`,
   `/checkout-2/`, admin/login and public callback routes. Record redirects,
   HTTP, CORS, JSON and TLS without a token, credential or POST.
7. Inventory the exact root cache path and relevant response headers. No broad
   cache purge or wildcard is allowed.

Any mismatch yields `STOP_BASELINE_DIVERGENCE`. A separate pre-write
announcement must publish the observed hashes, owner, timestamp, manifest,
paths and stop conditions. Acquisition remains forbidden until a distinct GO.

## Future acquisition and promotion sequence

Only after that distinct GO:

1. Create the shared lock atomically through the application SFTP credential,
   then create and reread `owner.txt` with the exact owner above. A failed
   `mkdir` stops without cleanup. Every later cleanup first rereads the owner;
   an owner mismatch stops and escalates.
2. Revalidate all hashes and invariants under lock. Create the private
   mode-600 manifest and fresh complete snapshots; rehash each snapshot before
   any public mutation.
3. Upload the router next file, preserve the target owner/mode, rehash it and
   require HTTP 403 for the sibling. With both flags still absent, swap it
   atomically on the same filesystem. Run PHP lint and the behavioral router
   harness before continuing.
4. Build `wp-config.php` from the exact under-lock baseline, adding only the
   two validated flags. Never log or store configuration contents outside the
   private mode-600 snapshot. Rehash the next file, require HTTP 403, then swap
   it atomically while preserving owner/mode.
5. Remove only the exact root Breeze cache object, and only if its under-lock
   hash is still the expected value. Preserve the exact rollback copy first.
   Regenerate it through the permitted read-only root request; do not touch any
   other cache entry.
6. Rehash both active files, prove `LAMAKO_MOBILE_WEB_ENABLED=true` and
   `LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT=100`, rerun lint and the router harness,
   then start the GET-only smoke and WebKit matrix.

Rollback order is configuration, exact root cache, then router. Each restored
file must match its private snapshot SHA-256, owner and mode before the lock is
released.

## WebKit R2 fixture and semantic wait

The browser context is a fresh iPhone WebKit context. The anti-mutation route
guard is installed before the first URL. The complete report is written in a
`finally` block before either gate is evaluated.

Pinned event fixture:

- ID: `13459`
- route: `/mobile/event/13459`
- title: `Lamako Acoustique #2 – Olombelo Ricky`
- required contractual date: `27 June` or `27 June 2026`
- forbidden publication date: `3 May` or `3 May 2026`

The harness waits semantically, for at most 90 seconds, until the exact title
and contractual date are visible and the publication date is absent. It then
waits for network idle. The same checks and wait are repeated after a direct
deep refresh of the event route.

Every request record must retain its own page identity, surface
(`mobile-app` or `wordpress-control`), start step, failure step, method,
redacted URL, host, resource type, initiator, status, error text and timestamp.
Sensitive query values are never written.

## Mandatory matrix and gates

The matrix covers:

- iPhone root to mobile home, plus `/mobile/` direct;
- events and shop root/deep links;
- event `13459` and product `13845`, including deep refresh;
- desktop root and explicit classic WordPress surface;
- `/paiement/`, `/checkout/`, `/checkout-2/` exclusions;
- admin/login and payment/OAuth callback exclusions using GET/HEAD/OPTIONS;
- unavailable local storage with rollout 100%;
- ordinary and no-cache navigation, with service workers absent.

PASS requires:

- correct mobile routing and all exclusions, with desktop remaining classic;
- fixture title and 27 June present, 3 May absent, deep refresh PASS;
- zero transmitted mutations, candidate mutation attempts, HTTP errors, TLS,
  DNS, connection, CORS, invalid JSON, console errors/warnings, page errors,
  BlurHash network requests, service workers and overflow;
- no changes to business metrics or neighbor hashes.

Only GET/HEAD/OPTIONS with null status and an abort/cancel error inside an
explicit `initial-navigation`, `navigation-transition` or `deep-refresh`
window may be reported as non-blocking cancellations. Every other request
failure remains blocking.

The twelve R1 WordPress-classic `cafe-events-carousel` HTTP 403 responses
remain **blocking** in R2 even when correctly attributed to
`wordpress-control`. They are not relabeled as router failures, but R2 cannot
pass while they occur.

Every transmitted mutation is an immediate **blocking rollback condition**.
Every attempted candidate mutation is also blocking. A WordPress-control
attempt aborted before transmission is retained with full attribution and
blocks the strict environment gate unless the release coordinator grants an
explicit, evidence-based waiver; the harness never grants one automatically.

## Stop and rollback conditions

Stop before write on lock contention, owner mismatch, baseline drift, a
pre-existing R2 path, inaccessible private snapshot path, unexpected device,
owner or mode, exposed sibling, unexpected flag, cache hash mismatch, neighbor
drift or unexplained business drift.

Rollback immediately on swap ambiguity, active hash mismatch, lint/harness
failure, a routing or exclusion regression, a classic WordPress 403, any
transmitted mutation, candidate mutation attempt, HTTP/CORS/TLS/JSON/console/
page failure, missing semantic fixture, publication-date leak, deep-refresh
failure, BlurHash request, service worker, overflow, metric change or neighbor
change. There is no retry inside R2.

## Postflight and exclusions

Success or rollback must seal:

- exact active and snapshot hashes, owners and modes;
- full WebKit and HTTP evidence, including attributed 403s, mutation attempts
  and transmitted count;
- before/after business metrics and neighbor hashes;
- production-untouched proof;
- `manifest.sha256` and canonical private rollback location;
- owner-verified lock removal followed by independent absence checks through
  master and a second SFTP connection.

Excluded throughout: production writes, POS files, other PHP/MU files, DB,
options, sessions, other caches, stateful manager endpoints, orders, payments,
tickets, stock changes, e-mail and provider QA.
