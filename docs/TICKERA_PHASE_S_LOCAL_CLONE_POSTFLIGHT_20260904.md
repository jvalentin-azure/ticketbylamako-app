# Tickera Phase S local isolated clone — postflight 2026-09-04

## Decision

`QUARANTINED_NO_GO` for the Phase S release gate. The isolated clone was
created successfully and proved that the Tickera stateless candidate behaves
correctly for the measured component, but the frozen global runner detected
side-effect attempts from unrelated active plugins. The real HTTPS matrix was
not started after that CLI gate failed.

The already-qualified staging MU-plugin remains active and unchanged. No
production action occurred.

## Source and candidate

- source application: Cloudways staging `wvvtwdcenn`;
- source root: `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html`;
- branch: `fix/tickera-stateless-public-20260901`;
- product commit: `f1e58d9aeb81bd6ff8e5ffa66b04364f74757ddb`;
- staging shim SHA-256 before and after:
  `700b353ecb865daa48f0f842c764a415ddce2ab716358cff644a6b98b830e222`;
- Tickera 3.6.0.2 source SHA-256:
  `beb244415bf3e874925bd76a88f9bbf19c246121251877723dc6a3db41caac52`.

## Isolated clone controls

The successful private clone was created off-path at:

`/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-phase-s/tickera-20260904T080012Z-f1e58d9`

Controls actually exercised:

- private MariaDB 10.11.18 with `--skip-networking` and a private Unix socket;
- dedicated PHP credential with only `SELECT` on the clone database;
- rejected write canary: MariaDB `ERROR 1142`, exit 1, no canary table;
- `PUBLIC` grants on `test`/`test_%` revoked and the disposable test database
  absent;
- process-boundary egress denied with `unshare -Urn`;
- WordPress root bind-mounted read-only with `unshare -Urnm`;
- ephemeral `/tmp` mounted as tmpfs;
- non-public clone hostname `phase-s.local.invalid`;
- no public listener;
- source `wp-config.php` replaced by a clone-only configuration containing no
  source DB/provider credentials;
- cron, queue dispatch, mail delivery and provider callbacks disabled in the
  clone, with the network namespace as the final egress fence;
- persistent Object Cache Pro drop-in absent; cache writes consequently bound
  to the same read-only clone credential;
- source database accessed only for a consistent dump; all provisioning writes
  were confined to the private clone.

The initial clone attempt
`tickera-20260904T075731Z-f1e58d9` stopped before import because its MariaDB
Unix socket exceeded the 107-byte platform limit. Its transient SQL dump was
hashed and removed during cleanup.

## Runtime results

### Frozen runner

The exact frozen runner and validator were used first:

- runner SHA-256:
  `341f988cf8f83056402ce04d9ca8ecf5e6baf2f6249c66aa754e0bcc4cf33730`;
- validator SHA-256:
  `9f6f07a1a60392d4b0d14d5d8ab619dff39683bb2e429edcc22e46666040216d`;
- total queries observed: 83;
- accepted `SELECT`/`SHOW`: 76;
- blocked non-read attempts: 7;
- result: `STOP` before the complete WordPress lifecycle.

### Expurgated diagnostic run

A diagnostic-only copy of the runner was used to let the external read-only DB
credential reject writes while recording operation classes and call stacks.
It was never accepted as release evidence.

The real WordPress request reached the REST callback and proved:

- response status 200 with valid JSON and valid auth semantics;
- Tickera loaded from the exact expected bytes;
- stateless shim loaded from the exact expected bytes;
- allowlist matched;
- `Tickera\\TC::update_cart` priority 10 before the guard and absent after it,
  through WordPress shutdown and the late reporter;
- zero calls to all nine PHP session-handler operations;
- zero business mutation hooks;
- 344 total SQL attempts, of which 297 were `SELECT`/`SHOW` and 47 were
  non-read operations rejected by the clone credential;
- one WordPress HTTP attempt, blocked before transport;
- response remained 200 despite the rejected unrelated operations.

The 47 SQL attempts were attributed without retaining query values in this
report:

- two connection-local `SET` statements from MailPoet Doctrine;
- Check-in facts schema/install checks;
- Jetpack sync queue, transient and option maintenance;
- WooCommerce/plugin default option maintenance.

This is a runner/protocol compatibility blocker. Suppressing these plugins or
silently reclassifying their operations would no longer prove the exact active
staging runtime, so no PASS was manufactured.

## Cleanup and postflight

- successful clone evidence manifest SHA-256:
  `01ac2a3965d4cd0557856b8832fe7111176b640fd8e40b2bec6845c9ed6685e2`;
- both clone copies of the candidate shim removed;
- private MariaDB stopped and private socket absent;
- successful-clone lock absent;
- failed-clone lock absent;
- shared staging mono-writer absent;
- staging `HEAD /`: HTTP 200 and no `PHPSESSID`;
- staging shim hash unchanged at `700b353e...e222`;
- no staging DB, option, cache, SMTP, provider, order, payment, ticket, stock,
  session, cron or runner mutation was performed;
- production untouched.

The quarantined clone directories and sealed evidence remain private for a
future tooling repair. Deleting them is a separate destructive action.

## Permanent next action

Create a new, reviewed Phase S tooling candidate that models the exact active
plugin stack instead of requiring the impossible invariant “all SQL is
`SELECT/SHOW`”. It must distinguish harmless connection-local SQL from data
mutation, keep the external `SELECT`-only credential as the authoritative
write fence, disable Jetpack/Check-in/MailPoet background subsystems through
documented vendor controls without filtering active plugins out of the
runtime, and add a PII-safe first-attempt HTTP stack. Re-run the isolated CLI
gate only after those controls have dedicated tests. The real HTTPS matrix and
any production promotion remain blocked until that new gate passes.

## Local repair status

The follow-up candidate implements the permanent gate repair locally: the two
observed MailPoet connection-local statements are allowlisted by exact syntax
and counted independently; all other non-read SQL still fails closed. A
hash-bound clone-only MU guard suppresses Jetpack sync loading, async runner
dispatch, WordPress mail delivery and the Check-in schema installer without
altering the active-plugin inventory. It also preserves Tickera/Freemius'
cloned `fs_active_plugins` inventory during plugin inclusion. The guard
requires an explicit clone
constant and a `.invalid` hostname, so an accidental staging/production copy
is inert. This section is implementation status only, not new Phase S runtime
evidence; the quarantined run remains `QUARANTINED_NO_GO` until a separately
authorized clean clone rerun succeeds.
