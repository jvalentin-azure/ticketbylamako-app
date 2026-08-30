# Mobile router staging R2 read-only preflight

## Decision

Status: **STOP_MASTER_TRANSPORT_UNVERIFIED**.

The staging application, baseline, public probes and application SFTP
transport are ready. Acquisition is not ready because the owner-preserving
master transport required by the protocol could not authenticate with the
existing local staging identity. No lock, manifest, sibling, upload, flag or
cache mutation was attempted. Production was not accessed.

The POS predecessor `tbl-pos-dashboard-job-v2-staging-20260830T113519Z-976eaf1`
ended in `STOP_ROLLBACK`; its sealed `manifest.sha256` hash is
`8b2e84b0e11947d67560eb4a7be0dcd17cb52abeb94d1f3596f95e4bd75baa7e`.
Its target and neighbors match their before-state, and the shared lock was
absent before this preflight.

## Candidate and proposed future names

- Application/router source:
  `8d1cb2b94e4f1b886494991bc3c3cb9f83e739f3`
- QA tooling:
  `e82933e354056c8df5347dcbaa758fde887d1b0f`
- Protocol commit before this report:
  `e4397d042659ce4c69f5380c9c71b7918a8f8463`
- Router candidate SHA-256:
  `85283d8fe9a8e10b57d6691e0f21b440f506dfa4e129b6ae132fb0acc2ea389f`
- In-memory `wp-config.php` candidate SHA-256:
  `58ef28151966c341a2bdd58642a0230088d79c52bb17285bd4b0c9b477cd21fd`
- Proposed owner, not created:
  `tbl-mobile-router-staging-e82933e-r2`
