# Tickera stateless public-read guard — rollout and rollback

## Status and scope

`LOCAL_CANDIDATE / REMOTE_NO-GO`.

The candidate `scripts/tbl-tickera-stateless-rest.php` is a separate,
reversible MU shim. It prevents only Tickera's unconditional `update_cart`
callback on `wp_loaded` from opening a PHP session for an exact stateless
Mobile v2 read allowlist and the passive anonymous canonical homepage. It does
not start or destroy a session and does not delete `PHPSESSID` from a response.

No staging or production access, lock, upload, option, database, cache,
session, order, payment, ticket, stock or provider operation was performed for
this local candidate.

## Proven owner chain

The archived Tickera 3.6.0.2 source provides this chain:

1. `tickera.php:5301` instantiates the global `Tickera\TC` object;
2. its constructor registers `update_cart` on `wp_loaded` at default priority
   10 (`tickera.php:183`);
3. `update_cart()` reads `$this->session` before checking for a real cart action
   (`tickera.php:2763-2777`);
4. `TC_Session::get()` reaches `session_start()` through `maybe_init()` and
   `start()` (`includes/classes/class.session.php:27-29,48,112-115`).

This is a sufficient global cause on REST requests, although a different
plugin could start the first session earlier. The same ordering defect exists
in the retained Tickera 3.5.6.8 source.

## Exact allowlist

Only `GET`, `HEAD` and `OPTIONS` are eligible, in either pretty REST form
`/wp-json/...` or the literal query form `?rest_route=/...`:

- `/lamako-mobile/v2/rewards/config`;
- `/lamako-mobile/v2/web-session`;
- `/lamako-mobile/v2/public/home-data`;
- `/lamako-mobile/v2/public/events-data`;
- `/lamako-mobile/v2/public/events/<numeric-id>`;
- `/lamako-mobile/v2/public/shop-data`;
- `/lamako-mobile/v2/public/products/<numeric-id>`.

The classifier fails closed for unknown routes and methods, duplicate or
array-shaped `rest_route`, mismatches between the raw query and `$_GET`,
encoded/double-encoded separators, percent-bearing route values, backslashes,
repeated slashes, controls and dot segments. Checkout fields, profile,
authentication mutations, checkouts, payments, callbacks, seating, orders and
WooCommerce Store API routes are not allowlisted.

The only non-REST request eligible is exact `GET /` or `HEAD /`, with an empty
raw query, `$_GET`, `$_POST` and `$_FILES`, no method override or Authorization
header (including PHP-normalized Basic-auth variables), no
content-length/type/transfer-encoding body marker, no already-active PHP session,
and no PHP-session,
WordPress authentication or WooCommerce
session/cart cookie. `/index.php`, any query string (including analytics),
OPTIONS, authenticated visits, existing carts, `/cart/`, `/checkout/` and
`/paiement/` remain stateful. The guard does not claim that a later homepage
component cannot legitimately start a session; runtime qualification must
prove that the deployed canonical homepage has no such component path.

Any `_method` query override, `X-HTTP-Method-Override` header, normalized query
alias, semicolon separator or non-exact method token is rejected so the shim
and WordPress REST dispatch cannot reason about different methods. Query keys
are also allowlisted per route: only `summary`, `events_limit`,
`products_limit` and `limit` are accepted where the corresponding callback
actually consumes them. Unknown, duplicate, cart, checkout, payment, Woo AJAX
and Seating keys leave Tickera stateful.

## Preserved behavior

At the first `woocommerce_blocks_loaded` priority (`PHP_INT_MIN`), the shim
removes only the proven Bridge priority-10 bootstrap before it can read the
Tickera cart. At the first `wp_loaded` priority (`PHP_INT_MIN`), before
Tickera's proven priority 10, it independently removes Tickera's global cart
bootstrap. Each guard requires all of the following before any change:

FastCGI fields that exist with an empty value are treated as absent. Any
non-empty authentication identity, authorization value or method override
still fails closed. This matches the observed Cloudways/FPM request shape.

