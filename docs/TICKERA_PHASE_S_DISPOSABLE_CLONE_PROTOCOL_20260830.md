# Tickera stateless REST — disposable clone qualification

## Decision

The current Cloudways staging application `wvvtwdcenn` is not a valid Phase S
runtime. The qualification remains fail-closed before lock or deployment.

Read-only evidence collected on 2026-08-30 shows:

- no independently proven `SELECT`-only database credential;
- Object Cache Pro is isolated from production but the staging Redis database
  is still writable;
- the application process has a default network route and no proven OS or
  cgroup egress deny;
- no existing TicketByLamako disposable clone could be attributed safely;
- the repository contains no Docker, wp-env, DDEV, Lando, Vagrant or Cloudways
  clone provisioning mechanism that supplies those missing controls.

The local runner and validator check evidence supplied by the environment;
they do not create that isolation. Running them against ordinary writable
staging would therefore make a successful report non-probative.

## Frozen candidates

| Item                                                          | Value                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Application shim commit                                       | `9edc6c81af3a10228d223ce9438698da42403284`                         |
| Qualification tooling baseline (superseded by this hardening) | `ef38f8d5bacdd28f0aaa2a927a9855ade815e9d2`                         |
| MU-plugin SHA-256                                             | `9ee50c7fc73bbe4f2cebdc17ca8aac93aface21f7620e85d83cf2babe3ec1ddf` |
| Runtime runner SHA-256                                        | `d4f7bf4ad308c551aea15e1317aeb93cfe690eaea66f24a367509f211518b0c8` |
| Runtime validator SHA-256                                     | `ae799c8542998f8e22ea323e13feb4f1a543303d683e7f7bf2540857e1f2fe60` |
| Runtime library harness SHA-256                               | `cc88c4056c362bd926339eccdaedf5ef92727086de5480dfcd14107295456adb` |
| Runtime shutdown harness SHA-256                              | `525c107d0d55434280ca0ce7b08cf7425f116949ba97f3284dd631b406e93f91` |
| Runtime gate SHA-256                                          | `8e5be5f5971e8bd40a46c73e6629fb5d0caec2fd9b5343d491cc5f870a50ff88` |
| Source staging `wp-config.php` SHA-256                        | `3e1b6e68874f3784e35df8944a9e96eef82f318736eaa3c4ad010e3290f46227` |
| Active Tickera version                                        | `3.6.0.2`                                                          |
| Active REST/cookie guard SHA-256                              | `ebed8d97dd9336dc6332844fc43ef417db1eb929f344d1f15c950f559a32d06e` |

The carousel candidate `e23fddaed6f53d2303b31a8be9a5bd1e417ab491`
remains frozen and read-only until this Phase S is sealed PASS.

## Provisioning gate

Creating or billing a clone is an external infrastructure change and requires
a separate explicit user authorization. The clone must have a new application
identifier and hostname and must never reuse the public staging or production
domains.

Before any WordPress bootstrap, an operator independent from the runner must
seal a private mode-`0600` proof, expiring in at most one hour, that contains
only redacted classifications and hashes and proves all of the following:

1. the clone is derived from the exact active staging files and database
   snapshot, or its intentional differences are inventoried and approved;
2. the database credential used by PHP has only the minimum read privileges
   needed by the measured routes; the provisioning operator creates a
   disposable clone-only canary before switching to that credential, the
   measured process proves an attempted write is rejected, and the operator
   removes the canary before sealing; the proof includes only a redacted
   SHA-256 fingerprint of the resolved clone DB target;
3. Redis/object cache uses a clone-only backend and database, and writes are
   denied or redirected to an ephemeral backend that is destroyed after the
   run; the proof includes its redacted target fingerprint and the required
   catalogue keys are already HIT;
4. direct outbound traffic is denied outside the clone's local database and
   cache dependencies at the server, container, cgroup or equivalent process
   boundary; WordPress filters alone are not accepted;
5. Orange, CyberSource, SMTP, Firebase, OAuth and every other production
   credential are absent or replaced with non-routable sentinels;
6. cron, Action Scheduler runners, queue workers, e-mail delivery and provider
   callbacks are disabled for the clone. The repository clone-only isolation
   guard must be sealed by SHA-256 in the proof. It activates only with
   `TBL_TICKERA_PHASE_S_ISOLATED_CLONE=true` and a `.invalid` hostname, and
   must report all five expected controls active;
