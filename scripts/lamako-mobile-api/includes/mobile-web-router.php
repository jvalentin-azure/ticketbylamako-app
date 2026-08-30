<?php
/**
 * Routes phone-sized WordPress visitors to the non-installable Expo web app.
 *
 * Detection runs in the browser so full-page caches cannot accidentally cache
 * a mobile HTTP redirect and serve it to desktop visitors. Search engines and
 * WordPress keep receiving the canonical HTML; the switch is UX-only.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'wp_head', 'lamako_mobile_web_render_router', 0 );

function lamako_mobile_web_request_path() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] )
        ? wp_unslash( $_SERVER['REQUEST_URI'] )
        : '/';
    return '/' . ltrim( (string) wp_parse_url( $request_uri, PHP_URL_PATH ), '/' );
}

function lamako_mobile_web_has_transaction_query() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] )
        ? wp_unslash( $_SERVER['REQUEST_URI'] )
        : '';
    $query       = (string) wp_parse_url( $request_uri, PHP_URL_QUERY );
    $parameters  = [];
    if ( $query !== '' ) {
        parse_str( $query, $parameters );
    }
    $parameters = array_merge( $parameters, (array) $_GET );
    $keys       = array_map( 'strtolower', array_map( 'strval', array_keys( $parameters ) ) );

    return (bool) array_intersect(
        $keys,
        [
            'lamako_checkout',
            'lamako_checkout_token',
            'lamako_seat_embed',
            'lamako_seating_checkout',
            'lamako_seating_token',
            'pay_for_order',
            'wc-api',
            'wc_api',
        ]
    );
}

function lamako_mobile_web_is_excluded_request() {
    if (
        is_admin()
        || wp_doing_ajax()
        || ( defined( 'REST_REQUEST' ) && REST_REQUEST )
        || is_feed()
        || is_robots()
        || is_trackback()
        || is_preview()
        || lamako_mobile_web_has_transaction_query()
    ) {
        return true;
    }

    $path       = strtolower( lamako_mobile_web_request_path() );
    $path_forms = [ $path ];
    for ( $decode_pass = 0; $decode_pass < 2; $decode_pass++ ) {
        $decoded_path = strtolower( rawurldecode( end( $path_forms ) ) );
        if ( $decoded_path === end( $path_forms ) ) {
            break;
        }
        $path_forms[] = $decoded_path;
    }
    $excluded_prefixes = [
        '/mobile',
        '/wp-admin',
        '/wp-login.php',
        '/wp-json',
        '/checkout',
        '/checkout-2',
        '/paiement',
        '/commande',
        '/commande-recue',
        '/order-pay',
        '/order-received',
        '/thankyou',
        '/wc-api',
        '/lamako-mobile',
    ];
    foreach ( $path_forms as $candidate_path ) {
        foreach ( $excluded_prefixes as $prefix ) {
            if ( $candidate_path === $prefix || strpos( $candidate_path, $prefix . '/' ) === 0 ) {
                return true;
            }
        }
    }

    return false;
}

function lamako_mobile_web_target_path() {
    if ( is_singular( 'product' ) ) {
        $product_id = (int) get_queried_object_id();
        return $product_id > 0 ? '/mobile/product/' . $product_id : '/mobile/shop';
    }
    if ( is_singular( 'tc_events' ) ) {
        $event_id = (int) get_queried_object_id();
        return $event_id > 0 ? '/mobile/event/' . $event_id : '/mobile/events';
    }

    $path = strtolower( trim( lamako_mobile_web_request_path(), '/' ) );
    if ( preg_match( '#^(evenements?|events?)(/|$)#', $path ) ) {
        return '/mobile/events';
    }
    if ( preg_match( '#^(boutique|shop)(/|$)#', $path ) ) {
        return '/mobile/shop';
    }
    if ( preg_match( '#^(panier|cart)(/|$)#', $path ) ) {
        return '/mobile/cart';
    }
    if ( preg_match( '#^(mes-commandes|my-account/orders)(/|$)#', $path ) ) {
        return '/mobile/orders';
    }
    if ( preg_match( '#^(mon-compte|my-account)(/|$)#', $path ) ) {
        return '/mobile/profile';
    }

    return '/mobile/';
}

function lamako_mobile_web_render_router() {
    if (
        ! defined( 'LAMAKO_MOBILE_WEB_ENABLED' )
        || ! LAMAKO_MOBILE_WEB_ENABLED
        || lamako_mobile_web_is_excluded_request()
    ) {
        return;
    }

    $target  = home_url( lamako_mobile_web_target_path() );
    if ( defined( 'LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT' ) ) {
        $configured_rollout = LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT;
        $rollout            = is_numeric( $configured_rollout )
            ? min( 100, max( 0, (int) $configured_rollout ) )
            : 0;
    } else {
        $rollout = 100;
    }
    ?>
<script id="ticketbylamako-mobile-web-router">
  (function () {
    try {
      function readStorage(name, key) {
        try {
          var storage = window[name];
          return { ok: true, value: storage.getItem(key) };
        } catch (error) {
          return { ok: false, value: null };
        }
      }

      function writeStorage(name, key, value) {
        try {
          window[name].setItem(key, value);
          return true;
        } catch (error) {
          return false;
        }
      }

      var query = new URLSearchParams(window.location.search);
      if (query.get("desktop") === "1") {
        writeStorage("sessionStorage", "ticketbylamako_desktop_session", "1");
        return;
      }
      var desktopSession = readStorage("sessionStorage", "ticketbylamako_desktop_session");
      if (desktopSession.ok && desktopSession.value === "1") return;

      var userAgent = window.navigator.userAgent || "";
      if (/bot|crawl|spider|slurp|google-inspectiontool|lighthouse/i.test(userAgent)) return;
      var phoneViewport = window.matchMedia("(max-width: 820px)").matches;
      var mobileAgent = /Android|iPhone|iPod|IEMobile|Opera Mini/i.test(userAgent);
      if (!phoneViewport && !mobileAgent) return;

      var rolloutPercent = <?php echo wp_json_encode( $rollout ); ?>;
      if (rolloutPercent <= 0) return;

      // A full rollout must keep working when localStorage is blocked. Partial
      // rollouts require a persistent bucket so exposure remains stable.
      if (rolloutPercent < 100) {
        var bucketKey = "ticketbylamako_mobile_web_bucket";
        var storedBucket = readStorage("localStorage", bucketKey);
        if (!storedBucket.ok) return;

        var rawBucket = storedBucket.value;
        var canonicalBucket = rawBucket !== null
          ? String(rawBucket).trim()
          : "";
        var bucket = /^(?:0|[1-9]\d?)$/.test(canonicalBucket)
          ? Number(canonicalBucket)
          : NaN;
        if (!Number.isInteger(bucket) || bucket < 0 || bucket >= 100) {
          bucket = Math.floor(Math.random() * 100);
          if (!writeStorage("localStorage", bucketKey, String(bucket))) return;
        }
        if (bucket >= rolloutPercent) return;
      }

      var target = new URL(<?php echo wp_json_encode( $target ); ?>);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"].forEach(function (key) {
        if (query.has(key)) target.searchParams.set(key, query.get(key));
      });
      window.location.replace(target.toString());
    } catch (error) {
      // WordPress remains usable when browser APIs are restricted.
    }
  })();
</script>
    <?php
}
