# PHP session cookie hardening — 2026-08-29

## Scope and observation

Read-only HTTPS probes showed that production REST responses, including the REST
index, a core `wp/v2` route, Rewards config, mobile web-session and public event
routes, could emit `PHPSESSID` with `Path=/` but without `Secure`, `HttpOnly` or
`SameSite`. The cookie value was redacted and is not recorded. The same probes on
staging showed the existing MU guard applying `Secure`, `HttpOnly` and
`SameSite=Lax`.

The common behavior on unrelated REST routes means the cookie originates from a
global plugin session, not from the Rewards, web-session or public-event callback
itself. None of the three route callbacks contains `session_start()`. A read-only
search of the active staging plugin tree on 2026-08-29 identified the frontend
owners below (line numbers describe that deployed snapshot):

| Owner | Direct `session_start()` locations |
| --- | --- |
| Tickera | `tickera/includes/classes/class.session.php:115`, `tickera/includes/general-functions.php:376`, `tickera/includes/classes/class.payment_gateways.php:151` |
| Tickera duplicate package | the same three relative locations below `tickera-event-ticketing-system/` |
| Seating Charts | `seating-charts/includes/classes/class.shortcodes.php:40`, `seating-charts/includes/class.tc_firebase.php:64,135,328,367`, `seating-charts/seating-charts.php:1845,2370` |
| Breeze | `breeze/inc/functions.php:418` (conditional currency session) |
| MailPoet | `mailpoet/mailpoet_initializer.php:60` (debugger path) |

Additional hits exist in conditional admin or bundled vendor paths (CSV export,
Google Listings, WP File Manager and libraries), but they are not the source path
for the three public REST probes. The policy is nevertheless set globally before
all normal plugins, so any later valid session owner receives the same flags.

| Public probe | Route callback starts a session | Observed session source class |
| --- | --- | --- |
| Rewards configuration | no | global frontend plugin bootstrap |
| Mobile web-session | no | global frontend plugin bootstrap |
| Public event detail/list | no | global frontend plugin bootstrap |

## Candidate policy

`scripts/tbl-rest-security-hardening.php` is a local-only candidate derived from
the currently active staging MU guard. It configures PHP before normal WordPress
plugins load and again on Tickera's pre-session hook. It never calls
`session_start()`.

- `Path=/`
- `HttpOnly=true`
- `SameSite=Lax`, preserving same-origin anonymous/JWT requests and top-level
  OAuth returns
- `Secure=true` for native HTTPS, trusted proxy HTTPS, port 443, or a WordPress
  production environment
- session cookies only and strict-mode session identifiers

No PHP session, WordPress option, database row, cache, order, payment or provider
call is created by the guard or its harness. Deployment remains forbidden until
a separately coordinated mono-writer window and baseline hash check.
