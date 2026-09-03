# Temporary first PHP-session caller probe

## Status and boundary

`LOCAL_TOOLING_ONLY / REMOTE_NOT_AUTHORIZED`.

`scripts/tbl-session-first-caller-probe.php` is disposable diagnostic tooling,
not part of the Tickera stateless product candidate. It must never be bundled
into a normal release or left installed after one attributed request. This
local lot performed no remote access, lock, deployment, cache, database,
session, cron, provider or SMTP operation.

The probe does not call `session_start()`, destroy a session, modify cookies or
replace session data. When its complete gate passes before normal plugins, it
wraps PHP's current internal `SessionHandler`, delegates `open()` and all other
session operations to that handler, and records only the first `open()` stack.
An already-active session or an existing user-defined handler is a hard stop.

## Exact activation gate

All conditions are mandatory:

1. The operator generates a new 32-byte random token represented by exactly 64
   lowercase hexadecimal characters. The raw token is supplied only in the
   request header `X-TBL-Session-Probe-Token`; only its lowercase SHA-256 is
   placed in the private manifest described below.
2. The exact private file
   `private_html/tbl-session-first-caller-probe-config.json`, derived from the
   real `ABSPATH`, is a regular, non-symlinked, owner-owned mode-`0600` JSON
   file of at most 2048 bytes. It has exactly `schema`, `tokenSha256` and
   `outputPath`; `schema` is `1`. FPM reads this file directly, so no shell/FPM
   environment propagation or global FPM change is needed.
3. Its `outputPath` names an absent file matching
   `tbl-session-first-caller-[a-z0-9-]+.json` in an existing, writable,
   owner-only directory below the real `private_html` sibling of
   `public_html`. The probe creates no directory and refuses public, symlinked,
   or pre-existing output targets.
4. The request is exact anonymous `GET /` or `HEAD /`, with no query, body,
   upload, cookie, authorization, transfer encoding or method override. FPM
   may expose `CONTENT_LENGTH` as absent, empty or exactly `0`, and
   `CONTENT_TYPE` as absent or empty. Those representations all describe an
   empty body and pass; any other value fails the request-shape gate.
5. PHP has no active session and the existing session module is not `user`.

An invalid/missing private config, wrong token, active session, `user` handler
or unsafe output leaves the configured handler untouched and creates no file.
After a valid config and exact token match, a request-shape refusal or handler
registration failure consumes the exclusive output with a bounded refusal
report. The token, its hash, output path, query, cookies, authorization and
request headers are never included in evidence.

## Evidence contract

The output is created exclusively (`fopen(..., "x")`) and never overwritten.
One probe process records at most one trace. Concurrent processes targeting the
same absent path race safely: only the exclusive creator can write it.

Successful registration keeps the v1 JSON contract:

- schema version and event `first_session_handler_open`;
- UTC capture time and `GET` or `HEAD`;
- original session-handler module name;
- at most 32 stack frames with only normalized file label, line, function,
  class and call type.

If registration cannot proceed after the private-config/token checks, the
exclusive output instead contains event `probe_gate_refused`, a bounded reason
enum, request-shape booleans plus `GET`/`HEAD`/`OTHER`, bounded session-status
and module enums, and booleans for handler/config/output availability. It has
no timestamp, stack, raw request value, header, token, path, query or cookie.

`DEBUG_BACKTRACE_IGNORE_ARGS` excludes arguments. Files below the WordPress
root become `[ABSPATH]/...`; all other files become `[external]`. Anonymous
class symbols are redacted. No absolute application/user path, session ID,
session payload, query, cookie or token is retained. The private parent must
already be mode `0700` or stricter and owned by the PHP effective UID; the
probe attempts to set the new evidence file to `0600`.

## Future isolated execution

A separately authorized diagnostic window must use a fresh owner, manifest
and the shared mono-writer. Before installation, seal:

- probe commit/SHA-256 and exact private-manifest SHA-256;
- absent probe target and output file;
- active session module, `session.auto_start=Off`, PHP version and SAPI;
- active-plugin/MU/drop-in hashes and the exact request contract;
- private directory realpath, owner, group and mode.

Install only the probe as
`wp-content/mu-plugins/tbl-session-first-caller-probe.php`, preserving its
sealed bytes. Atomically install the sealed mode-`0600` private manifest
without placing the raw token in a repository, manifest, command transcript
or access log. Send
one exact `HEAD /` request with the token header. Any first-caller or refusal
report consumes that output path. Never retry with the same token or output;
a new authorized run requires a fresh token, manifest hash and absent output.
A missing report, malformed JSON, raw path, sensitive value, handler error,
HTTP regression or more than one evidence file is STOP.

The trace identifies a candidate caller; it does not itself authorize a
vendor, MU, configuration or product fix. Any correction requires a new local
owner-specific patch and qualification.

## Exact cleanup and rollback

Cleanup is mandatory in the same diagnostic window:

1. reread the lock owner and stop on mismatch;
2. verify the installed probe hash and evidence path equal the sealed manifest;
3. remove only `wp-content/mu-plugins/tbl-session-first-caller-probe.php`;
4. remove only the single sealed private JSON evidence after it has been
   copied into the private manifest and rehashed;
5. remove the now-empty dedicated evidence directory only after exact owner,
   mode and emptiness checks;
6. remove only the exact private probe manifest and prove a normal
   anonymous `HEAD /` no longer loads the probe;
7. rehash all MU/drop-in neighbors, release the lock after exact owner reread,
   and independently prove the lock absent.

Never remove a session file, cache object, plugin file, vendor file or unknown
output during cleanup. A hash, owner, path or lock mismatch stops cleanup and
escalates instead of broadening deletion.

## Local validation

The committed harness uses isolated temporary directories and the native
`files` handler. It proves authorized GET/HEAD activation, session data
round-trip, one immutable trace, normalized no-argument frames, FPM-empty
content metadata and exact zero content-length acceptance, bounded refusal
evidence for non-empty content
metadata/query/cookie, silent refusal for ordinary/wrong-token/public-path/
existing-output/active-session/user-handler cases, and exact fixture cleanup.
A future staging run must separately prove transparency with the actual
staging session module.
