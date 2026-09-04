# Tickera stateless public-read guard — production postflight

## Result

`PROMOTED`

The staging-qualified Tickera stateless public-read MU shim was promoted to
the production application `bvprmuerhv` after the user authorized the
production step. The only public filesystem change was the creation of:

`/home/master/applications/bvprmuerhv/public_html/wp-content/mu-plugins/tbl-tickera-stateless-rest.php`

The active SHA-256 is
`700b353ecb865daa48f0f842c764a415ddce2ab716358cff644a6b98b830e222`.
The deployed file is owned by `master_nqpwygdfqp:www-data` with mode `0644`.
It is byte-identical to the staging-qualified artifact. PHP lint passed before
the atomic rename. The local release gate passed 145/145 tests, PHP lint for
the shim/runner/validator, and TypeScript checking.

## Preflight and rollback

Before the write, production was confirmed as WordPress 7.1 with environment
type `production`, Tickera 3.6.0.2 active, the target absent and the production
lock absent. Neighboring MU-plugin hashes, ownership, modes and sizes were
sealed. The target did not exist before this release, so the complete rollback
is removal of only this file after exact owner and SHA-256 verification.

The historical lock location under `private_html/tbl-deploy` could not be
created by the available Cloudways master credential because that directory
is `0755` and owned by the application user. The attempt failed before any
file or manifest creation. No permissions were changed. The deployment used
the atomic, private, group-writable application-root lock instead:

`/home/master/applications/bvprmuerhv/private_html/.mono-writer.lock`

Owner: `tickera-stateless-prod-20260904T111956Z-700b353`.

Scope: `single-new-mu-shim-stateless-public-read-no-db-smtp-payment`.

## Runtime qualification

Before deployment, production `www` responses for rewards configuration,
public home data, public events data and public shop data returned their
existing HTTP 200 JSON payloads while emitting `PHPSESSID`. The canonical
homepage returned HTTP 200 without that cookie.

After deployment:

- the seven-route GET/HEAD/OPTIONS matrix, using both pretty and literal
  `rest_route` forms, passed 42/42 with the existing status classes
  (`200`, access-controlled `403`, or missing-fixture `404`) and no
  `PHPSESSID`;
- canonical homepage GET and HEAD remained HTTP 200 without `PHPSESSID`;
- requests containing `Origin: https://app.ticketbylamako.com` preserved the
  expected CORS response on successful public routes and all OPTIONS checks;
- no cache purge or PHP-FPM restart was required: real HTTPS requests proved
  that the new MU file was loaded by production PHP workers.

An initial apex-only pass emitted `PHPSESSID` once on public home data and once
on public events data. Immediate bounded no-cache repetition across apex and
`www` was clean in all 24 affected-route requests. This transient is retained
as residual evidence and was not hidden.

## Invariants

The database and neighboring MU-plugin baselines were byte-for-byte identical
before and after promotion:

- WooCommerce sessions: 2;
- legacy orders: 715;
- HPOS orders: 1,823;
- Tickera ticket instances: 4,700;
- Tickera ticket types: 2;
- Action Scheduler: pending 23, in-progress 0;
- WP Mail SMTP log rows: 6,118;
- users: 273, maximum ID 274;
- usermeta rows: 11,418.

No SMTP, provider, payment, order, ticket, stock, runner or wp-cron operation
was performed. No production database, option, cache, plugin, drop-in or
neighboring MU-plugin was changed.

## Evidence and final lock state

Private manifest:

`/home/master/applications/bvprmuerhv/private_html/tickera-stateless-prod-20260904T111956Z-700b353`

SHA-256 of `MANIFEST.sha256`:

`fd6162975d0ae30f0dba1dd683877933ab17b7781ca20760e23ba696bb82cd6d`

The actual private-root mono-writer was removed after exact owner validation.
Both that path and the historical `tbl-deploy` lock path were confirmed absent
through a second SSH connection. SFTP independently listed both private
locations with exit code zero and no `.mono-writer.lock` entry.

The exposed Cloudways application password from the task transcript was not
used. The successful release used the existing dedicated SSH key. That
password should still be rotated.
