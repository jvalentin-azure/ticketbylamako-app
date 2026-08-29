<?php
/**
 * Plugin Name: TBL Orange Payment Guard
 * Description: Shared, capability-token authenticated Orange Money gateway for WooCommerce and Lamako Mobile v2.
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'TBL_ORANGE_GUARD_VERSION', '1.1.0' );
define( 'TBL_ORANGE_CALLBACK_TTL', 2 * HOUR_IN_SECONDS );

function tbl_orange_payment_environment() {
    if ( ! defined( 'TBL_ORANGE_PAYMENT_ENVIRONMENT' ) ) {
        return '';
    }
    $environment = sanitize_key( (string) TBL_ORANGE_PAYMENT_ENVIRONMENT );
    return in_array( $environment, [ 'test', 'production' ], true ) ? $environment : '';
}

function tbl_orange_environment_is_allowed() {
    $host        = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
    $environment = tbl_orange_payment_environment();
    if ( 'staging.ticketbylamako.com' === $host ) {
        return 'test' === $environment;
    }
    if ( in_array( $host, [ 'ticketbylamako.com', 'www.ticketbylamako.com' ], true ) ) {
        return 'production' === $environment;
    }
    return false;
}

function tbl_orange_callback_request_id() {
    static $request_id = '';
    if ( $request_id !== '' ) {
        return $request_id;
    }

    $incoming = isset( $_SERVER['HTTP_X_REQUEST_ID'] )
        ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_REQUEST_ID'] ) )
        : '';
    $request_id = preg_match( '/^[A-Za-z0-9._-]{8,64}$/', $incoming )
        ? $incoming
        : wp_generate_uuid4();
    return $request_id;
}

function tbl_orange_callback_error( $code, $message, $status ) {
    error_log(
        '[TBL Orange callback] ' . sanitize_key( (string) $code )
        . ' request_id=' . tbl_orange_callback_request_id()
    );
    return new WP_Error( $code, $message, [ 'status' => (int) $status ] );
}

function tbl_orange_gateway_log( $message, $order_id = 0 ) {
    if ( function_exists( 'wc_get_logger' ) ) {
        wc_get_logger()->error(
            sanitize_text_field( (string) $message ),
            [
                'source'     => 'tbl-orange',
                'order_id'   => absint( $order_id ),
                'request_id' => tbl_orange_callback_request_id(),
            ]
        );
    }
}

function tbl_orange_callback_rate_limit( $token_fingerprint ) {
    $minute = gmdate( 'YmdHi' );
    $keys   = [
        'tbl_orange_cb_token_' . md5( (string) $token_fingerprint . '|' . $minute ) => 30,
        'tbl_orange_cb_global_' . $minute                                         => 300,
    ];

    foreach ( $keys as $key => $limit ) {
        $count = (int) get_transient( $key );
        if ( $count >= $limit ) {
            return tbl_orange_callback_error( 'orange_callback_rate_limited', 'Too many callback attempts', 429 );
        }
        set_transient( $key, $count + 1, 2 * MINUTE_IN_SECONDS );
    }

    return true;
}

function tbl_orange_token_is_valid( $token ) {
    $length = strlen( (string) $token );
    return $length >= 16
        && $length <= 512
        && 1 === preg_match( '/^[A-Za-z0-9._~:\/+=-]+$/', (string) $token );
}

function tbl_orange_token_hash( $token ) {
    return hash_hmac( 'sha256', (string) $token, wp_salt( 'auth' ) );
}

function tbl_orange_gateway_lock( $order_id, $release = false ) {
    global $wpdb;

    $name = 'tbl_orange_' . absint( $order_id );
    if ( $release ) {
        $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $name ) );
        return true;
    }

    return 1 === (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 5)', $name ) );
}

function tbl_orange_audit_order( $action, $order, $metadata = [] ) {
    if ( ! $order || ! function_exists( 'tbl_organizer_audit_write' ) ) {
        return;
    }

    $event_ids = function_exists( 'tbl_get_order_event_ids_for_channel' )
        ? tbl_get_order_event_ids_for_channel( $order )
        : [];
    foreach ( (array) $event_ids as $event_id ) {
        tbl_organizer_audit_write(
            $action,
            $event_id,
            'order',
            $order->get_id(),
            'order:' . $order->get_id(),
            array_merge( [ 'gateway' => 'papi_paiement' ], (array) $metadata ),
            0
        );
    }
}

function tbl_orange_expected_amount( $order ) {
    $total = (float) $order->get_total();
    if ( $total <= 0 || abs( $total - round( $total ) ) > 0.0001 ) {
        return false;
    }

    $amount = (int) round( $total );
    return $amount > 0 && $amount <= 2147483647 ? $amount : false;
}

function tbl_orange_store_payment_snapshot( $order, $notification_token, $pay_token, $payment_url, $request_reference ) {
    $amount   = tbl_orange_expected_amount( $order );
    $currency = strtoupper( (string) $order->get_currency() );
    if ( false === $amount || 'MGA' !== $currency ) {
        return new WP_Error( 'orange_order_snapshot_invalid', 'Orange payment amount or currency is invalid' );
    }

    $issued_at = time();
    $order->update_meta_data( '_tbl_papi_notif_token_hash', tbl_orange_token_hash( $notification_token ) );
    $order->update_meta_data( '_tbl_papi_pay_token_hash', tbl_orange_token_hash( $pay_token ) );
    $order->update_meta_data( '_tbl_papi_payment_url', esc_url_raw( $payment_url ) );
    $order->update_meta_data( '_tbl_orange_expected_amount', $amount );
    $order->update_meta_data( '_tbl_orange_expected_currency', $currency );
    $order->update_meta_data( '_tbl_orange_expected_reference', sanitize_text_field( $request_reference ) );
    $order->update_meta_data( '_tbl_orange_token_issued_at', $issued_at );
    $order->update_meta_data( '_tbl_orange_token_expires_at', $issued_at + TBL_ORANGE_CALLBACK_TTL );
    $order->update_meta_data( '_tbl_payment_state', 'PENDING' );
    $order->delete_meta_data( '_papi_notif_token' );
    $order->delete_meta_data( '_papi_pay_token' );
    return true;
}

function tbl_orange_migrate_legacy_snapshot( $order, $notification_token ) {
    if ( (string) $order->get_meta( '_tbl_orange_expected_currency' ) !== '' ) {
        return true;
    }

    $created = $order->get_date_created();
    $created = $created ? $created->getTimestamp() : 0;
    if ( $created <= 0 || ( time() - $created ) > TBL_ORANGE_CALLBACK_TTL ) {
        return new WP_Error( 'orange_legacy_callback_expired', 'Legacy Orange callback window expired' );
    }

    $amount   = tbl_orange_expected_amount( $order );
    $currency = strtoupper( (string) $order->get_currency() );
    if ( false === $amount || 'MGA' !== $currency ) {
        return new WP_Error( 'orange_legacy_snapshot_invalid', 'Legacy Orange payment snapshot is invalid' );
    }

    $order->update_meta_data( '_tbl_papi_notif_token_hash', tbl_orange_token_hash( $notification_token ) );
    $order->update_meta_data( '_tbl_orange_expected_amount', $amount );
    $order->update_meta_data( '_tbl_orange_expected_currency', $currency );
    $order->update_meta_data( '_tbl_orange_expected_reference', 'Ticket_' . $order->get_id() );
    $order->update_meta_data( '_tbl_orange_token_issued_at', $created );
    $order->update_meta_data( '_tbl_orange_token_expires_at', $created + TBL_ORANGE_CALLBACK_TTL );
    $order->delete_meta_data( '_papi_notif_token' );
    $order->delete_meta_data( '_papi_pay_token' );
    $order->save();
    return true;
}

function tbl_orange_find_order( $notification_token ) {
    if ( ! function_exists( 'wc_get_orders' ) ) {
        return false;
    }

    $token_hash = tbl_orange_token_hash( $notification_token );
    $common     = [
        'limit'          => 2,
        'payment_method' => 'papi_paiement',
        'orderby'        => 'date',
        'order'          => 'DESC',
        'return'         => 'objects',
    ];
    $by_hash    = wc_get_orders(
        array_merge(
            $common,
            [ 'meta_key' => '_tbl_papi_notif_token_hash', 'meta_value' => $token_hash ]
        )
    );
    // Compatibility is limited by tbl_orange_migrate_legacy_snapshot().
    $by_raw = wc_get_orders(
        array_merge(
            $common,
            [ 'meta_key' => '_papi_notif_token', 'meta_value' => (string) $notification_token ]
        )
    );

    $orders = [];
    foreach ( array_merge( (array) $by_hash, (array) $by_raw ) as $candidate ) {
        if ( $candidate instanceof WC_Order ) {
            $orders[ $candidate->get_id() ] = $candidate;
        }
    }
    if ( 1 !== count( $orders ) ) {
        return false;
    }

    $order       = reset( $orders );
    $stored_hash = (string) $order->get_meta( '_tbl_papi_notif_token_hash' );
    $stored_raw  = (string) $order->get_meta( '_papi_notif_token' );
    if ( $stored_hash !== '' && ! hash_equals( $stored_hash, $token_hash ) ) {
        return false;
    }
    if ( $stored_hash === '' && ( $stored_raw === '' || ! hash_equals( $stored_raw, (string) $notification_token ) ) ) {
        return false;
    }

    return $order;
}

function tbl_orange_validate_callback_snapshot( $order, array $body, $allow_expired = false ) {
    $expected_amount   = absint( $order->get_meta( '_tbl_orange_expected_amount' ) );
    $expected_currency = strtoupper( (string) $order->get_meta( '_tbl_orange_expected_currency' ) );
    $expires_at        = absint( $order->get_meta( '_tbl_orange_token_expires_at' ) );
    $current_amount    = tbl_orange_expected_amount( $order );
    $current_currency  = strtoupper( (string) $order->get_currency() );

    if (
        false === $current_amount
        || $expected_amount <= 0
        || $current_amount !== $expected_amount
        || 'MGA' !== $expected_currency
        || $current_currency !== $expected_currency
    ) {
        return new WP_Error( 'orange_callback_order_mismatch', 'Orange callback does not match the order snapshot' );
    }
    if ( ! $allow_expired && ( $expires_at <= 0 || time() > $expires_at ) ) {
        return new WP_Error( 'orange_callback_expired', 'Orange callback window expired' );
    }

    if ( array_key_exists( 'amount', $body ) ) {
        if ( ! is_numeric( $body['amount'] ) || abs( (float) $body['amount'] - $expected_amount ) > 0.0001 ) {
            return new WP_Error( 'orange_callback_amount_mismatch', 'Orange callback amount mismatch' );
        }
    }
    if ( array_key_exists( 'currency', $body ) ) {
        $currency = strtoupper( sanitize_text_field( (string) $body['currency'] ) );
        if ( $currency !== $expected_currency ) {
            return new WP_Error( 'orange_callback_currency_mismatch', 'Orange callback currency mismatch' );
        }
    }

    $expected_reference = (string) $order->get_meta( '_tbl_orange_expected_reference' );
    foreach ( [ 'order_id', 'reference' ] as $field ) {
        if ( ! empty( $body[ $field ] ) ) {
            $received = sanitize_text_field( (string) $body[ $field ] );
            if ( $received !== $expected_reference && $received !== 'Ticket_' . $order->get_id() ) {
                return new WP_Error( 'orange_callback_reference_mismatch', 'Orange callback reference mismatch' );
            }
        }
    }

    return true;
}

function tbl_orange_callback_fingerprint( array $body, $notification_token, $status ) {
    $transaction_id = sanitize_text_field( (string) ( $body['transaction_id'] ?? ( $body['txnid'] ?? '' ) ) );
    $amount         = array_key_exists( 'amount', $body ) ? (string) $body['amount'] : '';
    $currency       = strtoupper( sanitize_text_field( (string) ( $body['currency'] ?? '' ) ) );
    return hash_hmac(
        'sha256',
        implode( '|', [ $notification_token, $status, $transaction_id, $amount, $currency ] ),
        wp_salt( 'nonce' )
    );
}

function tbl_orange_secure_webhook( WP_REST_Request $request ) {
    if ( strlen( (string) $request->get_body() ) > 8192 ) {
        return tbl_orange_callback_error( 'orange_callback_too_large', 'Callback body is too large', 413 );
    }

    $content_type = strtolower( (string) $request->get_header( 'content-type' ) );
    if ( 0 !== strpos( $content_type, 'application/json' ) ) {
        return tbl_orange_callback_error( 'orange_callback_json_required', 'JSON content type required', 415 );
    }

    $body = $request->get_json_params();
    if ( ! is_array( $body ) ) {
        return tbl_orange_callback_error( 'orange_callback_invalid_json', 'Invalid JSON payload', 400 );
    }

    $notification_token = trim( (string) ( $body['notif_token'] ?? '' ) );
    $status             = strtoupper( sanitize_key( (string) ( $body['status'] ?? '' ) ) );
    if ( ! tbl_orange_token_is_valid( $notification_token ) ) {
        return tbl_orange_callback_error( 'orange_callback_token_invalid', 'Invalid notification token', 400 );
    }
    if ( ! in_array( $status, [ 'SUCCESS', 'COMPLETED', 'TS', 'FAILED', 'CANCELLED', 'INSUFFICIENT_BALANCE', 'PENDING', 'TIP' ], true ) ) {
        return tbl_orange_callback_error( 'orange_callback_status_invalid', 'Invalid payment status', 422 );
    }

    $limited = tbl_orange_callback_rate_limit( hash( 'sha256', $notification_token ) );
    if ( is_wp_error( $limited ) ) {
        return $limited;
    }

    $order = tbl_orange_find_order( $notification_token );
    if ( ! $order || 'papi_paiement' !== $order->get_payment_method() ) {
        return tbl_orange_callback_error( 'orange_callback_order_not_found', 'Payment reference not found', 404 );
    }
    if ( ! tbl_orange_gateway_lock( $order->get_id() ) ) {
        return tbl_orange_callback_error( 'orange_callback_busy', 'Payment callback is already being processed', 409 );
    }

    $locked_order_id = $order->get_id();
    try {
        $order          = wc_get_order( $locked_order_id );
        $success_states = [ 'SUCCESS', 'COMPLETED', 'TS' ];
        $failure_states = [ 'FAILED', 'CANCELLED', 'INSUFFICIENT_BALANCE' ];
        $is_success     = in_array( $status, $success_states, true );

        if ( ! $order || 'papi_paiement' !== $order->get_payment_method() ) {
            return tbl_orange_callback_error( 'orange_callback_order_invalid', 'Payment reference is invalid', 404 );
        }
        if ( $order->is_paid() ) {
            return $is_success
                ? rest_ensure_response( [ 'accepted' => true, 'status' => 'paid', 'idempotent_replay' => true ] )
                : tbl_orange_callback_error( 'orange_callback_paid_downgrade_blocked', 'A paid order cannot be downgraded', 409 );
        }
        if ( in_array( $order->get_status(), [ 'cancelled', 'refunded', 'failed' ], true ) ) {
            if ( 'failed' === $order->get_status() && in_array( $status, $failure_states, true ) ) {
                return rest_ensure_response( [ 'accepted' => true, 'status' => 'failed', 'idempotent_replay' => true ] );
            }
            return tbl_orange_callback_error( 'orange_callback_terminal_order', 'Order can no longer change payment state', 409 );
        }

        $migrated = tbl_orange_migrate_legacy_snapshot( $order, $notification_token );
        if ( is_wp_error( $migrated ) ) {
            return tbl_orange_callback_error( $migrated->get_error_code(), 'Orange callback requires manual review', 409 );
        }
        $valid_snapshot = tbl_orange_validate_callback_snapshot( $order, $body );
        if ( is_wp_error( $valid_snapshot ) ) {
            $order->update_meta_data( '_tbl_payment_state', 'REVIEW' );
            $order->update_meta_data( '_tbl_orange_review_reason', sanitize_key( $valid_snapshot->get_error_code() ) );
            $order->save();
            tbl_orange_audit_order( 'payment_callback_rejected', $order, [ 'reason' => $valid_snapshot->get_error_code() ] );
            return tbl_orange_callback_error( $valid_snapshot->get_error_code(), 'Orange callback requires manual review', 409 );
        }

        $fingerprint = tbl_orange_callback_fingerprint( $body, $notification_token, $status );
        $last        = (string) $order->get_meta( '_tbl_orange_callback_fingerprint' );
        if ( $last !== '' && hash_equals( $last, $fingerprint ) ) {
            $state = sanitize_key( (string) $order->get_meta( '_tbl_orange_callback_final_status' ) );
            return rest_ensure_response(
                [
                    'accepted'          => true,
                    'status'            => $state !== '' ? $state : 'pending',
                    'idempotent_replay' => true,
                ]
            );
        }

        $order->update_meta_data( '_tbl_orange_callback_fingerprint', $fingerprint );
        $order->update_meta_data( '_tbl_orange_callback_received_at', time() );
        if ( $is_success ) {
            $transaction_id = sanitize_text_field( (string) ( $body['transaction_id'] ?? ( $body['txnid'] ?? '' ) ) );
            $transaction_id = $transaction_id !== ''
                ? 'orange_' . substr( hash( 'sha256', $transaction_id ), 0, 24 )
                : 'orange_' . substr( hash( 'sha256', $notification_token ), 0, 24 );
            $order->update_meta_data( '_tbl_payment_state', 'CONFIRMED' );
            $order->update_meta_data( '_tbl_orange_callback_final_status', 'paid' );
            $order->delete_meta_data( '_tbl_papi_payment_url' );
            $order->payment_complete( $transaction_id );
            $order->add_order_note( __( 'Paiement Orange Money confirmé par notification serveur liée à la transaction.', 'papi-pay' ) );
            $order->save();
            tbl_orange_audit_order( 'payment_callback_confirmed', $order, [ 'provider_status' => $status ] );
            return rest_ensure_response( [ 'accepted' => true, 'status' => 'paid', 'idempotent_replay' => false ] );
        }

        if ( in_array( $status, $failure_states, true ) ) {
            $replay = $order->has_status( 'failed' );
            if ( ! $replay ) {
                $order->update_meta_data( '_tbl_payment_state', 'FAILED' );
                $order->update_meta_data( '_tbl_orange_callback_final_status', 'failed' );
                $order->delete_meta_data( '_tbl_papi_payment_url' );
                // WooCommerce's failed-status transition restores reduced stock.
                $order->update_status( 'failed', __( 'Paiement Orange Money refusé par la notification serveur.', 'papi-pay' ) );
                tbl_orange_audit_order( 'payment_callback_failed', $order, [ 'provider_status' => $status ] );
            } else {
                $order->save();
            }
            return rest_ensure_response( [ 'accepted' => true, 'status' => 'failed', 'idempotent_replay' => $replay ] );
        }

        $replay = $order->has_status( 'on-hold' );
        if ( ! $replay ) {
            $order->update_meta_data( '_tbl_payment_state', 'PENDING' );
            $order->update_meta_data( '_tbl_orange_callback_final_status', 'pending' );
            $order->update_status( 'on-hold', __( 'Paiement Orange Money en attente de confirmation.', 'papi-pay' ) );
            tbl_orange_audit_order( 'payment_callback_pending', $order, [ 'provider_status' => $status ] );
        } else {
            $order->save();
        }
        return rest_ensure_response( [ 'accepted' => true, 'status' => 'pending', 'idempotent_replay' => $replay ] );
    } finally {
        tbl_orange_gateway_lock( $locked_order_id, true );
    }
}

function tbl_orange_check_status_permission( WP_REST_Request $request ) {
    $order = function_exists( 'wc_get_order' )
        ? wc_get_order( absint( $request->get_param( 'order_id' ) ) )
        : false;
    if ( ! $order ) {
        return new WP_Error( 'orange_order_not_found', 'Order not found', [ 'status' => 404 ] );
    }
    if ( current_user_can( 'manage_woocommerce' ) ) {
        return true;
    }
    if ( get_current_user_id() > 0 && (int) $order->get_customer_id() === get_current_user_id() ) {
        return true;
    }

    $order_key = sanitize_text_field( (string) $request->get_param( 'order_key' ) );
    return $order_key !== '' && hash_equals( (string) $order->get_order_key(), $order_key )
        ? true
        : new WP_Error( 'orange_order_forbidden', 'Order access denied', [ 'status' => 403 ] );
}

function tbl_orange_secure_check_status( WP_REST_Request $request ) {
    $order = wc_get_order( absint( $request->get_param( 'order_id' ) ) );
    return rest_ensure_response(
        [
            'status' => $order->get_status(),
            'paid'   => $order->is_paid(),
        ]
    );
}

trait TBL_Orange_Gateway_Security {
    public function tbl_security_ready() {
        $merchant = trim( (string) $this->merchant_key );
        $consumer = trim( (string) $this->consumer_key );
        return tbl_orange_environment_is_allowed()
            && $merchant !== ''
            && strlen( $merchant ) <= 512
            && ! preg_match( '/[\r\n]/', $merchant )
            && $consumer !== ''
            && strlen( $consumer ) <= 2048
            && ! preg_match( '/[\r\n]/', $consumer )
            && ! is_wp_error( $this->tbl_endpoint( $this->api_token_url, '/oauth/' ) )
            && ! is_wp_error( $this->tbl_endpoint( $this->api_payment_url, '/orange-money-webpay/' ) );
    }

    public function process_payment( $order_id ) {
        $order = wc_get_order( absint( $order_id ) );
        if (
            ! $this->tbl_security_ready()
            || ! $order
            || false === tbl_orange_expected_amount( $order )
            || 'MGA' !== strtoupper( (string) $order->get_currency() )
        ) {
            wc_add_notice( __( 'Montant ou devise Orange Money invalide.', 'papi-pay' ), 'error' );
            return [ 'result' => 'failure' ];
        }
        if ( $order->is_paid() ) {
            return [ 'result' => 'success', 'redirect' => $order->get_checkout_order_received_url() ];
        }
        if ( in_array( $order->get_status(), [ 'cancelled', 'refunded', 'failed' ], true ) ) {
            wc_add_notice( __( 'Cette commande ne peut plus être payée avec Orange Money.', 'papi-pay' ), 'error' );
            return [ 'result' => 'failure' ];
        }

        $existing_url = (string) $order->get_meta( '_tbl_papi_payment_url' );
        $expires_at   = absint( $order->get_meta( '_tbl_orange_token_expires_at' ) );
        if ( $existing_url !== '' && $expires_at > time() && $this->tbl_valid_redirect( $existing_url ) ) {
            return [ 'result' => 'success', 'redirect' => $existing_url ];
        }
        if ( ! tbl_orange_gateway_lock( $order_id ) ) {
            wc_add_notice( __( 'La demande Orange Money est déjà en cours. Réessayez dans quelques secondes.', 'papi-pay' ), 'notice' );
            return [ 'result' => 'failure' ];
        }

        try {
            $order        = wc_get_order( absint( $order_id ) );
            if ( ! $order ) {
                return [ 'result' => 'failure' ];
            }
            $existing_url = (string) $order->get_meta( '_tbl_papi_payment_url' );
            $expires_at   = absint( $order->get_meta( '_tbl_orange_token_expires_at' ) );
            if ( $existing_url !== '' && $expires_at > time() && $this->tbl_valid_redirect( $existing_url ) ) {
                return [ 'result' => 'success', 'redirect' => $existing_url ];
            }

            $request_reference = (string) $order->get_meta( '_tbl_orange_request_reference' );
            $started_at        = absint( $order->get_meta( '_tbl_orange_initiation_started_at' ) );
            if ( $request_reference !== '' && $expires_at <= 0 && $started_at > ( time() - 120 ) ) {
                wc_add_notice( __( 'La première demande Orange Money est encore en cours de vérification. Réessayez dans deux minutes.', 'papi-pay' ), 'notice' );
                return [ 'result' => 'failure' ];
            }
            if ( $request_reference === '' || ( $expires_at > 0 && $expires_at <= time() ) ) {
                $request_reference = 'tbl' . $order->get_id()
                    . substr( hash_hmac( 'sha256', $order->get_order_key() . '|' . microtime( true ), wp_salt( 'auth' ) ), 0, 20 );
                $order->update_meta_data( '_tbl_orange_request_reference', $request_reference );
            }
            // If an earlier HTTP response was lost, reuse the same reference.
            // This prevents two provider transactions for one WooCommerce order.
            $order->update_meta_data( '_tbl_orange_initiation_started_at', time() );
            $order->update_meta_data( '_tbl_payment_state', 'INITIATING' );
            $order->save();

            $token = $this->tbl_token();
            if ( is_wp_error( $token ) ) {
                $order->update_meta_data( '_tbl_payment_state', 'INITIATION_FAILED' );
                $order->delete_meta_data( '_tbl_orange_initiation_started_at' );
                $order->save();
                tbl_orange_gateway_log( 'Orange authentication failed', $order_id );
                wc_add_notice( __( 'Orange Money est momentanément indisponible.', 'papi-pay' ), 'error' );
                return [ 'result' => 'failure' ];
            }

            $payment_endpoint = $this->tbl_endpoint( $this->api_payment_url, '/orange-money-webpay/' );
            if ( is_wp_error( $payment_endpoint ) ) {
                $order->update_meta_data( '_tbl_payment_state', 'INITIATION_FAILED' );
                $order->delete_meta_data( '_tbl_orange_initiation_started_at' );
                $order->save();
                tbl_orange_gateway_log( 'Orange payment endpoint invalid', $order_id );
                wc_add_notice( __( 'Configuration Orange Money invalide.', 'papi-pay' ), 'error' );
                return [ 'result' => 'failure' ];
            }

            $response = wp_safe_remote_post(
                $payment_endpoint,
                [
                    'headers'            => [
                        'Content-Type'  => 'application/json',
                        'Authorization' => 'Bearer ' . $token,
                        'Accept'        => 'application/json',
                    ],
                    'body'               => wp_json_encode(
                        [
                            'merchant_key' => (string) $this->merchant_key,
                            'order_id'     => $request_reference,
                            'amount'       => tbl_orange_expected_amount( $order ),
                            'reference'    => 'Ticket_' . $order->get_id(),
                            'return_url'   => $order->get_checkout_order_received_url(),
                            'cancel_url'   => add_query_arg(
                                [
                                    'tbl_payment_cancelled' => 'orange',
                                    'order_id'              => $order->get_id(),
                                    'key'                   => $order->get_order_key(),
                                ],
                                wc_get_checkout_url()
                            ),
                            'notif_url'    => rest_url( 'papi/v1/webhook' ),
                            'lang'         => 'fr',
                            'currency'     => 'MGA',
                        ]
                    ),
                    'timeout'            => 30,
                    'redirection'        => 0,
                    'reject_unsafe_urls' => true,
                ]
            );
            if ( is_wp_error( $response ) || 201 !== (int) wp_remote_retrieve_response_code( $response ) ) {
                $order->update_meta_data( '_tbl_payment_state', 'INITIATION_UNCONFIRMED' );
                $order->save();
                tbl_orange_gateway_log( 'Orange initiation failed', $order_id );
                wc_add_notice( __( 'La demande Orange Money n’a pas pu être créée. La commande est conservée.', 'papi-pay' ), 'error' );
                return [ 'result' => 'failure' ];
            }

            $raw_body = (string) wp_remote_retrieve_body( $response );
            $body     = strlen( $raw_body ) <= 16384 ? json_decode( $raw_body, true ) : null;
            $payment_url       = is_array( $body ) ? esc_url_raw( (string) ( $body['payment_url'] ?? '' ) ) : '';
            $notification_token = is_array( $body ) ? trim( (string) ( $body['notif_token'] ?? '' ) ) : '';
            $pay_token          = is_array( $body ) ? trim( (string) ( $body['pay_token'] ?? '' ) ) : '';
            if (
                ! $this->tbl_valid_redirect( $payment_url )
                || ! tbl_orange_token_is_valid( $notification_token )
                || ! tbl_orange_token_is_valid( $pay_token )
            ) {
                $order->update_meta_data( '_tbl_payment_state', 'REVIEW' );
                $order->update_meta_data( '_tbl_orange_review_reason', 'initiation_response_invalid' );
                $order->save();
                tbl_orange_gateway_log( 'Orange initiation response invalid', $order_id );
                wc_add_notice( __( 'Réponse Orange Money invalide. La commande est conservée.', 'papi-pay' ), 'error' );
                return [ 'result' => 'failure' ];
            }

            $snapshot = tbl_orange_store_payment_snapshot(
                $order,
                $notification_token,
                $pay_token,
                $payment_url,
                $request_reference
            );
            if ( is_wp_error( $snapshot ) ) {
                tbl_orange_gateway_log( 'Orange payment snapshot invalid', $order_id );
                wc_add_notice( __( 'La commande Orange Money n’a pas pu être sécurisée.', 'papi-pay' ), 'error' );
                return [ 'result' => 'failure' ];
            }

            $order->update_status( 'on-hold', __( 'Orange Money : confirmation serveur en attente.', 'papi-pay' ) );
            $order->save();
            if ( function_exists( 'WC' ) && WC()->cart ) {
                WC()->cart->empty_cart();
            }
            tbl_orange_audit_order( 'payment_initiated', $order );
            return [ 'result' => 'success', 'redirect' => $payment_url ];
        } finally {
            tbl_orange_gateway_lock( $order_id, true );
        }
    }

    private function tbl_token() {
        $endpoint = $this->tbl_endpoint( $this->api_token_url, '/oauth/' );
        $consumer = trim( (string) $this->consumer_key );
        if ( is_wp_error( $endpoint ) || $consumer === '' || strlen( $consumer ) > 2048 || preg_match( '/[\r\n]/', $consumer ) ) {
            return new WP_Error( 'orange_token_config_invalid', 'Orange authentication configuration is invalid' );
        }

        $response = wp_safe_remote_post(
            $endpoint,
            [
                'headers'            => [
                    'Content-Type'  => 'application/x-www-form-urlencoded',
                    'Authorization' => 'Basic ' . $consumer,
                    'Accept'        => 'application/json',
                ],
                'body'               => [ 'grant_type' => 'client_credentials' ],
                'timeout'            => 20,
                'redirection'        => 0,
                'reject_unsafe_urls' => true,
            ]
        );
        if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return new WP_Error( 'orange_token_failed', 'Orange authentication failed' );
        }

        $body  = json_decode( (string) wp_remote_retrieve_body( $response ), true );
        $token = is_array( $body ) ? trim( (string) ( $body['access_token'] ?? '' ) ) : '';
        return tbl_orange_token_is_valid( $token )
            ? $token
            : new WP_Error( 'orange_token_missing', 'Orange authentication token missing' );
    }

    private function tbl_endpoint( $url, $required_path ) {
        $url  = esc_url_raw( (string) $url );
        $host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
        $path = (string) wp_parse_url( $url, PHP_URL_PATH );
        if ( 'https' !== wp_parse_url( $url, PHP_URL_SCHEME ) || 'api.orange.com' !== $host || false === strpos( $path, $required_path ) ) {
            return new WP_Error( 'orange_endpoint_invalid', 'Orange endpoint is invalid' );
        }
        return $url;
    }

    private function tbl_valid_redirect( $url ) {
        return wp_http_validate_url( (string) $url )
            && 'https' === wp_parse_url( (string) $url, PHP_URL_SCHEME );
    }
}

add_action(
    'plugins_loaded',
    static function() {
        if ( ! class_exists( 'WC_Payment_Gateway' ) || class_exists( 'TBL_Secure_Orange_Gateway' ) ) {
            return;
        }

        if ( class_exists( 'WC_papi_pay_Gateway' ) ) {
            class TBL_Secure_Orange_Gateway extends WC_papi_pay_Gateway {
                use TBL_Orange_Gateway_Security;
            }
        } else {
            class TBL_Secure_Orange_Gateway extends WC_Payment_Gateway {
                use TBL_Orange_Gateway_Security;

                public $merchant_key = '';
                public $consumer_key = '';
                public $api_token_url = '';
                public $api_payment_url = '';

                public function __construct() {
                    $this->id                 = 'papi_paiement';
                    $this->icon               = plugins_url( 'orange/assets/papi.png' );
                    $this->has_fields         = false;
                    $this->method_title       = __( 'Orange Money Payment', 'papi-pay' );
                    $this->method_description = __( 'Paiement Orange Money sécurisé pour WooCommerce et Lamako Mobile.', 'papi-pay' );
                    $this->supports           = [ 'products' ];
                    $this->init_form_fields();
                    $this->init_settings();
                    $this->enabled         = $this->get_option( 'enabled', 'no' );
                    $this->title           = $this->get_option( 'title', 'Orange Money' );
                    $this->description     = $this->get_option( 'description', '' );
                    $this->merchant_key    = $this->get_option( 'merchant_key', '' );
                    $this->consumer_key    = $this->get_option( 'consumer_key', '' );
                    $this->api_token_url   = $this->get_option( 'api_token_url', 'https://api.orange.com/oauth/v3/token' );
                    $this->api_payment_url = $this->get_option( 'api_payment_url', 'https://api.orange.com/orange-money-webpay/mg/v1/webpayment' );
                    add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, [ $this, 'process_admin_options' ] );
                }

                public function init_form_fields() {
                    $this->form_fields = [
                        'enabled'         => [
                            'title'   => __( 'Enable/Disable', 'papi-pay' ),
                            'type'    => 'checkbox',
                            'label'   => __( 'Activer Orange Money', 'papi-pay' ),
                            'default' => 'no',
                        ],
                        'title'           => [ 'title' => __( 'Titre', 'papi-pay' ), 'type' => 'text', 'default' => 'Orange Money' ],
                        'description'     => [ 'title' => __( 'Description', 'papi-pay' ), 'type' => 'textarea', 'default' => '' ],
                        'merchant_key'    => [ 'title' => __( 'Merchant Key', 'papi-pay' ), 'type' => 'text' ],
                        'consumer_key'    => [ 'title' => __( 'Consumer Key', 'papi-pay' ), 'type' => 'password' ],
                        'api_token_url'   => [
                            'title'   => __( 'URL API Token', 'papi-pay' ),
                            'type'    => 'text',
                            'default' => 'https://api.orange.com/oauth/v3/token',
                        ],
                        'api_payment_url' => [
                            'title'   => __( 'URL API Paiement', 'papi-pay' ),
                            'type'    => 'text',
                            'default' => 'https://api.orange.com/orange-money-webpay/mg/v1/webpayment',
                        ],
                    ];
                }
            }
        }
    },
    20
);

function tbl_orange_gateway_is_hardened( $gateway = null ) {
    if (
        ! defined( 'TBL_ORANGE_GUARD_VERSION' )
        || ! class_exists( 'TBL_Secure_Orange_Gateway' )
        || ! function_exists( 'tbl_orange_secure_webhook' )
    ) {
        return false;
    }
    if ( null === $gateway ) {
        return true;
    }
    return $gateway instanceof TBL_Secure_Orange_Gateway
        && method_exists( $gateway, 'tbl_security_ready' )
        && $gateway->tbl_security_ready();
}

add_filter(
    'woocommerce_payment_gateways',
    static function( $gateways ) {
        $filtered = [];
        foreach ( (array) $gateways as $gateway ) {
            $class = is_object( $gateway ) ? get_class( $gateway ) : (string) $gateway;
            if ( ! in_array( $class, [ 'WC_papi_pay_Gateway', 'TBL_Secure_Orange_Gateway' ], true ) ) {
                $filtered[] = $gateway;
            }
        }
        if ( class_exists( 'TBL_Secure_Orange_Gateway' ) ) {
            $filtered[] = 'TBL_Secure_Orange_Gateway';
        }
        return $filtered;
    },
    999
);

add_action(
    'rest_api_init',
    static function() {
        register_rest_route(
            'papi/v1',
            '/webhook',
            [
                'methods'             => 'POST',
                'callback'            => 'tbl_orange_secure_webhook',
                // Authentication is the high-entropy, server-issued notif_token
                // bound to a single immutable order snapshot.
                'permission_callback' => '__return_true',
            ],
            true
        );
        register_rest_route(
            'papi/v1',
            '/check-status',
            [
                'methods'             => 'POST',
                'callback'            => 'tbl_orange_secure_check_status',
                'permission_callback' => 'tbl_orange_check_status_permission',
                'args'                => [
                    'order_id' => [ 'required' => true, 'sanitize_callback' => 'absint' ],
                    'order_key' => [ 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
                ],
            ],
            true
        );
    },
    PHP_INT_MAX
);
