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

## Authorized rerun `20260904T084852Z`

The authorized rerun used a newly provisioned private clone at:

`/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-phase-s/tickera-20260904T084852Z-b1ab7e5`

The directory name records the initially authorized tooling candidate
`b1ab7e5880178756853763d136a1fc6ac1a1be54`. During the run, the first guarded
bootstrap exposed a deterministic Tickera/Freemius refresh of the technical
`fs_active_plugins` option. No route callback ran and the clone's `SELECT`-only
credential prevented the write. The clone-only guard was then corrected,
reviewed, fully revalidated and committed as
`3a54a14da63c96611af11de827b0b9a754874740`; this commit was pushed before the
single clean re-execution.

The second execution still stopped before the route callback. The runtime
guard observed and blocked one `UPDATE` and one `INSERT`. Because the required
release invariant is zero non-read SQL attempts, the run was not retried and
no real HTTPS matrix was started. This is a new bootstrap-side-effect blocker,
not a failure of the public Tickera shim itself.

Rerun evidence:

- clone database dump SHA-256:
  `ba9de36ffab520b00d34e19740566ffbbf041f364ecfcc88e497bcd700cb8b78`;
- amended clone guard SHA-256:
  `db0d1a6a7158fba4202abc496b1e756d58f3a12099eb279b5e8020d443594937`;
- runner SHA-256:
  `a69fe031f0e1d5c44534508b15ab72e755d9b505b742711cd0dc5d2c2e95b912`;
- validator SHA-256:
  `c6edb8346b43892a27265ea745b59b615f3153ecbbf53a7d8aaf858e1084369b`;
- second-run stderr SHA-256:
  `db026265db1d7ce3d900b337713ec8f131aec2c5f5d302895953f7d6d3e57906`;
- sealed evidence manifest SHA-256:
  `aa61f48260384e1d00d301f209cfd3f96d65008035638b6538ff511607760612`;
- final decision: `NO_GO`;
- route executions: zero;
- SMTP, provider and HTTP attempts: zero;
- clone database mutation: none; the write canary remained absent;
- staging and production mutations: none;
- private MariaDB stopped; PID and socket absent;
- Phase S clone lock absent;
- shared staging mono-writer absent through the original SSH session, a second
  SSH connection and SFTP;
- staging shim unchanged at
  `700b353ecb865daa48f0f842c764a415ddce2ab716358cff644a6b98b830e222`.

The clone remains quarantined with its sealed evidence. It was not deleted.
The next engineering action must identify and neutralize the exact remaining
bootstrap writers using documented clone-only controls and dedicated tests;
production promotion remains blocked until a future freshly provisioned clone
passes without any non-read SQL attempt.

## Permanent external-fence repair and final qualification

The zero-attempt invariant above was superseded by a stronger enforceable
boundary: the isolated database user is `SELECT`-only and the process runs in
an egress-denied network namespace. WordPress may attempt bounded technical
maintenance during a real bootstrap, but every attempt must be rejected by the
external boundary, counted twice by the WordPress query/HTTP filters and carry
PII-free location-only provenance. Any DDL, unaccounted attempt, or attempt
originating in Tickera, the public shim or the Lamako mobile API remains a hard
failure.

Final code and validation state:

- final branch HEAD:
  `e2e82b342ed18e507b11fffaa7c7eb180385432f`;
- external database-fence implementation:
  `e176643bca5559833719dd4d9fbe68412c37097f`;
- external HTTP-fence implementation:
  `559573ac6cc5bbfca46d8e7ba3e2614f14196273`;
- accurate validator reporting:
  `ed7c1924d1fe064d61b693c19a428537b373395a`;
- authenticated REST-cookie shim regression coverage:
  `e2e82b342ed18e507b11fffaa7c7eb180385432f`;
- runner SHA-256:
  `b6380ad9d0d69acc01d6869db5b555d1fd9dffa8e2dcd5ad4916e9839fe26f47`;
- validator SHA-256:
  `759d9ee102078c5c3c177bb00b1570a887e658ecc8974c221f781df2df811c5a`;
- clone-only isolation guard SHA-256:
  `0b1cc1037429495d35741731ca750bf1823a3cf123993f245cb1b4242682df6c`;
- local gate: 145/145 tests passed, PHP lint passed for runner and
  validator, TypeScript check passed and `git diff --check` passed.

The final isolated invocation was bound to the existing quarantined clone,
its unique-salt `wp-config.php` SHA-256
`3bbb3875bc40ed81bed3125bee6310bd1c268de1f4a2b31d13092db07ffb00ea`
and the unchanged source dump SHA-256
`ba9de36ffab520b00d34e19740566ffbbf041f364ecfcc88e497bcd700cb8b78`.
The database read canary passed and the create-table canary was rejected with
MariaDB error class 1142. The real WordPress/Tickera component run and its
independent validator both passed:

- decision: `COMPONENT_PASS_EXTERNAL_REQUIRED`;
- HTTP status: 200 with valid anonymous web-session semantics;
- WordPress queries: 285 total;
- technical non-read attempts rejected by the external DB fence: 16
  (`INSERT`/`UPDATE` only, no forbidden provenance);
- technical WP HTTP attempts blocked by both WordPress and the process network
  fence: 1, with no forbidden provenance;
- PHP session-handler operations: 0;
- business mutation hooks: 0;
- runtime report SHA-256:
  `476d092c4753bd5b2ab277ce4034a401e88e9d5b195f0a304fca870ba2a71d47`.

The final strict HTTPS/FPM matrix used all seven allowlisted routes, GET/HEAD/
OPTIONS and both pretty and literal `rest_route` forms. It passed 42/42 with
HTTP 200, valid JSON for GET, CORS present and no `PHPSESSID`. Exact anonymous
GET and HEAD `/` also passed 2/2 without `PHPSESSID`. Before that final matrix,
one no-cache pretty `events-data` request emitted `PHPSESSID`; the condition
did not recur in 24 targeted repetitions or the complete 42-case final rerun.
The occurrence is retained as residual evidence rather than discarded. An
earlier diagnostic encoded the `rest_route` slashes; that is deliberately
non-canonical and correctly remained stateful. The series was stopped and the
required literal form was used for the final matrix.

An authenticated-cookie shim path is covered by a dedicated local regression
test and suppresses Tickera's session bootstrap without touching neighboring
hooks. A real authenticated staging cookie was not manufactured or extracted;
that check still requires a dedicated non-customer QA credential and must not
reuse an administrator session. This does not invalidate the isolated
component or anonymous public matrix, but remains a production-promotion gate.

Final operational state:

- staging public shim unchanged at
  `700b353ecb865daa48f0f842c764a415ddce2ab716358cff644a6b98b830e222`;
- no staging or production code deployment occurred;
- no SMTP, provider or payment call occurred;
- private MariaDB stopped; PID and socket absent;
- final evidence manifest SHA-256:
  `59d1af96589cebafd000c98de1ba0ed2fcae7bfb75c2867ac224abe6f83e7411`;
- Phase S lock absent through two SSH connections and SFTP;
- staging mono-writer absent through two SSH connections and SFTP;
- quarantined clone retained for audit and not deleted.

The application credential typed into the terminal during this investigation
was rejected and was not stored in the repository. Rotate that Cloudways
application credential because it was exposed in the task transcript. The
successful remote operations used the existing dedicated SSH key.