7. the active-plugin list, Tickera bytes, MU-neighbor hashes, PHP version and
   clone `wp-config.php` hash are sealed;
8. the clone is password protected or otherwise inaccessible to the public,
   except for the explicitly allowlisted QA source.

The proof schema is version `2`. It is bound before bootstrap to the clone
root, clone hostname, `wp-config.php`, runner, validator, invocation-ID and
request fingerprints, method, URL form, web-session mode and cache preflight
state. Required controls are exactly `CLONE_SELECT_ONLY_CREDENTIAL`,
`CLONE_EPHEMERAL_OR_WRITE_DENIED`, `PROCESS_EGRESS_DENY` and
`READ_ONLY_ROOT_EPHEMERAL_TMP`. The runner validates the proof's shape, hashes,
bindings and freshness; it does not itself impose mysqli/PDO privileges, cURL
or stream egress policy, Redis/cache permissions, or filesystem isolation.

Any missing, stale or self-declared-only proof is `STOP_BEFORE_BOOTSTRAP`.

## Phase S execution

Use a new clone-only mono-writer owner, manifest and rollback. Never reuse a
staging or production lock.

1. Revalidate all provisioning evidence and candidate hashes.
2. Snapshot the clone MU directory and relevant configuration metadata.
3. Install only `tbl-tickera-stateless-rest.php` atomically with the normal MU
   owner, group and mode. Do not modify Tickera vendor files.
4. PHP-lint and run the exact behavioral harness against deployed bytes.
5. Run `php -d session.use_strict_mode=1` in one fresh isolated CLI process per
   GET, HEAD and OPTIONS case, for both pretty and literal `?rest_route=` URI
   forms. Use `ANONYMOUS_CLI` only for `/web-session` and `NOT_APPLICABLE` for
   every other route. Accept only
   `COMPONENT_PASS_EXTERNAL_REQUIRED` with zero session operations, zero
   data-mutating SQL, zero cache writes, zero outbound attempts and the exact
   inventory of every `Tickera\TC::update_cart` callback transitioning from
   the single global priority-`10` callback to absent through WordPress
   shutdown and the late reporter. The only accepted connection-local SQL is
   exactly `SET time_zone = '+00:00'` or `SET SESSION SQL_BIG_SELECTS=1`;
   these statements are counted separately and every observed query must equal
   read-only plus connection-local counts. All other `SET` and non-read SQL is
   a hard failure. The external clone `SELECT`-only credential remains the
   authoritative write fence.
6. Through real HTTPS/FPM, separately run GET, HEAD and OPTIONS for pretty and
   literal `rest_route` forms. Require valid JSON/CORS/JWT semantics and no
   `PHPSESSID` on a fresh client; `/web-session` needs distinct anonymous and
   authenticated cases. Never merge these HTTP observations into the CLI
   session/hook report.
7. In the non-bootstrapping behavioral harness only, run negative cases for
   unknown routes, query ambiguity, cart, checkout, payment, admin, callback
   and Seating keys; prove Tickera's hook is left intact. Do not issue real
   HTTP commerce, admin, callback or Seating requests in Phase S.
8. Revalidate filesystem hashes, clone-only database/cache counters and zero
   provider, mail, order, ticket, stock, hold and session mutation.
9. Seal the manifest, remove the clone-only lock after exact owner reread and
   prove its absence independently.

Any divergence triggers removal of only the MU shim, rollback of the clone
snapshot and quarantine of the clone. Deleting the clone is a separate
destructive action and requires its own explicit authorization. A component
result from CLI alone is never a release PASS.

## Resume order after PASS

1. qualify the shim on ordinary staging under a new, separately authorized
   deployment window using only real HTTPS stateless smokes and rollback;
2. prove the seven Mobile v2 routes and homepage no longer emit
   `PHPSESSID` unexpectedly;
3. execute carousel Phase A `e23fdda` under its own owner and manifest;
4. qualify the three directory modes and immutable CSS/JS GET/HEAD responses;
5. keep carousel Phase B and every commerce mutation under a later explicit
   authorization.

Production remains excluded throughout this protocol.
