# Tickera stateless Mobile v2 REST guard — rollout and rollback

## Status and scope

`LOCAL_CANDIDATE / REMOTE_NO-GO`.

The candidate `scripts/tbl-tickera-stateless-rest.php` is a separate,
reversible MU shim. It prevents only Tickera's unconditional `update_cart`
callback on `wp_loaded` from opening a PHP session for an exact stateless
Mobile v2 read allowlist. It does not start or destroy a session and does not
delete `PHPSESSID` from a response.

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

Any `_method` query override, `X-HTTP-Method-Override` header, normalized query
alias, semicolon separator or non-exact method token is rejected so the shim
and WordPress REST dispatch cannot reason about different methods. Query keys
are also allowlisted per route: only `summary`, `events_limit`,
`products_limit` and `limit` are accepted where the corresponding callback
actually consumes them. Unknown, duplicate, cart, checkout, payment, Woo AJAX
and Seating keys leave Tickera stateful.

## Preserved behavior

At the first `wp_loaded` priority (`PHP_INT_MIN`), after normal plugin and
`plugins_loaded` registration but before Tickera's proven priority 10, the shim
requires all of the following before any change:

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

A future separately authorized staging window must:

1. inventory active plugin slugs/versions and hashes, including whether the
   duplicate `tickera-event-ticketing-system` package is inactive;
2. verify the active Tickera callback object and exact priority 10 without
   invoking it;
3. rehash the active REST security MU guard and Mobile v2 neighbors;
4. acquire the shared staging mono-writer atomically with a fresh owner and
   private manifest;
5. snapshot the MU-plugin directory metadata; the candidate target must be a
   new, absent `wp-content/mu-plugins/tbl-tickera-stateless-rest.php`;
6. upload a fresh private/HTTP-inaccessible next, rehash and PHP-lint it, then
   install it atomically with the normal MU owner/group/mode;
7. run the local behavioral harness against the exact deployed bytes;
8. execute fresh-process GET/HEAD/OPTIONS probes for every allowlisted route in
   both URL forms where applicable, with expected HTTP, JSON, CORS and JWT
   behavior;
9. prove `session_status() === PHP_SESSION_NONE` before and after, no
   `Set-Cookie: PHPSESSID`, and zero PHP session-handler open/write/destroy;
10. separately distinguish permitted warm catalogue reads from a cold-cache
    `set_transient()`; do not label catalogue cache activity as a PHP-session
    write;
11. run positive regressions for Tickera standalone cart/add/update/coupon,
    WooCommerce cart/checkout, payment page/callback and Seating/Firebase;
12. seal hashes, reports, neighbor state and business counters before
    owner-verified lock release and independent absence verification.

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
