<?php

if ( ! defined( 'ABSPATH' ) || strpos( home_url(), 'staging.ticketbylamako.com' ) === false ) {
    fwrite( STDERR, "This QA script may run on staging only.\n" );
    exit( 1 );
}

$product_id = 13841;
$product    = wc_get_product( $product_id );
if ( ! $product || 'yes' !== get_post_meta( $product_id, '_tc_is_ticket', true ) ) {
    fwrite( STDERR, "QA ticket product 13841 is unavailable.\n" );
    exit( 1 );
}

foreach ( [
    'woocommerce_email_enabled_new_order',
    'woocommerce_email_enabled_customer_processing_order',
    'woocommerce_email_enabled_customer_completed_order',
    'woocommerce_email_enabled_customer_on_hold_order',
    'woocommerce_email_enabled_cancelled_order',
] as $filter ) {
    add_filter( $filter, '__return_false', 999 );
}

$order          = null;
$ticket_ids     = [];
$stock_before   = $product->get_stock_quantity();
$manages_stock  = $product->managing_stock();
$result         = [
    'pendingTicketCount' => null,
    'paidTicketCount'    => null,
    'cleaned'            => false,
];

try {
    $order = wc_create_order();
    if ( is_wp_error( $order ) ) {
        throw new RuntimeException( $order->get_error_message() );
    }

    $order->add_product( $product, 1 );
    $order->set_billing_first_name( 'QA' );
    $order->set_billing_last_name( 'Wallet' );
    $order->set_billing_email( 'qa-no-delivery@example.invalid' );
    $order->set_created_via( 'lamako_mobile_v2_qa' );
    $order->set_status( 'pending' );
    $order->update_meta_data( '_lamako_mobile_order', 'yes' );
    $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
    $order->calculate_totals();
    $order->save();

    $pending = lamako_mobile_v2_ensure_ticket_instances_for_order( $order );
    if ( is_wp_error( $pending ) ) {
        throw new RuntimeException( $pending->get_error_message() );
    }

    $ticket_ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft', 'trash' ],
        'post_parent'    => $order->get_id(),
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'no_found_rows'  => true,
    ] );
    $result['pendingTicketCount'] = count( $ticket_ids );
    if ( 0 !== $result['pendingTicketCount'] ) {
        throw new RuntimeException( 'A pending order emitted a ticket.' );
    }

    $order->set_payment_method( 'cybersource' );
    $order->update_status( 'cs-complete', 'Staging QA payment confirmation.' );
    $order = wc_get_order( $order->get_id() );

    $ticket_ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft' ],
        'post_parent'    => $order->get_id(),
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'no_found_rows'  => true,
    ] );
    $result['paidTicketCount'] = count( $ticket_ids );
    if ( 1 !== $result['paidTicketCount'] ) {
        throw new RuntimeException( 'A confirmed order did not emit exactly one ticket.' );
    }
} finally {
    if ( $order instanceof WC_Order ) {
        $ticket_ids = get_posts( [
            'post_type'      => 'tc_tickets_instances',
            'post_status'    => 'any',
            'post_parent'    => $order->get_id(),
            'fields'         => 'ids',
            'posts_per_page' => -1,
            'no_found_rows'  => true,
        ] );
        foreach ( $ticket_ids as $ticket_id ) {
            wp_delete_post( absint( $ticket_id ), true );
        }
        $order->delete( true );
    }

    if ( $manages_stock && null !== $stock_before ) {
        wc_update_product_stock( $product, $stock_before, 'set' );
    }
    $result['cleaned'] = true;
}

echo wp_json_encode( $result, JSON_UNESCAPED_SLASHES ) . PHP_EOL;
