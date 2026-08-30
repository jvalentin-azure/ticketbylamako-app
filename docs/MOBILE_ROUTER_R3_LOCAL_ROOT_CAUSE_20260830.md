# Mobile router R3 local root-cause and correction

## Scope and sealed evidence

This work is local only. R3 ended as `ROLLED_BACK_NO_GO`; staging was restored
and its mono-writer was absent on both validation transports. The sealed
manifest SHA-256 is
`492879d17009bdf6faa7bab9bffdc4085d7ad7bb09bf32e4cf3ca55c00289464`.
No staging or production connection, flag, cache or file is changed by this
correction.

## Root causes

### Payment returned to the mobile cart

`/paiement/` was already excluded from automatic mobile routing. With an empty
WooCommerce cart, WordPress redirected that request to `/cart/`. The second
request was a public path to the router and was consequently mapped to
`/mobile/cart`.

The router now treats `/cart` and its localized `/panier` alias as
transactional fail-closed prefixes, including nested, query-string and encoded
forms. This preserves the complete classic checkout/payment chain after a
server redirect instead of protecting only its first URL.

The same fail-closed boundary now excludes every non-GET request and the
WooCommerce mutation query keys `wc-ajax`, `add-to-cart`, `remove_item`,
`apply_coupon` and `update_cart`. The UX router cannot be injected into a
state-changing response.

### Desktop and explicit-classic false failure

The router script is deliberately injected into cache-safe WordPress HTML. A
desktop or `?desktop=1` response can therefore contain its marker while the
script correctly performs no navigation. R3 incorrectly used marker presence
as a failure.

The corrected control gate records the marker as diagnostic evidence and
requires the real behavior instead: the final path stays outside `/mobile`, no
mobile document is requested, and no router replacement is attempted. It also
parses an absolute URL, enforces the expected origin, decodes the path twice,
normalizes repeated slashes and rejects missing, malformed, off-origin or
encoded mobile destinations. Desktop and explicit-classic controls require one
cache-safe marker; the excluded payment return requires none.

### First onboarding slide false failure

R3 counted network URLs containing the source filename for slide 1. Expo may
hash, preload or satisfy that image from memory, so a visible, decoded slide
can legitimately produce a filename count of zero.

The corrected gate proves what WebKit rendered: title and action visible,
image element present, `complete=true`, positive natural dimensions and
positive viewport dimensions and a finite intersection ratio in `(0, 1]`.
Slide identity, active index and contract text are checked together. Missing,
unknown, undecoded, non-finite or off-viewport images still fail. HTTP, TLS,
CORS and image-load failures remain independently blocking; the change is not
a waiver.

## WordPress-control attribution

The retained local WebKit console evidence attributes the repeated HTTP 403s
exactly to:

- `/wp-content/plugins/cafe-events-carousel/assets/css/front.css?ver=3.1.18`;
- `/wp-content/plugins/cafe-events-carousel/assets/js/front.js?ver=3.1.18`.

The locally archived plugin source confirms ownership and registration of
both assets in `cafe-events-carousel.php` version `3.1.18`. Reference hashes
from that separately owned backend worktree are:

- plugin PHP: `BE867B348151507DB8E988469AD7094F71C91BFF71537C1D9B575615AE7B4E85`;
- `front.css`: `5F34D8699D9D8A53E2FAC75FB3FE2D0ED6E3471F3A16D0CC8F5BB53E900A1E45`;
- `front.js`: `997618DA19C70FE4353A3587652F17D23ACB8A910994C6077F037A10C4787617`.

The HTTP status is therefore an asset-serving permission/policy or deployed
file-state problem, not a mobile-router response. It cannot be repaired in
this worktree without crossing backend ownership. The local release gate keeps
every such 403 blocking and reports it as `wordpress-control-debt`.

The same console trace separately attributes warnings to:

- `themes-kingdom/the-marquee-block`, registered with block API version 1;
- legacy jQuery calls reported by `jquery-migrate`;
- Complianz `opt-in` logging;
- intercepted WooCommerce/floating-cart refreshes, which remain mutation
  attempts and are never transmitted by the read-only harness.

Those owners require their own local candidates and staging qualifications.
This router lot neither suppresses the messages nor weakens the zero-error
release gate. The environment gate passes only with zero carousel 403s, other
HTTP errors, console issues, page errors, mutation attempts and transmitted
mutations.

The future runner must consume the single composed
`evaluateWebKitRouterReleaseGate()` verdict. It requires both onboarding
slides exactly once, desktop root, explicit classic and payment-return controls
exactly once, the full content scenario, and a clean WordPress control. A
partial collection cannot be qualified accidentally.

## Validation contract for a future run

A future staging attempt is not authorized by this document. Before proposing
one:

1. the WordPress asset owner must prove both carousel files return HTTP 200 and
   remove the associated console errors;
2. desktop, `?desktop=1`, `/paiement/`, `/cart/` and `/panier/` must remain on
   classic WordPress without a mobile document or replacement;
3. onboarding slide 1 and slide 2 must pass rendered viewport evidence without
   relying on asset filenames;
4. first-use and seeded-content scenarios remain separate;
5. event `13459` must render the exact title and 27 June, never 3 May, and pass
   deep refresh;
6. all mutation, HTTP, TLS, CORS, JSON, console, page, BlurHash and overflow
   gates remain fail-closed.
