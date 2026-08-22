<?php
/**
 * Read-only staging benchmark for the authenticated mobile ticket wallet.
 *
 * Run with:
 * wp eval-file scripts/qa-ticket-wallet-performance.php
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
    fwrite( STDERR, "This script must run through WP-CLI.\n" );
    exit( 1 );
}

$site_host = (string) wp_parse_url( home_url( '/' ), PHP_URL_HOST );
if ( strpos( $site_host, 'staging.ticketbylamako.com' ) === false ) {
    WP_CLI::error( 'Refusing to benchmark outside TicketByLamako staging.' );
}

if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'lamako_mobile_v2_get_orders' ) ) {
    WP_CLI::error( 'WooCommerce or the Lamako Mobile v2 API is unavailable.' );
}

global $wpdb;

$ticket_item_ids = $wpdb->get_col(
    "SELECT DISTINCT pm.meta_value
    FROM {$wpdb->postmeta} pm
    INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
    WHERE p.post_type = 'tc_tickets_instances'
      AND pm.meta_key = 'item_id'
      AND pm.meta_value <> ''
    ORDER BY p.ID DESC
    LIMIT 500"
);

$customer_counts = [];
foreach ( $ticket_item_ids as $item_id ) {
    $order_id = function_exists( 'wc_get_order_id_by_order_item_id' )
        ? wc_get_order_id_by_order_item_id( absint( $item_id ) )
        : 0;
    $order = $order_id ? wc_get_order( $order_id ) : false;
    if ( ! $order instanceof WC_Order ) {
        continue;
    }

    $customer_id = (int) $order->get_customer_id();
    if ( $customer_id <= 0 ) {
        continue;
    }

    $customer_counts[ $customer_id ] = ( $customer_counts[ $customer_id ] ?? 0 ) + 1;
}

if ( empty( $customer_counts ) ) {
    WP_CLI::warning( 'No staging customer with existing ticket instances was found.' );
    exit( 0 );
}

arsort( $customer_counts );
$customer_id = (int) array_key_first( $customer_counts );
wp_set_current_user( $customer_id );

$orders = wc_get_orders( [
    'customer_id' => $customer_id,
    'limit'       => 20,
    'paged'       => 1,
    'orderby'     => 'date',
    'order'       => 'DESC',
] );
$mode   = getenv( 'TBL_WALLET_BENCHMARK_MODE' ) === 'legacy' ? 'legacy' : 'batched';
$result = [];

$queries_before = get_num_queries();
$started_at     = microtime( true );
if ( $mode === 'legacy' ) {
    foreach ( $orders as $order ) {
        $result[] = lamako_mobile_v2_order_summary( $order, true, true );
    }
} else {
    $ticket_map = lamako_mobile_v2_get_tickets_for_orders( $orders );
    foreach ( $orders as $order ) {
        $result[] = lamako_mobile_v2_order_summary(
            $order,
            true,
            true,
            $ticket_map[ $order->get_id() ] ?? []
        );
    }
}
$elapsed_ms  = ( microtime( true ) - $started_at ) * 1000;
$query_count = get_num_queries() - $queries_before;

$ticket_count = 0;
foreach ( $result as $order ) {
    $ticket_count += is_array( $order['tickets'] ?? null ) ? count( $order['tickets'] ) : 0;
}

WP_CLI::line( wp_json_encode( [
    'mode'         => $mode,
    'orders'       => count( $result ),
    'tickets'      => $ticket_count,
    'elapsedMs'    => round( $elapsed_ms, 2 ),
    'queryCount'   => $query_count,
    'customerHash' => substr( wp_hash( (string) $customer_id ), 0, 12 ),
] ) );
