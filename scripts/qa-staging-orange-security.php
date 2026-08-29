<?php
/**
 * Staging-only Orange Money initiation smoke.
 *
 * This creates a fee-only synthetic WooCommerce order, requests an Orange
 * payment URL, verifies that only token hashes and an immutable amount/currency
 * snapshot were stored, then permanently removes the synthetic order. It does
 * not open the payment URL, submit an OTP, complete a payment, issue a ticket or
 * touch product stock.
 *
 * Run with an explicit one-shot acknowledgement:
 *   TBL_QA_ALLOW_ORANGE_INITIATION=1 TBL_QA_ORANGE_CREDENTIAL_ENV=test \
 *     wp eval-file scripts/qa-staging-orange-security.php
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
    fwrite( STDERR, "This script must run through WP-CLI.\n" );
    exit( 1 );
}

$site_host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
if ( 'staging.ticketbylamako.com' !== $site_host ) {
    WP_CLI::error( 'Refusing to run Orange QA outside TicketByLamako staging.' );
}
if ( '1' !== (string) getenv( 'TBL_QA_ALLOW_ORANGE_INITIATION' ) ) {
    WP_CLI::error( 'Set TBL_QA_ALLOW_ORANGE_INITIATION=1 to authorize one provider initiation without payment.' );
}
if ( 'test' !== strtolower( (string) getenv( 'TBL_QA_ORANGE_CREDENTIAL_ENV' ) ) ) {
    WP_CLI::error( 'Refusing provider initiation until Orange credentials are independently confirmed non-production/test.' );
}
if ( ! function_exists( 'tbl_orange_gateway_is_hardened' ) || ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
    WP_CLI::error( 'The shared Orange gateway is unavailable.' );
}

function tblqa_orange_assert( $condition, $message ) {
    if ( ! $condition ) {
        throw new RuntimeException( $message );
    }
}

function tblqa_orange_order_count() {
    $page = wc_get_orders(
        [
            'limit'    => 1,
            'paginate' => true,
            'return'   => 'ids',
            'status'   => array_keys( wc_get_order_statuses() ),
        ]
    );
    return is_object( $page ) && isset( $page->total ) ? (int) $page->total : -1;
}

// Do not send a customer or administrator email for the synthetic order.
add_filter( 'woocommerce_email_enabled_new_order', '__return_false', PHP_INT_MAX );
add_filter( 'woocommerce_email_enabled_customer_on_hold_order', '__return_false', PHP_INT_MAX );
add_filter( 'woocommerce_email_enabled_failed_order', '__return_false', PHP_INT_MAX );

$order_id = 0;
$failure  = null;
$orders_before = tblqa_orange_order_count();
tblqa_orange_assert( $orders_before >= 0, 'Unable to record the baseline WooCommerce order count.' );

try {
    $gateways = WC()->payment_gateways()->payment_gateways();
    $gateway  = $gateways['papi_paiement'] ?? null;
    tblqa_orange_assert( $gateway instanceof TBL_Secure_Orange_Gateway, 'The active Orange gateway is not the hardened implementation.' );
    tblqa_orange_assert( tbl_orange_gateway_is_hardened( $gateway ), 'The hardened Orange gateway configuration is not ready.' );

    $order = wc_create_order(
        [
            'customer_id' => 0,
            'created_via' => 'tbl-orange-security-qa',
            'status'      => 'pending',
        ]
    );
    tblqa_orange_assert( $order instanceof WC_Order, 'Unable to create the synthetic Orange order.' );
    $order_id = $order->get_id();

    $fee = new WC_Order_Item_Fee();
    $fee->set_name( 'Synthetic Orange staging security QA' );
    $fee->set_amount( 100 );
    $fee->set_total( 100 );
    $fee->set_tax_status( 'none' );
    $order->add_item( $fee );
    $order->set_currency( 'MGA' );
    $order->set_payment_method( $gateway );
    $order->calculate_totals( false );
    $order->save();

    $result = $gateway->process_payment( $order_id );
    tblqa_orange_assert( is_array( $result ) && 'success' === ( $result['result'] ?? '' ), 'Orange did not return a successful initiation result.' );
    $redirect_url = esc_url_raw( (string) ( $result['redirect'] ?? '' ) );
    tblqa_orange_assert( wp_http_validate_url( $redirect_url ) && 'https' === wp_parse_url( $redirect_url, PHP_URL_SCHEME ), 'Orange returned an invalid payment URL.' );

    $order = wc_get_order( $order_id );
    tblqa_orange_assert( $order instanceof WC_Order && $order->has_status( 'on-hold' ), 'The synthetic order is not waiting for server confirmation.' );
    tblqa_orange_assert( 64 === strlen( (string) $order->get_meta( '_tbl_papi_notif_token_hash' ) ), 'Notification token hash is missing.' );
    tblqa_orange_assert( 64 === strlen( (string) $order->get_meta( '_tbl_papi_pay_token_hash' ) ), 'Payment token hash is missing.' );
    tblqa_orange_assert( '' === (string) $order->get_meta( '_papi_notif_token' ), 'Raw notification token was stored.' );
    tblqa_orange_assert( '' === (string) $order->get_meta( '_papi_pay_token' ), 'Raw payment token was stored.' );
    tblqa_orange_assert( 100 === (int) $order->get_meta( '_tbl_orange_expected_amount' ), 'Expected amount snapshot is invalid.' );
    tblqa_orange_assert( 'MGA' === (string) $order->get_meta( '_tbl_orange_expected_currency' ), 'Expected currency snapshot is invalid.' );
    tblqa_orange_assert( absint( $order->get_meta( '_tbl_orange_token_expires_at' ) ) > time(), 'Notification token expiry is invalid.' );
    tblqa_orange_assert( ! $order->is_paid(), 'The synthetic order must never be marked paid.' );

    WP_CLI::success( 'Orange initiation smoke passed: hardened gateway, HTTPS redirect, hashed tokens and immutable MGA snapshot.' );
} catch ( Throwable $error ) {
    $failure = $error;
} finally {
    if ( $order_id > 0 ) {
        $fixture = wc_get_order( $order_id );
        if ( $fixture ) {
            $fixture->delete( true );
        }
        clean_post_cache( $order_id );
    }

    if ( $order_id > 0 && wc_get_order( $order_id ) && ! $failure ) {
        $failure = new RuntimeException( 'Synthetic Orange order cleanup failed.' );
    }
    $orders_after = tblqa_orange_order_count();
    if ( $orders_after !== $orders_before && ! $failure ) {
        $failure = new RuntimeException( 'WooCommerce order count did not return to its exact baseline.' );
    }
}

if ( $failure ) {
    WP_CLI::error( 'Orange initiation smoke failed safely: ' . $failure->getMessage() );
}

WP_CLI::success(
    sprintf(
        'Synthetic Orange order removed; order count %d -> %d, no payment, ticket or stock item created.',
        $orders_before,
        $orders_after
    )
);