- the exact allowlisted request classification;
- the real loaded `Tickera\TC` global object;
- the independently qualified Tickera version `3.6.0.2`;
- a callable `update_cart` callback;
- `has_action( 'wp_loaded', [ $tc, 'update_cart' ] ) === 10`;
- a successful `remove_action()` followed by proof that the callback is gone.

If any condition fails, Tickera remains stateful. If post-removal verification
is not exact, the priority-10 callback is restored. The shim never touches
Tickera's `admin_post_*`, payment, cart, checkout or Seating/Firebase hooks and
does not alter REST CORS or JWT filters.

## Required future staging protocol

A future separately authorized staging window first performs the common code
phase:

1. inventory active plugin slugs/versions and hashes, including whether the
   duplicate `tickera-event-ticketing-system` package is inactive;
2. verify the active Tickera 3.6.0.2 callback object and exact priority 10
   without invoking it;
3. rehash the active REST security MU guard and Mobile v2 neighbors;
4. acquire the shared staging mono-writer atomically with a fresh owner and
   private manifest;
5. snapshot the MU-plugin directory metadata; the candidate target must be a
   new, absent `wp-content/mu-plugins/tbl-tickera-stateless-rest.php`;
6. upload a fresh private/HTTP-inaccessible next, rehash and PHP-lint it, then
   install it atomically with the normal MU owner/group/mode;
7. run the behavioral harness against the exact deployed bytes.

### Phase S — stateless session qualification only

Phase S is an independently reported, read-only gate. It must not be combined
with any commerce regression or cache warm-up:

- **do not run the front-controller probe against an ordinary writable
  staging runtime.** Before bootstrap, the runner requires a fresh private
  mode-`0600` isolation proof bound to the invocation, exact request,
  clone root/config, runner and validator hashes. It requires an independently
  rejected DB canary write plus a redacted DB-target fingerprint, isolated or
  write-denied cache plus its target fingerprint, process-boundary egress
  deny, read-only/ephemeral filesystem, absent production credentials,
  disabled workers/mail/callbacks and a one-hour-or-shorter expiry. A missing
  or mismatched gate is `STOP`;
- the runner accepts only a sealed isolated-clone `--wp-root`, forbids the
  source staging root `/home/1525593.cloudwaysapps.com/wvvtwdcenn/public_html`,
  and verifies the exact clone `wp-config.php` hash before including
  WordPress. The proof's non-production clone hostname and root must match;
- use `php -d session.use_strict_mode=1` and one fresh process per method,
  URL form and route with the private no-persist runner
  `scripts/qa-tickera-stateless-rest-runtime.php`. It installs and reinforces
  the complete session handler before Tickera and before the REST callback,
  counts `open/read/write/destroy/close/gc/createSid/validateId/updateTimestamp`,
  records handler module, `auto_start`, strict mode and status checkpoints,
  and never calls `session_write_close()`. If a session is unexpectedly active,
  it may use `session_abort()` only in the late reporter after WordPress
  `shutdown`. The reporter requires literal marker `wp_shutdown_seen`, emits
  exactly one report from destruction, and exits nonzero on every incomplete
  sequence;
- the WordPress `query` and `pre_http_request` filters throw/block and count,
  but their declared coverage is only `WPDB_QUERY_FILTER_ONLY` and
  `WP_HTTP_API_ONLY`. They do not prove anything about direct mysqli/PDO,
  Redis, cURL, streams or later filters; the independent DB/cache/egress gates
  above remain mandatory;
- independently validate its JSON evidence with
  `scripts/validate-tickera-stateless-rest-runtime.php`; the validator refuses
  even a component pass for absent/synthetic WordPress/Tickera runtime,
  missing isolation evidence, wrong script/config/plugin/invocation hashes,
  lost instrumentation, zero observed queries or an incomplete hook/shutdown
  sequence;
- require the exact Tickera and shim hashes, hook priority `10` before and no
  hook after, `session_status() === PHP_SESSION_NONE` at every checkpoint and
  zero calls to every session-handler operation;
