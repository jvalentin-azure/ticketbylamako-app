# Mobile router staging R3 protocol

## Current decision and authority

Status: **LOCAL_PROTOCOL_ONLY — WAITING_FOR_POS_POSTFLIGHT**.

This document does not authorize a remote preflight, lock, upload, file swap,
flag change, cache change or QA against staging. The staging mono-writer window
belongs to POS R2 owner
`tbl-pos-dashboard-job-v2-staging-20260830T133500Z-976eaf1-r2`.

R3 may begin a fresh read-only preflight only after the POS postflight proves
its final active or rollback state, business invariants and independent lock
absence, followed by an explicit transfer. Acquisition and writes require a
separate explicit R3 GO.

Production is excluded.

## Frozen inputs

- Application/router source: `8d1cb2b94e4f1b886494991bc3c3cb9f83e739f3`
- QA/RCA tooling: `bfe2124f545b5610a2a7f8f85706949d65dba93b`
- Router candidate SHA-256:
  `85283d8fe9a8e10b57d6691e0f21b440f506dfa4e129b6ae132fb0acc2ea389f`
- Expected configuration candidate SHA-256:
  `58ef28151966c341a2bdd58642a0230088d79c52bb17285bd4b0c9b477cd21fd`
- Web bundle tree already active on staging:
  `1e5fdbb552d25b95a52328f0e6e34fddf4620d7f5cfe300c6daf1062a9ebefcc`
- Pinned event: `13459`, route `/mobile/event/13459`
- Pinned title: `Lamako Acoustique #2 – Olombelo Ricky`
- Required contractual date: `27 juin` or `27 juin 2026`
- Forbidden publication date: `3 mai` or `3 mai 2026`

No application or API change is part of R3. R3 corrects the QA precondition
that left R2 on first-use onboarding.

## Fresh proposed names — not created or remotely verified

- Owner: `tbl-mobile-router-staging-bfe2124-r3`
- Manifest basename:
  `tbl-mobile-router-staging-20260830T133637Z-bfe2124-r3`
- Shared staging lock:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/.mono-writer.lock/`
- Private manifest:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-mobile-router-staging-20260830T133637Z-bfe2124-r3/`

Application root:
`/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html`

Router target:
`wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/mobile-web-router.php`

Router siblings:

- `wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.tbl-mobile-web-router-next-bfe2124-r3-133637Z.php`
- `wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.tbl-mobile-web-router-rollback-bfe2124-r3-133637Z.php`

Configuration target: `wp-config.php`

Configuration siblings:

- `.tbl-mobile-routing-config-next-bfe2124-r3-133637Z.php`
- `.tbl-mobile-routing-config-rollback-bfe2124-r3-133637Z.php`

Exact Breeze root cache target:
`wp-content/cache/breeze/2d9cc3f7bf1acaa66f61a623a9977b6fbd078a731059e5f513ff635ea73db9ce/c4930403fd08fe6dd1053784a5926f5928f4143207978d20f502360a038b2e27.html`

Cache rollback sibling:
`wp-content/cache/breeze/2d9cc3f7bf1acaa66f61a623a9977b6fbd078a731059e5f513ff635ea73db9ce/.tbl-mobile-root-cache-rollback-bfe2124-r3-133637Z.html`

Private mode-600 evidence paths:

- `snapshot/mobile-web-router.php.before`
- `snapshot/wp-config.php.before`
- `snapshot/root-cache.html.before`
- `snapshot/baseline.sha256`
- `snapshot/stat.txt`
- `qa/first-use-report.json`
- `qa/content-report.json`
- `qa/router-matrix-report.json`
- `qa/request-evidence.ndjson`
- `postflight.txt`
- `manifest.sha256`

Every proposed R3 path must be absent during the future preflight. Nothing from
R1 or R2 may be reused as a next, rollback sibling or mutable manifest.

## Expected baseline to revalidate after POS

The following values come from the sealed R2 rollback and are expectations,
not a current remote observation:

