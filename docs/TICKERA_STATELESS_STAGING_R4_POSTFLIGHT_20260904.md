# Tickera stateless public guard — staging R4 postflight

## Result

`STAGING_CANARY_PASS_ACTIVE`

- Branch: `fix/tickera-stateless-public-20260901`
- Candidate: `f1e58d9aeb81bd6ff8e5ffa66b04364f74757ddb`
- Plugin version: `0.3.2`
- Canonical candidate SHA-256:
  `700b353ecb865daa48f0f842c764a415ddce2ab716358cff644a6b98b830e222`
- Active staging target:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html/wp-content/mu-plugins/tbl-tickera-stateless-rest.php`
- Remote manifest:
  `/home/1525593.cloudwaysapps.com/wvvtwdcenn/private_html/tbl-deploy/tbl-tickera-stateless-staging-20260904T073136Z-f1e58d9-r4`
- `MANIFEST.sha256` SHA-256:
  `0a943d3e438636afd9da87e49cf75095d58a805638d3ef5fb20fe329fce4f4c0`

The first anonymous `HEAD /` returned HTTP 200 without `PHPSESSID`. The
bounded public matrix then returned HTTP 200 without `PHPSESSID` for all six
cases: GET home-data, HEAD events-data, HEAD event 13459, HEAD product 13845,
literal `rest_route` HEAD shop-data, and OPTIONS home-data. A post-lock
anonymous `HEAD /` remained HTTP 200 without `PHPSESSID`.

The local gate passed 130/130 Tickera product and runtime-validator tests.
PHP lint, TypeScript check, ESLint and the production server build passed.

Tickera, Bridge for WooCommerce, all neighboring MU-plugins and WordPress
drop-ins matched their preflight hashes after promotion. The run made no cart,
checkout, payment, SMTP/provider, database, cache, cron, Action Scheduler or
production request. The mono-writer was removed after exact owner verification
and independently observed absent through application SSH, master SSH and
SFTP.

## Preceding stopped candidates

- `7d4197f` was rolled back after its first `HEAD /` still emitted
  `PHPSESSID`; sealed manifest SHA-256 `ed241ee1673e2f4369bfee30c2d4a647c7f7b6f0067d30d2d7046e198c3e36c4`.
- `ec71fdc` was rolled back after its first `HEAD /` still emitted
  `PHPSESSID`; sealed manifest SHA-256 `b47ecdf689d551d6e2210e6b088548e6781a16a8d50ec5a18a3e528d7cf7301d`.

Both stopped runs ended with the target absent, neighbor/vendor/drop-in hashes
restored, and the mono-writer absent on all three transports.

## Remaining release gates

This R4 result proves the bounded ordinary-staging public canary. It does not
replace the separately authorized isolated Phase S runtime qualification, the
separately authorized Phase C commerce compatibility run, or a fresh
production preflight and production GO.