- catalogue transient keys must already be warm and independently proven
  `HIT` before the window. Do not issue a priming request. If any key is cold,
  expired or uncertain, STOP Phase S and do not call that route. The runner
  re-reads the exact key and stops before the callback on `MISS`;
- require cache `HIT` again in the measured response, zero `set_transient`
  attempt, zero WordPress HTTP attempt, zero non-read `$wpdb` query and zero
  business hook. Do not relabel these counters as global `provider_calls=0` or
  `writes=0`;
- CLI does not reliably expose CORS, `Set-Cookie` or final web-server status.
  Its successful verdict is therefore only
  `COMPONENT_PASS_EXTERNAL_REQUIRED`, never a Phase S release PASS. CLI covers
  anonymous `/web-session` component semantics only. Execute a separate real
  HTTPS/FPM GET/HEAD/OPTIONS matrix for every allowlisted route and both pretty
  and literal `?rest_route=` forms, with anonymous and authenticated
  `/web-session` clients, proving JSON/CORS/JWT semantics and no `PHPSESSID`;
- do not call or simulate cart add/update, coupon, checkout, order creation,
  payment pages or callbacks, Seating/Firebase, provider APIs, cache purge or
  cache prime in Phase S.

The public-home component is qualified in its own fresh anonymous processes:
exact `GET /` and `HEAD /` must show zero session-handler operations and no
`PHPSESSID`; negative controls with a PHP/Woo/auth cookie, a query, `/cart/`,
`/checkout/` and `/paiement/` must keep Tickera's priority-10 callback. The
real HTTPS homepage must remain HTTP 200 with the same cache/body contract,
while the cart/checkout/payment controls retain their expected stateful
behavior. This is additive to, not a substitute for, the REST matrix.

The committed runner is intentionally not a local-runtime substitute. With no
real WordPress root it exits `STOP real_wordpress_runtime_required`; unit
fixtures validate only the gate shape and cannot be used as runtime or release
evidence. Phase S is PASS only when the isolated CLI component, real HTTPS/FPM
matrix, pre/post hashes, cache inventory and business counters are all sealed
without divergence.

### Phase C — commerce compatibility, separately authorized

Phase C starts only after Phase S is sealed PASS, its mono-writer is released,
and a new explicit GO, owner, lock, manifest and rollback are announced. It is
the only phase allowed to exercise Tickera cart add/update/coupon,
WooCommerce cart/checkout, payment callback logic or Seating/Firebase.

Use dedicated QA identities and fixtures, snapshot exact cart/session/order,
ticket, stock and transient state, forbid real provider authorization/capture
unless separately approved, and delete or restore every exact fixture before
postflight. Counts, hashes and relevant rows must match the declared expected
delta and return to baseline after cleanup. Any uncertain cleanup, unexpected
e-mail/provider call, order, ticket, stock or session delta is a STOP and
rollback, not a reason to continue Phase C.

Only after both phases are independently sealed may the operator preserve the
new MU file, seal neighbor hashes and business counters, release the lock after
owner verification and prove lock absence through an independent connection.

Unknown hook priority, active-plugin drift, any mutative method bypass,
missing/invalid JSON, CORS/JWT regression, `PHPSESSID` on an allowlisted fresh
request, session-handler write, or commerce regression requires immediate
rollback.

If `PHPSESSID` persists after this shim, capture a PII-free first-caller stack
in a separately authorized instrumentation window. Do not patch Breeze,
MailPoet or Seating speculatively.

## Rollback

The canonical rollback is removal of only
`wp-content/mu-plugins/tbl-tickera-stateless-rest.php`, using its sealed hash and
the same mono-writer protocol. No Tickera vendor file needs restoration because
the candidate modifies none. After removal, re-run the REST and commerce
matrix and verify neighbor hashes and business counters.

Production requires an independent staging PASS, fresh production baselines
and a separate explicit production authorization.
