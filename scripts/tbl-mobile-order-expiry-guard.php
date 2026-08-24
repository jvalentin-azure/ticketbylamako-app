<?php
/**
 * Plugin Name: TBL Mobile Order Expiry Guard
 * Description: Cancels expired, unpaid Lamako Mobile orders and lets WooCommerce/Tickera revoke their tickets.
 * Version: 1.0.0
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'cron_schedules', static function ( $schedules ) {
    $schedules['tbl_mobile_order_minute'] = [
        'interval' => MINUTE_IN_SECONDS,
        'display'  => 'Every minute (TBL mobile order guard)',
    ];
    return $schedules;
} );

add_action( 'init', static function () {
    if ( ! wp_next_scheduled( 'tbl_mobile_expire_unpaid_orders' ) ) {
        wp_schedule_event( time() + MINUTE_IN_SECONDS, 'tbl_mobile_order_minute', 'tbl_mobile_expire_unpaid_orders' );
    }

    // Low-traffic sites do not always trigger WP-Cron exactly on time. Run the
    // same idempotent sweep at most once per minute during ordinary traffic.
    if ( ! wp_doing_cron() && false === get_transient( 'tbl_mobile_order_expiry_sweep_lock' ) ) {
        set_transient( 'tbl_mobile_order_expiry_sweep_lock', 1, 55 );
        tbl_mobile_expire_unpaid_orders();
    }
} );

function tbl_mobile_order_expiry_timestamp( WC_Order $order ) {
    foreach ( [ '_lamako_v2_reservation_expires_at', '_lamako_v2_checkout_expires_at' ] as $key ) {
        $value = (string) $order->get_meta( $key, true );
        if ( $value !== '' ) {
            $timestamp = strtotime( $value );
            if ( $timestamp ) {
                return $timestamp;
            }
        }
    }

    $created = $order->get_date_created();
    return $created ? $created->getTimestamp() + ( 10 * MINUTE_IN_SECONDS ) : 0;
}

function tbl_mobile_expire_unpaid_orders() {
    if ( ! function_exists( 'wc_get_orders' ) ) {
        return;
    }

    $orders = wc_get_orders( [
        'limit'        => 100,
        'status'       => [ 'pending', 'on-hold', 'checkout-draft' ],
        'meta_query'   => [
            [
                'key'   => '_lamako_mobile_v2',
                'value' => 'yes',
            ],
        ],
        'orderby'      => 'date',
        'order'        => 'ASC',
        'return'       => 'objects',
    ] );

    foreach ( $orders as $order ) {
        if ( ! $order instanceof WC_Order || $order->is_paid() ) {
            continue;
        }
        if ( 'yes' !== $order->get_meta( '_lamako_mobile_v2', true ) ) {
            continue;
        }

        $expires_at = tbl_mobile_order_expiry_timestamp( $order );
        if ( ! $expires_at || time() < $expires_at ) {
            continue;
        }

        // Allow a payment request started at the end of the hold two minutes
        // to return. This does not extend the seat/cart reservation indefinitely.
        $attempt_started = absint( $order->get_meta( '_lamako_v2_payment_attempt_started_at', true ) );
        $attempt_status  = sanitize_key( $order->get_meta( '_lamako_v2_payment_attempt_status', true ) );
        $active_statuses = [ 'queued', 'processing', 'pending', 'redirect' ];
        if ( in_array( $attempt_status, $active_statuses, true ) && $attempt_started > 0 && time() < $attempt_started + ( 2 * MINUTE_IN_SECONDS ) ) {
            continue;
        }

        // Re-read immediately before the transition so a concurrent provider
        // callback always wins over this cleanup job.
        $fresh_order = wc_get_order( $order->get_id() );
        if ( ! $fresh_order || $fresh_order->is_paid() || ! $fresh_order->has_status( [ 'pending', 'on-hold', 'checkout-draft' ] ) ) {
            continue;
        }

        $fresh_order->update_meta_data( '_lamako_v2_payment_attempt_status', 'expired' );
        $fresh_order->update_meta_data( '_lamako_v2_payment_error', 'Reservation expired before confirmed payment.' );
        $fresh_order->update_status( 'cancelled', 'Lamako Mobile reservation expired without confirmed payment.' );
    }
}
