# REST `PHPSESSID` source chain — local attribution

## Decision and scope

This is a local, read-only attribution. No staging or production connection,
lock, probe, flag or cache operation was performed. The active staging MU guard
is known from the sealed qualification as SHA-256
`EBED8D97DD9336DC6332844FC43EF417DB1EB929F344D1F15C950F559A32D06E`.
It hardens a later PHP session cookie but never starts a session.

The exact initiating call in the currently active server process cannot be
selected among third-party plugins without a fresh stack trace. Such remote
instrumentation is explicitly excluded from this lot. The chain up to that
boundary and the candidate-owned non-sources are proven locally.

## Proven request chain

1. A request enters WordPress through `index.php`, `wp-blog-header.php`,
   `wp-load.php`, `wp-config.php` and `wp-settings.php`.
2. MU plugins load before normal plugins. `tbl-rest-security-hardening.php`
   applies `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, cookies-only and
   strict-mode settings. It calls neither `session_start()` nor a provider or
   persistence API.
3. Normal active plugins bootstrap before WordPress dispatches the REST route.
   A global Tickera/Seating/Breeze/MailPoet path can therefore call
   `session_start()` and schedule `Set-Cookie: PHPSESSID=...` before the REST
   callback runs.
4. Mobile API v2 loads `v2-commerce.php`, which loads
   `mobile-web-router.php`. The router only registers a `wp_head` callback and
   also excludes `REST_REQUEST`; REST responses never render its browser
   script. It contains no `session_start()`.
5. `rest_api_init` registers `/rewards/config`, `/web-session` and
   `/public/events...`. Their code reads options/posts/users and builds REST
   responses; the entire `v2-commerce.php` source contains no
   `session_start()`.
6. The already-started global PHP session cookie is emitted with the REST
   response. The MU guard controls its attributes but is not its owner.

Current candidate-owned source hashes:

- Mobile v2: `4417AA27E7A39A99769E667268B406354DEABE32BBBD05E28E5D9A27EE4F53FA`;
- Rewards API: `B03338E3DA34E241C16D4D86242378BCC978028EFBCF6D19BC10ECA6CCC25F2C`;
- hardened router: `B9EB558295DE85D3870791B61FEC5077C25BA165B8AC8CE24B9D72870C717B66`.

## Historical direct-start owners

The prior authorized read-only staging inventory recorded these direct calls
in the deployed snapshot:

| Owner | Direct `session_start()` locations |
| --- | --- |
| Tickera | `tickera/includes/classes/class.session.php:115`; `tickera/includes/general-functions.php:376`; `tickera/includes/classes/class.payment_gateways.php:151` |
| Duplicate Tickera package | the same three relative locations under `tickera-event-ticketing-system/` |
| Seating Charts | `seating-charts/includes/classes/class.shortcodes.php:40`; `seating-charts/includes/class.tc_firebase.php:64,135,328,367`; `seating-charts/seating-charts.php:1845,2370` |
| Breeze | `breeze/inc/functions.php:418`, conditional currency session |
| MailPoet | `mailpoet/mailpoet_initializer.php:60`, debugger path |

Because `PHPSESSID` was observed on unrelated public REST routes, a global
frontend bootstrap path is the source class. Tickera's session bootstrap is the
primary suspect, but naming one exact call as proven would exceed the retained
evidence. Seating, Breeze and MailPoet remain alternatives until the owner lot
captures a call stack or disables candidates one at a time in an authorized
staging window.

## Separate stateless correction

A response-layer cookie deletion or a second MU `session_start()` is rejected:
both would hide or repeat the stateful operation rather than make REST
stateless. PHP provides no safe generic hook that can cancel an arbitrary later
built-in `session_start()` call.

The minimal real correction belongs at every active direct-start call site:

1. introduce one early, side-effect-free request classifier in the session
   owner package that recognizes the path and `?rest_route=` before
   `REST_REQUEST` is defined;
2. return before `session_start()` only for an exact fail-closed candidate
   allowlist of GET/HEAD/OPTIONS routes, each still pending behavioral proof of
   transitive PHP-session independence:
   `/lamako-mobile/v2/rewards/config`, `/web-session`, `/public/home-data`,
   `/public/events-data`, `/public/events/<id>`, `/public/shop-data` and
   `/public/products/<id>`; unknown routes, methods and malformed encodings are
   not silently reclassified;
3. apply the same guard to the duplicate Tickera package and each actually
   active Seating/Breeze/MailPoet start path;
4. do not disable the complete plugins, do not emit an expired `PHPSESSID`, and
   do not replace persistence with an in-memory/no-op session handler;
5. keep WordPress logged-in cookies, JWT and WooCommerce's own purpose-specific
   cookies independent from PHP's global session.

A blanket `/wp-json/` bypass is explicitly rejected. Mobile v2 also exposes
checkout, payment, seating, order and authentication mutations, and other
plugins may have stateful REST endpoints. Expanding the stateless allowlist
requires route-by-route proof rather than an assumption based on the HTTP
method alone.

This must be a separately owned third-party-plugin candidate. Those complete
sources are not present in this worktree, so fabricating an unverified patch
here would be unsafe. The route candidate `c8fbf9a7...` is intentionally
unchanged.

The static test proves only that the owned files contain no direct literal
`session_start()`. It does not prove transitive callbacks stateless:
`/rewards/config` may call the externally defined
`lr_rewards_public_config()`, while catalogue builders invoke WordPress,
WooCommerce and Tickera functions/filters. The owner qualification must capture
the first runtime caller and prove every allowlisted route in a fresh process
before the early return is enabled.

## Required non-regression qualification

Before any promotion of the stateless owner patch:

- PHP lint every changed owner file and prove source hashes/baselines;
- behavioral harness for every direct start: ordinary classic request retains
  its required session behavior, `/wp-json/...` and `?rest_route=...` record
  `session_start=0`;
- exact active-plugin inventory/hashes and a PII-free first-caller stack from a
  dedicated authorized instrumentation window;
- GET/OPTIONS for REST index, core `wp/v2`, rewards config, web-session and
  public home/events/event/shop return expected HTTP/JSON/CORS/JWT behavior;
- no `Set-Cookie: PHPSESSID` on those REST responses;
- no PHP session file/handler open/write/destroy event;
- `session_status() === PHP_SESSION_NONE` before and after each allowlisted
  callback in a fresh process, including transitive plugin hooks;
- no new `session_start()` in MU guard, Mobile v2, Rewards or router;
- authenticated cookie/JWT flows and anonymous catalogue remain functional;
- negative cases for mutative methods, encoded/ambiguous paths and all routes
  outside the allowlist, plus positive regression for legitimate classic
  Tickera/Seating/cart/checkout/payment session behavior;
- zero business DB/option/order/payment/ticket/stock/provider mutation during
  the read-only matrix. Public catalogue callbacks may call `set_transient()`
  on a cache MISS (`v2-commerce.php:123-127`), so the evidence must record
  session-handler writes separately from catalogue-cache writes and qualify a
  known warm-cache baseline. It must never misreport a cold-cache transient as
  a PHP session write or claim absolute `writes=0` without that distinction.

Security decision: **NO-GO for declaring REST stateless** until the active
third-party start call is captured and its owner patch passes this matrix. The
existing MU guard remains valuable defense in depth for legitimate non-REST
sessions but is not the stateless fix.