| Surface              | Expected SHA-256                                                   | Expected owner/mode              |
| -------------------- | ------------------------------------------------------------------ | -------------------------------- |
| Router               | `5733800c463340be519e9661c6851e447ef617983df861b0a1d398dda7f92232` | `master_nqpwygdfqp:www-data:644` |
| `wp-config.php`      | `3e1b6e68874f3784e35df8944a9e96eef82f318736eaa3c4ad010e3290f46227` | `master_nqpwygdfqp:www-data:664` |
| Exact root cache     | `d96488e62537b1ec9465610ab8a6f1cfcee68b06a527da9546865f8f1b15a750` | `wvvtwdcenn:www-data:664`        |
| Mobile v2 commerce   | `4417aa27e7a39a99769e667268b406354deabe32bbbd05e28e5d9a27ee4f53fa` | read-only neighbor               |
| Mobile API bootstrap | `0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11` | read-only neighbor               |
| REST/cookie MU guard | `ebed8d97dd9336dc6332844fc43ef417db1eb929f344d1f15c950f559a32d06e` | read-only neighbor               |

Both routing flags must be absent. The only future configuration additions are:

```php
define( 'LAMAKO_MOBILE_WEB_ENABLED', true );
define( 'LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT', 100 );
```

Reference business values from R2 are orders `715 / max 13357`, HPOS
`1843 / max 14547` and product `13845` stock `46`. The future preflight must
reconcile any natural drift with the POS postflight rather than assume these
values remain current.

## Future read-only preflight after explicit transfer

No step in this section is authorized yet.

1. Record the POS R2 candidate, final state, manifest hash and independent
   mono-writer absence proof.
2. Observe the staging lock as absent through master SSH and a second
   application SFTP connection. Verify all R3 paths are absent.
3. Rehash and stat the router, `wp-config.php`, exact cache and neighbors.
   Count the two routing constants without printing configuration contents.
4. Reconcile order, HPOS and stock counters with the POS postflight using only
   read-only queries.
5. Revalidate the application SFTP chroot and read/list access. Do not test
   write access and do not create a probe.
6. Capture GET/HEAD/OPTIONS baselines for iPhone and desktop roots, `/mobile/`,
   event/shop deep links, payment/checkout/admin/login and callback exclusions.
7. Publish observed hashes, owner, paths and stop conditions. Wait for a
   separate acquisition GO.

Any unexplained mismatch returns `STOP_BASELINE_DIVERGENCE` without a lock.

## Future acquisition and promotion sequence

Only a separate explicit R3 acquisition GO may authorize these steps:

1. Create the shared lock atomically through application SFTP. Write and reread
   `owner.txt`; every cleanup requires an exact owner reread.
2. Revalidate baselines under lock. Create complete private mode-600 snapshots
   and rehash them before public mutation.
3. Upload and rehash the router next file, preserve target owner/mode and
   require HTTP 403 for the sibling. Swap atomically on the same filesystem,
   then run PHP lint and the behavioral router harness while flags are absent.
4. Build configuration from the exact under-lock baseline, adding only the two
   constants. Never log configuration contents. Rehash, require sibling HTTP
   403 and swap atomically while preserving owner/mode.
5. Remove only the exact root cache object after its hash matches the expected
   under-lock baseline. Preserve its rollback first and regenerate through one
   allowed read-only root request.
6. Rehash active targets, prove flags `true / 100`, rerun lint/harness, then
   start the strict GET/HEAD/OPTIONS smoke and WebKit matrix.

Rollback order is `wp-config.php`, exact root cache, then router. Restoration
must match each private snapshot hash, owner and mode.

## WebKit scenario A — first use, fresh storage

This scenario proves onboarding and deep-link preservation. It must not seed
or reuse browser storage.

1. Create a fresh iPhone 15 WebKit context with anti-mutation routing installed
   before the first document.
2. Navigate directly to `/mobile/event/13459` and preserve that path.
3. Require the first onboarding text and image, activate `Suivant`, require the
   second slide, then activate the visible `Découvrir` action.
