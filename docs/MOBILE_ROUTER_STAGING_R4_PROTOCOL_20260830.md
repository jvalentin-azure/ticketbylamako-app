# Mobile router staging R4 protocol — local draft

## Status

`LOCAL_READY / REMOTE_NO-GO`.

This protocol performs no preflight, lock or write. The Organisateur read-only
window retains priority and a future staging acquisition requires a new
explicit GO after its postflight. Production is excluded.

## Frozen local candidates

- application/router/tooling commit:
  `c8fbf9a7ccdad4f7df7796e00846d68c76922c21`;
- session-source attribution commit:
  `8da20ee4b7c1371edbaaf82834100d819abfc253`;
- router SHA-256:
  `B9EB558295DE85D3870791B61FEC5077C25BA165B8AC8CE24B9D72870C717B66`;
- WebKit gate SHA-256:
  `7C5A40698F051E3C3CDE000C3EA3A822AF08F4291554837BF1702631C3448387`.
- expected configuration candidate derived from the restored baseline with only
  the two rollout flags:
  `58ef28151966c341a2bdd58642a0230088d79c52bb17285bd4b0c9b477cd21fd`.

Expected restored staging baselines from the sealed R3 postflight, to be
revalidated rather than assumed:

- router: `5733800c463340be519e9661c6851e447ef617983df861b0a1d398dda7f92232`;
- `wp-config.php`:
  `3e1b6e68874f3784e35df8944a9e96eef82f318736eaa3c4ad010e3290f46227`;
- root Breeze cache:
  `d96488e62537b1ec9465610ab8a6f1cfcee68b06a527da9546865f8f1b15a750`;
- Mobile v2 neighbor:
  `4417AA27E7A39A99769E667268B406354DEABE32BBBD05E28E5D9A27EE4F53FA`;
- REST MU guard neighbor:
  `EBED8D97DD9336DC6332844FC43EF417DB1EB929F344D1F15C950F559A32D06E`.

## Proposed fresh R4 names

These paths are definitions only and have not been created:

- owner: `tbl-mobile-router-staging-c8fbf9a-r4`;
- manifest:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-mobile-router-staging-20260830T175631Z-c8fbf9a-r4/`;
- lock:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/.mono-writer.lock/`;
- router next:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.mobile-web-router-next-c8fbf9a-r4.php`;
- configuration sentinel:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.tbl-config-sentinel-c8fbf9a-r4.txt`;
- configuration next:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.wp-config-next-c8fbf9a-r4.php`;
- all snapshots and rollback material live only inside the private manifest,
  mode `0600` where supported.

Every proposed path must be absent in the future preflight. Any presence,
baseline drift, owner/mode drift or lock ambiguity stops before write.

## External gates before acquisition

R4 cannot acquire the writer until:

1. the current staging writer is absent by independent master and application
   transport checks;
2. Organisateur has published its postflight and transferred the slot;
3. the WordPress owner has fixed or removed the observed
   `cafe-events-carousel` v3.1.18 CSS/JS HTTP 403s and the related console/page
   failures in a separate qualified lot;
4. WordPress control pages no longer attempt WooCommerce/floating-cart
   mutations during the read-only matrix, or those components are corrected
   by their owners; interception is not a waiver;
5. active hashes, business counters, filesystem device, space and both
   transports are revalidated read-only;
6. the proposed names remain fresh. Otherwise a new timestamp, owner and paths
   must be announced before GO.

The separate global REST `PHPSESSID` owner correction is not folded into R4.
It remains a production-readiness P1 and must not be simulated by deleting a
cookie after `session_start()`.

## Future controlled sequence

Only a later explicit acquisition GO may authorize this order:

1. repeat the final read-only baseline/neighbor/counter check;
2. acquire the staging lock atomically with the application credential, write
   the exact owner record, reread it through both transports and stop without
   cleanup if `mkdir` reports an existing lock;
3. create and rehash complete private snapshots for the active router,
   `wp-config.php` and every cache file selected by the inventory;
4. create the harmless public sentinel first and prove GET and HEAD both return
   403 before any secret configuration sibling exists;
5. create/revalidate the router next, PHP lint it, run the behavior harness and
   prove its owner/group/mode before swap;
6. atomically swap the router **while both rollout flags are still absent**,
   then rehash, lint and prove OPcache/workers converge to the candidate;
7. derive the configuration next from the exact active baseline without
   logging content; add only `LAMAKO_MOBILE_WEB_ENABLED=true` and
   `LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT=100`, mode `0600`, rehash and prove the
   sentinel still blocks HTTP access;
8. inventory Breeze/edge HTML variants for root, events, shop, the event
   fixture, product fixture, desktop/classic and transaction exclusions.
   Delete only files whose current hashes match their snapshots; unknown cache
   structures or hashes stop and rollback;
9. atomically swap configuration last, then verify flags, owners, modes and
   first-hit plus warm-hit behavior for every qualified URL;
10. execute the read-only smokes and WebKit matrix below;
11. on PASS, seal all evidence and retain the private rollback; on any failure,
    rollback immediately in the reverse safety order:
    `wp-config.php` -> every exact cache file -> router.

No public secret sibling may exist before the sentinel test. No master-owned
file may be replaced by an application-owned rename. The validating master
account remains read-only except for the previously authorized owner-preserving
atomic swaps.

## R4 QA contract

The runner must persist evidence in `finally` and use the single
`evaluateWebKitRouterReleaseGate()` result. A hand-written partial verdict is
invalid.

Required evidence exactly once:

- onboarding slide 1 at active index 0 with exact title/action and a complete,
  finite, intersecting rendered image;
- onboarding slide 2 at active index 1 with the same rendered-image contract;
- desktop root with one cache-safe marker and zero mobile document/replacement;
- `?desktop=1` with the explicit classic contract and zero mobile navigation;
- `/paiement/` through its real empty-cart redirect, ending only on
  `/paiement`, `/cart` or `/panier`, with zero marker/mobile navigation;
- seeded content event `13459`, exact title, 27 June present, 3 May absent,
  event API evidence and deep refresh;
- root, events, shop, product, direct `/mobile/`, admin/login, checkout,
  callbacks and encoded exclusion controls.

Every URL must be absolute, same-origin, normalized and decoded twice by the
gate. Unknown/extra/missing slide or control identities, string booleans,
non-finite metrics or duplicate evidence fail closed.

PASS requires zero mutation attempts and transmissions, carousel or other HTTP
errors, blocking cancellations, TLS/CORS/DNS errors, invalid JSON, console/page
errors, BlurHash requests, service workers and overflow. A WordPress-owned
failure remains release-blocking even when correctly attributed.

## Postflight

Seal source and active hashes, owners/modes, snapshots, exact cache inventory,
all reports, counters, neighbor hashes, production-untouched proof, rollback
location and `manifest.sha256`. Remove public next/sentinel/config siblings.
Release only after rereading the exact owner, then prove lock absence through
master and a second application SFTP connection.

Excluded throughout: production writes, PHP/MU/session-owner changes, DB,
options, non-inventoried cache files, sessions, orders, payments, tickets,
stock, e-mail, provider calls, POS and Organisateur files.
