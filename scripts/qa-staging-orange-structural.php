<?php
/**
 * Read-only staging smoke for the shared Orange gateway.
 *
 * Run with:
 *   wp eval-file scripts/qa-staging-orange-structural.php
 *
 * This performs no provider call and no WordPress write.
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
    fwrite( STDERR, "This script must run through WP-CLI.\n" );
    exit( 1 );
}

$site_host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
if ( 'staging.ticketbylamako.com' !== $site_host ) {
    WP_CLI::error( 'Refusing to run Orange structural QA outside TicketByLamako staging.' );
}

function tblqa_orange_structural_assert( $condition, $message ) {
    if ( ! $condition ) {
        throw new RuntimeException( $message );
    }
}

try {
    tblqa_orange_structural_assert( defined( 'TBL_ORANGE_GUARD_VERSION' ), 'Orange guard version is missing.' );
    tblqa_orange_structural_assert( '1.1.0' === TBL_ORANGE_GUARD_VERSION, 'Unexpected Orange guard version.' );
    tblqa_orange_structural_assert( function_exists( 'tbl_orange_secure_webhook' ), 'Canonical secure callback is unavailable.' );
    tblqa_orange_structural_assert( function_exists( 'tbl_orange_gateway_is_hardened' ), 'Orange guard marker is unavailable.' );
    tblqa_orange_structural_assert( function_exists( 'lamako_mobile_v2_orange_server_verification_available' ), 'Mobile v2 Orange bridge is unavailable.' );
    tblqa_orange_structural_assert( function_exists( 'WC' ) && WC()->payment_gateways(), 'WooCommerce gateways are unavailable.' );

    $gateways = WC()->payment_gateways()->payment_gateways();
    $gateway  = $gateways['papi_paiement'] ?? null;
    tblqa_orange_structural_assert( $gateway instanceof TBL_Secure_Orange_Gateway, 'WooCommerce is not using the hardened Orange class.' );
    tblqa_orange_structural_assert( tbl_orange_gateway_is_hardened( $gateway ), 'Orange credentials/endpoints are not ready.' );
    tblqa_orange_structural_assert( lamako_mobile_v2_orange_server_verification_available(), 'Mobile v2 still fails Orange closed.' );

    $methods    = function_exists( 'lamako_mobile_v2_enabled_payment_gateways' )
        ? lamako_mobile_v2_enabled_payment_gateways()
        : [];
    $method_ids = array_values( array_filter( array_map( static function( $method ) {
        return is_array( $method ) ? sanitize_key( $method['id'] ?? '' ) : '';
    }, (array) $methods ) ) );
    tblqa_orange_structural_assert( in_array( 'papi_paiement', $method_ids, true ), 'Mobile v2 does not expose the hardened Orange method.' );

    $routes = rest_get_server()->get_routes();
    tblqa_orange_structural_assert( ! empty( $routes['/papi/v1/webhook'] ), 'Canonical Orange webhook route is missing.' );
    tblqa_orange_structural_assert( ! empty( $routes['/lamako-mobile/v2/payments/orange/callback'] ), 'Legacy Mobile v2 compatibility callback is missing.' );

    $canonical_callbacks = array_filter( array_map( static function( $endpoint ) {
        return is_array( $endpoint ) ? ( $endpoint['callback'] ?? null ) : null;
    }, (array) $routes['/papi/v1/webhook'] ) );
    tblqa_orange_structural_assert( in_array( 'tbl_orange_secure_webhook', $canonical_callbacks, true ), 'Canonical route does not resolve to the secure callback.' );

    $legacy_callbacks = array_filter( array_map( static function( $endpoint ) {
        return is_array( $endpoint ) ? ( $endpoint['callback'] ?? null ) : null;
    }, (array) $routes['/lamako-mobile/v2/payments/orange/callback'] ) );
    tblqa_orange_structural_assert( in_array( 'lamako_mobile_v2_orange_callback', $legacy_callbacks, true ), 'Mobile v2 compatibility route is not registered.' );

    WP_CLI::success(
        sprintf(
            'Orange structural QA passed: guard %s, hardened gateway, canonical callback and Mobile v2 method active; provider calls=0, writes=0.',
            TBL_ORANGE_GUARD_VERSION
        )
    );
} catch ( Throwable $error ) {
    WP_CLI::error( 'Orange structural QA failed: ' . $error->getMessage() );
}