4. Prove onboarding version `2` is persisted without reading unrelated storage
   or cookies.
5. Prove the URL remains `/mobile/event/13459` and the event API begins only
   after onboarding completion.
6. Close the context after its report is written in `finally`.

PASS requires both slides, accessible controls, preserved deep link, exact
onboarding version, zero transmitted mutations and zero blocking network,
HTTP, TLS, CORS, JSON, console, page or overflow failures.

## WebKit scenario B — content with onboarding version 2

This scenario tests application content independently from first use.

1. Create another fresh iPhone 15 WebKit context and install the anti-mutation
   route before the first document.
2. Before navigation, seed only
   `@ticketbylamako/onboarding-version=2` with an init script. No token, session,
   user, cart or other storage value may be injected.
3. Navigate directly to `/mobile/event/13459`. Onboarding assets or controls in
   this context are blocking.
4. Require a GET to `/wp-json/lamako-mobile/v2/public/events/13459`, valid JSON,
   the exact title, 27 June and absence of 3 May within 90 seconds, followed by
   network idle.
5. Deep-refresh the exact path and repeat the event API, semantic contract and
   network-idle checks.
6. Test product `13845`, `/mobile/`, events/shop routes and deep refresh.
7. Write the complete report in `finally` before evaluating the gate.

PASS requires event API evidence greater than zero before `ready`, exact
title/date, deep-refresh PASS, no onboarding surface and all strict zero-error
gates.

## Router/control matrix

A separate report covers:

- iPhone root, events and shop automatic routing;
- direct `/mobile/`;
- desktop root and explicit classic control;
- `/paiement/`, `/checkout/`, `/checkout-2/`, admin/login and OAuth/payment
  callback exclusions;
- rollout 100 when router storage is unavailable, using a navigation-capture
  stub so application onboarding storage is not conflated with router bucketing;
- no service worker and no horizontal overflow.

WordPress classic `cafe-events-carousel` HTTP 403 responses remain blocking.
Every attempted or transmitted mutation remains blocking, regardless of page
ownership.

## Fail-closed diagnostics

Content diagnosis uses event-specific evidence:

- onboarding assets > 0 and event API requests = 0:
  `blocked-by-onboarding`;
- event API requests = 0 without onboarding: `api-not-started`;
- event API requests > 0 but semantic contract absent:
  `event-contract-failure`;
- `ready` only when event API requests > 0 and the semantic contract passed.

Only GET/HEAD/OPTIONS cancellations with null status inside an explicit
`initial-navigation`, `navigation-transition` or `deep-refresh` window may be
non-blocking. R2 cancellations observed after HTTP 200 remain blocking and are
not reclassified or waived.

## Immediate stop and rollback conditions

Stop before write on lock contention, owner mismatch, any pre-existing R3
path, baseline or device drift, inaccessible snapshot path, unexpected flag,
exposed sibling, cache mismatch, neighbor drift or unexplained business drift.

Rollback immediately on swap ambiguity, active hash mismatch, lint/harness
failure, route/exclusion failure, onboarding/content scenario mixing, missing
event API, semantic timeout, publication-date leak, deep-refresh failure,
mutation attempt or transmission, HTTP 403 or other HTTP error, TLS/CORS/DNS/
connection/JSON/console/page failure, BlurHash request, service worker,
overflow, metric change or neighbor change.

There is no retry or waiver inside R3.

## Postflight contract

Success or rollback must seal active and snapshot hashes, owners/modes, all
three QA reports, request-level evidence, before/after metrics, neighbor hashes,
production-untouched proof, `manifest.sha256`, rollback location and the exact
decision. Public siblings are removed only after a proven final state and
sealed private rollback.

The lock is released only after exact owner reread, then absence is verified by
master SSH and a second SFTP connection.

Excluded throughout: production writes, POS files, other PHP/MU files, DB,
options, sessions, other caches, stateful manager routes, orders, payments,
tickets, stock changes, e-mail and provider QA.
