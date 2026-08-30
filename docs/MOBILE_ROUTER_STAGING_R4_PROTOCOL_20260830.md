# Mobile router staging R4 protocol — local draft

## Status

`LOCAL_READY / REMOTE_NO-GO`.

This protocol performs no preflight, lock or write. The Organisateur read-only
window retains priority and a future staging acquisition requires a new
explicit GO after its postflight. Production is excluded.

## Frozen local candidates

- application/router commit:
  `c8fbf9a7ccdad4f7df7796e00846d68c76922c21`;
- WebKit release-gate tooling commit:
  `17b6d128b869198490df2cfc3e165545c7254613`;
- session-source attribution commit:
  `8da20ee4b7c1371edbaaf82834100d819abfc253`;
- router SHA-256:
  `B9EB558295DE85D3870791B61FEC5077C25BA165B8AC8CE24B9D72870C717B66`;
- WebKit gate SHA-256:
  `5845D9C2953A7C3C65B67301673814EDC1A529DAD6B2F6BDE2579E9BC5C09AC0`;
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
  `EBED8D97DD9336DC6332844FC43EF417DB1EB929F344D1F15C950F559A32D06E`;
- Mobile API bootstrap neighbor:
  `0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11`;
- immutable staging `/mobile/` tree:
  `1e5fdbb552d25b95a52328f0e6e34fddf4620d7f5cfe300c6daf1062a9ebefcc`.

## Proposed fresh R4 names

These paths are definitions only and have not been created:

- owner: `tbl-mobile-router-staging-c8fbf9a-17b6d12-r4`;
- manifest:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-mobile-router-staging-20260830T181600Z-c8fbf9a-17b6d12-r4/`;
- lock:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/.mono-writer.lock/`;
- router next:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.mobile-web-router-next-c8fbf9a-17b6d12-r4.php`;
- router rollback-next:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.mobile-web-router-rollback-next-c8fbf9a-17b6d12-r4.php`;
- configuration sentinel:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.tbl-config-sentinel-c8fbf9a-17b6d12-r4.txt`;
- configuration next:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.wp-config-next-c8fbf9a-17b6d12-r4.php`;
- configuration rollback-next:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/.wp-config-rollback-next-c8fbf9a-17b6d12-r4.php`;
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
   transports, the Mobile API bootstrap and the immutable `/mobile/` tree are
   revalidated read-only;
6. the proposed names remain fresh. Otherwise a new timestamp, owner and paths
   must be announced before GO.

The separate global REST `PHPSESSID` owner correction is not folded into R4.
It remains a production-readiness P1 and must not be simulated by deleting a
cookie after `session_start()`.

## Future controlled sequence

Only a later explicit acquisition GO may authorize this order:

1. repeat the final read-only baseline/neighbor/counter check;
2. inventory every root/edge/Breeze cache variant and prove whether any edge
   cache exists before creating snapshots or deriving a deletion list;
3. acquire the staging lock atomically with the application credential, write
   the exact owner record, reread it through both transports and stop without
   cleanup if `mkdir` reports an existing lock;
4. create and rehash complete private snapshots for the active router,
   `wp-config.php` and every cache file selected by the pre-lock inventory,
   after revalidating each exact hash under lock;
5. create the harmless public sentinel first and prove GET and HEAD both return
   403 before any secret configuration sibling exists;
6. create/revalidate the router next and router rollback-next, PHP lint both,
   run the behavior harness and
   prove its owner/group/mode before swap;
7. atomically swap the router **while both rollout flags are still absent**,
   then rehash, lint and prove OPcache/workers converge to the candidate;
8. through the master transport only, copy the secret configuration into a
   verified master-only private snapshot, derive configuration next and
   rollback-next without logging or downloading content, and add only
   `LAMAKO_MOBILE_WEB_ENABLED=true` and
   `LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT=100`. Both temporary configuration files
   remain master-owned mode `0600`; immediately before the atomic swap the
   candidate is set to the baseline final owner/group and mode `0664`. Rehash
   without exposing content and prove GET/HEAD return 403 for the sentinel,
   configuration next and configuration rollback-next;
9. delete only root/cache files whose current hashes still match the sealed
   inventory and snapshots. Unknown cache structures, an unqualified edge
   cache or any hash drift stops and rolls back;
10. atomically swap configuration last, then verify flags, owners, modes and
    first-hit plus warm-hit behavior for every qualified URL;
11. execute the read-only smokes and WebKit matrix below;
12. on PASS, seal all evidence and retain the private rollback; on any failure,
    rollback immediately in the reverse safety order:
    `wp-config.php` -> every exact cache file -> router.

No public secret sibling may exist before the sentinel test. The application
SFTP account may manage only the lock, exact owner record, non-secret manifest,
router candidates and non-secret snapshots. It must never read, download or
upload `wp-config.php`. A future explicit GO must authorize the master account
only for a master-private secret snapshot/transform, configuration
next/rollback-next, owner-preserving swaps, exact cache operations and cleanup.
If no master-writable private path is proved before acquisition, stop. No
master-owned file may be replaced by an application-owned rename.

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
- `/paiement/` first as a no-follow HTTP control, then through its real
  empty-cart browser redirect ending only on `/paiement`, `/cart` or `/panier`.
  The candidate explicitly excludes `/cart` and `/panier`, so the final page
  must contain zero router marker, mobile document and replacement attempts;
- seeded content event `13459`, exact title, 27 June present, 3 May absent,
  event API evidence and deep refresh;
- exactly ten named route controls: iPhone root, events, shop and product
  (exactly one replacement each); direct `/mobile/`; admin; login; checkout;
  callback; and double-encoded exclusion (zero replacements each).

Every URL must be absolute, same-origin, normalized and decoded twice by the
gate. Unknown/extra/missing slide or control identities, string booleans,
non-finite metrics or duplicate evidence fail closed.

PASS requires zero mutation attempts and transmissions, carousel or other HTTP
errors, blocking cancellations, TLS/CORS/DNS errors, invalid JSON, console/page
errors, BlurHash requests, service workers and overflow. A WordPress-owned
failure remains release-blocking even when correctly attributed.

Record `PHPSESSID` before and after from the same endpoint set: source class,
presence and Secure/HttpOnly/SameSite/Path attributes must remain unchanged by
the router, and the router/MU harness must still prove `session_start=0`. This
does not declare the full plugin bootstrap stateless or mask the separate
third-party session-owner P1.

## Postflight

Seal source and active hashes, owners/modes, snapshots, exact cache inventory,
all reports, counters, neighbor hashes, production-untouched proof, rollback
location and `manifest.sha256`. Remove public next/sentinel/config siblings.
Release only after rereading the exact owner, then prove lock absence through
master and a second application SFTP connection.

Excluded throughout: production writes, PHP/MU/session-owner changes, DB,
options, non-inventoried cache files, sessions, orders, payments, tickets,
stock, e-mail, provider calls, POS and Organisateur files.