- Proposed manifest, not created:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-mobile-router-staging-20260830T121129Z-e82933e-r2/`

Fresh public siblings, all observed absent:

- `wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.tbl-mobile-web-router-next-e82933e-r2-121129Z.php`
- `wp-content/plugins/lamako-mobile-api/lamako-mobile-api/includes/.tbl-mobile-web-router-rollback-e82933e-r2-121129Z.php`
- `.tbl-mobile-routing-config-next-e82933e-r2-121129Z.php`
- `.tbl-mobile-routing-config-rollback-e82933e-r2-121129Z.php`
- `wp-content/cache/breeze/2d9cc3f7bf1acaa66f61a623a9977b6fbd078a731059e5f513ff635ea73db9ce/.tbl-mobile-root-cache-rollback-e82933e-r2-121129Z.html`

Future private mode-600 snapshots, not created:

- `snapshot/mobile-web-router.php.before`
- `snapshot/wp-config.php.before`
- `snapshot/root-cache.html.before`
- `snapshot/baseline.sha256`
- `snapshot/stat.txt`

## Remote baseline

Observations ran between `20260830T115820Z` and `20260830T120652Z`.

| Surface                     | SHA-256                                                            | Owner/mode                       |   Bytes |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------- | ------: |
| Router                      | `5733800c463340be519e9661c6851e447ef617983df861b0a1d398dda7f92232` | `master_nqpwygdfqp:www-data:644` |   4,383 |
| `wp-config.php`             | `3e1b6e68874f3784e35df8944a9e96eef82f318736eaa3c4ad010e3290f46227` | `master_nqpwygdfqp:www-data:664` |   5,031 |
| Exact root Breeze cache     | `d96488e62537b1ec9465610ab8a6f1cfcee68b06a527da9546865f8f1b15a750` | `wvvtwdcenn:www-data:664`        | 555,135 |
| Mobile v2 commerce          | `4417aa27e7a39a99769e667268b406354deabe32bbbd05e28e5d9a27ee4f53fa` | `wvvtwdcenn:www-data:644`        | 303,726 |
| Active Mobile API bootstrap | `0613564f2be9037af5d48020045ae9167fed278c3f76131d7d79ef229bf46a11` | `master_nqpwygdfqp:www-data:644` | 186,890 |
| REST/cookie MU guard        | `ebed8d97dd9336dc6332844fc43ef417db1eb929f344d1f15c950f559a32d06e` | `master_nqpwygdfqp:www-data:644` |   9,695 |

The active plugin option selects
`lamako-mobile-api/lamako-mobile-api.php`. A second, inactive nested file at
`lamako-mobile-api/lamako-mobile-api/lamako-mobile-api.php` has SHA-256
`8a1c84f37ee33f667a977f1155d5fd32ac95021f2386c3b982a4e7fc70c8fbe1`.
This explains the apparent bootstrap mismatch during the first path check; it
is not baseline drift.

Both `LAMAKO_MOBILE_WEB_ENABLED` and
`LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT` are absent. PHP lint passes for the active
router and `wp-config.php`. The protected configuration was transformed only
in process memory: one insertion marker, candidate size 5,129 bytes and the
expected candidate hash above. No configuration content or secret was logged
or stored.

The deployment-directory fingerprint remained
`215ec03b94bd13618f2949b9d52a89cb42daebcdc866fc6b1c63f97a3c3ac50e`
before and after the probes. The filesystem device is `65026`, with
15,722,376 KiB available at the observation. The shared mono-writer and all
new R2 paths were absent at the final observation.

## Business invariants

Read-only SQL observations before/after the HTTP probes were identical:

- posts orders: `715`, maximum ID `13357`;
- HPOS orders: `1843`, maximum ID `14547`;
- product `13845` stock: `46`.

No POST, PUT, PATCH or DELETE request was sent.

## Non-mutative HTTP probes

- iPhone and desktop root: HTTP 200, identical body SHA-256
  `4c4b93229a56d53100c141900d1b01c994cab75d7df5e227f7f4542a16c5c69f`,
  router marker absent as expected while flags are absent;
- root HEAD: 200;
- `/mobile/`, event `13459` and product `13845`: 200 and immutable app index
  SHA-256 `3c1b0ecad6a4317be19018f3ebaa4f6410a35d49f9806af6384eff7c1d8d7cf0`;
- `/paiement/`: 302 to `/cart/`;
- `/checkout/`: 301 to `/checkout-2/`;
- `/checkout-2/`: 200, router marker absent;
- `/wp-admin/`: 302 to login;
- Facebook OAuth callback OPTIONS: 200;
- home, events, event `13459`, shop, product `13845`, rewards config and web
  session APIs: 200, valid JSON and same-origin CORS;
- unauthenticated profile: 401, valid JSON and same-origin CORS;
- Orange and MVola callback OPTIONS: 200, valid JSON and same-origin CORS.

The root cache hash, mtime and size were unchanged after these requests. These
top-level probes do not clear the WebKit release gate: the R1 classic
WordPress `cafe-events-carousel` 403 responses remain blocking if reproduced,
and every mutative attempt remains fail-closed with attribution.

## Local candidate validation

- Router PHP lint: PASS.
- Router behavior: 58/58 PASS, including payment/admin/callback exclusions,
  rollout 0/partial/100 and unavailable storage.
- WebKit request classifier/gate: 37/37 PASS.
- Candidate source hash equals the announced router hash.
- The corrected server flag contract is
  `LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT=100`; the earlier protocol spelling
  without `_PERCENT` was documentation-only and is corrected with this
  report.

## Transport evidence and blocker

Application SSH/SFTP authenticates with the existing RSA-4096 staging
identity. It reports UID `wvvtwdcenn`, group `www-data`, chroot `/`, and can
list/read both `/public_html` and `/private_html/tbl-deploy`. A second SFTP
connection independently reported the lock path absent.

The available local staging identity attempted against
`master_nqpwygdfqp@139.84.234.183` was rejected with exit 255,
`Permission denied (publickey,password)`. No password or secret was requested,
displayed or transmitted outside the SSH negotiation.

The application transport cannot substitute for master: the router target is
master-owned and mode 644, and an application-user rename would not preserve
the required owner. Therefore acquisition is fail-closed until an authorized
master transport authenticates and repeats the final lock/hash/stat checks.

## Stops before a future GO

The separate acquisition GO must not be issued until:

1. owner-preserving master SSH succeeds read-only and proves the same lock,
   device, hashes, owners and modes;
2. the exact manifest and sibling paths above are still absent;
3. the deployment fingerprint and business invariants remain attributable;
4. the config candidate is regenerated in memory with the exact `_PERCENT`
   flag and reproduces `58ef2815...21fd`;
5. POS has no new writer window and no other owner holds the staging lock.

All protocol stop/rollback gates remain unchanged: classic WordPress 403,
mutative attempt or transmission, HTTP/CORS/TLS/JSON/console/page failure,
fixture/date/deep-refresh failure, hash/owner/mode drift, cache drift, business
drift or ambiguous swap yields immediate stop or rollback. There is no retry
inside R2.
