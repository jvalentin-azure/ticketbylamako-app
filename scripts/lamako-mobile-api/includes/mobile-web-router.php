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

function lamako_mobile_web_is_excluded_request() {
    if (
        is_admin()
        || wp_doing_ajax()
        || ( defined( 'REST_REQUEST' ) && REST_REQUEST )
        || is_feed()
        || is_robots()
        || is_trackback()
        || is_preview()
    ) {
        return true;
    }

    $path = strtolower( lamako_mobile_web_request_path() );
    $excluded_prefixes = [
        '/mobile',
        '/wp-admin',
        '/wp-login.php',
        '/wp-json',
        '/checkout',
        '/commande',
        '/order-pay',
        '/wc-api',
        '/lamako-mobile',
    ];
    foreach ( $excluded_prefixes as $prefix ) {
        if ( $path === $prefix || strpos( $path, $prefix . '/' ) === 0 ) {
            return true;
        }
    }

    return false;
}

function lamako_mobile_web_target_path() {
    if ( is_singular( 'product' ) ) {
        return '/mobile/product/' . absint( get_queried_object_id() );
    }
    if ( is_singular( 'tc_events' ) ) {
        return '/mobile/event/' . absint( get_queried_object_id() );
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
    $rollout = defined( 'LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT' )
        ? min( 100, max( 0, absint( LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT ) ) )
        : 100;
    ?>
<script id="ticketbylamako-mobile-web-router">
  (function () {
    try {
      var query = new URLSearchParams(window.location.search);
      if (query.get("desktop") === "1") {
        window.sessionStorage.setItem("ticketbylamako_desktop_session", "1");
        return;
      }
      if (window.sessionStorage.getItem("ticketbylamako_desktop_session") === "1") return;

      var userAgent = window.navigator.userAgent || "";
      if (/bot|crawl|spider|slurp|google-inspectiontool|lighthouse/i.test(userAgent)) return;
      var phoneViewport = window.matchMedia("(max-width: 820px)").matches;
      var mobileAgent = /Android|iPhone|iPod|IEMobile|Opera Mini/i.test(userAgent);
      if (!phoneViewport && !mobileAgent) return;

      var rolloutPercent = <?php echo wp_json_encode( $rollout ); ?>;
      var bucketKey = "ticketbylamako_mobile_web_bucket";
      var bucket = Number(window.localStorage.getItem(bucketKey));
      if (!Number.isFinite(bucket) || bucket < 0 || bucket >= 100) {
        bucket = Math.floor(Math.random() * 100);
        window.localStorage.setItem(bucketKey, String(bucket));
      }
      if (bucket >= rolloutPercent) return;

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
