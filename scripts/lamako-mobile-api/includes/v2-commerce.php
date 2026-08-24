<?php
/**
 * Lamako Mobile API v2.
 *
 * Adds JWT-authenticated commerce, order, ticket, push token, and rewards
 * endpoints beside the legacy v1 WooCommerce-key endpoints. The v2 surface is
 * intentionally additive so production can migrate screen by screen.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'LAMAKO_MOBILE_V2_CHECKOUT_TTL' ) ) {
    define( 'LAMAKO_MOBILE_V2_CHECKOUT_TTL', 10 * MINUTE_IN_SECONDS );
}

if ( ! defined( 'LAMAKO_MOBILE_V2_PAYMENT_VERIFY_TTL' ) ) {
    define( 'LAMAKO_MOBILE_V2_PAYMENT_VERIFY_TTL', HOUR_IN_SECONDS );
}

if ( ! defined( 'LAMAKO_MOBILE_V2_SEATING_TTL' ) ) {
    define( 'LAMAKO_MOBILE_V2_SEATING_TTL', 10 * MINUTE_IN_SECONDS );
}

if ( ! defined( 'LAMAKO_MOBILE_V2_CATALOG_TTL' ) ) {
    define( 'LAMAKO_MOBILE_V2_CATALOG_TTL', 2 * MINUTE_IN_SECONDS );
}

add_action( 'rest_api_init', 'lamako_mobile_v2_register_routes' );
add_action( 'template_redirect', 'lamako_mobile_v2_maybe_serve_payment_return', 2 );
add_action( 'template_redirect', 'lamako_mobile_v2_maybe_serve_cybersource', 2 );
add_action( 'template_redirect', 'lamako_mobile_v2_bridge_checkout_token', 4 );
add_action( 'template_redirect', 'lamako_mobile_v2_begin_seating_checkout', 4 );
add_action( 'template_redirect', 'lamako_mobile_v2_maybe_serve_seating_flow', 3 );
add_action( 'lamako_mobile_v2_cleanup_seating_flow', 'lamako_mobile_v2_cleanup_seating_flow_option', 10, 1 );
add_action( 'lamako_mobile_v2_process_async_payment', 'lamako_mobile_v2_process_async_payment', 10, 3 );
add_action( 'lamako_mobile_v2_poll_provider_payment', 'lamako_mobile_v2_poll_provider_payment', 10, 3 );
add_action( 'lamako_mobile_v2_reconcile_pending_payments', 'lamako_mobile_v2_reconcile_pending_payments' );
add_action( 'lamako_mobile_v2_expire_stale_orders', 'lamako_mobile_v2_expire_stale_orders' );
add_action( 'init', 'lamako_mobile_v2_ensure_payment_reconciliation_schedule' );
add_action( 'woocommerce_order_status_changed', 'lamako_mobile_v2_issue_tickets_after_payment', 50, 4 );
add_action( 'woocommerce_payment_complete', 'lamako_mobile_v2_issue_tickets_after_payment', 50, 1 );
add_action( 'save_post_tc_events', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'save_post_product', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'before_delete_post', 'lamako_mobile_v2_invalidate_catalog_cache_for_deleted_post' );
add_action( 'set_object_terms', 'lamako_mobile_v2_invalidate_catalog_cache_for_terms', 10, 6 );
add_action( 'created_event_category', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'edited_event_category', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'delete_event_category', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'created_product_cat', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'edited_product_cat', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_action( 'delete_product_cat', 'lamako_mobile_v2_invalidate_catalog_cache' );
add_filter( 'cron_schedules', 'lamako_mobile_v2_payment_cron_schedules' );
add_action( 'woocommerce_checkout_create_order', 'lamako_mobile_v2_mark_seating_order', 20, 2 );
add_action( 'woocommerce_checkout_order_created', 'lamako_mobile_v2_link_seating_order_created', 20 );
add_filter( 'woocommerce_get_return_url', 'lamako_mobile_v2_payment_return_url', 10000, 2 );
add_filter( 'woocommerce_get_checkout_order_received_url', 'lamako_mobile_v2_payment_received_url', 10000, 2 );
add_filter( 'woocommerce_get_cancel_order_url', 'lamako_mobile_v2_payment_cancel_url', 10000, 2 );
add_filter( 'woocommerce_get_checkout_url', 'lamako_mobile_v2_provider_cancel_url', 10000, 1 );
add_filter( 'tc_seat_chart_add_to_cart_url', 'lamako_mobile_v2_seating_cart_url', 10000 );

function lamako_mobile_v2_catalog_cache_version() {
    return max( 1, absint( get_option( 'lamako_mobile_v2_catalog_cache_version', 1 ) ) );
}

function lamako_mobile_v2_invalidate_catalog_cache() {
    update_option(
        'lamako_mobile_v2_catalog_cache_version',
        lamako_mobile_v2_catalog_cache_version() + 1,
        false
    );
}

function lamako_mobile_v2_invalidate_catalog_cache_for_deleted_post( $post_id ) {
    if ( in_array( get_post_type( $post_id ), [ 'tc_events', 'product' ], true ) ) {
        lamako_mobile_v2_invalidate_catalog_cache();
    }
}

function lamako_mobile_v2_invalidate_catalog_cache_for_terms( $object_id, $terms, $tt_ids, $taxonomy ) {
    if ( in_array( $taxonomy, [ 'event_category', 'product_cat' ], true ) ) {
        lamako_mobile_v2_invalidate_catalog_cache();
    }
}

function lamako_mobile_v2_catalog_cache_key( $scope, array $parameters ) {
    ksort( $parameters );
    return 'lamako_v2_catalog_' . md5( wp_json_encode( [
        'version'    => lamako_mobile_v2_catalog_cache_version(),
        'scope'      => sanitize_key( $scope ),
        'parameters' => $parameters,
    ] ) );
}

function lamako_mobile_v2_catalog_cached_response( $cache_key ) {
    $cached = get_transient( $cache_key );
    if ( ! is_array( $cached ) ) {
        return null;
    }

    $response = rest_ensure_response( $cached );
    $response->header( 'X-Lamako-Catalog-Cache', 'HIT' );
    $response->header( 'Cache-Control', 'public, max-age=30, stale-while-revalidate=120' );
    return $response;
}

function lamako_mobile_v2_catalog_fresh_response( $cache_key, array $data ) {
    $data['version']     = (string) lamako_mobile_v2_catalog_cache_version();
    $data['generatedAt'] = gmdate( 'c' );
    set_transient( $cache_key, $data, LAMAKO_MOBILE_V2_CATALOG_TTL );

    $response = rest_ensure_response( $data );
    $response->header( 'X-Lamako-Catalog-Cache', 'MISS' );
    $response->header( 'Cache-Control', 'public, max-age=30, stale-while-revalidate=120' );
    return $response;
}

function lamako_mobile_v2_register_routes() {
    $namespace = 'lamako-mobile/v2';

    register_rest_route( $namespace, '/public/home-data', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_home_data',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/events-data', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_events_data',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/events/(?P<event_id>\d+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_event',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/events/(?P<event_id>\d+)/checkout-fields', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_event_checkout_fields',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/shop-data', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_shop_data',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/products/(?P<product_id>\d+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_product',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/checkouts', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_create_checkout',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/checkouts/fields', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_get_checkout_fields_for_items',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/checkouts/(?P<token>[A-Za-z0-9_-]+)/status', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_checkout_status',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payments/(?P<token>[A-Za-z0-9_-]+)/methods', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_payment_methods',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payments/(?P<token>[A-Za-z0-9_-]+)/coupon', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_update_payment_coupon',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payments/(?P<token>[A-Za-z0-9_-]+)/start', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_start_payment',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payments/(?P<token>[A-Za-z0-9_-]+)/verify', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_verify_payment',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payments/(?P<token>[A-Za-z0-9_-]+)/cancel', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_cancel_payment',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payments/mvola/callback', [
        'methods'             => 'PUT',
        'callback'            => 'lamako_mobile_v2_mvola_callback',
        'permission_callback' => 'lamako_mobile_v2_allow_mvola_callback',
    ] );

    register_rest_route( $namespace, '/payments/orange/callback', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_orange_callback',
        'permission_callback' => 'lamako_mobile_v2_allow_orange_callback',
    ] );

    register_rest_route( $namespace, '/seating-sessions', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_create_seating_session',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/seating-sessions/(?P<token>[A-Za-z0-9_-]+)/status', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_seating_session_status',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/seating-sessions/(?P<token>[A-Za-z0-9_-]+)/order', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_create_seating_order',
        'permission_callback' => 'lamako_mobile_v2_allow_seating_flow_session',
    ] );

    register_rest_route( $namespace, '/payment-return/(?P<token>[A-Za-z0-9_-]+)/status', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_payment_return_status',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/orders', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_orders',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/orders/(?P<order_id>\d+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_order',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/orders/(?P<order_id>\d+)/tickets', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_order_tickets_route',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/push-token', [
        [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'lamako_mobile_v2_register_push_token',
            'permission_callback' => 'lamako_mobile_v2_require_user',
        ],
        [
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'lamako_mobile_v2_unregister_push_token',
            'permission_callback' => 'lamako_mobile_v2_require_user',
        ],
    ] );

    register_rest_route( $namespace, '/profile', [
        [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'lamako_mobile_v2_get_profile',
            'permission_callback' => 'lamako_mobile_v2_require_user',
        ],
        [
            'methods'             => WP_REST_Server::EDITABLE,
            'callback'            => 'lamako_mobile_v2_update_profile',
            'permission_callback' => 'lamako_mobile_v2_require_user',
        ],
    ] );

    register_rest_route( $namespace, '/rewards/balance', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_rewards_balance',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/rewards/config', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_rewards_config',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/rewards/history', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_rewards_history',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/rewards/redeem', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_rewards_redeem',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/referral/code', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_referral_code',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/referral/validate', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_validate_referral_code',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/referral/register', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_register_referral',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );
}

function lamako_mobile_v2_require_user( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( $user_id <= 0 ) {
        return new WP_Error( 'lamako_v2_not_authenticated', 'Authentication required.', [ 'status' => 401 ] );
    }
    return true;
}

function lamako_mobile_v2_profile_response( WP_User $user ) {
    return [
        'id'           => (int) $user->ID,
        'email'        => (string) $user->user_email,
        'displayName'  => (string) $user->display_name,
        'firstName'    => (string) get_user_meta( $user->ID, 'first_name', true ),
        'lastName'     => (string) get_user_meta( $user->ID, 'last_name', true ),
        'billing'      => [
            'phone'     => (string) get_user_meta( $user->ID, 'billing_phone', true ),
            'address_1' => (string) get_user_meta( $user->ID, 'billing_address_1', true ),
            'city'      => (string) get_user_meta( $user->ID, 'billing_city', true ),
            'country'   => (string) ( get_user_meta( $user->ID, 'billing_country', true ) ?: 'MG' ),
        ],
    ];
}

function lamako_mobile_v2_get_profile( WP_REST_Request $request ) {
    $user = wp_get_current_user();
    if ( ! $user || ! $user->exists() ) {
        return new WP_Error( 'lamako_v2_not_authenticated', 'Authentication required.', [ 'status' => 401 ] );
    }
    return rest_ensure_response( lamako_mobile_v2_profile_response( $user ) );
}

function lamako_mobile_v2_update_profile( WP_REST_Request $request ) {
    $user = wp_get_current_user();
    if ( ! $user || ! $user->exists() ) {
        return new WP_Error( 'lamako_v2_not_authenticated', 'Authentication required.', [ 'status' => 401 ] );
    }

    $params     = $request->get_json_params();
    $params     = is_array( $params ) ? $params : [];
    $first_name = sanitize_text_field( $params['firstName'] ?? '' );
    $last_name  = sanitize_text_field( $params['lastName'] ?? '' );
    $email      = sanitize_email( $params['email'] ?? '' );
    $billing    = isset( $params['billing'] ) && is_array( $params['billing'] ) ? $params['billing'] : [];

    if ( $email === '' || ! is_email( $email ) ) {
        return new WP_Error( 'lamako_v2_invalid_email', 'Please provide a valid email address.', [ 'status' => 400 ] );
    }

    $email_owner = get_user_by( 'email', $email );
    if ( $email_owner && (int) $email_owner->ID !== (int) $user->ID ) {
        return new WP_Error( 'lamako_v2_email_exists', 'This email address is already in use.', [ 'status' => 409 ] );
    }

    $updated = wp_update_user( [
        'ID'           => $user->ID,
        'user_email'   => $email,
        'first_name'   => $first_name,
        'last_name'    => $last_name,
        'display_name' => trim( $first_name . ' ' . $last_name ) ?: $user->display_name,
    ] );
    if ( is_wp_error( $updated ) ) {
        return new WP_Error( 'lamako_v2_profile_update_failed', $updated->get_error_message(), [ 'status' => 400 ] );
    }

    update_user_meta( $user->ID, 'billing_email', $email );
    update_user_meta( $user->ID, 'billing_first_name', $first_name );
    update_user_meta( $user->ID, 'billing_last_name', $last_name );
    update_user_meta( $user->ID, 'billing_phone', sanitize_text_field( $billing['phone'] ?? '' ) );
    update_user_meta( $user->ID, 'billing_address_1', sanitize_text_field( $billing['address_1'] ?? '' ) );
    update_user_meta( $user->ID, 'billing_city', sanitize_text_field( $billing['city'] ?? '' ) );
    $country = strtoupper( sanitize_text_field( $billing['country'] ?? 'MG' ) );
    update_user_meta( $user->ID, 'billing_country', preg_match( '/^[A-Z]{2}$/', $country ) ? $country : 'MG' );

    clean_user_cache( $user->ID );
    $fresh_user = get_user_by( 'id', $user->ID );
    return rest_ensure_response( lamako_mobile_v2_profile_response( $fresh_user ?: $user ) );
}

function lamako_mobile_v2_payment_cron_schedules( $schedules ) {
    if ( empty( $schedules['lamako_mobile_minute'] ) ) {
        $schedules['lamako_mobile_minute'] = [
            'interval' => MINUTE_IN_SECONDS,
            'display'  => 'Every minute (Lamako mobile payments)',
        ];
    }
    return $schedules;
}

function lamako_mobile_v2_ensure_payment_reconciliation_schedule() {
    if ( ! wp_next_scheduled( 'lamako_mobile_v2_reconcile_pending_payments' ) ) {
        wp_schedule_event( time() + MINUTE_IN_SECONDS, 'lamako_mobile_minute', 'lamako_mobile_v2_reconcile_pending_payments' );
    }
    if ( ! wp_next_scheduled( 'lamako_mobile_v2_expire_stale_orders' ) ) {
        wp_schedule_event( time() + MINUTE_IN_SECONDS, 'lamako_mobile_minute', 'lamako_mobile_v2_expire_stale_orders' );
    }
}

function lamako_mobile_v2_allow_mvola_callback( WP_REST_Request $request ) {
    $body      = $request->get_json_params();
    $body      = is_array( $body ) ? $body : [];
    $reference = sanitize_text_field( $body['serverCorrelationId'] ?? '' );
    $status    = sanitize_key( $body['transactionStatus'] ?? '' );

    if ( ! preg_match( '/^[a-f0-9-]{20,64}$/i', $reference ) ) {
        return new WP_Error( 'lamako_v2_mvola_callback_invalid', 'Invalid callback payload.', [ 'status' => 400 ] );
    }
    if ( ! in_array( $status, [ 'pending', 'completed', 'failed' ], true ) ) {
        return new WP_Error( 'lamako_v2_mvola_callback_invalid', 'Invalid callback payload.', [ 'status' => 400 ] );
    }
    return true;
}

function lamako_mobile_v2_meta_first( $post_id, array $keys, $default = '' ) {
    foreach ( $keys as $key ) {
        $value = get_post_meta( $post_id, $key, true );
        if ( $value !== '' && $value !== null && $value !== false ) {
            return maybe_unserialize( $value );
        }
    }
    return $default;
}

function lamako_mobile_v2_truthy_meta( $post_id, array $keys ) {
    $value = lamako_mobile_v2_meta_first( $post_id, $keys, '' );
    return in_array( strtolower( (string) $value ), [ '1', 'yes', 'true', 'on' ], true );
}

function lamako_mobile_v2_rewards_enabled_meta_keys() {
    return [
        'tbl_post_event_lamako_rewards_enabled',
        '_tbl_post_event_lamako_rewards_enabled',
        'tbl_lamako_rewards_enabled',
        '_tbl_lamako_rewards_enabled',
        '_lper_lamako_rewards_enabled',
        'lper_lamako_rewards_enabled',
        'lamako_rewards_enabled',
        '_lamako_rewards_enabled',
        'rewards_redeem_enabled',
        '_rewards_redeem_enabled',
        'rewardsRedeemEnabled',
        '_rewardsRedeemEnabled',
    ];
}

function lamako_mobile_v2_rewards_redeem_enabled( $post_id ) {
    return lamako_mobile_v2_truthy_meta( $post_id, lamako_mobile_v2_rewards_enabled_meta_keys() );
}

function lamako_mobile_v2_is_rewards_coupon_code( $coupon_code ) {
    $coupon_code = trim( (string) $coupon_code );
    if ( $coupon_code === '' ) {
        return false;
    }

    if ( stripos( $coupon_code, 'LR-' ) === 0 ) {
        return true;
    }

    if ( class_exists( 'WC_Coupon' ) ) {
        $coupon = new WC_Coupon( $coupon_code );
        if ( $coupon->get_id() > 0 && stripos( (string) $coupon->get_description(), 'Lamako Mobile v2 rewards coupon' ) !== false ) {
            return true;
        }
    }

    return false;
}

function lamako_mobile_v2_checkout_item_rewards_redeem_enabled( array $item ) {
    $base_id  = absint( $item['base_id'] ?? 0 );
    $event_id = absint( $item['event_id'] ?? 0 );

    if ( $event_id > 0 && lamako_mobile_v2_rewards_redeem_enabled( $event_id ) ) {
        return true;
    }

    return $base_id > 0 && lamako_mobile_v2_rewards_redeem_enabled( $base_id );
}

function lamako_mobile_v2_image_url_from_value( $value, $size = 'large' ) {
    if ( is_numeric( $value ) ) {
        $url = wp_get_attachment_image_url( absint( $value ), $size );
        return $url ? $url : '';
    }
    if ( is_string( $value ) && preg_match( '#^https?://#', $value ) ) {
        return esc_url_raw( $value );
    }
    return '';
}

function lamako_mobile_v2_ticket_event_image( $event_id, $product_id ) {
    $event_id   = absint( $event_id );
    $product_id = absint( $product_id );

    if ( $event_id > 0 ) {
        $featured = get_the_post_thumbnail_url( $event_id, 'medium_large' );
        if ( is_string( $featured ) && $featured !== '' ) {
            return esc_url_raw( $featured );
        }

        $event_gallery = lamako_mobile_v2_public_gallery( $event_id, [
            'lamako_mobile_gallery',
            '_lamako_mobile_gallery',
            'mobile_gallery',
            '_mobile_gallery',
            '_tbl_event_gallery_image_ids',
        ] );
        if ( ! empty( $event_gallery[0] ) ) {
            return esc_url_raw( $event_gallery[0] );
        }
    }

    if ( $product_id > 0 ) {
        $product_featured = get_the_post_thumbnail_url( $product_id, 'medium_large' );
        if ( is_string( $product_featured ) && $product_featured !== '' ) {
            return esc_url_raw( $product_featured );
        }

        $product_gallery = lamako_mobile_v2_public_gallery( $product_id, [
            'lamako_mobile_gallery',
            '_lamako_mobile_gallery',
            'mobile_gallery',
            '_mobile_gallery',
        ] );
        if ( ! empty( $product_gallery[0] ) ) {
            return esc_url_raw( $product_gallery[0] );
        }
    }

    return '';
}

function lamako_mobile_v2_public_gallery( $post_id, array $keys ) {
    $raw = lamako_mobile_v2_meta_first( $post_id, $keys, [] );
    if ( is_string( $raw ) ) {
        $raw = array_filter( array_map( 'trim', explode( ',', $raw ) ) );
    }
    if ( ! is_array( $raw ) ) {
        return [];
    }

    $urls = [];
    foreach ( $raw as $item ) {
        if ( is_array( $item ) ) {
            $item = $item['url'] ?? $item['src'] ?? $item['id'] ?? '';
        }
        $url = lamako_mobile_v2_image_url_from_value( $item );
        if ( $url ) {
            $urls[] = $url;
        }
    }
    return array_values( array_unique( $urls ) );
}

function lamako_mobile_v2_public_practical_info( $post_id ) {
    $raw = lamako_mobile_v2_meta_first( $post_id, [
        'lamako_mobile_practical_info',
        '_lamako_mobile_practical_info',
        'mobile_practical_info',
        '_mobile_practical_info',
        'practical_info',
        '_practical_info',
    ], [] );

    if ( ! is_array( $raw ) ) {
        return [];
    }

    $items = [];
    foreach ( $raw as $row ) {
        if ( ! is_array( $row ) ) {
            continue;
        }
        $label = sanitize_text_field( $row['label'] ?? $row['title'] ?? '' );
        $value = sanitize_text_field( $row['value'] ?? $row['text'] ?? '' );
        if ( $label !== '' || $value !== '' ) {
            $items[] = [
                'label' => $label,
                'value' => $value,
            ];
        }
    }
    return $items;
}

function lamako_mobile_v2_public_event_categories() {
    $terms = get_terms( [
        'taxonomy'   => 'event_category',
        'hide_empty' => false,
        'number'     => 100,
    ] );

    if ( is_wp_error( $terms ) ) {
        return [];
    }

    return array_map( function( $term ) {
        return [
            'id'     => (int) $term->term_id,
            'name'   => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
            'slug'   => $term->slug,
            'count'  => (int) $term->count,
            'parent' => (int) $term->parent,
        ];
    }, $terms );
}

function lamako_mobile_v2_public_product_categories( $product_id ) {
    $terms = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'all' ] );
    if ( is_wp_error( $terms ) ) {
        return [];
    }

    return array_map( function( $term ) {
        return [
            'id'   => (int) $term->term_id,
            'name' => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
            'slug' => $term->slug,
        ];
    }, $terms );
}

function lamako_mobile_v2_is_boutique_product( $product_id ) {
    $terms = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'all' ] );
    if ( is_wp_error( $terms ) || empty( $terms ) ) {
        return false;
    }

    foreach ( $terms as $term ) {
        if ( strpos( $term->slug, 'boutique-' ) === 0 ) {
            return true;
        }

        $parent_id = (int) $term->parent;
        while ( $parent_id > 0 ) {
            $parent = get_term( $parent_id, 'product_cat' );
            if ( ! $parent || is_wp_error( $parent ) ) {
                break;
            }
            if ( strpos( $parent->slug, 'boutique-' ) === 0 ) {
                return true;
            }
            $parent_id = (int) $parent->parent;
        }
    }

    return false;
}

function lamako_mobile_v2_public_shop_categories() {
    $terms = get_terms( [
        'taxonomy'   => 'product_cat',
        'hide_empty' => false,
        'number'     => 100,
    ] );

    if ( is_wp_error( $terms ) ) {
        return [];
    }

    $categories = [];
    foreach ( $terms as $term ) {
        $include = strpos( $term->slug, 'boutique-' ) === 0;
        if ( ! $include && $term->parent > 0 ) {
            $parent = get_term( $term->parent, 'product_cat' );
            $include = $parent && ! is_wp_error( $parent ) && strpos( $parent->slug, 'boutique-' ) === 0;
        }
        if ( ! $include ) {
            continue;
        }

        $categories[] = [
            'id'     => (int) $term->term_id,
            'name'   => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
            'slug'   => $term->slug,
            'count'  => (int) $term->count,
            'image'  => null,
            'parent' => (int) $term->parent,
        ];
    }
    return $categories;
}

function lamako_mobile_v2_public_product_images( WC_Product $product, $image_size = 'large' ) {
    $image_ids = [];
    $main_id = $product->get_image_id();
    if ( $main_id ) {
        $image_ids[] = $main_id;
    }
    foreach ( $product->get_gallery_image_ids() as $image_id ) {
        $image_ids[] = $image_id;
    }

    $images = [];
    foreach ( array_unique( array_filter( $image_ids ) ) as $image_id ) {
        $src = wp_get_attachment_image_url( $image_id, $image_size );
        if ( $src ) {
            $images[] = [
                'id'  => (int) $image_id,
                'src' => $src,
                'alt' => get_post_meta( $image_id, '_wp_attachment_image_alt', true ),
            ];
        }
    }
    return $images;
}

function lamako_mobile_v2_public_product_mobile_fields( $product_id ) {
    return [
        'description'    => lamako_mobile_v2_meta_first( $product_id, [
            'lamako_mobile_description',
            '_lamako_mobile_description',
            'mobile_description',
            '_mobile_description',
        ], null ),
        'gallery'        => lamako_mobile_v2_public_gallery( $product_id, [
            'lamako_mobile_gallery',
            '_lamako_mobile_gallery',
            'mobile_gallery',
            '_mobile_gallery',
        ] ),
        'practical_info' => lamako_mobile_v2_public_practical_info( $product_id ),
    ];
}

function lamako_mobile_v2_public_product_summary( WC_Product $product, $include_details = false ) {
    $product_id = $product->get_id();
    $post = get_post( $product_id );
    if ( ! $post || $post->post_status !== 'publish' ) {
        return null;
    }

    $data = [
        'id'              => $product_id,
        'name'            => html_entity_decode( $product->get_name(), ENT_QUOTES, 'UTF-8' ),
        'slug'            => $post->post_name,
        'permalink'       => get_permalink( $product_id ),
        'price'           => $product->get_price(),
        'regular_price'   => $product->get_regular_price(),
        'sale_price'      => $product->get_sale_price(),
        'description'     => $include_details ? wp_kses_post( $product->get_description() ) : '',
        'short_description' => $include_details ? wp_kses_post( $product->get_short_description() ) : '',
        'images'          => lamako_mobile_v2_public_product_images( $product, $include_details ? 'large' : 'medium_large' ),
        'categories'      => lamako_mobile_v2_public_product_categories( $product_id ),
        'stock_status'    => $product->get_stock_status(),
        'type'            => $product->get_type(),
        'lamako_rewards_enabled' => lamako_mobile_v2_rewards_redeem_enabled( $product_id ),
        'rewardsRedeemEnabled' => lamako_mobile_v2_rewards_redeem_enabled( $product_id ),
        'meta_data'       => [],
        'date_created'    => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : '',
        'lamako_mobile'   => $include_details ? lamako_mobile_v2_public_product_mobile_fields( $product_id ) : null,
    ];

    return $data;
}

function lamako_mobile_v2_public_shop_products( $limit = 100, $include_details = false ) {
    if ( ! function_exists( 'wc_get_product' ) ) {
        return [];
    }

    $posts = get_posts( [
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => min( max( absint( $limit ), 1 ), 100 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
        'fields'         => 'ids',
    ] );

    $products = [];
    foreach ( $posts as $product_id ) {
        if ( lamako_mobile_v2_truthy_meta( $product_id, [ '_tc_is_ticket' ] ) ) {
            continue;
        }
        if ( ! lamako_mobile_v2_is_boutique_product( $product_id ) ) {
            continue;
        }
        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            continue;
        }
        $summary = lamako_mobile_v2_public_product_summary( $product, $include_details );
        if ( $summary ) {
            $products[] = $summary;
        }
    }
    return $products;
}

function lamako_mobile_v2_public_ticket_map( $event_ids = [], $include_checkout_fields = true ) {
    if ( ! function_exists( 'wc_get_product' ) ) {
        return [];
    }

    if ( ! is_array( $event_ids ) ) {
        $event_ids = absint( $event_ids ) > 0 ? [ absint( $event_ids ) ] : [];
    }
    $event_ids = array_values( array_unique( array_filter( array_map( 'absint', $event_ids ) ) ) );

    $meta_query = [
        [
            'key'     => '_tc_is_ticket',
            'value'   => [ 'yes', '1' ],
            'compare' => 'IN',
        ],
    ];
    if ( ! empty( $event_ids ) ) {
        $meta_query[] = [
            'key'     => '_event_name',
            'value'   => $event_ids,
            'compare' => 'IN',
        ];
    }

    $posts = get_posts( [
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => 300,
        'fields'         => 'ids',
        'meta_query'     => $meta_query,
    ] );

    $map = [];
    foreach ( $posts as $product_id ) {
        $ticket_event_id = absint( get_post_meta( $product_id, '_event_name', true ) );
        if ( $ticket_event_id <= 0 ) {
            continue;
        }
        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            continue;
        }

        if ( ! isset( $map[ $ticket_event_id ] ) ) {
            $map[ $ticket_event_id ] = [];
        }
        $form_template_id = absint( get_post_meta( $product_id, '_owner_form_template', true ) );
        $checkout_fields  = $include_checkout_fields && $form_template_id > 0
            ? lamako_mobile_v2_checkout_fields_for_ticket( $product_id, $ticket_event_id, 1 )
            : [ 'hasFields' => false, 'requiresFields' => false ];
        $map[ $ticket_event_id ][] = [
            'id'           => $product_id,
            'name'         => html_entity_decode( $product->get_name(), ENT_QUOTES, 'UTF-8' ),
            'price'        => $product->get_price(),
            'stock_status' => $product->get_stock_status(),
            'usesSeating'  => lamako_mobile_v2_truthy_meta( $product_id, [ '_tc_used_for_seatings' ] ),
            'eventId'      => (string) $ticket_event_id,
            'hasCheckoutFields'      => ! empty( $checkout_fields['hasFields'] ),
            'requiresCheckoutFields' => ! empty( $checkout_fields['requiresFields'] ),
            'lamako_rewards_enabled' => lamako_mobile_v2_rewards_redeem_enabled( $ticket_event_id ) || lamako_mobile_v2_rewards_redeem_enabled( $product_id ),
            'rewardsRedeemEnabled' => lamako_mobile_v2_rewards_redeem_enabled( $ticket_event_id ) || lamako_mobile_v2_rewards_redeem_enabled( $product_id ),
        ];
    }
    return $map;
}

function lamako_mobile_v2_public_event_mobile_fields( $event_id, $include_details = true ) {
    $fields = [
        'event_date_time'     => lamako_mobile_v2_meta_first( $event_id, [ 'event_date_time', '_event_date_time', 'event_start_date', '_event_start_date' ], null ),
        'event_end_date_time' => lamako_mobile_v2_meta_first( $event_id, [ 'event_end_date_time', '_event_end_date_time', 'event_end_date', '_event_end_date' ], null ),
        'event_location'      => lamako_mobile_v2_meta_first( $event_id, [ 'event_location', '_event_location' ], null ),
    ];

    if ( ! $include_details ) {
        return $fields;
    }

    return array_merge( $fields, [
        'description'         => lamako_mobile_v2_meta_first( $event_id, [
            'lamako_mobile_description',
            '_lamako_mobile_description',
            'mobile_description',
            '_mobile_description',
        ], null ),
        'gallery'             => lamako_mobile_v2_public_gallery( $event_id, [
            'lamako_mobile_gallery',
            '_lamako_mobile_gallery',
            'mobile_gallery',
            '_mobile_gallery',
        ] ),
        'practical_info'      => lamako_mobile_v2_public_practical_info( $event_id ),
        'event_terms'         => lamako_mobile_v2_meta_first( $event_id, [ 'event_terms', '_event_terms' ], null ),
        'event_logo'          => lamako_mobile_v2_image_url_from_value( lamako_mobile_v2_meta_first( $event_id, [ 'event_logo', '_event_logo' ], '' ) ),
        'sponsors_logo'       => lamako_mobile_v2_image_url_from_value( lamako_mobile_v2_meta_first( $event_id, [ 'sponsors_logo', '_sponsors_logo' ], '' ) ),
    ] );
}

function lamako_mobile_v2_public_event_summary( WP_Post $event, array $ticket_map, $include_details = true ) {
    $event_id = $event->ID;
    $terms = wp_get_post_terms( $event_id, 'event_category', [ 'fields' => 'all' ] );
    $category_ids = [];
    $category_names = [];
    if ( ! is_wp_error( $terms ) ) {
        foreach ( $terms as $term ) {
            $category_ids[] = (int) $term->term_id;
            $category_names[] = html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' );
        }
    }

    $tickets = $ticket_map[ $event_id ] ?? [];
    $prices = [];
    foreach ( $tickets as $ticket ) {
        $price = isset( $ticket['price'] ) ? (float) $ticket['price'] : 0;
        if ( $price > 0 ) {
            $prices[] = $price;
        }
    }

    $thumb_id = get_post_thumbnail_id( $event_id );
    $featured = $thumb_id
        ? wp_get_attachment_image_url( $thumb_id, $include_details ? 'large' : 'medium_large' )
        : '';

    return [
        'id'              => $event_id,
        'date'            => get_post_time( 'c', true, $event ),
        'slug'            => $event->post_name,
        'status'          => $event->post_status,
        'title'           => [ 'rendered' => html_entity_decode( get_the_title( $event ), ENT_QUOTES, 'UTF-8' ) ],
        'content'         => [ 'rendered' => $include_details ? apply_filters( 'the_content', $event->post_content ) : '' ],
        'featured_media'  => (int) $thumb_id,
        'event_category'  => $category_ids,
        'link'            => get_permalink( $event_id ),
        'featuredImage'   => $featured ?: null,
        'categoryNames'   => $category_names,
        'mobileFields'    => lamako_mobile_v2_public_event_mobile_fields( $event_id, $include_details ),
        'lamako_rewards_enabled' => lamako_mobile_v2_rewards_redeem_enabled( $event_id ),
        'rewardsRedeemEnabled' => lamako_mobile_v2_rewards_redeem_enabled( $event_id ),
        'tickets'         => $tickets,
        'minPrice'        => ! empty( $prices ) ? min( $prices ) : null,
        'maxPrice'        => ! empty( $prices ) ? max( $prices ) : null,
        'hasSeatingChart' => ! empty( array_filter( $tickets, function( $ticket ) {
            return ! empty( $ticket['usesSeating'] );
        } ) ) || lamako_mobile_v2_find_chart_for_event( $event_id ) > 0,
    ];
}

function lamako_mobile_v2_public_events( $limit = 50, $include_details = true ) {
    $events = get_posts( [
        'post_type'      => 'tc_events',
        'post_status'    => 'publish',
        'posts_per_page' => min( max( absint( $limit ), 1 ), 100 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
    ] );

    $event_ids  = wp_list_pluck( $events, 'ID' );
    $ticket_map = lamako_mobile_v2_public_ticket_map( $event_ids, $include_details );
    return array_map( function( $event ) use ( $ticket_map, $include_details ) {
        return lamako_mobile_v2_public_event_summary( $event, $ticket_map, $include_details );
    }, $events );
}

function lamako_mobile_v2_public_home_data( WP_REST_Request $request ) {
    $include_details = ! rest_sanitize_boolean( $request->get_param( 'summary' ) );
    $events_limit    = min( max( absint( $request->get_param( 'events_limit' ) ?: 50 ), 1 ), 100 );
    $products_limit  = min( max( absint( $request->get_param( 'products_limit' ) ?: 12 ), 1 ), 100 );
    $cache_key       = lamako_mobile_v2_catalog_cache_key( 'home', [
        'include_details' => $include_details,
        'events_limit'    => $events_limit,
        'products_limit'  => $products_limit,
    ] );
    $cached = lamako_mobile_v2_catalog_cached_response( $cache_key );
    if ( $cached ) {
        return $cached;
    }

    return lamako_mobile_v2_catalog_fresh_response( $cache_key, [
        'events'     => lamako_mobile_v2_public_events( $events_limit, $include_details ),
        'products'   => lamako_mobile_v2_public_shop_products( $products_limit ),
        'categories' => lamako_mobile_v2_public_event_categories(),
    ] );
}

function lamako_mobile_v2_public_events_data( WP_REST_Request $request ) {
    $include_details = ! rest_sanitize_boolean( $request->get_param( 'summary' ) );
    $limit           = min( max( absint( $request->get_param( 'limit' ) ?: 50 ), 1 ), 100 );
    $cache_key       = lamako_mobile_v2_catalog_cache_key( 'events', [
        'include_details' => $include_details,
        'limit'           => $limit,
    ] );
    $cached = lamako_mobile_v2_catalog_cached_response( $cache_key );
    if ( $cached ) {
        return $cached;
    }

    return lamako_mobile_v2_catalog_fresh_response( $cache_key, [
        'events'     => lamako_mobile_v2_public_events( $limit, $include_details ),
        'categories' => lamako_mobile_v2_public_event_categories(),
    ] );
}

function lamako_mobile_v2_public_event( WP_REST_Request $request ) {
    $event_id = absint( $request['event_id'] );
    $event    = get_post( $event_id );
    if ( ! $event || $event->post_type !== 'tc_events' || $event->post_status !== 'publish' ) {
        return new WP_Error( 'lamako_v2_event_not_found', 'Event not found.', [ 'status' => 404 ] );
    }

    $ticket_map = lamako_mobile_v2_public_ticket_map( $event_id, true );
    return rest_ensure_response( lamako_mobile_v2_public_event_summary( $event, $ticket_map, true ) );
}

function lamako_mobile_v2_standard_owner_field_names() {
    return [ 'ticket_type_id', 'first_name', 'last_name', 'owner_email', 'owner_confirm_email' ];
}

function lamako_mobile_v2_standard_buyer_field_names() {
    return [ 'first_name', 'last_name', 'email', 'confirm_email' ];
}

function lamako_mobile_v2_field_values( $field ) {
    if ( ! isset( $field['field_values'] ) ) {
        return [];
    }

    $values = $field['field_values'];
    if ( ! is_array( $values ) ) {
        $values = explode( ',', (string) $values );
    }

    $options = [];
    foreach ( $values as $value ) {
        if ( is_array( $value ) ) {
            $option_value = isset( $value['value'] ) ? (string) $value['value'] : (string) ( $value['label'] ?? '' );
            $option_label = isset( $value['label'] ) ? (string) $value['label'] : $option_value;
        } else {
            $option_value = trim( (string) $value );
            $option_label = $option_value;
        }
        if ( $option_value === '' ) {
            continue;
        }
        $options[] = [
            'label' => html_entity_decode( $option_label, ENT_QUOTES, 'UTF-8' ),
            'value' => $option_value,
        ];
    }

    return $options;
}

function lamako_mobile_v2_normalize_checkout_field_schema( $field, $scope = 'attendee', array $standard_names = [] ) {
    if ( ! is_array( $field ) ) {
        return null;
    }

    $field_name = sanitize_key( $field['field_name'] ?? '' );
    $field_type = sanitize_key( $field['field_type'] ?? 'text' );
    if ( $field_name === '' || in_array( $field_type, [ 'function', 'label', 'script', 'hidden', 'error' ], true ) ) {
        return null;
    }

    $supported = [ 'text', 'number', 'email', 'date', 'textarea', 'select', 'radio', 'checkbox' ];
    if ( ! in_array( $field_type, $supported, true ) ) {
        $field_type = 'text';
    }

    $post_field_type = sanitize_key( $field['post_field_type'] ?? ( ! empty( $field['post_meta'] ) || ! isset( $field['post_meta'] ) ? 'post_meta' : '' ) );
    $storage_key     = $field_name . ( $post_field_type ? '_' . $post_field_type : '' );
    $visible         = ! array_key_exists( 'form_visibility', $field ) || filter_var( $field['form_visibility'], FILTER_VALIDATE_BOOLEAN );

    return [
        'key'          => $field_name,
        'storageKey'   => $storage_key,
        'label'        => html_entity_decode( (string) ( $field['field_title'] ?? $field_name ), ENT_QUOTES, 'UTF-8' ),
        'type'         => $field_type,
        'scope'        => $scope,
        'required'     => ! empty( $field['required'] ),
        'visible'      => $visible,
        'custom'       => ! in_array( $field_name, $standard_names, true ),
        'placeholder'  => html_entity_decode( (string) ( $field['field_placeholder'] ?? '' ), ENT_QUOTES, 'UTF-8' ),
        'description'  => html_entity_decode( (string) ( $field['field_description'] ?? '' ), ENT_QUOTES, 'UTF-8' ),
        'defaultValue' => isset( $field['field_default_value'] ) ? (string) $field['field_default_value'] : ( isset( $field['default_value'] ) ? (string) $field['default_value'] : '' ),
        'validation'   => sanitize_key( $field['validation_type'] ?? '' ),
        'min'          => isset( $field['field_min'] ) ? (string) $field['field_min'] : '',
        'max'          => isset( $field['field_max'] ) ? (string) $field['field_max'] : '',
        'step'         => isset( $field['field_step'] ) ? (string) $field['field_step'] : '',
        'options'      => lamako_mobile_v2_field_values( $field ),
    ];
}

function lamako_mobile_v2_cart_form_class() {
    if ( class_exists( '\Tickera\TC_Cart_Form' ) ) {
        return '\Tickera\TC_Cart_Form';
    }
    if ( class_exists( 'TC_Cart_Form' ) ) {
        return 'TC_Cart_Form';
    }
    return '';
}

function lamako_mobile_v2_ticket_owner_fields_schema( $ticket_type_id ) {
    $class_name = lamako_mobile_v2_cart_form_class();
    if ( $class_name === '' ) {
        return [];
    }

    $form     = new $class_name( $ticket_type_id );
    $fields   = $form->get_owner_info_fields( $ticket_type_id );
    $standard = lamako_mobile_v2_standard_owner_field_names();
    $schema   = [];

    foreach ( (array) $fields as $field ) {
        $normalized = lamako_mobile_v2_normalize_checkout_field_schema( $field, 'attendee', $standard );
        if ( $normalized && ! empty( $normalized['visible'] ) ) {
            $schema[] = $normalized;
        }
    }

    return $schema;
}

function lamako_mobile_v2_buyer_fields_schema() {
    $class_name = lamako_mobile_v2_cart_form_class();
    if ( $class_name === '' ) {
        return [];
    }

    $form     = new $class_name();
    $fields   = $form->get_buyer_info_fields();
    $standard = lamako_mobile_v2_standard_buyer_field_names();
    $schema   = [];

    foreach ( (array) $fields as $field ) {
        $normalized = lamako_mobile_v2_normalize_checkout_field_schema( $field, 'buyer', $standard );
        if ( $normalized && ! empty( $normalized['visible'] ) && ! empty( $normalized['custom'] ) ) {
            $schema[] = $normalized;
        }
    }

    return $schema;
}

function lamako_mobile_v2_ticket_has_custom_checkout_fields( $ticket_type_id ) {
    $ticket_type_id = absint( $ticket_type_id );
    if ( $ticket_type_id <= 0 ) {
        return false;
    }

    if ( get_post_type( $ticket_type_id ) === 'product_variation' ) {
        $template_id = get_post_meta( wp_get_post_parent_id( $ticket_type_id ), '_owner_form_template', true );
    } else {
        $template_id = get_post_meta( $ticket_type_id, '_owner_form_template', true );
    }
    if ( ! empty( $template_id ) && (int) $template_id > 0 ) {
        return true;
    }

    foreach ( lamako_mobile_v2_ticket_owner_fields_schema( $ticket_type_id ) as $field ) {
        if ( ! empty( $field['custom'] ) ) {
            return true;
        }
    }

    return false;
}

function lamako_mobile_v2_checkout_fields_for_ticket( $ticket_type_id, $event_id = 0, $quantity = 1 ) {
    $ticket_type_id   = absint( $ticket_type_id );
    $product          = function_exists( 'wc_get_product' ) ? wc_get_product( $ticket_type_id ) : null;
    $has_custom_fields = lamako_mobile_v2_ticket_has_custom_checkout_fields( $ticket_type_id );
    $owner_fields     = $has_custom_fields ? lamako_mobile_v2_ticket_owner_fields_schema( $ticket_type_id ) : [];

    return [
        'productId'      => $ticket_type_id,
        'eventId'        => absint( $event_id ),
        'name'           => $product ? html_entity_decode( $product->get_name(), ENT_QUOTES, 'UTF-8' ) : html_entity_decode( get_the_title( $ticket_type_id ), ENT_QUOTES, 'UTF-8' ),
        'quantity'       => max( 1, absint( $quantity ) ),
        'requiresFields' => ! empty( array_filter( $owner_fields, function( $field ) {
            return ! empty( $field['required'] );
        } ) ),
        'hasFields'      => ! empty( $owner_fields ),
        'ownerFields'    => $owner_fields,
    ];
}

function lamako_mobile_v2_public_event_checkout_fields( WP_REST_Request $request ) {
    $event_id = absint( $request['event_id'] );
    $event    = get_post( $event_id );
    if ( ! $event || $event->post_type !== 'tc_events' || $event->post_status !== 'publish' ) {
        return new WP_Error( 'lamako_v2_event_not_found', 'Event not found.', [ 'status' => 404 ] );
    }

    $ticket_map = lamako_mobile_v2_public_ticket_map( $event_id, false );
    $tickets    = [];
    foreach ( $ticket_map[ $event_id ] ?? [] as $ticket ) {
        $tickets[] = lamako_mobile_v2_checkout_fields_for_ticket( (int) $ticket['id'], $event_id, 1 );
    }

    $buyer_fields = lamako_mobile_v2_buyer_fields_schema();

    return rest_ensure_response( [
        'eventId'        => $event_id,
        'hasFields'      => ! empty( array_filter( $tickets, function( $ticket ) {
            return ! empty( $ticket['hasFields'] );
        } ) ) || ! empty( $buyer_fields ),
        'requiresFields' => ! empty( array_filter( $tickets, function( $ticket ) {
            return ! empty( $ticket['requiresFields'] );
        } ) ) || ! empty( array_filter( $buyer_fields, function( $field ) {
            return ! empty( $field['required'] );
        } ) ),
        'buyerFields'    => $buyer_fields,
        'tickets'        => $tickets,
    ] );
}

function lamako_mobile_v2_get_checkout_fields_for_items( WP_REST_Request $request ) {
    $body  = $request->get_json_params();
    $body  = is_array( $body ) ? $body : [];
    $items = isset( $body['items'] ) && is_array( $body['items'] ) ? $body['items'] : [];

    if ( empty( $items ) ) {
        return new WP_Error( 'lamako_v2_items_required', 'Checkout items are required.', [ 'status' => 400 ] );
    }

    $response_items  = [];
    $has_ticket_items = false;
    foreach ( $items as $index => $item ) {
        $validated_item = lamako_mobile_v2_validate_checkout_item( $item, $index );
        if ( is_wp_error( $validated_item ) ) {
            return $validated_item;
        }

        if ( empty( $validated_item['is_ticket'] ) ) {
            $response_items[] = [
                'productId'      => (int) $validated_item['base_id'],
                'eventId'        => 0,
                'name'           => html_entity_decode( $validated_item['product']->get_name(), ENT_QUOTES, 'UTF-8' ),
                'quantity'       => (int) $validated_item['quantity'],
                'requiresFields' => false,
                'hasFields'      => false,
                'ownerFields'    => [],
            ];
            continue;
        }

        $has_ticket_items = true;
        $ticket_type_id   = $validated_item['variation_id'] > 0 ? $validated_item['variation_id'] : $validated_item['base_id'];
        $response_items[] = lamako_mobile_v2_checkout_fields_for_ticket( $ticket_type_id, (int) $validated_item['event_id'], (int) $validated_item['quantity'] );
    }

    $buyer_fields = $has_ticket_items ? lamako_mobile_v2_buyer_fields_schema() : [];

    return rest_ensure_response( [
        'buyerFields'    => $buyer_fields,
        'items'          => $response_items,
        'hasFields'      => ! empty( array_filter( $response_items, function( $item ) {
            return ! empty( $item['hasFields'] );
        } ) ) || ! empty( $buyer_fields ),
        'requiresFields' => ! empty( array_filter( $response_items, function( $item ) {
            return ! empty( $item['requiresFields'] );
        } ) ) || ! empty( array_filter( $buyer_fields, function( $field ) {
            return ! empty( $field['required'] );
        } ) ),
    ] );
}

function lamako_mobile_v2_public_shop_data( WP_REST_Request $request ) {
    $limit     = min( max( absint( $request->get_param( 'limit' ) ?: 100 ), 1 ), 100 );
    $cache_key = lamako_mobile_v2_catalog_cache_key( 'shop', [ 'limit' => $limit ] );
    $cached    = lamako_mobile_v2_catalog_cached_response( $cache_key );
    if ( $cached ) {
        return $cached;
    }

    return lamako_mobile_v2_catalog_fresh_response( $cache_key, [
        'products'   => lamako_mobile_v2_public_shop_products( $limit ),
        'categories' => lamako_mobile_v2_public_shop_categories(),
    ] );
}

function lamako_mobile_v2_public_product( WP_REST_Request $request ) {
    if ( ! function_exists( 'wc_get_product' ) ) {
        return new WP_Error( 'lamako_v2_woocommerce_missing', 'WooCommerce is not available.', [ 'status' => 500 ] );
    }

    $product_id = absint( $request['product_id'] );
    if ( $product_id <= 0 || lamako_mobile_v2_truthy_meta( $product_id, [ '_tc_is_ticket' ] ) || ! lamako_mobile_v2_is_boutique_product( $product_id ) ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found.', [ 'status' => 404 ] );
    }

    $product = wc_get_product( $product_id );
    if ( ! $product ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found.', [ 'status' => 404 ] );
    }

    $summary = lamako_mobile_v2_public_product_summary( $product, true );
    if ( ! $summary ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found.', [ 'status' => 404 ] );
    }

    return rest_ensure_response( $summary );
}

function lamako_mobile_v2_token() {
    if ( function_exists( 'random_bytes' ) ) {
        return rtrim( strtr( base64_encode( random_bytes( 32 ) ), '+/', '-_' ), '=' );
    }
    return wp_generate_password( 48, false, false );
}

function lamako_mobile_v2_token_hash( $token ) {
    return hash_hmac( 'sha256', (string) $token, wp_salt( 'auth' ) );
}

function lamako_mobile_v2_seating_transient_key( $token ) {
    return 'lamako_v2_seat_' . lamako_mobile_v2_token_hash( $token );
}

function lamako_mobile_v2_seating_option_key( $token ) {
    return 'lamako_v2_seat_db_' . lamako_mobile_v2_token_hash( $token );
}

function lamako_mobile_v2_cleanup_seating_flow_option( $option_key ) {
    $option_key = sanitize_key( $option_key );
    if ( strpos( $option_key, 'lamako_v2_seat_db_' ) !== 0 ) {
        return;
    }

    $flow = get_option( $option_key, false );
    if ( is_array( $flow ) ) {
        $order = lamako_mobile_v2_find_seating_order( $flow );
        if ( $order instanceof WC_Order && lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) {
            $delay = max( 5 * MINUTE_IN_SECONDS, lamako_mobile_v2_payment_verification_deadline( $order ) - time() + ( 5 * MINUTE_IN_SECONDS ) );
            wp_schedule_single_event( time() + $delay, 'lamako_mobile_v2_cleanup_seating_flow', [ $option_key ] );
            return;
        }
    }

    delete_option( $option_key );
}

function lamako_mobile_v2_delete_seating_flow( $token ) {
    if ( empty( $token ) ) {
        return;
    }

    $option_key = lamako_mobile_v2_seating_option_key( $token );
    delete_transient( lamako_mobile_v2_seating_transient_key( $token ) );
    delete_option( $option_key );
    wp_clear_scheduled_hook( 'lamako_mobile_v2_cleanup_seating_flow', [ $option_key ] );
}

function lamako_mobile_v2_seating_url( $token ) {
    return home_url( '/lamako-mobile/seat/' . rawurlencode( $token ) . '/' );
}

function lamako_mobile_v2_get_seating_flow( $token ) {
    if ( empty( $token ) ) {
        return false;
    }

    $transient_key = lamako_mobile_v2_seating_transient_key( $token );
    $flow          = get_transient( $transient_key );

    if ( ! is_array( $flow ) ) {
        $flow = get_option( lamako_mobile_v2_seating_option_key( $token ), false );
    }

    if ( ! is_array( $flow ) ) {
        return false;
    }

    $expires_at = (int) ( $flow['expires_at'] ?? 0 );
    if ( $expires_at > 0 && $expires_at < time() ) {
        $order = lamako_mobile_v2_find_seating_order( $flow );
        if ( ! $order instanceof WC_Order || ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) {
            lamako_mobile_v2_delete_seating_flow( $token );
            return false;
        }

        $remaining_ttl = max( 5 * MINUTE_IN_SECONDS, lamako_mobile_v2_payment_verification_deadline( $order ) - time() + ( 5 * MINUTE_IN_SECONDS ) );
        set_transient( $transient_key, $flow, $remaining_ttl );
        return $flow;
    }

    $remaining_ttl = $expires_at > 0
        ? max( MINUTE_IN_SECONDS, $expires_at - time() + ( 5 * MINUTE_IN_SECONDS ) )
        : LAMAKO_MOBILE_V2_SEATING_TTL + ( 5 * MINUTE_IN_SECONDS );
    set_transient( $transient_key, $flow, $remaining_ttl );

    return $flow;
}

function lamako_mobile_v2_save_seating_flow( $token, array $flow ) {
    $expires_at = (int) ( $flow['expires_at'] ?? 0 );
    $ttl        = $expires_at > 0
        ? max( MINUTE_IN_SECONDS, $expires_at - time() + ( 5 * MINUTE_IN_SECONDS ) )
        : LAMAKO_MOBILE_V2_SEATING_TTL + ( 5 * MINUTE_IN_SECONDS );
    $option_key = lamako_mobile_v2_seating_option_key( $token );

    set_transient( lamako_mobile_v2_seating_transient_key( $token ), $flow, $ttl );
    update_option( $option_key, $flow, false );

    wp_clear_scheduled_hook( 'lamako_mobile_v2_cleanup_seating_flow', [ $option_key ] );
    wp_schedule_single_event( time() + $ttl, 'lamako_mobile_v2_cleanup_seating_flow', [ $option_key ] );
}

function lamako_mobile_v2_extract_seating_token_from_request() {
    if ( ! empty( $_GET['lamako_seating_token'] ) ) {
        return sanitize_text_field( wp_unslash( $_GET['lamako_seating_token'] ) );
    }

    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    $path = $request_uri ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
    if ( ! $path ) {
        return '';
    }

    if ( preg_match( '#/lamako-mobile/seat/([A-Za-z0-9_-]+)#', $path, $matches ) ) {
        return sanitize_text_field( $matches[1] );
    }

    return '';
}

function lamako_mobile_v2_extract_path_token( $route ) {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
    $path        = $request_uri ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
    if ( ! $path ) {
        return '';
    }

    $route = trim( (string) $route, '/' );
    if ( $route === '' ) {
        return '';
    }

    if ( preg_match( '#/lamako-mobile/' . preg_quote( $route, '#' ) . '/([A-Za-z0-9_-]+)/?#', $path, $matches ) ) {
        return sanitize_text_field( $matches[1] );
    }

    return '';
}

function lamako_mobile_v2_checkout_url( $token ) {
    return home_url( '/lamako-mobile/checkout/' . rawurlencode( $token ) . '/' );
}

function lamako_mobile_v2_find_chart_for_event( $event_id ) {
    $event_id = absint( $event_id );
    if ( $event_id <= 0 ) {
        return 0;
    }

    $charts = get_posts( [
        'post_type'      => 'tc_seat_charts',
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_query'     => [
            [
                'key'     => 'event_name',
                'value'   => $event_id,
                'compare' => '=',
            ],
        ],
    ] );

    if ( ! empty( $charts ) ) {
        return (int) $charts[0];
    }

    $event = get_post( $event_id );
    if ( ! $event ) {
        return 0;
    }

    if ( preg_match( '/data-seating-map-id="(\d+)"/', $event->post_content, $matches ) ) {
        return (int) $matches[1];
    }

    $rendered = apply_filters( 'the_content', $event->post_content );
    if ( preg_match( '/data-seating-map-id="(\d+)"/', $rendered, $matches ) ) {
        return (int) $matches[1];
    }

    return 0;
}

function lamako_mobile_v2_find_order_by_token( $token ) {
    if ( empty( $token ) || ! function_exists( 'wc_get_order' ) ) {
        return false;
    }

    $hash     = lamako_mobile_v2_token_hash( $token );
    $order_id = get_transient( 'lamako_v2_checkout_' . $hash );
    if ( $order_id ) {
        $order = wc_get_order( (int) $order_id );
        if ( $order ) {
            return $order;
        }
    }

    $orders = wc_get_orders( [
        'limit'      => 1,
        'meta_key'   => '_lamako_v2_checkout_token_hash',
        'meta_value' => $hash,
        'orderby'    => 'date',
        'order'      => 'DESC',
    ] );

    return ! empty( $orders ) ? $orders[0] : false;
}

function lamako_mobile_v2_is_checkout_expired( WC_Order $order ) {
    $expires_at = $order->get_meta( '_lamako_v2_checkout_expires_at' );
    if ( ! $expires_at ) {
        return false;
    }

    return strtotime( (string) $expires_at ) < time();
}

function lamako_mobile_v2_is_order_owner( WC_Order $order, $user_id = 0 ) {
    $user_id = $user_id ? (int) $user_id : get_current_user_id();
    if ( $user_id <= 0 ) {
        return false;
    }

    if ( (int) $order->get_customer_id() === $user_id ) {
        return true;
    }

    $user = get_user_by( 'id', $user_id );
    if ( $user && $order->get_billing_email() && strcasecmp( $order->get_billing_email(), $user->user_email ) === 0 ) {
        return true;
    }

    return current_user_can( 'manage_woocommerce' );
}

function lamako_mobile_v2_get_billing_from_request( $billing, WP_User $user ) {
    $billing = is_array( $billing ) ? $billing : [];
    $first_name = $billing['first_name'] ?? get_user_meta( $user->ID, 'billing_first_name', true );
    $last_name  = $billing['last_name'] ?? get_user_meta( $user->ID, 'billing_last_name', true );
    $email      = $billing['email'] ?? get_user_meta( $user->ID, 'billing_email', true );
    $phone      = $billing['phone'] ?? get_user_meta( $user->ID, 'billing_phone', true );
    $address_1  = $billing['address_1'] ?? get_user_meta( $user->ID, 'billing_address_1', true );
    $city       = $billing['city'] ?? get_user_meta( $user->ID, 'billing_city', true );
    $country    = $billing['country'] ?? get_user_meta( $user->ID, 'billing_country', true );

    if ( ! $first_name ) {
        $first_name = get_user_meta( $user->ID, 'first_name', true );
    }
    if ( ! $last_name ) {
        $last_name = get_user_meta( $user->ID, 'last_name', true );
    }
    if ( ! $email ) {
        $email = $user->user_email;
    }
    if ( ! $country ) {
        $country = 'MG';
    }

    return [
        'first_name' => sanitize_text_field( $first_name ),
        'last_name'  => sanitize_text_field( $last_name ),
        'email'      => sanitize_email( $email ),
        'phone'      => sanitize_text_field( $phone ),
        'address_1'  => sanitize_text_field( $address_1 ),
        'city'       => sanitize_text_field( $city ),
        'country'    => sanitize_text_field( $country ),
    ];
}

function lamako_mobile_v2_set_order_address( WC_Order $order, array $billing, $shipping = [] ) {
    $order->set_billing_first_name( $billing['first_name'] );
    $order->set_billing_last_name( $billing['last_name'] );
    $order->set_billing_email( $billing['email'] );
    $order->set_billing_phone( $billing['phone'] );
    $order->set_billing_address_1( $billing['address_1'] );
    $order->set_billing_city( $billing['city'] );
    $order->set_billing_country( $billing['country'] );

    if ( is_array( $shipping ) && ! empty( $shipping ) ) {
        $order->set_shipping_first_name( sanitize_text_field( $shipping['first_name'] ?? $billing['first_name'] ) );
        $order->set_shipping_last_name( sanitize_text_field( $shipping['last_name'] ?? $billing['last_name'] ) );
        $order->set_shipping_address_1( sanitize_text_field( $shipping['address_1'] ?? $billing['address_1'] ) );
        $order->set_shipping_city( sanitize_text_field( $shipping['city'] ?? $billing['city'] ) );
        $order->set_shipping_country( sanitize_text_field( $shipping['country'] ?? $billing['country'] ) );
    }
}

function lamako_mobile_v2_product_base_id( WC_Product $product, $requested_product_id ) {
    $parent_id = $product->get_parent_id();
    return $parent_id ? (int) $parent_id : (int) $requested_product_id;
}

function lamako_mobile_v2_validate_checkout_item( $raw_item, $index ) {
    $product_id   = isset( $raw_item['product_id'] ) ? absint( $raw_item['product_id'] ) : 0;
    $variation_id = isset( $raw_item['variation_id'] ) ? absint( $raw_item['variation_id'] ) : 0;
    $quantity     = isset( $raw_item['quantity'] ) ? absint( $raw_item['quantity'] ) : 1;

    if ( $product_id <= 0 || $quantity <= 0 ) {
        return new WP_Error( 'lamako_v2_invalid_item', 'Invalid product or quantity at item ' . ( $index + 1 ) . '.', [ 'status' => 400 ] );
    }

    if ( $quantity > 20 ) {
        return new WP_Error( 'lamako_v2_quantity_too_high', 'Quantity is too high at item ' . ( $index + 1 ) . '.', [ 'status' => 400 ] );
    }

    $product = wc_get_product( $variation_id ?: $product_id );
    if ( ! $product ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found: ' . $product_id, [ 'status' => 404 ] );
    }

    $base_id       = lamako_mobile_v2_product_base_id( $product, $product_id );
    $is_ticket     = get_post_meta( $base_id, '_tc_is_ticket', true ) === 'yes';
    $uses_seating  = get_post_meta( $base_id, '_tc_used_for_seatings', true ) === 'yes';
    $event_id      = get_post_meta( $base_id, '_event_name', true );
    $product_post  = get_post( $base_id );

    if ( ! $product_post || $product_post->post_status !== 'publish' ) {
        return new WP_Error( 'lamako_v2_product_unavailable', 'Product is not published: ' . $base_id, [ 'status' => 400 ] );
    }

    if ( $uses_seating ) {
        return new WP_Error( 'lamako_v2_seating_required', 'Seating products must be purchased through the seating chart flow.', [ 'status' => 409 ] );
    }

    if ( $is_ticket ) {
        if ( empty( $event_id ) || ! get_post( (int) $event_id ) ) {
            return new WP_Error( 'lamako_v2_ticket_event_missing', 'Ticket product is not linked to a valid event.', [ 'status' => 400 ] );
        }

        if ( class_exists( '\Tickera\TC_Ticket' ) && method_exists( '\Tickera\TC_Ticket', 'is_sales_available' ) ) {
            $available = \Tickera\TC_Ticket::is_sales_available( $base_id );
            if ( ! $available ) {
                return new WP_Error( 'lamako_v2_ticket_sales_closed', 'Ticket sales are not available for this product.', [ 'status' => 409 ] );
            }
        }
    }

    if ( ! $product->is_in_stock() ) {
        return new WP_Error( 'lamako_v2_out_of_stock', 'Product is out of stock: ' . $base_id, [ 'status' => 409 ] );
    }

    if ( method_exists( $product, 'has_enough_stock' ) && ! $product->has_enough_stock( $quantity ) ) {
        return new WP_Error( 'lamako_v2_not_enough_stock', 'Not enough stock for product: ' . $base_id, [ 'status' => 409 ] );
    }

    return [
        'product'      => $product,
        'product_id'   => $product_id,
        'base_id'      => $base_id,
        'variation_id' => $variation_id,
        'quantity'     => $quantity,
        'is_ticket'    => $is_ticket,
        'event_id'     => $event_id ? (int) $event_id : 0,
    ];
}

function lamako_mobile_v2_temporarily_disable_legacy_product_overrides() {
    $removed = [
        'purchasable' => false,
        'stock'       => false,
    ];

    if ( function_exists( 'lamako_force_all_purchasable' ) ) {
        $removed['purchasable'] = remove_filter( 'woocommerce_is_purchasable', 'lamako_force_all_purchasable', 9999 );
    }
    if ( function_exists( 'lamako_force_all_in_stock' ) ) {
        $removed['stock'] = remove_filter( 'woocommerce_product_is_in_stock', 'lamako_force_all_in_stock', 9999 );
    }

    return $removed;
}

function lamako_mobile_v2_restore_legacy_product_overrides( array $removed ) {
    if ( ! empty( $removed['purchasable'] ) && function_exists( 'lamako_force_all_purchasable' ) ) {
        add_filter( 'woocommerce_is_purchasable', 'lamako_force_all_purchasable', 9999, 2 );
    }
    if ( ! empty( $removed['stock'] ) && function_exists( 'lamako_force_all_in_stock' ) ) {
        add_filter( 'woocommerce_product_is_in_stock', 'lamako_force_all_in_stock', 9999, 2 );
    }
}

function lamako_mobile_v2_create_checkout( WP_REST_Request $request ) {
    if ( ! function_exists( 'wc_create_order' ) ) {
        return new WP_Error( 'lamako_v2_wc_missing', 'WooCommerce is not available.', [ 'status' => 500 ] );
    }

    $body  = $request->get_json_params();
    $body  = is_array( $body ) ? $body : [];
    $items = isset( $body['items'] ) && is_array( $body['items'] ) ? $body['items'] : [];

    if ( empty( $items ) ) {
        return new WP_Error( 'lamako_v2_items_required', 'Checkout items are required.', [ 'status' => 400 ] );
    }

    $validated = [];
    foreach ( $items as $index => $item ) {
        $validated_item = lamako_mobile_v2_validate_checkout_item( $item, $index );
        if ( is_wp_error( $validated_item ) ) {
            return $validated_item;
        }
        $validated[] = $validated_item;
    }

    $user_id = get_current_user_id();
    $user    = get_user_by( 'id', $user_id );
    if ( ! $user ) {
        return new WP_Error( 'lamako_v2_user_missing', 'Current user not found.', [ 'status' => 401 ] );
    }

    $token      = lamako_mobile_v2_token();
    $token_hash = lamako_mobile_v2_token_hash( $token );
    $expires_at = time() + LAMAKO_MOBILE_V2_CHECKOUT_TTL;
    $billing    = lamako_mobile_v2_get_billing_from_request( $body['billing'] ?? [], $user );
    $shipping   = $body['shipping'] ?? [];
    $source     = sanitize_text_field( $body['source'] ?? 'native_cart' );
    $coupon     = sanitize_text_field( $body['couponCode'] ?? $body['coupon_code'] ?? '' );

    if ( lamako_mobile_v2_is_rewards_coupon_code( $coupon ) ) {
        foreach ( $validated as $item ) {
            if ( ! lamako_mobile_v2_checkout_item_rewards_redeem_enabled( $item ) ) {
                return new WP_Error(
                    'lamako_v2_rewards_not_participating',
                    'Rewards reductions are available only on participating events and offers.',
                    [ 'status' => 403 ]
                );
            }
        }
    }

    $removed_filters = lamako_mobile_v2_temporarily_disable_legacy_product_overrides();

    try {
        $order = wc_create_order( [
            'customer_id' => $user_id,
            'created_via' => 'lamako_mobile_v2',
        ] );

        if ( is_wp_error( $order ) ) {
            lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
            return new WP_Error( 'lamako_v2_order_create_failed', $order->get_error_message(), [ 'status' => 500 ] );
        }

        lamako_mobile_v2_set_order_address( $order, $billing, $shipping );

        foreach ( $validated as $item ) {
            $added = $order->add_product( $item['product'], $item['quantity'] );
            if ( is_wp_error( $added ) ) {
                $order->delete( true );
                lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
                return new WP_Error( 'lamako_v2_add_product_failed', $added->get_error_message(), [ 'status' => 409 ] );
            }
        }

        if ( $coupon !== '' ) {
            $coupon_result = $order->apply_coupon( $coupon );
            if ( is_wp_error( $coupon_result ) ) {
                $order->delete( true );
                lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
                return new WP_Error( 'lamako_v2_coupon_invalid', $coupon_result->get_error_message(), [ 'status' => 400 ] );
            }
        }

        $order->calculate_totals();
        $order->set_status( 'pending' );
        $order->set_created_via( 'lamako_mobile_v2' );
        $order->update_meta_data( '_lamako_mobile_order', 'yes' );
        $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
        $order->update_meta_data( '_lamako_checkout_source', $source );
        $order->update_meta_data( '_lamako_v2_checkout_token_hash', $token_hash );
        $order->update_meta_data( '_lamako_v2_checkout_expires_at', gmdate( 'c', $expires_at ) );
        $order->add_order_note( 'Lamako Mobile v2 checkout session created.' );
        $order->save();

        $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $order );
        if ( is_wp_error( $ticket_result ) ) {
            $order->delete( true );
            lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
            return new WP_Error( 'lamako_v2_ticket_create_failed', $ticket_result->get_error_message(), [ 'status' => 500 ] );
        }
    } catch ( Exception $e ) {
        lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
        return new WP_Error( 'lamako_v2_checkout_failed', $e->getMessage(), [ 'status' => 500 ] );
    }

    lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );

    set_transient( 'lamako_v2_checkout_' . $token_hash, $order->get_id(), LAMAKO_MOBILE_V2_CHECKOUT_TTL + ( 5 * MINUTE_IN_SECONDS ) );

    return rest_ensure_response( [
        'checkoutToken' => $token,
        'checkoutUrl'   => lamako_mobile_v2_checkout_url( $token ),
        'orderId'       => $order->get_id(),
        'expiresAt'     => gmdate( 'c', $expires_at ),
        'total'         => $order->get_total(),
        'currency'      => $order->get_currency(),
        'itemCount'     => $order->get_item_count(),
    ] );
}

function lamako_mobile_v2_create_seating_session( WP_REST_Request $request ) {
    $body     = $request->get_json_params();
    $body     = is_array( $body ) ? $body : [];
    $event_id = absint( $body['eventId'] ?? $body['event_id'] ?? 0 );

    if ( $event_id <= 0 ) {
        return new WP_Error( 'lamako_v2_event_required', 'Event ID is required.', [ 'status' => 400 ] );
    }

    $event = get_post( $event_id );
    if ( ! $event || $event->post_type !== 'tc_events' || $event->post_status !== 'publish' ) {
        return new WP_Error( 'lamako_v2_event_not_found', 'Event not found.', [ 'status' => 404 ] );
    }

    $chart_id = lamako_mobile_v2_find_chart_for_event( $event_id );
    if ( $chart_id <= 0 ) {
        return new WP_Error( 'lamako_v2_seating_chart_not_found', 'No seating chart is linked to this event.', [ 'status' => 404 ] );
    }

    $user_id    = get_current_user_id();
    $token      = lamako_mobile_v2_token();
    $token_hash = lamako_mobile_v2_token_hash( $token );
    $expires_at = time() + LAMAKO_MOBILE_V2_SEATING_TTL;
    $flow_id    = 'seat_' . substr( $token_hash, 0, 16 );

    $flow = [
        'flow_id'          => $flow_id,
        'token_hash'       => $token_hash,
        'user_id'          => $user_id,
        'event_id'         => $event_id,
        'chart_id'         => $chart_id,
        'created_at'       => time(),
        'expires_at'       => $expires_at,
        'cart_initialized' => false,
        'order_id'         => 0,
    ];

    lamako_mobile_v2_save_seating_flow( $token, $flow );

    return rest_ensure_response( [
        'flowId'    => $flow_id,
        'flowToken' => $token,
        'eventId'   => $event_id,
        'chartId'   => $chart_id,
        'seatUrl'   => lamako_mobile_v2_seating_url( $token ),
        'expiresAt' => gmdate( 'c', $expires_at ),
    ] );
}

function lamako_mobile_v2_find_seating_order( array $flow ) {
    if ( ! empty( $flow['order_id'] ) && function_exists( 'wc_get_order' ) ) {
        $order = wc_get_order( (int) $flow['order_id'] );
        if ( $order ) {
            return $order;
        }
    }

    if ( empty( $flow['token_hash'] ) || ! function_exists( 'wc_get_orders' ) ) {
        return false;
    }

    $orders = wc_get_orders( [
        'limit'      => 1,
        'meta_key'   => '_lamako_seating_flow_hash',
        'meta_value' => $flow['token_hash'],
        'orderby'    => 'date',
        'order'      => 'DESC',
    ] );

    return ! empty( $orders ) ? $orders[0] : false;
}

function lamako_mobile_v2_get_seating_session_status( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! $flow ) {
        return new WP_Error( 'lamako_v2_seating_session_not_found', 'Seating session not found.', [ 'status' => 404 ] );
    }

    if ( (int) $flow['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_woocommerce' ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating session.', [ 'status' => 403 ] );
    }

    $order = lamako_mobile_v2_find_seating_order( $flow );
    if ( $order && ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating order.', [ 'status' => 403 ] );
    }

    $status = 'active';
    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        $status = 'expired';
    }
    if ( $order ) {
        $status = lamako_mobile_v2_normalize_payment_status( $order );
    }

    return rest_ensure_response( [
        'flowId'        => $flow['flow_id'] ?? '',
        'eventId'       => (int) ( $flow['event_id'] ?? 0 ),
        'chartId'       => (int) ( $flow['chart_id'] ?? 0 ),
        'status'        => $status,
        'expiresAt'     => ! empty( $flow['expires_at'] ) ? gmdate( 'c', (int) $flow['expires_at'] ) : null,
        'seatUrl'       => lamako_mobile_v2_seating_url( $token ),
        'checkoutUrl'   => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' ),
        'order'         => $order ? lamako_mobile_v2_order_summary( $order, true ) : null,
        'ticketsReady'  => $order ? count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0 : false,
    ] );
}

function lamako_mobile_v2_allow_seating_flow_session( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! is_array( $flow ) ) {
        return new WP_Error( 'lamako_v2_seating_session_not_found', 'Seating session not found.', [ 'status' => 404 ] );
    }
    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        return new WP_Error( 'lamako_v2_seating_session_expired', 'Seating session expired.', [ 'status' => 410 ] );
    }

    $user_id = get_current_user_id();
    if ( $user_id > 0 && ( (int) $flow['user_id'] === $user_id || current_user_can( 'manage_woocommerce' ) ) ) {
        return true;
    }

    $cookie_token = ! empty( $_COOKIE['lamako_mobile_seat_flow'] )
        ? sanitize_text_field( wp_unslash( $_COOKIE['lamako_mobile_seat_flow'] ) )
        : '';
    if ( $cookie_token !== '' && hash_equals( $token, $cookie_token ) ) {
        return true;
    }

    return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating session.', [ 'status' => 403 ] );
}

function lamako_mobile_v2_create_seating_order( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! is_array( $flow ) ) {
        return new WP_Error( 'lamako_v2_seating_session_not_found', 'Seating session not found.', [ 'status' => 404 ] );
    }

    $existing = lamako_mobile_v2_find_seating_order( $flow );
    if ( $existing ) {
        return rest_ensure_response( [
            'flowToken' => $token,
            'order'     => lamako_mobile_v2_order_summary( $existing, true ),
        ] );
    }

    if ( function_exists( 'wc_load_cart' ) && ( ! function_exists( 'WC' ) || ! WC()->cart ) ) {
        wc_load_cart();
    }
    if ( ! function_exists( 'WC' ) || ! WC()->cart || WC()->cart->is_empty() ) {
        return new WP_Error( 'lamako_v2_seating_cart_empty', 'No confirmed seat is available in this session.', [ 'status' => 409 ] );
    }

    $event_id = (int) ( $flow['event_id'] ?? 0 );
    foreach ( WC()->cart->get_cart() as $cart_item ) {
        $product_id    = absint( $cart_item['product_id'] ?? 0 );
        $ticket_event  = absint( get_post_meta( $product_id, '_event_name', true ) );
        if ( $product_id <= 0 || ( $ticket_event > 0 && $ticket_event !== $event_id ) ) {
            return new WP_Error( 'lamako_v2_seating_cart_mismatch', 'The selected seats do not belong to this event.', [ 'status' => 409 ] );
        }
    }

    $seat_cookie = lamako_mobile_v2_get_seating_cart_cookie();
    if ( empty( $seat_cookie ) ) {
        return new WP_Error( 'lamako_v2_seating_metadata_missing', 'No confirmed seat metadata is available in this session.', [ 'status' => 409 ] );
    }

    $user = get_user_by( 'id', (int) ( $flow['user_id'] ?? 0 ) );
    if ( ! $user ) {
        return new WP_Error( 'lamako_v2_user_missing', 'Current user not found.', [ 'status' => 401 ] );
    }

    $checkout = WC()->checkout();
    $data     = [
        'billing_first_name' => get_user_meta( $user->ID, 'billing_first_name', true ) ?: get_user_meta( $user->ID, 'first_name', true ),
        'billing_last_name'  => get_user_meta( $user->ID, 'billing_last_name', true ) ?: get_user_meta( $user->ID, 'last_name', true ),
        'billing_email'      => $user->user_email,
        'billing_phone'      => get_user_meta( $user->ID, 'billing_phone', true ),
        'billing_country'    => get_user_meta( $user->ID, 'billing_country', true ) ?: 'MG',
        'payment_method'     => '',
    ];

    try {
        $order_id = $checkout->create_order( $data );
    } catch ( Throwable $error ) {
        return new WP_Error( 'lamako_v2_seating_order_failed', $error->getMessage(), [ 'status' => 500 ] );
    }
    if ( is_wp_error( $order_id ) ) {
        return new WP_Error( 'lamako_v2_seating_order_failed', $order_id->get_error_message(), [ 'status' => 500 ] );
    }

    $order = wc_get_order( $order_id );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_seating_order_failed', 'The seating order could not be loaded.', [ 'status' => 500 ] );
    }

    $order->set_customer_id( $user->ID );
    $order->set_created_via( 'lamako_mobile_seating_v2' );
    $order->set_status( 'pending' );
    $order->update_meta_data( '_lamako_mobile_order', 'yes' );
    $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
    $order->update_meta_data( '_lamako_checkout_source', 'seating' );
    $order->update_meta_data( '_lamako_seating_flow_hash', $flow['token_hash'] ?? lamako_mobile_v2_token_hash( $token ) );
    $order->update_meta_data( '_lamako_seating_event_id', $event_id );
    $order->update_meta_data( '_lamako_seating_chart_id', (int) ( $flow['chart_id'] ?? 0 ) );
    $order->add_order_note( 'Lamako Mobile native seating order created.' );
    $order->save();

    $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $order, $seat_cookie, $flow );
    if ( is_wp_error( $ticket_result ) ) {
        $order->add_order_note( 'Lamako Mobile ticket generation failed: ' . $ticket_result->get_error_message() );
        $order->update_status( 'failed' );
        $error_data = $ticket_result->get_error_data();
        $status     = is_array( $error_data ) && ! empty( $error_data['status'] ) ? absint( $error_data['status'] ) : 500;
        return new WP_Error( 'lamako_v2_ticket_create_failed', $ticket_result->get_error_message(), [ 'status' => $status ] );
    }

    $flow['order_id'] = $order->get_id();
    lamako_mobile_v2_save_seating_flow( $token, $flow );
    WC()->cart->empty_cart();

    return rest_ensure_response( [
        'flowToken' => $token,
        'order'     => lamako_mobile_v2_order_summary( $order, true ),
    ] );
}

function lamako_mobile_v2_payment_order( $token, $kind ) {
    if ( $kind === 'checkout' ) {
        return lamako_mobile_v2_find_order_by_token( $token );
    }
    if ( $kind === 'seating' ) {
        $flow = lamako_mobile_v2_get_seating_flow( $token );
        return is_array( $flow ) ? lamako_mobile_v2_find_seating_order( $flow ) : false;
    }
    return false;
}

function lamako_mobile_v2_payment_order_from_request( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $kind  = sanitize_key( $request->get_param( 'kind' ) ?: 'checkout' );
    if ( ! in_array( $kind, [ 'checkout', 'seating' ], true ) ) {
        return new WP_Error( 'lamako_v2_invalid_payment_kind', 'Payment kind must be checkout or seating.', [ 'status' => 400 ] );
    }

    $order = lamako_mobile_v2_payment_order( $token, $kind );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_payment_order_not_found', 'Payment order not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this payment.', [ 'status' => 403 ] );
    }

    return [ $token, $kind, $order ];
}

function lamako_mobile_v2_payment_gateway_definitions() {
    return apply_filters( 'lamako_mobile_v2_payment_gateway_definitions', [
        'mvola_paiement'  => [ 'flow' => 'async', 'requiresPhone' => true,  'description' => 'Confirmez la demande MVola sur votre téléphone.', 'icon' => 'mvola-payment/assets/mvola.png' ],
        'airtel_paiement' => [ 'flow' => 'async', 'requiresPhone' => true,  'description' => 'Confirmez la demande Airtel Money sur votre téléphone.', 'icon' => 'airtel-payment/assets/airtel.png' ],
        'papi_paiement'   => [ 'flow' => 'redirect', 'requiresPhone' => false, 'description' => 'Vous serez dirigé vers Orange Money pour autoriser le paiement.', 'icon' => 'orange/assets/papi.png' ],
        'cybersource'     => [ 'flow' => 'redirect', 'requiresPhone' => false, 'description' => 'Paiement sécurisé par carte bancaire.', 'icon' => 'cybersource-payment-gateway/gateway/assets/images/cybersource.png' ],
    ] );
}

function lamako_mobile_v2_payment_gateway_icon_url( $gateway, $fallback_path = '' ) {
    $icon_url = isset( $gateway->icon ) && is_string( $gateway->icon )
        ? trim( $gateway->icon )
        : '';
    $home_host = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );

    if ( $icon_url === '' && method_exists( $gateway, 'get_icon' ) ) {
        $icon_html = (string) $gateway->get_icon();
        if ( class_exists( 'WP_HTML_Tag_Processor' ) ) {
            $processor = new WP_HTML_Tag_Processor( $icon_html );
            if ( $processor->next_tag( 'IMG' ) ) {
                $icon_url = (string) $processor->get_attribute( 'src' );
            }
        }
    }

    if ( strpos( $icon_url, '//' ) === 0 ) {
        $icon_url = 'https:' . $icon_url;
    } elseif ( strpos( $icon_url, '/' ) === 0 ) {
        $icon_url = home_url( $icon_url );
    }

    $icon_host = strtolower( (string) wp_parse_url( $icon_url, PHP_URL_HOST ) );
    if ( $icon_url !== '' && ( $icon_host === '' || $icon_host !== $home_host ) ) {
        $icon_url = '';
    }

    $fallback_path = ltrim( (string) $fallback_path, '/' );
    if ( $icon_url === '' && $fallback_path !== '' && is_readable( WP_PLUGIN_DIR . '/' . $fallback_path ) ) {
        $icon_url = plugins_url( $fallback_path );
    }

    if ( strpos( $icon_url, '//' ) === 0 ) {
        $icon_url = 'https:' . $icon_url;
    } elseif ( strpos( $icon_url, '/' ) === 0 ) {
        $icon_url = home_url( $icon_url );
    }

    $icon_host = strtolower( (string) wp_parse_url( $icon_url, PHP_URL_HOST ) );
    if ( $icon_host !== '' && $icon_host === $home_host ) {
        $icon_url = set_url_scheme( $icon_url, 'https' );
    }

    $icon_url = esc_url_raw( $icon_url, [ 'https' ] );
    return $icon_url !== '' && wp_http_validate_url( $icon_url ) ? $icon_url : '';
}

function lamako_mobile_v2_enabled_payment_gateways() {
    if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
        return [];
    }
    $definitions = lamako_mobile_v2_payment_gateway_definitions();
    $gateways    = WC()->payment_gateways()->payment_gateways();
    $enabled     = [];
    foreach ( $definitions as $gateway_id => $definition ) {
        if ( empty( $gateways[ $gateway_id ] ) || $gateways[ $gateway_id ]->enabled !== 'yes' ) {
            continue;
        }
        $gateway  = $gateways[ $gateway_id ];
        $icon_url = lamako_mobile_v2_payment_gateway_icon_url( $gateway, $definition['icon'] ?? '' );
        $enabled[] = [
            'id'            => $gateway_id,
            'title'         => wp_strip_all_tags( $gateway->get_title() ),
            'description'   => $definition['description'],
            'flow'          => $definition['flow'],
            'requiresPhone' => (bool) $definition['requiresPhone'],
            'iconUrl'       => $icon_url,
        ];
    }
    return $enabled;
}

function lamako_mobile_v2_get_payment_methods( WP_REST_Request $request ) {
    $context = lamako_mobile_v2_payment_order_from_request( $request );
    if ( is_wp_error( $context ) ) {
        return $context;
    }
    list( $token, $kind, $order ) = $context;

    return rest_ensure_response( [
        'kind'       => $kind,
        'token'      => $token,
        'methods'    => (float) $order->get_total() > 0 ? lamako_mobile_v2_enabled_payment_gateways() : [],
        'order'      => lamako_mobile_v2_order_summary( $order, true ),
        'zeroTotal'  => (float) $order->get_total() <= 0,
        'pollAfterMs'=> 2500,
    ] );
}

function lamako_mobile_v2_update_payment_coupon( WP_REST_Request $request ) {
    $context = lamako_mobile_v2_payment_order_from_request( $request );
    if ( is_wp_error( $context ) ) {
        return $context;
    }
    list( $token, $kind, $order ) = $context;
    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return new WP_Error( 'lamako_v2_order_already_paid', 'This order is already paid.', [ 'status' => 409 ] );
    }

    $body   = $request->get_json_params();
    $body   = is_array( $body ) ? $body : [];
    $action = sanitize_key( $body['action'] ?? 'apply' );
    $code   = wc_format_coupon_code( $body['code'] ?? '' );

    if ( $action === 'remove' ) {
        if ( $code !== '' ) {
            $order->remove_coupon( $code );
        } else {
            foreach ( $order->get_coupon_codes() as $coupon_code ) {
                $order->remove_coupon( $coupon_code );
            }
        }
    } else {
        if ( $code === '' ) {
            return new WP_Error( 'lamako_v2_coupon_required', 'Coupon code is required.', [ 'status' => 422 ] );
        }
        if ( lamako_mobile_v2_is_rewards_coupon_code( $code ) && ! in_array( $code, $order->get_coupon_codes(), true ) ) {
            return new WP_Error( 'lamako_v2_rewards_coupon_flow_required', 'Use the LamakoRewards redemption flow for this coupon.', [ 'status' => 403 ] );
        }
        $result = $order->apply_coupon( $code );
        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'lamako_v2_coupon_invalid', $result->get_error_message(), [ 'status' => 422 ] );
        }
    }

    $order->calculate_totals();
    $order->save();
    return rest_ensure_response( [
        'kind'  => $kind,
        'token' => $token,
        'order' => lamako_mobile_v2_order_summary( $order, true ),
    ] );
}

function lamako_mobile_v2_gateway_response( WC_Order $order, $gateway_id, $attempt_id, $result ) {
    $status       = lamako_mobile_v2_normalize_payment_status( $order );
    $redirect_url = is_array( $result ) ? esc_url_raw( $result['redirect'] ?? '' ) : '';
    $result_code  = is_array( $result ) ? sanitize_key( $result['result'] ?? '' ) : '';
    $flow         = 'failed';
    if ( $status === 'success' ) {
        $flow = 'success';
    } elseif ( $redirect_url !== '' && $result_code === 'success' ) {
        $flow = 'redirect';
    } elseif ( in_array( $status, [ 'pending', 'unknown' ], true ) && $result_code !== 'fail' && $result_code !== 'error' ) {
        $flow = 'pending';
    }

    return [
        'flow'          => $flow,
        'paymentStatus' => $status,
        'redirectUrl'   => $redirect_url,
        'orderId'       => $order->get_id(),
        'gatewayId'     => $gateway_id,
        'attemptId'     => $attempt_id,
        'pollAfterMs'   => 2500,
        'order'         => lamako_mobile_v2_order_summary( $order, true ),
    ];
}

function lamako_mobile_v2_cybersource_bridge_url( $token, $kind ) {
    return add_query_arg(
        [ 'kind' => in_array( $kind, [ 'checkout', 'seating' ], true ) ? $kind : 'checkout' ],
        home_url( '/lamako-mobile/cybersource/' . rawurlencode( $token ) . '/' )
    );
}

function lamako_mobile_v2_start_cybersource( WC_Order $order, $attempt_id, $token, $kind ) {
    $gateway = lamako_mobile_v2_provider_gateway( 'cybersource' );
    if ( is_wp_error( $gateway ) ) {
        return $gateway;
    }

    $redirect_url = lamako_mobile_v2_cybersource_bridge_url( $token, $kind );
    $response     = [
        'flow'          => 'redirect',
        'paymentStatus' => lamako_mobile_v2_normalize_payment_status( $order ),
        'redirectUrl'   => $redirect_url,
        'orderId'       => $order->get_id(),
        'gatewayId'     => 'cybersource',
        'attemptId'     => $attempt_id,
        'pollAfterMs'   => 2500,
        'order'         => lamako_mobile_v2_order_summary( $order, true ),
    ];

    $order->set_payment_method( $gateway );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'redirect' );
    $order->update_meta_data( '_lamako_v2_payment_result', wp_json_encode( $response ) );
    $order->delete_meta_data( '_lamako_v2_payment_error' );
    $order->save();

    return $response;
}

function lamako_mobile_v2_release_unconfirmed_cybersource_attempt( WC_Order $order ) {
    if ( 'cybersource' !== $order->get_payment_method() ) {
        return;
    }

    $attempt_status = sanitize_key( $order->get_meta( '_lamako_v2_payment_attempt_status' ) );
    $started_at     = absint( $order->get_meta( '_lamako_v2_payment_attempt_started_at' ) );
    $cached_result  = json_decode( (string) $order->get_meta( '_lamako_v2_payment_result' ), true );
    if (
        ! in_array( $attempt_status, [ 'queued', 'processing' ], true )
        || is_array( $cached_result )
        || $started_at <= 0
        || ( time() - $started_at ) < 30
    ) {
        return;
    }

    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
    $order->update_meta_data( '_lamako_v2_payment_error', 'CyberSource did not return a payment redirect.' );
    $order->save();
}

function lamako_mobile_v2_prevent_gateway_order_delete( $order_id ) {
    $protected_order_id = absint( $GLOBALS['lamako_mobile_v2_protected_order_id'] ?? 0 );
    if ( $protected_order_id > 0 && absint( $order_id ) === $protected_order_id ) {
        throw new RuntimeException( 'The mobile payment order must remain available for retry.' );
    }
}

function lamako_mobile_v2_invoke_gateway( WC_Order $order, $gateway_id, $attempt_id, $token = '', $kind = 'checkout' ) {
    $gateways = WC()->payment_gateways()->payment_gateways();
    if ( empty( $gateways[ $gateway_id ] ) || $gateways[ $gateway_id ]->enabled !== 'yes' ) {
        return new WP_Error( 'lamako_v2_gateway_unavailable', 'This payment method is unavailable.', [ 'status' => 409 ] );
    }

    $gateway = $gateways[ $gateway_id ];
    $order->set_payment_method( $gateway );
    $order->update_meta_data( '_lamako_v2_payment_attempt_id', $attempt_id );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'processing' );
    $order->update_meta_data( '_lamako_v2_payment_attempt_started_at', time() );
    $order->save();

    if ( function_exists( 'wc_clear_notices' ) ) {
        wc_clear_notices();
    }
    $output_level = ob_get_level();
    $GLOBALS['lamako_mobile_v2_protected_order_id'] = $order->get_id();
    $GLOBALS['lamako_mobile_v2_gateway_context'] = [
        'order_id'   => $order->get_id(),
        'gateway_id' => $gateway_id,
        'token'      => sanitize_text_field( $token ),
        'kind'       => in_array( $kind, [ 'checkout', 'seating' ], true ) ? $kind : 'checkout',
    ];
    add_action( 'woocommerce_before_delete_order', 'lamako_mobile_v2_prevent_gateway_order_delete', 1, 1 );
    ob_start();
    try {
        $result = $gateway->process_payment( $order->get_id() );
    } catch ( Throwable $error ) {
        $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
        $order->update_meta_data( '_lamako_v2_payment_error', sanitize_text_field( $error->getMessage() ) );
        $order->save();
        return new WP_Error( 'lamako_v2_payment_failed', 'The payment provider could not be started.', [ 'status' => 502 ] );
    } finally {
        while ( ob_get_level() > $output_level ) {
            ob_end_clean();
        }
        remove_action( 'woocommerce_before_delete_order', 'lamako_mobile_v2_prevent_gateway_order_delete', 1 );
        unset( $GLOBALS['lamako_mobile_v2_protected_order_id'] );
        unset( $GLOBALS['lamako_mobile_v2_gateway_context'] );
    }

    $fresh_order = wc_get_order( $order->get_id() );
    if ( ! $fresh_order ) {
        return new WP_Error( 'lamako_v2_payment_order_lost', 'The payment provider removed the order after an error.', [ 'status' => 502 ] );
    }
    $response = lamako_mobile_v2_gateway_response( $fresh_order, $gateway_id, $attempt_id, $result );
    $fresh_order->update_meta_data( '_lamako_v2_payment_attempt_status', $response['flow'] );
    $fresh_order->update_meta_data( '_lamako_v2_payment_result', wp_json_encode( $response ) );
    $fresh_order->save();
    return $response;
}

function lamako_mobile_v2_provider_gateway( $gateway_id ) {
    if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
        return new WP_Error( 'lamako_v2_gateway_unavailable', 'Payment services are unavailable.', [ 'status' => 503 ] );
    }

    $gateways = WC()->payment_gateways()->payment_gateways();
    if ( empty( $gateways[ $gateway_id ] ) || $gateways[ $gateway_id ]->enabled !== 'yes' ) {
        return new WP_Error( 'lamako_v2_gateway_unavailable', 'This payment method is unavailable.', [ 'status' => 409 ] );
    }

    return $gateways[ $gateway_id ];
}

function lamako_mobile_v2_orange_endpoint( $gateway, $property, $fallback ) {
    $url  = isset( $gateway->{$property} ) ? esc_url_raw( (string) $gateway->{$property} ) : '';
    $url  = $url !== '' ? $url : $fallback;
    $host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );

    if ( 'https' !== strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) ) || 'api.orange.com' !== $host ) {
        return new WP_Error(
            'lamako_v2_orange_config_invalid',
            'Orange Money is temporarily unavailable.',
            [ 'status' => 502 ]
        );
    }

    return $url;
}

function lamako_mobile_v2_orange_token( $gateway ) {
    $endpoint = lamako_mobile_v2_orange_endpoint(
        $gateway,
        'api_token_url',
        'https://api.orange.com/oauth/v3/token'
    );
    if ( is_wp_error( $endpoint ) ) {
        return $endpoint;
    }

    $consumer_key = isset( $gateway->consumer_key ) ? trim( (string) $gateway->consumer_key ) : '';
    if ( $consumer_key === '' ) {
        return new WP_Error(
            'lamako_v2_orange_config_invalid',
            'Orange Money is temporarily unavailable.',
            [ 'status' => 502 ]
        );
    }

    $response = wp_remote_post( $endpoint, [
        'headers' => [
            'Authorization' => 'Basic ' . $consumer_key,
            'Accept'        => 'application/json',
            'Content-Type'  => 'application/x-www-form-urlencoded',
        ],
        'body'    => [ 'grant_type' => 'client_credentials' ],
        'timeout' => 20,
    ] );
    $body = lamako_mobile_v2_json_response(
        $response,
        [ 200 ],
        'lamako_v2_orange_token_failed',
        'Orange Money is temporarily unavailable.'
    );

    if ( is_wp_error( $body ) || empty( $body['access_token'] ) ) {
        return is_wp_error( $body )
            ? $body
            : new WP_Error(
                'lamako_v2_orange_token_failed',
                'Orange Money is temporarily unavailable.',
                [ 'status' => 502 ]
            );
    }

    return sanitize_text_field( $body['access_token'] );
}

function lamako_mobile_v2_initiate_orange( WC_Order $order, $gateway, $attempt_id, $token, $kind ) {
    $access_token = lamako_mobile_v2_orange_token( $gateway );
    if ( is_wp_error( $access_token ) ) {
        return $access_token;
    }

    $endpoint = lamako_mobile_v2_orange_endpoint(
        $gateway,
        'api_payment_url',
        'https://api.orange.com/orange-money-webpay/mg/v1/webpayment'
    );
    if ( is_wp_error( $endpoint ) ) {
        return $endpoint;
    }

    $merchant_key = isset( $gateway->merchant_key ) ? trim( (string) $gateway->merchant_key ) : '';
    if ( $merchant_key === '' ) {
        return new WP_Error(
            'lamako_v2_orange_config_invalid',
            'Orange Money is temporarily unavailable.',
            [ 'status' => 502 ]
        );
    }

    $return_url = lamako_mobile_v2_payment_page_url( $token, $kind, 'payment-return' );
    $cancel_url = lamako_mobile_v2_payment_page_url( $token, $kind, 'payment-cancel', 'cancelled' );
    $notif_url  = rest_url( 'lamako-mobile/v2/payments/orange/callback' );

    $payload = [
        'merchant_key' => $merchant_key,
        'order_id'     => 'TBL' . $order->get_id() . gmdate( 'YmdHis' ),
        'amount'       => (int) round( (float) $order->get_total() ),
        'reference'    => 'Ticket_' . $order->get_id(),
        'return_url'   => $return_url,
        'cancel_url'   => $cancel_url,
        'notif_url'    => $notif_url,
        'lang'         => 'fr',
        'currency'     => 'MGA',
    ];
    $response = wp_remote_post( $endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_token,
            'Accept'        => 'application/json',
            'Content-Type'  => 'application/json',
        ],
        'body'    => wp_json_encode( $payload ),
        'timeout' => 25,
    ] );
    $body = lamako_mobile_v2_json_response(
        $response,
        [ 201 ],
        'lamako_v2_orange_start_failed',
        'Orange Money could not start the payment request.'
    );
    if ( is_wp_error( $body ) ) {
        return $body;
    }

    $redirect_url = esc_url_raw( $body['payment_url'] ?? '' );
    $pay_token    = sanitize_text_field( $body['pay_token'] ?? '' );
    $notif_token  = sanitize_text_field( $body['notif_token'] ?? '' );
    if (
        $redirect_url === ''
        || 'https' !== strtolower( (string) wp_parse_url( $redirect_url, PHP_URL_SCHEME ) )
        || $pay_token === ''
        || $notif_token === ''
    ) {
        return new WP_Error(
            'lamako_v2_orange_start_failed',
            'Orange Money could not start the payment request.',
            [ 'status' => 502 ]
        );
    }

    $order->update_meta_data( '_papi_pay_token', $pay_token );
    $order->update_meta_data( '_papi_notif_token', $notif_token );
    $order->update_meta_data( '_lamako_v2_provider_reference', $pay_token );
    $order->update_meta_data( '_lamako_v2_provider_correlation', $notif_token );
    $order->update_status( 'on-hold', 'Orange Money payment authorization started.' );
    $result = lamako_mobile_v2_gateway_response(
        $order,
        'papi_paiement',
        $attempt_id,
        [ 'result' => 'success', 'redirect' => $redirect_url ]
    );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'redirect' );
    $order->update_meta_data( '_lamako_v2_payment_result', wp_json_encode( $result ) );
    $order->save();

    return $result;
}

function lamako_mobile_v2_json_response( $response, array $success_codes, $error_code, $error_message ) {
    if ( is_wp_error( $response ) ) {
        return new WP_Error( $error_code, $error_message, [ 'status' => 502 ] );
    }

    $status = (int) wp_remote_retrieve_response_code( $response );
    $body   = json_decode( (string) wp_remote_retrieve_body( $response ), true );
    if ( ! in_array( $status, $success_codes, true ) || ! is_array( $body ) ) {
        return new WP_Error( $error_code, $error_message, [ 'status' => 502 ] );
    }

    return $body;
}

function lamako_mobile_v2_normalize_mg_phone( $phone, $local_prefix = true ) {
    $digits = preg_replace( '/\D+/', '', (string) $phone );
    if ( strpos( $digits, '261' ) === 0 ) {
        $digits = substr( $digits, 3 );
    } elseif ( strpos( $digits, '0' ) === 0 ) {
        $digits = substr( $digits, 1 );
    }
    $digits = strlen( $digits ) > 9 ? substr( $digits, -9 ) : $digits;
    if ( strlen( $digits ) !== 9 ) {
        return '';
    }
    return $local_prefix ? '0' . $digits : $digits;
}

function lamako_mobile_v2_schedule_provider_poll( WC_Order $order, $gateway_id, $attempt_id, $delay = 4 ) {
    $run_at  = time() + max( 2, absint( $delay ) );
    $planned = absint( $order->get_meta( '_lamako_v2_payment_next_poll_at' ) );
    if ( $planned > time() ) {
        return;
    }

    $order->update_meta_data( '_lamako_v2_payment_next_poll_at', $run_at );
    $order->save();
    $args = [ $order->get_id(), $gateway_id, $attempt_id ];
    if ( function_exists( 'as_schedule_single_action' ) ) {
        // A running Action Scheduler job cannot schedule its successor as a
        // unique action because the current job is considered a duplicate.
        as_schedule_single_action( $run_at, 'lamako_mobile_v2_poll_provider_payment', $args, 'lamako-mobile-payments', false );
    } else {
        wp_schedule_single_event( $run_at, 'lamako_mobile_v2_poll_provider_payment', $args );
    }
}

function lamako_mobile_v2_provider_poll_delay( WC_Order $order ) {
    $poll_count = absint( $order->get_meta( '_lamako_v2_payment_poll_count' ) );
    if ( $poll_count < 12 ) {
        return 5;
    }
    if ( $poll_count < 36 ) {
        return 15;
    }
    return 60;
}

function lamako_mobile_v2_pending_provider_response( WC_Order $order, $gateway_id, $attempt_id ) {
    $pending_until = time() + LAMAKO_MOBILE_V2_PAYMENT_VERIFY_TTL;
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'pending' );
    $order->update_meta_data( '_lamako_v2_payment_pending_until', $pending_until );
    $order->update_meta_data( '_lamako_v2_payment_last_checked_at', time() );
    $order->update_meta_data( '_lamako_v2_payment_poll_count', 0 );
    $order->update_meta_data( '_lamako_v2_payment_error', '' );
    $order->save();
    $response = [
        'flow'          => 'pending',
        'paymentStatus' => 'pending',
        'orderId'       => $order->get_id(),
        'gatewayId'     => $gateway_id,
        'attemptId'     => $attempt_id,
        'pollAfterMs'   => 3000,
        'order'         => lamako_mobile_v2_order_summary( $order, true ),
    ];
    $order->update_meta_data( '_lamako_v2_payment_result', wp_json_encode( $response ) );
    $order->save();
    return $response;
}

function lamako_mobile_v2_provider_failure( WC_Order $order, $message ) {
    $safe_message = sanitize_text_field( $message );
    $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
    $order->update_meta_data( '_lamako_v2_payment_error', $safe_message );
    if ( ! $order->has_status( [ 'failed', 'cancelled' ] ) ) {
        $order->update_status( 'failed', 'Lamako Mobile payment failed: ' . $safe_message );
    } else {
        $order->add_order_note( 'Lamako Mobile payment failed: ' . $safe_message );
        $order->save();
    }
}

function lamako_mobile_v2_cancel_unpaid_payment( WC_Order $order, $reason = 'Customer cancelled the payment.' ) {
    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return false;
    }

    $safe_reason = sanitize_text_field( $reason );
    $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
    $order->update_meta_data( '_lamako_v2_payment_pending_until', 0 );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'cancelled' );
    $order->update_meta_data( '_lamako_v2_payment_error', $safe_reason );

    if ( ! $order->has_status( 'cancelled' ) ) {
        $order->update_status( 'cancelled', 'Lamako Mobile: ' . $safe_reason );
    } else {
        $order->save();
    }

    return true;
}

function lamako_mobile_v2_payment_active_attempt_statuses() {
    return [ 'queued', 'processing', 'pending', 'redirect' ];
}

function lamako_mobile_v2_payment_review_attempt_statuses() {
    return [ 'verification_delayed', 'review' ];
}

function lamako_mobile_v2_order_has_protected_payment_attempt( $order ) {
    if ( ! $order instanceof WC_Order || lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return false;
    }

    $attempt_id = (string) $order->get_meta( '_lamako_v2_payment_attempt_id' );
    $status     = sanitize_key( $order->get_meta( '_lamako_v2_payment_attempt_status' ) );
    return $attempt_id !== '' && in_array(
        $status,
        array_merge( lamako_mobile_v2_payment_active_attempt_statuses(), lamako_mobile_v2_payment_review_attempt_statuses() ),
        true
    );
}

function lamako_mobile_v2_payment_verification_deadline( WC_Order $order ) {
    $deadline = absint( $order->get_meta( '_lamako_v2_payment_pending_until' ) );
    if ( $deadline > 0 ) {
        return $deadline;
    }

    $started_at = absint( $order->get_meta( '_lamako_v2_payment_attempt_started_at' ) );
    return ( $started_at > 0 ? $started_at : time() ) + LAMAKO_MOBILE_V2_PAYMENT_VERIFY_TTL;
}

function lamako_mobile_v2_mark_payment_for_review( WC_Order $order, $message ) {
    $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'verification_delayed' );
    $order->update_meta_data( '_lamako_v2_payment_error', sanitize_text_field( $message ) );
    if ( 'yes' !== $order->get_meta( '_lamako_v2_payment_review_noted' ) ) {
        $order->add_order_note( 'Lamako Mobile: provider verification delayed. Do not cancel or retry the debit before manual verification.' );
        $order->update_meta_data( '_lamako_v2_payment_review_noted', 'yes' );
    }
    $order->save();
}

function lamako_mobile_v2_mvola_token( $gateway ) {
    $response = wp_remote_post( 'https://api.mvola.mg/token', [
        'headers' => [
            'Content-Type'  => 'application/x-www-form-urlencoded',
            'Authorization' => 'Basic ' . (string) $gateway->consumer_key,
            'Accept'        => 'application/json',
        ],
        'body'    => [ 'grant_type' => 'client_credentials', 'scope' => 'EXT_INT_MVOLA_SCOPE' ],
        'timeout' => 20,
    ] );
    $body = lamako_mobile_v2_json_response( $response, [ 200 ], 'lamako_v2_mvola_token_failed', 'MVola is temporarily unavailable.' );
    if ( is_wp_error( $body ) || empty( $body['access_token'] ) ) {
        return is_wp_error( $body ) ? $body : new WP_Error( 'lamako_v2_mvola_token_failed', 'MVola is temporarily unavailable.', [ 'status' => 502 ] );
    }
    return sanitize_text_field( $body['access_token'] );
}

function lamako_mobile_v2_mvola_headers( $gateway, $token, $correlation_id ) {
    return [
        'Content-Type'          => 'application/json',
        'Authorization'         => 'Bearer ' . $token,
        'Accept'                => 'application/json',
        'Version'               => '1.0',
        'X-CorrelationID'       => $correlation_id,
        'UserAccountIdentifier' => 'msisdn;' . (string) $gateway->merchant_key,
        'UserLanguage'          => 'MG',
        'partnerName'           => 'TicketByLamako',
        'Accept-Charset'        => 'utf-8',
        'Cache-Control'         => 'no-cache',
    ];
}

function lamako_mobile_v2_initiate_mvola( WC_Order $order, $gateway, $attempt_id ) {
    // Match the production WooCommerce gateway payload during provider parity tests.
    $phone = trim( (string) $order->get_billing_phone() );
    if ( $phone === '' ) {
        return new WP_Error( 'lamako_v2_phone_invalid', 'Enter a valid Madagascar mobile number.', [ 'status' => 422 ] );
    }

    $token = lamako_mobile_v2_mvola_token( $gateway );
    if ( is_wp_error( $token ) ) {
        return $token;
    }
    $correlation_id = wp_generate_uuid4();
    $amount         = (string) (int) round( (float) $order->get_total() );
    $reference          = 'Lamako_' . $order->get_id();
    $original_reference = '_' . $order->get_id() . '_';
    $now                = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
    $milliseconds       = round( (int) $now->format( 'u' ) / 1000 );
    $request_date       = $now->format( 'Y-m-d\TH:i:s.' ) . $milliseconds . 'Z';
    $body = [
        'amount'                                      => $amount,
        'currency'                                    => 'Ar',
        'descriptionText'                             => 'Ticket ' . $order->get_id(),
        'requestDate'                                 => $request_date,
        'creditParty'                                 => [ [ 'key' => 'msisdn', 'value' => (string) $gateway->merchant_key ] ],
        'debitParty'                                  => [ [ 'key' => 'msisdn', 'value' => $phone ] ],
        'metadata'                                    => [
            [ 'key' => 'partnerName', 'value' => 'TicketByLamako' ],
            [ 'key' => 'amountFc', 'value' => $amount . 'Ar' ],
            [ 'key' => 'fc', 'value' => 'Ariary' ],
        ],
        'requestingOrganisationTransactionReference' => $reference,
        'originalTransactionReference'                => $original_reference,
    ];
    $response = wp_remote_post( 'https://api.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/', [
        'headers' => lamako_mobile_v2_mvola_headers( $gateway, $token, $correlation_id ),
        'body'    => wp_json_encode( $body ),
        'timeout' => 25,
    ] );
    $payload = lamako_mobile_v2_json_response( $response, [ 200, 202 ], 'lamako_v2_mvola_start_failed', 'MVola could not start the payment request.' );
    if ( is_wp_error( $payload ) || empty( $payload['serverCorrelationId'] ) ) {
        return is_wp_error( $payload ) ? $payload : new WP_Error( 'lamako_v2_mvola_start_failed', 'MVola could not start the payment request.', [ 'status' => 502 ] );
    }

    $order->update_meta_data( '_lamako_v2_provider_reference', sanitize_text_field( $payload['serverCorrelationId'] ) );
    $order->update_meta_data( '_lamako_v2_provider_correlation', $correlation_id );
    $order->update_meta_data( '_lamako_v2_provider_partner_reference', $reference );
    $order->update_meta_data( '_mvola_server_correlation_id', sanitize_text_field( $payload['serverCorrelationId'] ) );
    $order->save();
    lamako_mobile_v2_schedule_provider_poll( $order, 'mvola_paiement', $attempt_id );
    return lamako_mobile_v2_pending_provider_response( $order, 'mvola_paiement', $attempt_id );
}

function lamako_mobile_v2_airtel_token( $gateway ) {
    $api = untrailingslashit( (string) $gateway->api );
    if ( $api === '' ) {
        return new WP_Error( 'lamako_v2_airtel_config_invalid', 'Airtel Money is temporarily unavailable.', [ 'status' => 502 ] );
    }
    $response = wp_remote_post( $api . '/auth/oauth2/token', [
        'headers' => [ 'Content-Type' => 'application/json', 'Accept' => '*/*' ],
        'body'    => wp_json_encode( [
            'client_id'     => (string) $gateway->id_client,
            'client_secret' => (string) $gateway->secret_key,
            'grant_type'    => 'client_credentials',
        ] ),
        'timeout' => 20,
    ] );
    $body = lamako_mobile_v2_json_response( $response, [ 200 ], 'lamako_v2_airtel_token_failed', 'Airtel Money is temporarily unavailable.' );
    if ( is_wp_error( $body ) || empty( $body['access_token'] ) ) {
        return is_wp_error( $body ) ? $body : new WP_Error( 'lamako_v2_airtel_token_failed', 'Airtel Money is temporarily unavailable.', [ 'status' => 502 ] );
    }
    return sanitize_text_field( $body['access_token'] );
}

function lamako_mobile_v2_airtel_headers( $token ) {
    return [
        'Content-Type'  => 'application/json',
        'Authorization' => 'Bearer ' . $token,
        'Accept'        => 'application/json',
        'X-Country'     => 'MG',
        'X-Currency'    => 'MGA',
        'Cache-Control' => 'no-cache',
    ];
}

function lamako_mobile_v2_initiate_airtel( WC_Order $order, $gateway, $attempt_id ) {
    $phone = lamako_mobile_v2_normalize_mg_phone( $order->get_billing_phone(), false );
    if ( $phone === '' ) {
        return new WP_Error( 'lamako_v2_phone_invalid', 'Enter a valid Madagascar mobile number.', [ 'status' => 422 ] );
    }
    $token = lamako_mobile_v2_airtel_token( $gateway );
    if ( is_wp_error( $token ) ) {
        return $token;
    }
    $transaction_id = str_replace( '-', '', wp_generate_uuid4() );
    $payload = [
        'reference'  => 'TK_' . $order->get_id(),
        'subscriber' => [ 'country' => 'MG', 'currency' => 'MGA', 'msisdn' => $phone ],
        'transaction'=> [
            'amount'   => (float) $order->get_total(),
            'country'  => 'MG',
            'currency' => 'MGA',
            'id'       => $transaction_id,
        ],
    ];
    $response = wp_remote_post( untrailingslashit( (string) $gateway->api ) . '/merchant/v1/payments/', [
        'headers' => lamako_mobile_v2_airtel_headers( $token ),
        'body'    => wp_json_encode( $payload ),
        'timeout' => 25,
    ] );
    $body = lamako_mobile_v2_json_response( $response, [ 200 ], 'lamako_v2_airtel_start_failed', 'Airtel Money could not start the payment request.' );
    $provider_id = is_array( $body ) ? sanitize_text_field( $body['data']['transaction']['id'] ?? '' ) : '';
    $accepted    = is_array( $body ) && ! empty( $body['status']['success'] ) && $provider_id !== '';
    if ( is_wp_error( $body ) || ! $accepted ) {
        return is_wp_error( $body ) ? $body : new WP_Error( 'lamako_v2_airtel_start_failed', 'Airtel Money could not start the payment request.', [ 'status' => 502 ] );
    }

    $order->update_meta_data( '_lamako_v2_provider_reference', $provider_id );
    $order->update_meta_data( '_lamako_v2_provider_correlation', $transaction_id );
    $order->save();
    lamako_mobile_v2_schedule_provider_poll( $order, 'airtel_paiement', $attempt_id );
    return lamako_mobile_v2_pending_provider_response( $order, 'airtel_paiement', $attempt_id );
}

function lamako_mobile_v2_initiate_async_payment( WC_Order $order, $gateway_id, $attempt_id ) {
    $gateway = lamako_mobile_v2_provider_gateway( $gateway_id );
    if ( is_wp_error( $gateway ) ) {
        return $gateway;
    }

    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'processing' );
    $order->update_meta_data( '_lamako_v2_payment_attempt_started_at', time() );
    $order->save();
    if ( $gateway_id === 'mvola_paiement' ) {
        return lamako_mobile_v2_initiate_mvola( $order, $gateway, $attempt_id );
    }
    if ( $gateway_id === 'airtel_paiement' ) {
        return lamako_mobile_v2_initiate_airtel( $order, $gateway, $attempt_id );
    }
    return new WP_Error( 'lamako_v2_gateway_invalid', 'Unsupported mobile payment method.', [ 'status' => 422 ] );
}

function lamako_mobile_v2_poll_provider_payment( $order_id, $gateway_id, $attempt_id ) {
    global $wpdb;

    $lock_name = 'lamako_payment_' . absint( $order_id );
    $locked    = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock_name ) );
    if ( 1 !== $locked ) {
        return;
    }

    try {
        lamako_mobile_v2_poll_provider_payment_unlocked( $order_id, $gateway_id, $attempt_id );
    } finally {
        $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
    }
}

function lamako_mobile_v2_poll_provider_payment_unlocked( $order_id, $gateway_id, $attempt_id ) {
    $order = wc_get_order( absint( $order_id ) );
    if ( ! $order || lamako_mobile_v2_payment_is_confirmed( $order ) || (string) $order->get_meta( '_lamako_v2_payment_attempt_id' ) !== (string) $attempt_id ) {
        return;
    }

    $deadline = lamako_mobile_v2_payment_verification_deadline( $order );
    $delayed  = time() > $deadline;
    $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
    $order->update_meta_data( '_lamako_v2_payment_last_checked_at', time() );
    $order->update_meta_data( '_lamako_v2_payment_poll_count', absint( $order->get_meta( '_lamako_v2_payment_poll_count' ) ) + 1 );
    $order->save();

    $gateway = lamako_mobile_v2_provider_gateway( $gateway_id );
    if ( is_wp_error( $gateway ) ) {
        if ( $delayed ) {
            lamako_mobile_v2_mark_payment_for_review( $order, $gateway->get_error_message() );
        } else {
            lamako_mobile_v2_schedule_provider_poll( $order, $gateway_id, $attempt_id, lamako_mobile_v2_provider_poll_delay( $order ) );
        }
        return;
    }
    $reference     = sanitize_text_field( $order->get_meta( '_lamako_v2_provider_reference' ) );
    $correlation   = sanitize_text_field( $order->get_meta( '_lamako_v2_provider_correlation' ) );
    $status        = 'pending';
    $transaction_id = '';

    if ( $gateway_id === 'mvola_paiement' ) {
        $token = lamako_mobile_v2_mvola_token( $gateway );
        if ( is_wp_error( $token ) ) {
            if ( $delayed ) {
                lamako_mobile_v2_mark_payment_for_review( $order, 'MVola verification is temporarily unavailable.' );
            } else {
                lamako_mobile_v2_schedule_provider_poll( $order, $gateway_id, $attempt_id, lamako_mobile_v2_provider_poll_delay( $order ) );
            }
            return;
        }
        $response = wp_remote_get( 'https://api.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/status/' . rawurlencode( $reference ), [
            'headers' => lamako_mobile_v2_mvola_headers( $gateway, $token, $correlation ?: wp_generate_uuid4() ),
            'timeout' => 20,
        ] );
        $body = lamako_mobile_v2_json_response( $response, [ 200 ], 'lamako_v2_mvola_status_failed', 'MVola status is temporarily unavailable.' );
        if ( is_wp_error( $body ) ) {
            if ( $delayed ) {
                lamako_mobile_v2_mark_payment_for_review( $order, 'MVola verification is delayed.' );
            } else {
                lamako_mobile_v2_schedule_provider_poll( $order, $gateway_id, $attempt_id, lamako_mobile_v2_provider_poll_delay( $order ) );
            }
            return;
        }
        $returned_reference = sanitize_text_field( $body['serverCorrelationId'] ?? '' );
        if ( $returned_reference !== '' && ! hash_equals( $reference, $returned_reference ) ) {
            lamako_mobile_v2_mark_payment_for_review( $order, 'MVola returned an inconsistent payment reference.' );
            return;
        }
        $status         = sanitize_key( $body['status'] ?? 'pending' );
        $transaction_id = sanitize_text_field( $body['objectReference'] ?? $reference );
    } elseif ( $gateway_id === 'airtel_paiement' ) {
        $token = lamako_mobile_v2_airtel_token( $gateway );
        if ( is_wp_error( $token ) ) {
            if ( $delayed ) {
                lamako_mobile_v2_mark_payment_for_review( $order, 'Airtel Money verification is temporarily unavailable.' );
            } else {
                lamako_mobile_v2_schedule_provider_poll( $order, $gateway_id, $attempt_id, lamako_mobile_v2_provider_poll_delay( $order ) );
            }
            return;
        }
        $response = wp_remote_get( untrailingslashit( (string) $gateway->api ) . '/standard/v1/payments/' . rawurlencode( $reference ), [
            'headers' => lamako_mobile_v2_airtel_headers( $token ),
            'timeout' => 20,
        ] );
        $body = lamako_mobile_v2_json_response( $response, [ 200 ], 'lamako_v2_airtel_status_failed', 'Airtel Money status is temporarily unavailable.' );
        if ( is_wp_error( $body ) ) {
            if ( $delayed ) {
                lamako_mobile_v2_mark_payment_for_review( $order, 'Airtel Money verification is delayed.' );
            } else {
                lamako_mobile_v2_schedule_provider_poll( $order, $gateway_id, $attempt_id, lamako_mobile_v2_provider_poll_delay( $order ) );
            }
            return;
        }
        $status         = strtoupper( sanitize_text_field( $body['data']['transaction']['status'] ?? 'TIP' ) );
        $transaction_id = sanitize_text_field( $body['data']['transaction']['airtel_money_id'] ?? $reference );
    }

    $success = ( $gateway_id === 'mvola_paiement' && $status === 'completed' ) || ( $gateway_id === 'airtel_paiement' && $status === 'TS' );
    $cancelled = ( $gateway_id === 'mvola_paiement' && $status === 'cancelled' )
        || ( $gateway_id === 'airtel_paiement' && $status === 'CANCELLED' );
    $failed  = ( $gateway_id === 'mvola_paiement' && in_array( $status, [ 'failed', 'rejected' ], true ) )
        || ( $gateway_id === 'airtel_paiement' && in_array( $status, [ 'TF', 'FAILED', 'REJECTED' ], true ) );

    if ( $success ) {
        $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
        $order->payment_complete( $transaction_id );
        $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'success' );
        $order->add_order_note( ucfirst( str_replace( '_paiement', '', $gateway_id ) ) . ' payment confirmed by the provider.' );
        $order->save();
        $response = lamako_mobile_v2_gateway_response( $order, $gateway_id, $attempt_id, [ 'result' => 'success' ] );
        $order->update_meta_data( '_lamako_v2_payment_result', wp_json_encode( $response ) );
        $order->save();
        return;
    }
    if ( $cancelled ) {
        lamako_mobile_v2_cancel_unpaid_payment( $order, 'The operator reported that the customer cancelled the payment.' );
        return;
    }
    if ( $failed ) {
        $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
        $order->save();
        lamako_mobile_v2_provider_failure( $order, 'The operator declined or cancelled the payment.' );
        return;
    }

    if ( $delayed ) {
        lamako_mobile_v2_mark_payment_for_review( $order, 'The operator has not returned a final payment status yet.' );
        return;
    }

    lamako_mobile_v2_schedule_provider_poll( $order, $gateway_id, $attempt_id, lamako_mobile_v2_provider_poll_delay( $order ) );
}

function lamako_mobile_v2_find_order_by_provider_reference( $reference ) {
    $orders = wc_get_orders( [
        'limit'          => 2,
        'payment_method' => 'mvola_paiement',
        'meta_query'     => [
            [
                'key'     => '_lamako_v2_provider_reference',
                'value'   => sanitize_text_field( $reference ),
                'compare' => '=',
            ],
        ],
        'orderby'        => 'date',
        'order'          => 'DESC',
        'return'         => 'objects',
    ] );

    foreach ( $orders as $order ) {
        if ( $order instanceof WC_Order && 'mvola_paiement' === $order->get_payment_method() ) {
            return $order;
        }
    }
    return false;
}

function lamako_mobile_v2_mvola_callback( WP_REST_Request $request ) {
    $body      = $request->get_json_params();
    $body      = is_array( $body ) ? $body : [];
    $reference = sanitize_text_field( $body['serverCorrelationId'] ?? '' );
    $hint      = sanitize_key( $body['transactionStatus'] ?? '' );
    $order     = lamako_mobile_v2_find_order_by_provider_reference( $reference );

    if ( $order instanceof WC_Order && ! lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        $throttle = 'lamako_mvola_callback_' . hash( 'sha256', $reference );
        if ( get_transient( $throttle ) ) {
            return new WP_REST_Response( [ 'received' => true ], 202 );
        }
        set_transient( $throttle, 1, 5 );

        $attempt_id = sanitize_text_field( $order->get_meta( '_lamako_v2_payment_attempt_id' ) );
        if ( $attempt_id !== '' ) {
            $order->update_meta_data( '_lamako_v2_mvola_callback_received_at', time() );
            $order->update_meta_data( '_lamako_v2_mvola_callback_hint', $hint );
            $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
            $order->save();

            // The callback is only a wake-up signal. The authenticated MVola
            // status API remains the source of truth before payment_complete().
            $args = [ $order->get_id(), 'mvola_paiement', $attempt_id ];
            if ( function_exists( 'as_enqueue_async_action' ) ) {
                as_enqueue_async_action( 'lamako_mobile_v2_poll_provider_payment', $args, 'lamako-mobile-payments', false );
            } else {
                wp_schedule_single_event( time() + 1, 'lamako_mobile_v2_poll_provider_payment', $args );
            }
        }
    }

    return new WP_REST_Response( [ 'received' => true ], 202 );
}

function lamako_mobile_v2_allow_orange_callback( WP_REST_Request $request ) {
    $body        = $request->get_json_params();
    $body        = is_array( $body ) ? $body : [];
    $notif_token = sanitize_text_field( $body['notif_token'] ?? '' );
    $status      = strtoupper( sanitize_text_field( $body['status'] ?? '' ) );

    if ( strlen( $notif_token ) < 16 || ! in_array( $status, [ 'SUCCESS', 'COMPLETED', 'TS', 'FAILED', 'CANCELLED', 'INSUFFICIENT_BALANCE', 'PENDING', 'TIP' ], true ) ) {
        return new WP_Error( 'lamako_v2_orange_callback_invalid', 'Invalid callback.', [ 'status' => 403 ] );
    }

    return true;
}

function lamako_mobile_v2_find_orange_order_by_notif_token( $notif_token ) {
    $orders = wc_get_orders( [
        'limit'          => 2,
        'payment_method' => 'papi_paiement',
        'meta_query'     => [
            [
                'key'     => '_papi_notif_token',
                'value'   => sanitize_text_field( $notif_token ),
                'compare' => '=',
            ],
        ],
        'orderby'        => 'date',
        'order'          => 'DESC',
        'return'         => 'objects',
    ] );

    foreach ( $orders as $order ) {
        if ( ! $order instanceof WC_Order || 'papi_paiement' !== $order->get_payment_method() ) {
            continue;
        }
        $stored = (string) $order->get_meta( '_papi_notif_token' );
        if ( $stored !== '' && hash_equals( $stored, (string) $notif_token ) ) {
            return $order;
        }
    }

    return false;
}

function lamako_mobile_v2_orange_callback( WP_REST_Request $request ) {
    $body          = $request->get_json_params();
    $body          = is_array( $body ) ? $body : [];
    $notif_token   = sanitize_text_field( $body['notif_token'] ?? '' );
    $status        = strtoupper( sanitize_text_field( $body['status'] ?? '' ) );
    $transaction_id = sanitize_text_field( $body['transaction_id'] ?? ( $body['txnid'] ?? '' ) );
    $order         = lamako_mobile_v2_find_orange_order_by_notif_token( $notif_token );

    if ( ! $order instanceof WC_Order ) {
        return new WP_REST_Response( [ 'received' => false ], 404 );
    }

    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    $attempt_id = sanitize_text_field( $order->get_meta( '_lamako_v2_payment_attempt_id' ) );
    if ( $attempt_id === '' ) {
        return new WP_REST_Response( [ 'received' => false ], 409 );
    }

    if ( in_array( $status, [ 'SUCCESS', 'COMPLETED', 'TS' ], true ) ) {
        $order->payment_complete( $transaction_id !== '' ? $transaction_id : (string) $order->get_meta( '_papi_pay_token' ) );
        $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'success' );
        $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
        $order->add_order_note( 'Orange Money payment confirmed by the provider callback.' );
        $result = lamako_mobile_v2_gateway_response( $order, 'papi_paiement', $attempt_id, [ 'result' => 'success' ] );
        $order->update_meta_data( '_lamako_v2_payment_result', wp_json_encode( $result ) );
        $order->save();
        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    if ( $status === 'CANCELLED' ) {
        lamako_mobile_v2_cancel_unpaid_payment( $order, 'Orange Money reported that the customer cancelled the payment.' );
        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    if ( in_array( $status, [ 'FAILED', 'INSUFFICIENT_BALANCE' ], true ) ) {
        lamako_mobile_v2_provider_failure( $order, 'The operator declined or cancelled the payment.' );
        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    if ( $order->has_status( [ 'failed', 'cancelled' ] ) ) {
        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    $order->update_status( 'on-hold', 'Orange Money payment confirmation is pending.' );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'pending' );
    $order->save();
    return new WP_REST_Response( [ 'received' => true ], 202 );
}

function lamako_mobile_v2_reconcile_pending_payments() {
    global $wpdb;

    if ( ! function_exists( 'wc_get_orders' ) ) {
        return;
    }

    $lock_name = 'lamako_payment_reconciliation';
    $locked    = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock_name ) );
    if ( 1 !== $locked ) {
        return;
    }

    $started_at = time();
    $checked    = 0;
    update_option( 'lamako_mobile_v2_payment_reconciliation_health', [
        'started_at'  => $started_at,
        'finished_at' => 0,
        'checked'     => 0,
    ], false );

    try {
        foreach ( [ 'mvola_paiement', 'airtel_paiement' ] as $gateway_id ) {
            $orders = wc_get_orders( [
                'limit'          => 50,
                'payment_method' => $gateway_id,
                'status'         => [ 'pending', 'on-hold', 'checkout-draft', 'failed' ],
                'date_created'   => '>' . ( time() - DAY_IN_SECONDS ),
                'orderby'        => 'date',
                'order'          => 'DESC',
                'return'         => 'objects',
            ] );

            foreach ( $orders as $order ) {
                if ( ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) {
                    continue;
                }
                $attempt_id = sanitize_text_field( $order->get_meta( '_lamako_v2_payment_attempt_id' ) );
                if ( $attempt_id !== '' ) {
                    $checked++;
                    lamako_mobile_v2_poll_provider_payment( $order->get_id(), $gateway_id, $attempt_id );
                }
            }
        }
    } finally {
        update_option( 'lamako_mobile_v2_payment_reconciliation_health', [
            'started_at'  => $started_at,
            'finished_at' => time(),
            'checked'     => $checked,
        ], false );
        $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
    }
}

function lamako_mobile_v2_process_async_payment( $order_id, $gateway_id, $attempt_id ) {
    $order = wc_get_order( absint( $order_id ) );
    if ( ! $order || lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return;
    }
    $result = lamako_mobile_v2_initiate_async_payment( $order, sanitize_key( $gateway_id ), sanitize_text_field( $attempt_id ) );
    if ( is_wp_error( $result ) ) {
        lamako_mobile_v2_provider_failure( $order, $result->get_error_message() );
    }
}

function lamako_mobile_v2_existing_payment_response( WC_Order $order ) {
    if ( ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) {
        return false;
    }

    $attempt_id     = (string) $order->get_meta( '_lamako_v2_payment_attempt_id' );
    $attempt_status = sanitize_key( $order->get_meta( '_lamako_v2_payment_attempt_status' ) );
    $cached_result  = json_decode( (string) $order->get_meta( '_lamako_v2_payment_result' ), true );
    if ( is_array( $cached_result ) && in_array( $attempt_status, lamako_mobile_v2_payment_active_attempt_statuses(), true ) ) {
        $cached_result['order']         = lamako_mobile_v2_order_summary( $order, true );
        $cached_result['paymentStatus'] = $cached_result['order']['paymentStatus'];
        return $cached_result;
    }

    return [
        'flow'          => 'pending',
        'paymentStatus' => in_array( $attempt_status, lamako_mobile_v2_payment_review_attempt_statuses(), true ) ? 'review' : 'pending',
        'orderId'       => $order->get_id(),
        'gatewayId'     => $order->get_payment_method(),
        'attemptId'     => $attempt_id,
        'pollAfterMs'   => 5000,
        'order'         => lamako_mobile_v2_order_summary( $order, true ),
    ];
}

function lamako_mobile_v2_start_payment( WP_REST_Request $request ) {
    $context = lamako_mobile_v2_payment_order_from_request( $request );
    if ( is_wp_error( $context ) ) {
        return $context;
    }
    list( $token, $kind, $order ) = $context;
    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return rest_ensure_response( [
            'flow'          => 'success',
            'paymentStatus' => 'success',
            'orderId'       => $order->get_id(),
            'order'         => lamako_mobile_v2_order_summary( $order, true ),
        ] );
    }

    lamako_mobile_v2_release_unconfirmed_cybersource_attempt( $order );
    $protected_response = lamako_mobile_v2_existing_payment_response( $order );
    if ( is_array( $protected_response ) ) {
        return rest_ensure_response( $protected_response );
    }

    if ( $kind === 'checkout' && lamako_mobile_v2_is_checkout_expired( $order ) ) {
        return new WP_Error( 'lamako_v2_checkout_expired', 'This payment session has expired.', [ 'status' => 410 ] );
    }
    if ( $kind === 'seating' ) {
        $flow = lamako_mobile_v2_get_seating_flow( $token );
        if ( ! is_array( $flow ) || ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) ) {
            return new WP_Error( 'lamako_v2_seating_session_expired', 'This seating session has expired.', [ 'status' => 410 ] );
        }
    }

    $body       = $request->get_json_params();
    $body       = is_array( $body ) ? $body : [];
    $gateway_id = sanitize_key( $body['paymentMethod'] ?? '' );
    $attempt_id = sanitize_text_field( $body['attemptId'] ?? '' );
    $phone      = sanitize_text_field( $body['billingPhone'] ?? '' );
    if ( $attempt_id === '' || strlen( $attempt_id ) > 80 ) {
        return new WP_Error( 'lamako_v2_attempt_required', 'A valid payment attempt identifier is required.', [ 'status' => 422 ] );
    }

    if ( (float) $order->get_total() <= 0 ) {
        $order->set_payment_method( '' );
        $order->set_payment_method_title( 'Coupon 100 %' );
        $order->update_meta_data( '_lamako_zero_total_order', 'yes' );
        $order->payment_complete();
        $order->save();
        return rest_ensure_response( [
            'flow'          => 'success',
            'paymentStatus' => 'success',
            'orderId'       => $order->get_id(),
            'order'         => lamako_mobile_v2_order_summary( $order, true ),
        ] );
    }

    $definitions = lamako_mobile_v2_payment_gateway_definitions();
    if ( empty( $definitions[ $gateway_id ] ) ) {
        return new WP_Error( 'lamako_v2_gateway_invalid', 'Select an available payment method.', [ 'status' => 422 ] );
    }
    if ( $definitions[ $gateway_id ]['requiresPhone'] && $phone === '' && $order->get_billing_phone() === '' ) {
        return new WP_Error( 'lamako_v2_phone_required', 'A phone number is required for this payment method.', [ 'status' => 422 ] );
    }
    if ( $phone !== '' ) {
        $order->set_billing_phone( $phone );
    }
    if ( $kind === 'seating' && ! empty( $flow['expires_at'] ) ) {
        $order->update_meta_data( '_lamako_v2_reservation_expires_at', gmdate( 'c', (int) $flow['expires_at'] ) );
    } else {
        $checkout_expires = (string) $order->get_meta( '_lamako_v2_checkout_expires_at' );
        if ( $checkout_expires !== '' ) {
            $order->update_meta_data( '_lamako_v2_reservation_expires_at', $checkout_expires );
        }
    }

    $cached_attempt = (string) $order->get_meta( '_lamako_v2_payment_attempt_id' );
    $cached_result  = json_decode( (string) $order->get_meta( '_lamako_v2_payment_result' ), true );
    if ( $cached_attempt === $attempt_id && is_array( $cached_result ) ) {
        return rest_ensure_response( $cached_result );
    }

    $order->set_payment_method( $gateway_id );
    $gateways = WC()->payment_gateways()->payment_gateways();
    if ( ! empty( $gateways[ $gateway_id ] ) ) {
        $order->set_payment_method_title( wp_strip_all_tags( $gateways[ $gateway_id ]->get_title() ) );
    }
    $order->update_meta_data( '_lamako_v2_payment_attempt_id', $attempt_id );
    $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'queued' );
    $order->update_meta_data( '_lamako_v2_payment_attempt_started_at', time() );
    $order->update_meta_data( '_lamako_v2_payment_pending_until', time() + LAMAKO_MOBILE_V2_PAYMENT_VERIFY_TTL );
    $order->update_meta_data( '_lamako_v2_payment_last_checked_at', 0 );
    $order->update_meta_data( '_lamako_v2_payment_poll_count', 0 );
    $order->update_meta_data( '_lamako_v2_payment_next_poll_at', 0 );
    $order->delete_meta_data( '_lamako_v2_payment_review_noted' );
    $order->update_meta_data( '_lamako_v2_payment_return_url', lamako_mobile_v2_payment_page_url( $token, $kind, 'payment-return' ) );
    $order->update_meta_data( '_lamako_v2_payment_cancel_url', lamako_mobile_v2_payment_page_url( $token, $kind, 'payment-cancel', 'cancelled' ) );
    $order->save();

    if ( $definitions[ $gateway_id ]['flow'] === 'async' ) {
        $response = lamako_mobile_v2_initiate_async_payment( $order, $gateway_id, $attempt_id );
        if ( is_wp_error( $response ) ) {
            lamako_mobile_v2_provider_failure( $order, $response->get_error_message() );
            return $response;
        }
        return rest_ensure_response( $response );
    }

    if ( $gateway_id === 'papi_paiement' ) {
        $gateway = lamako_mobile_v2_provider_gateway( $gateway_id );
        if ( is_wp_error( $gateway ) ) {
            return $gateway;
        }
        $response = lamako_mobile_v2_initiate_orange( $order, $gateway, $attempt_id, $token, $kind );
        if ( is_wp_error( $response ) ) {
            $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
            $order->update_meta_data( '_lamako_v2_payment_error', $response->get_error_message() );
            $order->save();
            return $response;
        }
        return rest_ensure_response( $response );
    }

    if ( $gateway_id === 'cybersource' ) {
        $response = lamako_mobile_v2_start_cybersource( $order, $attempt_id, $token, $kind );
        if ( is_wp_error( $response ) ) {
            $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
            $order->update_meta_data( '_lamako_v2_payment_error', $response->get_error_message() );
            $order->save();
            return $response;
        }
        return rest_ensure_response( $response );
    }

    $response = lamako_mobile_v2_invoke_gateway( $order, $gateway_id, $attempt_id, $token, $kind );
    if ( is_wp_error( $response ) ) {
        return $response;
    }
    return rest_ensure_response( $response );
}

function lamako_mobile_v2_verify_payment( WP_REST_Request $request ) {
    $context = lamako_mobile_v2_payment_order_from_request( $request );
    if ( is_wp_error( $context ) ) {
        return $context;
    }

    list( $token, $kind, $order ) = $context;
    if ( ! lamako_mobile_v2_payment_is_confirmed( $order ) && lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) {
        $gateway_id = sanitize_key( $order->get_payment_method() );
        $attempt_id = sanitize_text_field( $order->get_meta( '_lamako_v2_payment_attempt_id' ) );

        // MVola and Airtel expose a server-to-server status endpoint. Calling
        // this function never initiates a new debit; it only verifies the
        // existing provider reference before WooCommerce can mark it paid.
        if ( in_array( $gateway_id, [ 'mvola_paiement', 'airtel_paiement' ], true ) && $attempt_id !== '' ) {
            lamako_mobile_v2_poll_provider_payment( $order->get_id(), $gateway_id, $attempt_id );
            $order = wc_get_order( $order->get_id() );
        }
    }

    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_payment_order_not_found', 'Payment order not found.', [ 'status' => 404 ] );
    }

    $summary = lamako_mobile_v2_order_summary( $order, true );

    return rest_ensure_response( [
        'kind'          => $kind,
        'token'         => $token,
        'status'        => $summary['paymentStatus'],
        'paymentStatus' => $summary['paymentStatus'],
        'order'         => $summary,
        'ticketsReady'  => ! empty( $summary['ticketsReady'] ),
    ] );
}

function lamako_mobile_v2_cancel_payment( WP_REST_Request $request ) {
    $context = lamako_mobile_v2_payment_order_from_request( $request );
    if ( is_wp_error( $context ) ) {
        return $context;
    }

    list( $token, $kind, $order ) = $context;
    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return new WP_Error(
            'lamako_v2_payment_already_confirmed',
            'This payment is already confirmed and cannot be cancelled.',
            [ 'status' => 409 ]
        );
    }

    lamako_mobile_v2_cancel_unpaid_payment( $order, 'Customer cancelled the payment from the mobile application.' );
    $order = wc_get_order( $order->get_id() );
    $summary = lamako_mobile_v2_order_summary( $order, true );

    return rest_ensure_response( [
        'kind'          => $kind,
        'token'         => $token,
        'status'        => 'cancelled',
        'paymentStatus' => 'cancelled',
        'order'         => $summary,
        'ticketsReady'  => false,
    ] );
}

function lamako_mobile_v2_get_payment_return_status( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $kind  = sanitize_key( $request->get_param( 'kind' ) );

    if ( ! in_array( $kind, [ 'checkout', 'seating' ], true ) ) {
        return new WP_Error( 'lamako_v2_invalid_payment_return_kind', 'Payment return kind must be checkout or seating.', [ 'status' => 400 ] );
    }

    if ( $kind === 'checkout' ) {
        $order = lamako_mobile_v2_find_order_by_token( $token );
        if ( ! $order ) {
            return new WP_Error( 'lamako_v2_checkout_not_found', 'Checkout not found.', [ 'status' => 404 ] );
        }
        if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
            return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this checkout.', [ 'status' => 403 ] );
        }

        $order_summary = lamako_mobile_v2_order_summary( $order, true );
        if ( lamako_mobile_v2_is_checkout_expired( $order ) && ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) && in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
            $order_summary['paymentStatus'] = 'expired';
        }

        return rest_ensure_response( [
            'kind'         => 'checkout',
            'token'        => $token,
            'status'       => $order_summary['paymentStatus'],
            'order'        => $order_summary,
            'ticketsReady' => (bool) $order_summary['ticketsReady'],
        ] );
    }

    $flow = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! $flow ) {
        return new WP_Error( 'lamako_v2_seating_session_not_found', 'Seating session not found.', [ 'status' => 404 ] );
    }

    if ( (int) $flow['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_woocommerce' ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating session.', [ 'status' => 403 ] );
    }

    $order = lamako_mobile_v2_find_seating_order( $flow );
    if ( $order && ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating order.', [ 'status' => 403 ] );
    }

    $status = 'active';
    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        $status = 'expired';
    }
    if ( $order ) {
        $status = lamako_mobile_v2_normalize_payment_status( $order );
    }

    return rest_ensure_response( [
        'kind'         => 'seating',
        'token'        => $token,
        'status'       => $status,
        'order'        => $order ? lamako_mobile_v2_order_summary( $order, true ) : null,
        'ticketsReady' => $order ? count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0 : false,
    ] );
}

function lamako_mobile_v2_set_cookie( $name, $value, $expires, $http_only = true ) {
    $args = [
        'expires'  => $expires,
        'path'     => defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/',
        'secure'   => is_ssl(),
        'httponly' => $http_only,
        'samesite' => 'Lax',
    ];
    if ( defined( 'COOKIE_DOMAIN' ) && COOKIE_DOMAIN ) {
        $args['domain'] = COOKIE_DOMAIN;
    }
    setcookie( $name, $value, $args );
    $_COOKIE[ $name ] = $value;
}

function lamako_mobile_v2_payment_page_url( $token, $kind, $page = 'payment-return', $status = '' ) {
    $args = [
        'kind' => $kind,
    ];
    if ( $status !== '' ) {
        $args['status'] = $status;
    }

    return add_query_arg( $args, home_url( '/lamako-mobile/' . $page . '/' . rawurlencode( $token ) ) );
}

function lamako_mobile_v2_maybe_serve_cybersource() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
    $path        = $request_uri ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
    if ( ! $path || ! preg_match( '#/lamako-mobile/cybersource/([A-Za-z0-9_-]+)/?$#', $path, $matches ) ) {
        return;
    }

    $token = sanitize_text_field( $matches[1] );
    $kind  = ! empty( $_GET['kind'] ) ? sanitize_key( wp_unslash( $_GET['kind'] ) ) : 'checkout';
    $kind  = in_array( $kind, [ 'checkout', 'seating' ], true ) ? $kind : 'checkout';
    if ( 'seating' === $kind ) {
        $flow  = lamako_mobile_v2_get_seating_flow( $token );
        $order = is_array( $flow ) && ( empty( $flow['expires_at'] ) || (int) $flow['expires_at'] >= time() )
            ? lamako_mobile_v2_find_seating_order( $flow )
            : false;
    } else {
        $order = lamako_mobile_v2_find_order_by_token( $token );
        if ( $order instanceof WC_Order && lamako_mobile_v2_is_checkout_expired( $order ) ) {
            $order = false;
        }
    }

    if ( ! $order instanceof WC_Order || 'cybersource' !== $order->get_payment_method() ) {
        status_header( 404 );
        nocache_headers();
        wp_die( esc_html__( 'Payment session not found.', 'lamako-mobile-api' ), esc_html__( 'Payment unavailable', 'lamako-mobile-api' ), [ 'response' => 404 ] );
    }
    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        wp_safe_redirect( lamako_mobile_v2_payment_page_url( $token, $kind ) );
        exit;
    }

    $gateway = lamako_mobile_v2_provider_gateway( 'cybersource' );
    if ( is_wp_error( $gateway ) || ! method_exists( $gateway, 'process_payment_page' ) ) {
        $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
        $order->update_meta_data( '_lamako_v2_payment_error', 'CyberSource payment page is unavailable.' );
        $order->save();
        status_header( 502 );
        nocache_headers();
        wp_die( esc_html__( 'Card payment is temporarily unavailable.', 'lamako-mobile-api' ), esc_html__( 'Payment unavailable', 'lamako-mobile-api' ), [ 'response' => 502 ] );
    }

    status_header( 200 );
    nocache_headers();
    header( 'X-Robots-Tag: noindex, nofollow', true );
    $GLOBALS['lamako_mobile_v2_gateway_context'] = [
        'order_id'   => $order->get_id(),
        'gateway_id' => 'cybersource',
        'token'      => $token,
        'kind'       => $kind,
    ];
    ?><!doctype html>
    <html <?php language_attributes(); ?>><head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title><?php echo esc_html__( 'Secure card payment', 'lamako-mobile-api' ); ?></title>
        <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff;color:#111827;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}.loading-payment-text{padding:24px}.loading-payment-text img{display:block;width:40px;height:40px;margin:18px auto}</style>
    </head><body><?php
    try {
        $result = $gateway->process_payment_page( $order->get_id() );
        if ( false === $result ) {
            $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
            $order->update_meta_data( '_lamako_v2_payment_error', 'CyberSource could not initialize the signed payment form.' );
            $order->save();
        }
    } catch ( Throwable $error ) {
        $order->update_meta_data( '_lamako_v2_payment_attempt_status', 'failed' );
        $order->update_meta_data( '_lamako_v2_payment_error', sanitize_text_field( $error->getMessage() ) );
        $order->save();
        echo '<p>' . esc_html__( 'Card payment could not be initialized. Please return to the application and try again.', 'lamako-mobile-api' ) . '</p>';
    }
    unset( $GLOBALS['lamako_mobile_v2_gateway_context'] );
    ?></body></html><?php
    exit;
}

function lamako_mobile_v2_app_payment_return_url( $token, $kind, $status = '', $order = null ) {
    $url = 'ticketbylamako://payment-return?kind=' . rawurlencode( $kind ) . '&token=' . rawurlencode( $token );
    if ( $status !== '' ) {
        $url .= '&status=' . rawurlencode( $status );
    }
    if ( is_array( $order ) && ! empty( $order['id'] ) ) {
        $url .= '&orderId=' . rawurlencode( (string) absint( $order['id'] ) );
        $url .= '&orderNumber=' . rawurlencode( (string) ( $order['number'] ?? $order['id'] ) );
    }
    return $url;
}

function lamako_mobile_v2_seating_checkout_url( $token ) {
    return home_url( '/lamako-mobile/seating-checkout/' . rawurlencode( $token ) . '/' );
}

function lamako_mobile_v2_get_cookie_token( $name ) {
    if ( empty( $_COOKIE[ $name ] ) ) {
        return '';
    }

    return sanitize_text_field( wp_unslash( $_COOKIE[ $name ] ) );
}

function lamako_mobile_v2_seating_cart_url( $url ) {
    $token = lamako_mobile_v2_get_cookie_token( 'lamako_mobile_seat_flow' );
    $flow  = $token ? lamako_mobile_v2_get_seating_flow( $token ) : false;

    if ( ! is_array( $flow ) || empty( $flow['expires_at'] ) || (int) $flow['expires_at'] < time() ) {
        return $url;
    }

    return lamako_mobile_v2_seating_checkout_url( $token );
}

function lamako_mobile_v2_maybe_apply_payment_return_hint( $order, $status_hint ) {
    if ( $order instanceof WC_Order && 'cancelled' === $status_hint && ! lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        lamako_mobile_v2_cancel_unpaid_payment( $order, 'Customer returned through the payment provider cancellation URL.' );
        return wc_get_order( $order->get_id() );
    }

    // A success query string is never authoritative. Only a verified provider
    // response or webhook may mark an order as paid.
    return $order;
}

function lamako_mobile_v2_return_url_for_order( $return_url, $order, $page = 'payment-return', $status = '' ) {
    if ( ! $order instanceof WC_Order ) {
        return $return_url;
    }

    if ( $order->get_meta( '_lamako_mobile_v2' ) !== 'yes' ) {
        return $return_url;
    }

    $stored_url = 'payment-cancel' === $page
        ? (string) $order->get_meta( '_lamako_v2_payment_cancel_url' )
        : (string) $order->get_meta( '_lamako_v2_payment_return_url' );
    if ( $stored_url !== '' ) {
        return esc_url_raw( $stored_url );
    }

    $gateway_context = $GLOBALS['lamako_mobile_v2_gateway_context'] ?? null;
    if (
        is_array( $gateway_context )
        && absint( $gateway_context['order_id'] ?? 0 ) === $order->get_id()
        && ! empty( $gateway_context['token'] )
    ) {
        return lamako_mobile_v2_payment_page_url(
            $gateway_context['token'],
            $gateway_context['kind'] ?? 'checkout',
            $page,
            $status
        );
    }

    $source = (string) $order->get_meta( '_lamako_checkout_source' );

    if ( $source === 'seating' ) {
        $seat_token = lamako_mobile_v2_get_cookie_token( 'lamako_mobile_seat_flow' );
        $flow       = $seat_token ? lamako_mobile_v2_get_seating_flow( $seat_token ) : false;
        $order_hash = (string) $order->get_meta( '_lamako_seating_flow_hash' );

        if ( is_array( $flow ) && $order_hash !== '' && hash_equals( $order_hash, (string) ( $flow['token_hash'] ?? '' ) ) ) {
            return lamako_mobile_v2_payment_page_url( $seat_token, 'seating', $page, $status );
        }
    }

    $checkout_token = lamako_mobile_v2_get_cookie_token( 'lamako_mobile_checkout_token' );
    $checkout_hash  = (string) $order->get_meta( '_lamako_v2_checkout_token_hash' );

    if ( $checkout_token !== '' && $checkout_hash !== '' && hash_equals( $checkout_hash, lamako_mobile_v2_token_hash( $checkout_token ) ) ) {
        return lamako_mobile_v2_payment_page_url( $checkout_token, 'checkout', $page, $status );
    }

    return $return_url;
}

function lamako_mobile_v2_payment_return_url( $return_url, $order ) {
    return lamako_mobile_v2_return_url_for_order( $return_url, $order, 'payment-return', '' );
}

function lamako_mobile_v2_payment_received_url( $return_url, $order ) {
    return lamako_mobile_v2_return_url_for_order( $return_url, $order, 'payment-return', '' );
}

function lamako_mobile_v2_payment_cancel_url( $cancel_url, $order ) {
    return lamako_mobile_v2_return_url_for_order( $cancel_url, $order, 'payment-cancel', 'cancelled' );
}

function lamako_mobile_v2_provider_cancel_url( $checkout_url ) {
    $context = $GLOBALS['lamako_mobile_v2_gateway_context'] ?? null;
    if (
        ! is_array( $context )
        || 'papi_paiement' !== ( $context['gateway_id'] ?? '' )
        || empty( $context['token'] )
    ) {
        return $checkout_url;
    }

    return lamako_mobile_v2_payment_page_url(
        $context['token'],
        $context['kind'] ?? 'checkout',
        'payment-cancel',
        'cancelled'
    );
}

function lamako_mobile_v2_extract_payment_return_request() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    $path        = $request_uri ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
    if ( ! $path ) {
        return false;
    }

    if ( ! preg_match( '#/lamako-mobile/(payment-return|payment-failed|payment-cancel)/([A-Za-z0-9_-]+)#', $path, $matches ) ) {
        return false;
    }

    $page = sanitize_key( $matches[1] );
    $kind = ! empty( $_GET['kind'] ) ? sanitize_key( wp_unslash( $_GET['kind'] ) ) : '';
    if ( ! in_array( $kind, [ 'checkout', 'seating' ], true ) ) {
        $kind = '';
    }

    $status_hint = '';
    if ( $page === 'payment-failed' ) {
        $status_hint = 'failed';
    } elseif ( $page === 'payment-cancel' ) {
        $status_hint = 'cancelled';
    } elseif ( ! empty( $_GET['status'] ) ) {
        $status_hint = sanitize_key( wp_unslash( $_GET['status'] ) );
    }

    return [
        'page'       => $page,
        'token'      => sanitize_text_field( $matches[2] ),
        'kind'       => $kind,
        'statusHint' => $status_hint,
    ];
}

function lamako_mobile_v2_payment_context_from_token( $token, $kind = '', $status_hint = '' ) {
    $context = [
        'kind'        => $kind ?: 'checkout',
        'flowId'      => 'return_' . substr( lamako_mobile_v2_token_hash( $token ), 0, 16 ),
        'status'      => $status_hint ?: 'unknown',
        'statusHint'  => $status_hint,
        'order'       => null,
        'ticketsReady'=> false,
        'found'       => false,
    ];

    if ( $kind !== 'seating' ) {
        $order = lamako_mobile_v2_find_order_by_token( $token );
        if ( $order instanceof WC_Order ) {
            $order  = lamako_mobile_v2_maybe_apply_payment_return_hint( $order, $status_hint );
            $status = lamako_mobile_v2_normalize_payment_status( $order );
            if ( lamako_mobile_v2_is_checkout_expired( $order ) && ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) && in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
                $status = 'expired';
            }

            $context['kind']         = 'checkout';
            $context['status']       = $status;
            $context['order']        = lamako_mobile_v2_order_summary( $order, false );
            $context['ticketsReady'] = count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0;
            $context['found']        = true;
            return $context;
        }
    }

    if ( $kind !== 'checkout' ) {
        $flow = lamako_mobile_v2_get_seating_flow( $token );
        if ( is_array( $flow ) ) {
            $order  = lamako_mobile_v2_find_seating_order( $flow );
            $status = 'pending';
            if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
                $status = 'expired';
            }
            if ( $order instanceof WC_Order ) {
                $order = lamako_mobile_v2_maybe_apply_payment_return_hint( $order, $status_hint );
                $status = lamako_mobile_v2_normalize_payment_status( $order );
            } elseif ( in_array( $status_hint, [ 'failed', 'cancelled' ], true ) ) {
                $status = $status_hint;
            }

            $context['kind']         = 'seating';
            $context['flowId']       = (string) ( $flow['flow_id'] ?? $context['flowId'] );
            $context['status']       = $status;
            $context['order']        = $order instanceof WC_Order ? lamako_mobile_v2_order_summary( $order, false ) : null;
            $context['ticketsReady'] = $order instanceof WC_Order ? count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0 : false;
            $context['found']        = true;
            return $context;
        }
    }

    return $context;
}

function lamako_mobile_v2_maybe_serve_payment_return() {
    $request = lamako_mobile_v2_extract_payment_return_request();
    if ( ! is_array( $request ) ) {
        return;
    }

    $token   = $request['token'];
    $context = lamako_mobile_v2_payment_context_from_token( $token, $request['kind'], $request['statusHint'] );
    $kind    = $context['kind'];
    $status  = $context['status'];
    $order   = is_array( $context['order'] ) ? $context['order'] : null;
    $navigation_status = in_array( $request['statusHint'], [ 'failed', 'cancelled' ], true ) && $status !== 'success'
        ? $request['statusHint']
        : $status;
    $app_url = lamako_mobile_v2_app_payment_return_url( $token, $kind, $navigation_status, $order );

    $title = 'Retour paiement';
    if ( $status === 'success' ) {
        $title = 'Paiement confirme';
    } elseif ( $status === 'pending' ) {
        $title = 'Paiement en attente';
    } elseif ( in_array( $status, [ 'failed', 'cancelled', 'expired' ], true ) ) {
        $title = 'Paiement non confirme';
    }

    nocache_headers();
    status_header( $context['found'] ? 200 : 404 );
    ?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="<?php echo esc_attr( get_bloginfo( 'charset' ) ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo esc_html( $title ); ?></title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #f7f3ed; color: #2f2116; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wrap { min-height: 100vh; box-sizing: border-box; padding: 48px 22px; display: flex; align-items: center; justify-content: center; text-align: center; }
    .panel { width: 100%; max-width: 420px; }
    .icon { width: 68px; height: 68px; margin: 0 auto 18px; border-radius: 34px; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 900; }
    .success { background: #dcfce7; color: #15803d; }
    .pending { background: #fef3c7; color: #b45309; }
    .error { background: #fee2e2; color: #b91c1c; }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    p { margin: 12px 0 0; color: #6f6256; font-size: 15px; line-height: 1.45; }
    a { display: block; margin-top: 24px; border-radius: 14px; padding: 15px 18px; background: #663d17; color: #fff; text-decoration: none; font-weight: 800; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="panel">
      <div class="icon <?php echo esc_attr( $status === 'success' ? 'success' : ( $status === 'pending' ? 'pending' : 'error' ) ); ?>">
        <?php echo esc_html( $status === 'success' ? 'OK' : ( $status === 'pending' ? '...' : '!' ) ); ?>
      </div>
      <h1><?php echo esc_html( $title ); ?></h1>
      <p>
        <?php if ( $status === 'success' ) : ?>
          Votre paiement est enregistre. Retour vers l'application pour verifier la commande.
        <?php elseif ( $status === 'pending' ) : ?>
          Votre paiement est en cours de confirmation. L'application va verifier le statut serveur.
        <?php elseif ( ! $context['found'] ) : ?>
          Cette session de paiement est introuvable ou expiree.
        <?php else : ?>
          Le paiement n'est pas confirme. L'application va verifier le statut serveur.
        <?php endif; ?>
      </p>
      <a href="<?php echo esc_url( $app_url, [ 'ticketbylamako' ] ); ?>">Retourner dans TicketByLamako</a>
    </section>
  </main>
  <script>
    (function() {
      var envelope = {
        source: "lamako-mobile-web",
        version: 1,
        flowId: <?php echo wp_json_encode( $context['flowId'] ); ?>,
        type: "PAYMENT_RESULT",
        payload: {
          kind: <?php echo wp_json_encode( $kind ); ?>,
          status: <?php echo wp_json_encode( $status ); ?>,
          statusHint: <?php echo wp_json_encode( $context['statusHint'] ); ?>,
          token: <?php echo wp_json_encode( $token ); ?>,
          orderId: <?php echo wp_json_encode( $order['id'] ?? null ); ?>,
          orderNumber: <?php echo wp_json_encode( $order['number'] ?? null ); ?>,
          ticketsReady: <?php echo wp_json_encode( (bool) $context['ticketsReady'] ); ?>
        },
        ts: Date.now(),
        signature: ""
      };
      function post(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }
      post(envelope);
      setTimeout(function() {
        post(Object.assign({}, envelope, { type: "RETURN_TO_APP", payload: Object.assign({}, envelope.payload, { reason: "payment_return" }) }));
      }, 250);
      setTimeout(function() {
        window.location.replace(<?php echo wp_json_encode( $app_url ); ?>);
      }, 80);
    })();
  </script>
</body>
</html>
    <?php
    exit;
}

function lamako_mobile_v2_prepare_seating_web_session( $token, array &$flow ) {
    $user_id = (int) ( $flow['user_id'] ?? 0 );
    if ( $user_id <= 0 ) {
        return;
    }

    wp_set_current_user( $user_id );
    wp_set_auth_cookie( $user_id, false, is_ssl() );

    $expires = ! empty( $flow['expires_at'] ) ? (int) $flow['expires_at'] : time() + LAMAKO_MOBILE_V2_SEATING_TTL;
    lamako_mobile_v2_set_cookie( 'lamako_mobile_session', '1', $expires, true );
    lamako_mobile_v2_set_cookie( 'lamako_mobile_seat_flow', $token, $expires, true );

    if ( function_exists( 'wc_load_cart' ) ) {
        wc_load_cart();
    }

    if ( function_exists( 'WC' ) ) {
        if ( WC()->session && ! WC()->session->has_session() ) {
            WC()->session->set_customer_session_cookie( true );
        }
        if ( class_exists( 'WC_Customer' ) ) {
            WC()->customer = new WC_Customer( $user_id, true );
        }
        if ( WC()->cart && empty( $flow['cart_initialized'] ) ) {
            WC()->cart->empty_cart( true );
            $flow['cart_initialized'] = true;
            lamako_mobile_v2_save_seating_flow( $token, $flow );
        }
    }
}

function lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, $title, $message, $response = 200 ) {
    $flow_id  = is_array( $flow ) ? (string) ( $flow['flow_id'] ?? '' ) : '';
    $seat_url = $token ? lamako_mobile_v2_seating_url( $token ) : home_url( '/' );

    nocache_headers();
    status_header( $response );
    ?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="<?php echo esc_attr( get_bloginfo( 'charset' ) ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title><?php echo esc_html( $title ); ?></title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #f7f3ed; color: #2f2116; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wrap { min-height: 100vh; box-sizing: border-box; padding: 42px 22px; display: flex; align-items: center; justify-content: center; text-align: center; }
    .panel { width: 100%; max-width: 420px; }
    .icon { width: 66px; height: 66px; border-radius: 33px; margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; background: #fef3c7; color: #b45309; font-size: 34px; font-weight: 900; }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    p { margin: 12px 0 0; color: #6f6256; font-size: 15px; line-height: 1.45; }
    a { display: block; margin-top: 24px; border-radius: 14px; padding: 15px 18px; background: #663d17; color: #fff; text-decoration: none; font-weight: 800; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="panel">
      <div class="icon">!</div>
      <h1><?php echo esc_html( $title ); ?></h1>
      <p><?php echo esc_html( $message ); ?></p>
      <a href="<?php echo esc_url( $seat_url ); ?>">Retour au plan de salle</a>
    </section>
  </main>
  <script>
    (function() {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        source: "lamako-mobile-web",
        version: 1,
        flowId: <?php echo wp_json_encode( $flow_id ); ?>,
        type: "SEAT_SELECTION_CHANGED",
        payload: { seats: [], count: 0, inCartCount: 0, message: <?php echo wp_json_encode( $message ); ?> },
        ts: Date.now(),
        signature: ""
      }));
    })();
  </script>
</body>
</html>
    <?php
    exit;
}

function lamako_mobile_v2_get_seating_cart_cookie() {
    if ( class_exists( 'TC_Seat_Chart' ) && method_exists( 'TC_Seat_Chart', 'get_cart_seats_cookie' ) ) {
        $seats = TC_Seat_Chart::get_cart_seats_cookie();
        return is_array( $seats ) ? $seats : [];
    }

    $cookie_id = 'tc_cart_seats_' . COOKIEHASH;
    if ( empty( $_COOKIE[ $cookie_id ] ) ) {
        return [];
    }

    $decoded = json_decode( stripslashes( wp_unslash( $_COOKIE[ $cookie_id ] ) ), true );
    return is_array( $decoded ) ? $decoded : [];
}

function lamako_mobile_v2_expand_seating_cookie_for_ticket_type( array $seat_cookie, $ticket_type_id ) {
    $ticket_type_id = (int) $ticket_type_id;
    $raw_seats      = [];

    if ( isset( $seat_cookie[ $ticket_type_id ] ) && is_array( $seat_cookie[ $ticket_type_id ] ) ) {
        $raw_seats = $seat_cookie[ $ticket_type_id ];
    } elseif ( isset( $seat_cookie[ (string) $ticket_type_id ] ) && is_array( $seat_cookie[ (string) $ticket_type_id ] ) ) {
        $raw_seats = $seat_cookie[ (string) $ticket_type_id ];
    }

    $expanded = [];
    foreach ( $raw_seats as $seat ) {
        if ( ! is_array( $seat ) ) {
            continue;
        }

        $quantity = max( 1, absint( $seat[3] ?? 1 ) );
        $entry    = [
            'seat_id'    => sanitize_text_field( (string) ( $seat[0] ?? '' ) ),
            'seat_label' => sanitize_text_field( (string) ( $seat[1] ?? '' ) ),
            'chart_id'   => absint( $seat[2] ?? 0 ),
        ];

        for ( $i = 0; $i < $quantity; $i++ ) {
            $expanded[] = $entry;
        }
    }

    return $expanded;
}

function lamako_mobile_v2_get_ticket_instances_for_item( $order_id, $item_id, $ticket_type_id = 0 ) {
    $meta_query = [
        [
            'key'   => 'item_id',
            'value' => (string) $item_id,
        ],
    ];

    if ( $ticket_type_id ) {
        $meta_query[] = [
            'key'   => 'ticket_type_id',
            'value' => (string) $ticket_type_id,
        ];
    }

    if ( count( $meta_query ) > 1 ) {
        $meta_query['relation'] = 'AND';
    }

    $ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft', 'trash' ],
        'post_parent'    => (int) $order_id,
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
        'meta_query'     => $meta_query,
    ] );

    return array_map( 'intval', $ids );
}

function lamako_mobile_v2_next_ticket_code_slot( $order_id ) {
    $ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft', 'trash' ],
        'post_parent'    => (int) $order_id,
        'fields'         => 'ids',
        'posts_per_page' => -1,
    ] );

    $used = [];
    foreach ( $ids as $id ) {
        $code = (string) get_post_meta( $id, 'ticket_code', true );
        if ( preg_match( '/-(\d+)$/', $code, $matches ) ) {
            $used[ (int) $matches[1] ] = true;
        } elseif ( preg_match( '/^' . preg_quote( (string) $order_id, '/' ) . '(\d+)$/', $code, $matches ) ) {
            $used[ (int) $matches[1] ] = true;
        }
    }

    for ( $slot = 1; $slot < 10000; $slot++ ) {
        if ( empty( $used[ $slot ] ) ) {
            return $slot;
        }
    }

    return count( $ids ) + 1;
}

function lamako_mobile_v2_create_ticket_instance_for_item( WC_Order $order, $item_id, $item, $ticket_type_id, $seat = null, array $flow = [] ) {
    $order_id   = $order->get_id();
    $product_id = (int) $item->get_product_id();
    $event_id   = absint( get_post_meta( $product_id, '_event_name', true ) );
    if ( $event_id <= 0 && ! empty( $flow['event_id'] ) ) {
        $event_id = absint( $flow['event_id'] );
    }

    $owner_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
    if ( $owner_name === '' ) {
        $owner_name = $order->get_billing_email();
    }
    if ( $owner_name === '' ) {
        $owner_name = 'Ticket';
    }

    $ticket_id = wp_insert_post( [
        'post_author'  => (int) $order->get_customer_id(),
        'post_parent'  => (int) $order_id,
        'post_excerpt' => '',
        'post_content' => '',
        'post_status'  => 'publish',
        'post_title'   => sanitize_text_field( $owner_name ),
        'post_type'    => 'tc_tickets_instances',
    ], true );

    if ( is_wp_error( $ticket_id ) ) {
        return $ticket_id;
    }

    $slot = lamako_mobile_v2_next_ticket_code_slot( $order_id );
    if ( apply_filters( 'tc_use_only_digit_order_number', false ) == true ) {
        $ticket_code = apply_filters( 'tc_ticket_code', $order_id . '' . $slot, $ticket_type_id, $ticket_id );
    } else {
        $ticket_code = apply_filters( 'tc_ticket_code', $order_id . '-' . $slot, $ticket_type_id, $ticket_id );
    }

    update_post_meta( $ticket_id, 'ticket_type_id', (int) $ticket_type_id );
    update_post_meta( $ticket_id, 'ticket_code', sanitize_text_field( $ticket_code ) );
    update_post_meta( $ticket_id, 'event_id', (int) $event_id );
    update_post_meta( $ticket_id, 'item_id', (int) $item_id );

    if ( $order->get_billing_first_name() ) {
        update_post_meta( $ticket_id, 'first_name', sanitize_text_field( $order->get_billing_first_name() ) );
    }
    if ( $order->get_billing_last_name() ) {
        update_post_meta( $ticket_id, 'last_name', sanitize_text_field( $order->get_billing_last_name() ) );
    }
    if ( $order->get_billing_email() ) {
        update_post_meta( $ticket_id, 'owner_email', sanitize_email( $order->get_billing_email() ) );
    }

    if ( is_array( $seat ) ) {
        update_post_meta( $ticket_id, 'chart_id', absint( $seat['chart_id'] ?? 0 ) );
        update_post_meta( $ticket_id, 'seat_id', sanitize_text_field( (string) ( $seat['seat_id'] ?? '' ) ) );
        update_post_meta( $ticket_id, 'seat_label', sanitize_text_field( (string) ( $seat['seat_label'] ?? '' ) ) );
    }

    do_action( 'tc_created_order_ticket_instance', $ticket_id, $order_id, false );

    return (int) $ticket_id;
}

function lamako_mobile_v2_get_item_seat_assignments( $item, $quantity ) {
    if ( ! is_object( $item ) || ! method_exists( $item, 'get_meta' ) ) {
        return [];
    }

    $labels_raw = (string) $item->get_meta( '_lamako_seat_labels', true );
    if ( $labels_raw === '' ) {
        $labels_raw = (string) $item->get_meta( 'Place', true );
    }
    $ids_raw    = (string) $item->get_meta( '_lamako_seat_ids', true );
    $charts_raw = (string) $item->get_meta( '_lamako_chart_ids', true );
    $labels     = array_values( array_filter( array_map( 'trim', explode( ',', $labels_raw ) ) ) );
    $ids        = array_values( array_filter( array_map( 'trim', explode( ',', $ids_raw ) ) ) );
    $charts     = array_values( array_filter( array_map( 'absint', explode( ',', $charts_raw ) ) ) );
    $seats      = [];

    for ( $index = 0; $index < max( 1, absint( $quantity ) ); $index++ ) {
        if ( empty( $labels[ $index ] ) || empty( $ids[ $index ] ) || empty( $charts[ $index ] ) ) {
            continue;
        }
        $seats[] = [
            'seat_id'    => sanitize_text_field( $ids[ $index ] ),
            'seat_label' => sanitize_text_field( $labels[ $index ] ),
            'chart_id'   => absint( $charts[ $index ] ),
        ];
    }

    return $seats;
}

function lamako_mobile_v2_issue_tickets_after_payment( $order_id, $from_status = '', $to_status = '', $order = null ) {
    $order = $order instanceof WC_Order ? $order : wc_get_order( absint( $order_id ) );
    if ( ! $order instanceof WC_Order
        || 'yes' !== $order->get_meta( '_lamako_mobile_v2' )
        || ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        return;
    }

    $result = lamako_mobile_v2_ensure_ticket_instances_for_order( $order );
    if ( is_wp_error( $result ) ) {
        $order->update_meta_data( '_lamako_v2_ticket_issue_status', 'failed' );
        $order->update_meta_data( '_lamako_v2_ticket_issue_error', sanitize_text_field( $result->get_error_message() ) );
        if ( 'yes' !== $order->get_meta( '_lamako_v2_ticket_issue_error_noted' ) ) {
            $order->add_order_note( 'Lamako Mobile ticket issuance failed after payment: ' . $result->get_error_message() );
            $order->update_meta_data( '_lamako_v2_ticket_issue_error_noted', 'yes' );
        }
        $order->save();
        return;
    }

    $order->update_meta_data( '_lamako_v2_ticket_issue_status', 'issued' );
    $order->delete_meta_data( '_lamako_v2_ticket_issue_error' );
    $order->save();
}

function lamako_mobile_v2_payment_is_confirmed( WC_Order $order ) {
    if ( $order->is_paid() ) {
        return true;
    }

    return 'cybersource' === $order->get_payment_method()
        && 'cs-complete' === $order->get_status();
}

function lamako_mobile_v2_ensure_ticket_instances_for_order( WC_Order $order, array $seat_cookie = [], array $flow = [] ) {
    $cart_contents    = [];
    $ticket_type_meta = [];
    $chart_id_meta    = [];
    $seat_id_meta     = [];
    $seat_label_meta  = [];

    foreach ( $order->get_items() as $item_id => $item ) {
        if ( ! is_object( $item ) || ! method_exists( $item, 'get_product_id' ) ) {
            continue;
        }

        $product_id     = (int) $item->get_product_id();
        $variation_id   = method_exists( $item, 'get_variation_id' ) ? (int) $item->get_variation_id() : 0;
        $ticket_type_id = $variation_id > 0 ? $variation_id : $product_id;

        if ( get_post_meta( $product_id, '_tc_is_ticket', true ) !== 'yes' ) {
            continue;
        }

        $quantity = max( 1, (int) $item->get_quantity() );
        if ( ! isset( $cart_contents[ $ticket_type_id ] ) ) {
            $cart_contents[ $ticket_type_id ] = 0;
        }
        $cart_contents[ $ticket_type_id ] += $quantity;

        $seats             = lamako_mobile_v2_expand_seating_cookie_for_ticket_type( $seat_cookie, $ticket_type_id );
        $is_seating_ticket = get_post_meta( $ticket_type_id, '_tc_used_for_seatings', true ) === 'yes'
            || get_post_meta( $product_id, '_tc_used_for_seatings', true ) === 'yes';

        if ( empty( $seats ) && $is_seating_ticket ) {
            $seats = lamako_mobile_v2_get_item_seat_assignments( $item, $quantity );
        }

        $assigned_seats = array_slice( $seats, 0, $quantity );
        if ( $is_seating_ticket ) {
            foreach ( $assigned_seats as $seat ) {
                if ( empty( $seat['seat_id'] ) || empty( $seat['seat_label'] ) || empty( $seat['chart_id'] ) ) {
                    return new WP_Error(
                        'lamako_v2_seating_metadata_missing',
                        'The selected seat metadata is incomplete. Please select the seats again.',
                        [ 'status' => 409 ]
                    );
                }
            }
            if ( count( $assigned_seats ) < $quantity ) {
                return new WP_Error(
                    'lamako_v2_seating_metadata_missing',
                    'The selected seat metadata is incomplete. Please select the seats again.',
                    [ 'status' => 409 ]
                );
            }
        }

        $ticket_type_key = (string) $ticket_type_id;
        if ( ! isset( $ticket_type_meta[ $ticket_type_key ] ) ) {
            $ticket_type_meta[ $ticket_type_key ] = [];
        }
        for ( $i = 0; $i < $quantity; $i++ ) {
            $ticket_type_meta[ $ticket_type_key ][] = $ticket_type_key;
        }

        $instances = [];
        if ( lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
            $instances = lamako_mobile_v2_get_ticket_instances_for_item( $order->get_id(), $item_id, $ticket_type_id );

            while ( count( $instances ) < $quantity ) {
                $next_index = count( $instances );
                $created    = lamako_mobile_v2_create_ticket_instance_for_item( $order, $item_id, $item, $ticket_type_id, $assigned_seats[ $next_index ] ?? null, $flow );
                if ( is_wp_error( $created ) ) {
                    return $created;
                }
                $instances[] = (int) $created;
            }
        }

        $seat_labels = [];
        $seat_ids    = [];
        $chart_ids   = [];
        for ( $i = 0; $i < $quantity; $i++ ) {
            if ( empty( $assigned_seats[ $i ] ) ) {
                continue;
            }

            $seat = $assigned_seats[ $i ];
            if ( ! empty( $instances[ $i ] ) ) {
                update_post_meta( $instances[ $i ], 'chart_id', absint( $seat['chart_id'] ?? 0 ) );
                update_post_meta( $instances[ $i ], 'seat_id', sanitize_text_field( (string) ( $seat['seat_id'] ?? '' ) ) );
                update_post_meta( $instances[ $i ], 'seat_label', sanitize_text_field( (string) ( $seat['seat_label'] ?? '' ) ) );
            }

            if ( ! empty( $seat['seat_label'] ) ) {
                $seat_labels[] = sanitize_text_field( (string) $seat['seat_label'] );
            }
            if ( ! empty( $seat['seat_id'] ) ) {
                $seat_ids[] = sanitize_text_field( (string) $seat['seat_id'] );
            }
            if ( ! empty( $seat['chart_id'] ) ) {
                $chart_ids[] = absint( $seat['chart_id'] );
            }
        }

        if ( ! empty( $assigned_seats ) ) {
            $chart_id_meta[ $ticket_type_key ]   = array_map( 'strval', array_column( $assigned_seats, 'chart_id' ) );
            $seat_id_meta[ $ticket_type_key ]    = array_map( 'strval', array_column( $assigned_seats, 'seat_id' ) );
            $seat_label_meta[ $ticket_type_key ] = array_map( 'strval', array_column( $assigned_seats, 'seat_label' ) );
        }

        // Persist the assignment before payment so the status-change hook can
        // recreate the exact Tickera instances without relying on WebView
        // cookies that no longer exist when the provider callback arrives.
        if ( ! empty( $seat_labels ) ) {
            $item->update_meta_data( '_lamako_seat_labels', implode( ', ', array_unique( $seat_labels ) ) );
            $item->update_meta_data( '_lamako_seat_ids', implode( ',', array_unique( $seat_ids ) ) );
            $item->update_meta_data( '_lamako_chart_ids', implode( ',', array_unique( $chart_ids ) ) );
            $item->update_meta_data( 'Place', implode( ', ', array_unique( $seat_labels ) ) );
            $item->save();
        }
    }

    if ( ! empty( $cart_contents ) ) {
        $order->update_meta_data( 'tc_cart_contents', array_filter( $cart_contents ) );
        $cart_info = $order->get_meta( 'tc_cart_info' );
        $cart_info = is_array( $cart_info ) ? $cart_info : [];
        $cart_info['buyer_data'] = isset( $cart_info['buyer_data'] ) && is_array( $cart_info['buyer_data'] )
            ? $cart_info['buyer_data']
            : [];
        $owner_data = isset( $cart_info['owner_data'] ) && is_array( $cart_info['owner_data'] )
            ? $cart_info['owner_data']
            : [];

        $owner_data['ticket_type_id_post_meta'] = $ticket_type_meta;
        foreach ( [
            'chart_id_post_meta'   => $chart_id_meta,
            'seat_id_post_meta'    => $seat_id_meta,
            'seat_label_post_meta' => $seat_label_meta,
        ] as $meta_key => $meta_value ) {
            if ( ! empty( $meta_value ) ) {
                $owner_data[ $meta_key ] = $meta_value;
            } else {
                unset( $owner_data[ $meta_key ] );
            }
        }

        $cart_info['owner_data'] = $owner_data;
        $order->update_meta_data( 'tc_cart_info', $cart_info );
        $order->save();
    }

    return true;
}

function lamako_mobile_v2_clear_seating_cart_state() {
    if ( class_exists( 'TC_Seat_Chart' ) && method_exists( 'TC_Seat_Chart', 'set_seats_cookie' ) ) {
        TC_Seat_Chart::set_seats_cookie( [] );
    } else {
        $cookie_id = 'tc_cart_seats_' . COOKIEHASH;
        unset( $_COOKIE[ $cookie_id ] );
        setcookie( $cookie_id, '', time() - HOUR_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN );
    }

    if ( get_current_user_id() ) {
        update_user_meta( get_current_user_id(), '_seatings_persistent_cart', [ 'seats_cart' => [] ] );
    }

    if ( function_exists( 'WC' ) ) {
        if ( WC()->cart ) {
            WC()->cart->empty_cart( true );
        }
        if ( WC()->session ) {
            WC()->session->set( 'tc_seat_cart_items', null );
            WC()->session->set( 'tc_cart_seats', null );
        }
    }
}

function lamako_mobile_v2_begin_seating_checkout() {
    $token = ! empty( $_GET['lamako_seating_checkout'] )
        ? sanitize_text_field( wp_unslash( $_GET['lamako_seating_checkout'] ) )
        : lamako_mobile_v2_extract_path_token( 'seating-checkout' );

    if ( $token === '' ) {
        return;
    }
    $flow  = lamako_mobile_v2_get_seating_flow( $token );

    if ( ! is_array( $flow ) ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, [], 'Session introuvable', 'Cette session de reservation est introuvable. Merci de relancer le choix des places.', 404 );
    }

    $order = lamako_mobile_v2_find_seating_order( $flow );
    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time()
        && ( ! $order instanceof WC_Order || ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Session expiree', 'Cette session de reservation a expire. Merci de relancer le choix des places.', 410 );
    }

    lamako_mobile_v2_prepare_seating_web_session( $token, $flow );

    if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Panier indisponible', 'Le panier WooCommerce est indisponible pour cette session.', 500 );
    }

    WC()->cart->calculate_totals();
    if ( WC()->cart->is_empty() ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Aucun siege confirme', 'Selectionnez un siege, puis confirmez-le dans la fenetre du plan de salle avant de passer au paiement.', 200 );
    }

    $seat_cookie = lamako_mobile_v2_get_seating_cart_cookie();
    if ( empty( $seat_cookie ) ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Aucun siege confirme', 'Selectionnez un siege, puis confirmez-le dans la fenetre du plan de salle avant de passer au paiement.', 200 );
    }

    $existing_order = lamako_mobile_v2_find_seating_order( $flow );
    if ( $existing_order instanceof WC_Order && in_array( $existing_order->get_status(), [ 'processing', 'completed', 'on-hold' ], true ) ) {
        wp_safe_redirect( home_url( '/?lamako_checkout=1&order_id=' . absint( $existing_order->get_id() ) . '&order_key=' . rawurlencode( $existing_order->get_order_key() ) ) );
        exit;
    }

    if ( $existing_order instanceof WC_Order && in_array( $existing_order->get_status(), [ 'pending', 'on-hold', 'checkout-draft' ], true ) ) {
        $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $existing_order, $seat_cookie, $flow );
        if ( is_wp_error( $ticket_result ) ) {
            lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Paiement indisponible', $ticket_result->get_error_message(), 500 );
        }
        lamako_mobile_v2_clear_seating_cart_state();
        wp_safe_redirect( home_url( '/?lamako_checkout=1&order_id=' . absint( $existing_order->get_id() ) . '&order_key=' . rawurlencode( $existing_order->get_order_key() ) ) );
        exit;
    }

    try {
        $checkout = WC()->checkout();
        $order_id = $checkout->create_order( [] );

        if ( is_wp_error( $order_id ) ) {
            throw new Exception( $order_id->get_error_message() );
        }

        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            throw new Exception( 'Order could not be created.' );
        }

        $user_id = (int) ( $flow['user_id'] ?? 0 );
        if ( $user_id > 0 ) {
            $user = get_userdata( $user_id );
            $order->set_customer_id( $user_id );
            if ( $user ) {
                if ( ! $order->get_billing_email() ) {
                    $order->set_billing_email( $user->user_email );
                }
                if ( ! $order->get_billing_first_name() ) {
                    $order->set_billing_first_name( get_user_meta( $user_id, 'first_name', true ) ?: $user->display_name );
                }
                if ( ! $order->get_billing_last_name() ) {
                    $order->set_billing_last_name( get_user_meta( $user_id, 'last_name', true ) );
                }
            }
        }

        $order->set_created_via( 'lamako_mobile_seating_v2' );
        $order->set_status( 'pending' );
        $order->update_meta_data( '_lamako_mobile_order', 'yes' );
        $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
        $order->update_meta_data( '_lamako_checkout_source', 'seating' );
        $order->update_meta_data( '_lamako_seating_flow_hash', $flow['token_hash'] ?? lamako_mobile_v2_token_hash( $token ) );
        $order->update_meta_data( '_lamako_seating_event_id', (int) ( $flow['event_id'] ?? 0 ) );
        $order->update_meta_data( '_lamako_seating_chart_id', (int) ( $flow['chart_id'] ?? 0 ) );
        $order->add_order_note( 'Lamako Mobile v2 seating order created from WebView cart.' );
        $order->calculate_totals();
        $order->save();

        $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $order, $seat_cookie, $flow );
        if ( is_wp_error( $ticket_result ) ) {
            throw new Exception( $ticket_result->get_error_message() );
        }

        $flow['order_id'] = $order->get_id();
        lamako_mobile_v2_save_seating_flow( $token, $flow );

        lamako_mobile_v2_clear_seating_cart_state();

        wp_safe_redirect( home_url( '/?lamako_checkout=1&order_id=' . absint( $order->get_id() ) . '&order_key=' . rawurlencode( $order->get_order_key() ) ) );
        exit;
    } catch ( Exception $e ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Paiement indisponible', $e->getMessage(), 500 );
    }
}

function lamako_mobile_v2_maybe_serve_seating_flow() {
    $token = lamako_mobile_v2_extract_seating_token_from_request();
    if ( $token === '' ) {
        return;
    }

    $flow = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! $flow ) {
        wp_die( 'Seating session not found.', 'Lamako Mobile', [ 'response' => 404 ] );
    }

    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        wp_die( 'Seating session expired.', 'Lamako Mobile', [ 'response' => 410 ] );
    }

    $event_id = (int) ( $flow['event_id'] ?? 0 );
    $chart_id = (int) ( $flow['chart_id'] ?? 0 );
    if ( $event_id <= 0 || $chart_id <= 0 ) {
        wp_die( 'Invalid seating session.', 'Lamako Mobile', [ 'response' => 400 ] );
    }

    lamako_mobile_v2_prepare_seating_web_session( $token, $flow );

    $flow_id      = esc_js( $flow['flow_id'] ?? '' );
    $event_title  = get_the_title( $event_id );
    $checkout_url      = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' );
    $seating_order_url = rest_url( 'lamako-mobile/v2/seating-sessions/' . rawurlencode( $token ) . '/order' );

    status_header( 200 );
    nocache_headers();
    ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex,nofollow" />
<title><?php echo esc_html( $event_title ?: 'Plan de salle' ); ?> - TicketByLamako</title>
<style>
html, body { margin: 0 !important; padding: 0 !important; min-height: 100%; background: #f7f3ed !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
body.lamako-mobile-seat-flow { overflow-x: hidden !important; }
#wpadminbar, header, footer, nav, aside, .site-header, .site-footer, #masthead, #colophon, .woocommerce-breadcrumb, .gt-breadcrumb, .gt-page-title-bar, .sidebar, [class*="whatsapp"], [id*="whatsapp"], [class*="qlwapp"], [id*="qlwapp"], [class*="cookie"], [class*="consent"], #fkcart-floating-toggler, .fkcart-main-wrapper, [class*="tidio"], [id*="tidio"], [class*="tawk"], [id*="tawk"], [class*="crisp"], [id*="crisp"] { display: none !important; visibility: hidden !important; }
.lamako-seat-shell { min-height: 100vh; padding: 12px 12px 24px; box-sizing: border-box; }
.lamako-seat-title { margin: 0 0 10px; color: #2f2116; font-size: 16px; font-weight: 800; line-height: 1.25; }
.lamako-seat-helper { margin: 0 0 12px; color: #6f6256; font-size: 13px; line-height: 1.35; }
.tc_seating_map_button, button.tc_seating_map_button { display: block !important; width: 100% !important; max-width: 360px !important; margin: 12px auto !important; padding: 14px 18px !important; border: 0 !important; border-radius: 12px !important; background: #663d17 !important; color: #fff !important; font-size: 16px !important; font-weight: 800 !important; text-align: center !important; }
.tc_seat_chart_wrap, .tc_seat_chart_modal, .tc_seat_chart_container, .tc_seating_chart { max-width: 100% !important; }
.fancybox-overlay, .fancybox-wrap { z-index: 9999 !important; }
.tc_zoom_in, .tc_zoom_out, .tc-zoom-in, .tc-zoom-out, [class*="zoom_in"], [class*="zoom_out"] { display: block !important; visibility: visible !important; }
.woocommerce, .woocommerce-cart, .woocommerce-checkout { max-width: 100% !important; padding: 10px !important; box-sizing: border-box !important; }
.wc-proceed-to-checkout a, .checkout-button, #place_order { display: block !important; width: 100% !important; border-radius: 12px !important; padding: 14px !important; font-size: 16px !important; font-weight: 800 !important; text-align: center !important; }
.tc_cart_button { background: #16a34a !important; color: #fff !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; border-radius: 12px !important; font-weight: 900 !important; box-shadow: 0 10px 24px rgba(22,163,74,.24) !important; }
.tc_cart_button:hover, .tc_cart_button:focus, .tc_cart_button:active { background: #15803d !important; color: #fff !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; }
.tc-checkout-button, a.tc-checkout-button { display: none !important; }
.tc-seating-legend-wrap { z-index: 2147482800 !important; }
.tc-seat-dialog.ui-dialog { z-index: 999999 !important; pointer-events: auto !important; }
.tc-seat-dialog.ui-dialog, .tc-seat-dialog.ui-dialog * { pointer-events: auto !important; }
.ui-widget-overlay { position: fixed !important; inset: 0 !important; z-index: 999998 !important; pointer-events: auto !important; }
.tc-seat-dialog .ui-dialog-content { max-width: calc(100vw - 24px) !important; max-height: calc(100vh - 112px) !important; overflow: auto !important; box-sizing: border-box !important; }
.tc-seat-dialog button, .tc-seat-dialog .button, .tc-seat-dialog .tc_cart_button { min-height: 48px !important; touch-action: manipulation !important; }
.tc-bottom-controls, .tc-bottom-controls *, .tc-zoom-wrap, .tc-zoom-wrap *, .tc-seating-legend-wrap, .tc-seating-legend-wrap * { pointer-events: auto !important; }
.tc_seat_unit, .tc_seat_unit * { pointer-events: auto !important; }
.tc-zoom-wrap .tc-plus-wrap, .tc-zoom-wrap .tc-minus-wrap, .tc-legend-arrow { touch-action: manipulation !important; -webkit-tap-highlight-color: transparent; }
.tc-zoom-wrap .tc-plus-wrap, .tc-zoom-wrap .tc-minus-wrap, .tc-legend-arrow { min-width: 44px; min-height: 44px; }
.lamako-seat-notice { position: fixed; left: 12px; right: 12px; bottom: 76px; z-index: 100000; display: none; border-radius: 12px; padding: 12px 14px; background: #fff7ed; color: #9a3412; font-size: 14px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.14); }
.lamako-seat-notice.is-visible { display: block; }
</style>
<?php wp_head(); ?>
</head>
<body class="lamako-mobile-seat-flow">
<main class="lamako-seat-shell">
    <h1 class="lamako-seat-title"><?php echo esc_html( $event_title ?: 'Choisissez vos places' ); ?></h1>
    <p class="lamako-seat-helper">Sélectionnez vos sièges avec le plan officiel, puis confirmez votre sélection pour continuer vers le paiement.</p>
    <?php echo do_shortcode( '[tc_seat_chart id="' . absint( $chart_id ) . '" show_legend="true" button_title="Choisir mes sièges" cart_title="Passer au paiement"]' ); ?>
</main>
<div class="lamako-seat-notice" id="lamako-seat-notice"></div>
<?php
// The native seating flow owns checkout. Public-site drawers must not observe
// Tickera cart mutations from this isolated route.
foreach ( [ 'tbl-event-fast-checkout', 'fkcart-script' ] as $script_handle ) {
    wp_dequeue_script( $script_handle );
}
?>
<?php wp_footer(); ?>
<script>
(function() {
  var flowId = "<?php echo $flow_id; ?>";
  var checkoutUrl = "<?php echo esc_js( $checkout_url ); ?>";
  var seatingOrderUrl = "<?php echo esc_js( $seating_order_url ); ?>";
  var lastSeatKey = "";
  var noticeTimer = null;
  var reportTimer = null;
  var orderCreating = false;
  var seatingOpened = false;
  var seatDialogOpen = false;
  var seatingLaunchAttempts = 0;
  function releaseEmbeddedConsentWall() {
    if (!document.body) return;

    // Complianz can disable pointer events while its hidden banner is pending.
    // Release only the transient DOM lock; do not store or imply consent.
    if (document.body.classList.contains("cmplz-banner-active")) {
      document.body.classList.remove("cmplz-banner-active");
    }
    document.querySelectorAll(".cmplz-cookiebanner").forEach(function(banner) {
      banner.setAttribute("aria-hidden", "true");
    });
  }
  releaseEmbeddedConsentWall();
  new MutationObserver(releaseEmbeddedConsentWall).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });
  function post(type, payload) {
    if (!window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      source: "lamako-mobile-web",
      version: 1,
      flowId: flowId,
      type: type,
      payload: payload || {},
      ts: Date.now(),
      signature: ""
    }));
  }
  function showNotice(message) {
    var notice = document.getElementById("lamako-seat-notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = "lamako-seat-notice is-visible";
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function() {
      notice.className = "lamako-seat-notice";
    }, 3600);
  }
  function visibleSeatDialog() {
    var dialogs = document.querySelectorAll(".tc-seat-dialog.ui-dialog");
    for (var index = 0; index < dialogs.length; index += 1) {
      var rect = dialogs[index].getBoundingClientRect();
      var style = window.getComputedStyle(dialogs[index]);
      if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") return true;
    }
    return false;
  }
  function reportSeatDialog() {
    var isOpen = visibleSeatDialog();
    if (isOpen === seatDialogOpen) return;
    seatDialogOpen = isOpen;
    post("SEATING_MODAL_STATE", { dialogOpen: isOpen });
  }
  function closeCompletedSeatDialog() {
    document.querySelectorAll(".tc-seat-dialog.ui-dialog").forEach(function(dialog) {
      dialog.style.setProperty("display", "none", "important");
      dialog.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll(".ui-widget-overlay").forEach(function(overlay) {
      overlay.style.setProperty("display", "none", "important");
      overlay.setAttribute("aria-hidden", "true");
    });
    document.body.classList.remove("tcsc-disabled");
    seatDialogOpen = false;
    post("SEATING_MODAL_STATE", { dialogOpen: false });
  }
  function seatingChartVisible() {
    var candidates = document.querySelectorAll(
      ".tc_seat_unit, .tc-seatchart-map, .tc_seating_map, .ui-dialog-content"
    );
    for (var index = 0; index < candidates.length; index += 1) {
      var rect = candidates[index].getBoundingClientRect();
      var style = window.getComputedStyle(candidates[index]);
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      ) {
        return true;
      }
    }
    return false;
  }
  function openSeatingChart() {
    if (seatingChartVisible()) {
      if (!seatingOpened) {
        seatingOpened = true;
        window.scrollTo(0, 0);
        post("SEATING_CHART_OPENED", { automatic: true });
      }
      return true;
    }
    if (seatingLaunchAttempts >= 32) {
      showNotice("Le plan met plus de temps que prévu à s'ouvrir. Touchez « Choisir mes sièges » pour réessayer.");
      return false;
    }
    var button = document.querySelector(".tc_seating_map_button, button.tc_seating_map_button");
    seatingLaunchAttempts += 1;
    if (!button) {
      setTimeout(openSeatingChart, 250);
      return false;
    }
    button.click();
    setTimeout(function() {
      if (seatingChartVisible()) {
        seatingOpened = true;
        window.scrollTo(0, 0);
        post("SEATING_CHART_OPENED", { automatic: true });
      } else {
        seatingOpened = false;
        setTimeout(openSeatingChart, 250);
      }
    }, 180);
    return true;
  }
  window.lamakoOpenSeatingChart = openSeatingChart;
  function seatLabel(el) {
    if (!el) return "";
    var p = el.querySelector("span p, p, span");
    return (p ? p.textContent : el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function inCartCount() {
    var input = document.querySelector(".tc-seatchart-in-cart-count");
    var value = input ? parseInt(input.value || "0", 10) : 0;
    if (!isNaN(value) && value > 0) return value;
    return document.querySelectorAll(".tc_seat_in_cart").length;
  }
  function selectedSeats() {
    var selectors = [
      ".tc_seat_unit.ui-selected",
      ".tc_seat_unit.tc-selected",
      ".tc_seat_unit.selected",
      ".tc_seat_unit.tc_seat_in_cart",
      ".tc_seat_unit.in_cart",
      ".tc_seat_unit.tc_in_cart",
      ".tc_seat_unit[data-in-cart='1']"
    ];
    var seen = {};
    var seats = [];
    selectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(el) {
        var id = el.id || el.getAttribute("data-seat-id") || seatLabel(el);
        if (!id || seen[id]) return;
        seen[id] = true;
        seats.push({ id: id, label: seatLabel(el) });
      });
    });
    return seats;
  }
  function pendingSeats() {
    var selectors = [
      ".tc_seat_unit.ui-selected:not(.tc_seat_in_cart)",
      ".tc_seat_unit.tc-selected:not(.tc_seat_in_cart)",
      ".tc_seat_unit.selected:not(.tc_seat_in_cart)"
    ];
    var seen = {};
    var seats = [];
    selectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(el) {
        var id = el.id || el.getAttribute("data-seat-id") || seatLabel(el);
        if (!id || seen[id]) return;
        seen[id] = true;
        seats.push({ id: id, label: seatLabel(el) });
      });
    });
    return seats;
  }
  function reportSeats() {
    var seats = selectedSeats();
    var pending = pendingSeats();
    var cartCount = inCartCount();
    var key = JSON.stringify({ seats: seats, pending: pending, cartCount: cartCount });
    if (key === lastSeatKey) return;
    lastSeatKey = key;
    post("SEAT_SELECTION_CHANGED", {
      seats: seats,
      seatLabels: seats.map(function(seat) { return seat.label || seat.id || ""; }).filter(Boolean),
      count: cartCount,
      selectedCount: seats.length,
      inCartCount: cartCount,
      pendingCount: pending.length
    });
  }
  function scheduleReport(delay) {
    if (reportTimer) clearTimeout(reportTimer);
    reportTimer = setTimeout(function() {
      reportTimer = null;
      reportSeats();
      reportSeatDialog();
      reportLocation();
    }, typeof delay === "number" ? delay : 120);
  }
  function reportLocation() {
    var url = window.location.href;
    if (url.indexOf("/checkout") !== -1 || url.indexOf("/commande") !== -1 || url.indexOf("lamako_checkout") !== -1) {
      post("CHECKOUT_READY", { url: url });
    }
    if (url.indexOf("order-received") !== -1 || url.indexOf("commande-recue") !== -1 || url.indexOf("thankyou") !== -1) {
      post("PAYMENT_RESULT", { status: "success", url: url });
      post("RETURN_TO_APP", { reason: "payment_result" });
    }
  }
  function setCheckoutButtonsBusy(busy) {
    document.querySelectorAll(".tc-checkout-button").forEach(function(el) {
      if (!el.dataset.lamakoOriginalText) el.dataset.lamakoOriginalText = el.textContent || "Continuer";
      el.classList.toggle("is-lamako-loading", busy);
      el.textContent = busy ? "Preparation de la commande..." : el.dataset.lamakoOriginalText;
      if ("disabled" in el) el.disabled = busy;
      if (busy) el.setAttribute("aria-busy", "true");
      else el.removeAttribute("aria-busy");
      el.style.cssText += ";background:#15803d!important;color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1!important;visibility:visible!important;";
    });
  }
  function goToCheckout(source) {
    reportSeats();
    if (inCartCount() <= 0) {
      var cartMessage = "Ajoutez d'abord chaque siège au panier dans la fenêtre du plan de salle.";
      showNotice(cartMessage);
      post("SEATING_CART_REQUIRED", { message: cartMessage });
      return false;
    }
    if (orderCreating) return false;
    orderCreating = true;
    setCheckoutButtonsBusy(true);
    post("SEATING_ORDER_CREATING", { requested: true, source: source || "seat_flow" });
    fetch(seatingOrderUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: "{}"
    })
      .then(function(response) {
        return response.json().catch(function() { return {}; }).then(function(payload) {
          if (!response.ok) {
            var error = new Error(payload && payload.message ? payload.message : "Impossible de preparer la commande.");
            error.code = payload && payload.code ? payload.code : "seating_order_failed";
            throw error;
          }
          return payload;
        });
      })
      .then(function(payload) {
        var order = payload && payload.order ? payload.order : null;
        var orderId = order ? parseInt(order.id || order.orderId || "0", 10) : 0;
        if (!orderId) {
          var invalidOrder = new Error("La commande des sièges n'a pas été confirmée par le serveur.");
          invalidOrder.code = "seating_order_not_confirmed";
          throw invalidOrder;
        }
        post("SEATING_ORDER_CREATED", {
          token: <?php echo wp_json_encode( $token ); ?>,
          order: order
        });
      })
      .catch(function(error) {
        orderCreating = false;
        setCheckoutButtonsBusy(false);
        showNotice(error && error.message ? error.message : "Impossible de preparer la commande.");
        post("SEATING_ORDER_ERROR", {
          code: error && error.code ? error.code : "seating_order_failed",
          message: error && error.message ? error.message : "Impossible de preparer la commande."
        });
      });
    return true;
  }
  window.lamakoGoToCheckoutFromApp = function() {
    return goToCheckout("native_badge");
  };
  window.lamakoPrimarySeatActionFromApp = function() {
    if (visibleSeatDialog() || pendingSeats().length > 0) return false;
    return goToCheckout("native_primary_action");
  };
  function seatingAjaxAction(settings) {
    var data = settings && settings.data ? settings.data : null;
    if (typeof data === "string") {
      var match = data.match(/(?:^|&)action=([^&]+)/);
      return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
    }
    if (window.FormData && data instanceof window.FormData && data.get) {
      return data.get("action") || "";
    }
    return data && typeof data === "object" && data.action ? String(data.action) : "";
  }
  function seatingAjaxParam(settings, name) {
    var data = settings && settings.data ? settings.data : null;
    if (typeof data === "string") {
      var pairs = data.split("&");
      for (var index = 0; index < pairs.length; index += 1) {
        var separator = pairs[index].indexOf("=");
        var rawKey = separator >= 0 ? pairs[index].slice(0, separator) : pairs[index];
        if (decodeURIComponent(rawKey.replace(/\+/g, " ")) !== name) continue;
        var rawValue = separator >= 0 ? pairs[index].slice(separator + 1) : "";
        return decodeURIComponent(rawValue.replace(/\+/g, " "));
      }
      return "";
    }
    if (window.FormData && data instanceof window.FormData && data.get) {
      return data.get(name) || "";
    }
    return data && typeof data === "object" && data[name] ? String(data[name]) : "";
  }
  function isSeatingCartRemoval(settings) {
    return seatingAjaxAction(settings) === "tc_remove_seat_from_cart_ajax";
  }
  function isSeatingCartRequest(settings) {
    var action = seatingAjaxAction(settings);
    return action === "tc_woo_update_cart_seats" ||
      action === "tc_update_cart_seats" ||
      action === "tc_remove_seat_from_cart_ajax";
  }
  function reconcileRemovedSeat(settings) {
    var cartSeat = seatingAjaxParam(settings, "tcsc_seat");
    var parts = String(cartSeat || "").split("-");
    var seatId = parts.length >= 3 ? parts.slice(1, -1).join("-") : "";
    var seat = seatId ? document.getElementById(seatId) : null;
    if (!seat) return;
    ["tc_seat_in_cart", "in_cart", "tc_in_cart", "ui-selected", "tc-selected", "selected"].forEach(function(className) {
      seat.classList.remove(className);
    });
  }
  document.addEventListener("click", function(event) {
    var target = event.target;
    var checkoutLink = target && target.closest ? target.closest(".tc-checkout-button") : null;
    if (checkoutLink) {
      event.preventDefault();
      event.stopPropagation();
      goToCheckout("tickera_cart_button");
      return;
    }
    scheduleReport(150);
    setTimeout(function() { scheduleReport(0); }, 500);
    setTimeout(function() { scheduleReport(0); }, 1100);
  }, false);
  document.addEventListener("touchend", function() { scheduleReport(220); }, false);
  document.addEventListener("pointerup", function() { scheduleReport(180); }, false);
  document.addEventListener("change", function() { scheduleReport(80); }, false);
  post("FLOW_READY", { eventId: <?php echo (int) $event_id; ?>, chartId: <?php echo (int) $chart_id; ?>, wooCheckoutUrl: checkoutUrl });
  function attachTickeraNativeHooks(attempt) {
    if (!window.jQuery || !document.body) {
      if (attempt < 100) window.setTimeout(function() { attachTickeraNativeHooks(attempt + 1); }, 100);
      return;
    }
    var jq = window.jQuery;
    jq(document).off("ajaxSend.lamakoTickeraBridge").on("ajaxSend.lamakoTickeraBridge", function(event, xhr, settings) {
      if (isSeatingCartRequest(settings)) {
        post(isSeatingCartRemoval(settings) ? "SEATING_CART_REMOVING" : "SEATING_CART_ADDING", { requested: true });
      }
    });
    jq(document).off("ajaxComplete.lamakoTickeraBridge").on("ajaxComplete.lamakoTickeraBridge", function(event, xhr, settings) {
      if (!isSeatingCartRequest(settings)) return;
      var response = xhr && xhr.responseJSON ? xhr.responseJSON : null;
      if (!response && xhr && xhr.responseText) {
        try { response = JSON.parse(xhr.responseText); } catch (error) { response = null; }
      }
      var removing = isSeatingCartRemoval(settings);
      var completedAction = response && response.action ? String(response.action) : "";
      if (removing && completedAction === "" && response && typeof response.in_cart_count !== "undefined") {
        completedAction = "removed";
      }
      var succeeded = !!(
        xhr && xhr.status >= 200 && xhr.status < 300 && response && !response.error &&
        ["added", "updated", "removed"].indexOf(completedAction) !== -1
      );
      window.setTimeout(function() {
        if (succeeded && removing) reconcileRemovedSeat(settings);
        reportSeats();
        if (succeeded) {
          closeCompletedSeatDialog();
          post("SEATING_CART_UPDATED", {
            action: completedAction,
            inCartCount: inCartCount(),
            seatLabels: selectedSeats().map(function(seat) { return seat.label || seat.id || ""; }).filter(Boolean)
          });
          return;
        }
        var errorMessage = response && response.error_message
          ? String(response.error_message)
          : removing
            ? "Ce siège n'a pas pu être retiré. Réessayez depuis le plan."
            : "Ce siège n'a pas pu être ajouté. Sélectionnez-le à nouveau.";
        showNotice(errorMessage);
        post("SEATING_CART_ADD_ERROR", {
          errorAction: removing ? "remove" : "add",
          message: errorMessage
        });
      }, 180);
    });
  }
  attachTickeraNativeHooks(0);
  if (window.MutationObserver && document.body) {
    var seatingStateObserver = new MutationObserver(function() {
      scheduleReport(100);
    });
    seatingStateObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"]
    });
  }
  setTimeout(openSeatingChart, 80);
  scheduleReport(0);
  setTimeout(function() { scheduleReport(0); }, 600);
  setTimeout(function() { scheduleReport(0); }, 1800);
})();
</script>
</body>
</html>
    <?php
    exit;
}

function lamako_mobile_v2_current_seating_flow_from_cookie() {
    if ( empty( $_COOKIE['lamako_mobile_seat_flow'] ) ) {
        return [ '', false ];
    }

    $token = sanitize_text_field( wp_unslash( $_COOKIE['lamako_mobile_seat_flow'] ) );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );
    return [ $token, $flow ];
}

function lamako_mobile_v2_mark_seating_order( $order, $data ) {
    list( $token, $flow ) = lamako_mobile_v2_current_seating_flow_from_cookie();
    if ( ! $token || ! is_array( $flow ) || ! $order instanceof WC_Order ) {
        return;
    }

    $user_id = (int) ( $flow['user_id'] ?? 0 );
    if ( $user_id > 0 ) {
        $order->set_customer_id( $user_id );
    }
    $order->set_created_via( 'lamako_mobile_seating_v2' );
    $order->update_meta_data( '_lamako_mobile_order', 'yes' );
    $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
    $order->update_meta_data( '_lamako_checkout_source', 'seating' );
    $order->update_meta_data( '_lamako_seating_flow_hash', $flow['token_hash'] ?? lamako_mobile_v2_token_hash( $token ) );
    $order->update_meta_data( '_lamako_seating_event_id', (int) ( $flow['event_id'] ?? 0 ) );
    $order->update_meta_data( '_lamako_seating_chart_id', (int) ( $flow['chart_id'] ?? 0 ) );
    $order->add_order_note( 'Lamako Mobile v2 seating checkout created.' );
}

function lamako_mobile_v2_link_seating_order_created( $order ) {
    list( $token, $flow ) = lamako_mobile_v2_current_seating_flow_from_cookie();
    if ( ! $token || ! is_array( $flow ) || ! $order instanceof WC_Order ) {
        return;
    }

    $flow['order_id'] = $order->get_id();
    lamako_mobile_v2_save_seating_flow( $token, $flow );
}

function lamako_mobile_v2_bridge_checkout_token() {
    $token = ! empty( $_GET['lamako_checkout_token'] )
        ? sanitize_text_field( wp_unslash( $_GET['lamako_checkout_token'] ) )
        : lamako_mobile_v2_extract_path_token( 'checkout' );

    if ( $token === '' ) {
        return;
    }
    $order = lamako_mobile_v2_find_order_by_token( $token );

    if ( ! $order ) {
        wp_die( 'Checkout session not found.', 'Lamako Mobile', [ 'response' => 404 ] );
    }

    if ( lamako_mobile_v2_is_checkout_expired( $order ) && ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) && $order->has_status( 'pending' ) ) {
        $order->update_status( 'cancelled', 'Lamako Mobile v2 checkout expired before payment.' );
        wp_die( 'Checkout session expired.', 'Lamako Mobile', [ 'response' => 410 ] );
    }

    $expires_at = strtotime( (string) $order->get_meta( '_lamako_v2_checkout_expires_at' ) );
    $expires    = $expires_at && $expires_at > time() ? $expires_at : time() + LAMAKO_MOBILE_V2_CHECKOUT_TTL;
    lamako_mobile_v2_set_cookie( 'lamako_mobile_session', '1', $expires, true );
    lamako_mobile_v2_set_cookie( 'lamako_mobile_checkout_token', $token, $expires, true );

    $_GET['lamako_checkout'] = '1';
    $_GET['order_id']        = $order->get_id();
    $_GET['order_key']       = $order->get_order_key();
    status_header( 200 );
    nocache_headers();
}

function lamako_mobile_v2_normalize_payment_status( WC_Order $order ) {
    $status = $order->get_status();

    if ( in_array( $status, [ 'completed', 'processing', 'cs-complete' ], true ) ) {
        return 'success';
    }
    if ( in_array( $status, [ 'pending', 'on-hold', 'cs-pending', 'cs-review', 'checkout-draft' ], true ) ) {
        return 'pending';
    }
    if ( in_array( $status, [ 'cancelled', 'failed', 'refunded', 'cs-error', 'cs-reject', 'cs-failed', 'cs-declined' ], true ) ) {
        return $status === 'cancelled' ? 'cancelled' : 'failed';
    }

    return 'unknown';
}

function lamako_mobile_v2_order_reservation_deadline( WC_Order $order ) {
    foreach ( [ '_lamako_v2_reservation_expires_at', '_lamako_v2_checkout_expires_at' ] as $meta_key ) {
        $raw       = (string) $order->get_meta( $meta_key );
        $timestamp = $raw !== '' ? strtotime( $raw ) : false;
        if ( $timestamp ) {
            return (int) $timestamp;
        }
    }

    $created = $order->get_date_created();
    return $created ? $created->getTimestamp() + LAMAKO_MOBILE_V2_CHECKOUT_TTL : 0;
}

function lamako_mobile_v2_void_unpaid_ticket_instances( WC_Order $order ) {
    if ( lamako_mobile_v2_payment_is_confirmed( $order ) ) {
        return 0;
    }

    $instance_ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft' ],
        'post_parent'    => $order->get_id(),
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'no_found_rows'  => true,
    ] );

    foreach ( $instance_ids as $instance_id ) {
        wp_trash_post( absint( $instance_id ) );
    }

    return count( $instance_ids );
}

function lamako_mobile_v2_release_expired_order_seats( WC_Order $order ) {
    foreach ( $order->get_items() as $item ) {
        $seat_ids  = array_values( array_filter( array_map( 'trim', explode( ',', (string) $item->get_meta( '_lamako_seat_ids', true ) ) ) ) );
        $chart_ids = array_values( array_filter( array_map( 'absint', explode( ',', (string) $item->get_meta( '_lamako_chart_ids', true ) ) ) ) );
        foreach ( $seat_ids as $index => $seat_id ) {
            $chart_id = absint( $chart_ids[ $index ] ?? 0 );
            if ( $chart_id <= 0 ) {
                continue;
            }
            if ( function_exists( 'tc_remove_seat_from_firebase' ) ) {
                tc_remove_seat_from_firebase( $seat_id, $chart_id );
            }
            delete_transient( 'tc_seat_' . $chart_id . '_' . $seat_id );
            delete_transient( 'tc_cart_seat_' . $seat_id );
        }
    }

    if ( function_exists( 'lamako_cleanup_firebase_seats_for_order' ) ) {
        lamako_cleanup_firebase_seats_for_order( $order );
    }
}

function lamako_mobile_v2_expire_stale_orders() {
    if ( ! function_exists( 'wc_get_orders' ) ) {
        return;
    }

    $orders = wc_get_orders( [
        'status'       => [ 'pending', 'checkout-draft', 'on-hold' ],
        'date_created' => '<' . ( time() - LAMAKO_MOBILE_V2_CHECKOUT_TTL ),
        'limit'        => 100,
        'orderby'      => 'date',
        'order'        => 'ASC',
        'return'       => 'objects',
    ] );

    foreach ( $orders as $order ) {
        if ( ! $order instanceof WC_Order
            || 'yes' !== $order->get_meta( '_lamako_mobile_v2' )
            || lamako_mobile_v2_payment_is_confirmed( $order ) ) {
            continue;
        }

        $deadline = lamako_mobile_v2_order_reservation_deadline( $order );
        if ( $deadline <= 0 || $deadline > time() ) {
            continue;
        }

        if ( lamako_mobile_v2_order_has_protected_payment_attempt( $order ) ) {
            if ( lamako_mobile_v2_payment_verification_deadline( $order ) <= time() ) {
                lamako_mobile_v2_mark_payment_for_review( $order, 'Reservation expired while provider confirmation still requires reconciliation.' );
            }
            continue;
        }

        $fresh_order = wc_get_order( $order->get_id() );
        if ( ! $fresh_order instanceof WC_Order
            || lamako_mobile_v2_payment_is_confirmed( $fresh_order )
            || ! $fresh_order->has_status( [ 'pending', 'checkout-draft', 'on-hold' ] )
            || lamako_mobile_v2_order_has_protected_payment_attempt( $fresh_order ) ) {
            continue;
        }

        $voided = lamako_mobile_v2_void_unpaid_ticket_instances( $fresh_order );
        lamako_mobile_v2_release_expired_order_seats( $fresh_order );
        $fresh_order->update_status( 'cancelled', 'Lamako Mobile reservation expired before payment confirmation.' );
        if ( $voided > 0 ) {
            $fresh_order->add_order_note( sprintf( '%d prematurely issued ticket instance(s) were voided.', $voided ) );
        }
        $fresh_order->save();
    }
}

function lamako_mobile_v2_order_allows_ticket_display( WC_Order $order ) {
    if ( in_array( $order->get_status(), [ 'cancelled', 'failed', 'refunded', 'pending', 'on-hold' ], true ) ) {
        return false;
    }

    return lamako_mobile_v2_payment_is_confirmed( $order );
}

function lamako_mobile_v2_order_summary( WC_Order $order, $include_items = false, $include_tickets = false, $preloaded_tickets = null ) {
    $tickets = [];
    if ( lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        $tickets = is_array( $preloaded_tickets )
            ? $preloaded_tickets
            : lamako_mobile_v2_get_tickets_for_order( $order );
    }
    $payment_status = lamako_mobile_v2_normalize_payment_status( $order );
    $attempt_status = sanitize_key( $order->get_meta( '_lamako_v2_payment_attempt_status' ) );
    if ( ! lamako_mobile_v2_payment_is_confirmed( $order ) && $attempt_status === 'failed' ) {
        $payment_status = 'failed';
    } elseif ( ! lamako_mobile_v2_payment_is_confirmed( $order ) && in_array( $attempt_status, lamako_mobile_v2_payment_review_attempt_statuses(), true ) ) {
        $payment_status = 'review';
    } elseif ( ! lamako_mobile_v2_payment_is_confirmed( $order ) && in_array( $attempt_status, lamako_mobile_v2_payment_active_attempt_statuses(), true ) ) {
        $payment_status = 'pending';
    }
    $reservation_expires_at = (string) $order->get_meta( '_lamako_v2_reservation_expires_at' );
    if ( $reservation_expires_at === '' ) {
        $reservation_expires_at = (string) $order->get_meta( '_lamako_v2_checkout_expires_at' );
    }
    $data = [
        'id'                  => $order->get_id(),
        'number'              => $order->get_order_number(),
        'status'              => $order->get_status(),
        'paymentStatus'       => $payment_status,
        'total'               => $order->get_total(),
        'subtotal'            => method_exists( $order, 'get_subtotal' ) ? $order->get_subtotal() : '',
        'totalTax'            => $order->get_total_tax(),
        'discountTotal'       => $order->get_discount_total(),
        'couponCodes'         => array_values( $order->get_coupon_codes() ),
        'shippingTotal'       => $order->get_shipping_total(),
        'currency'            => $order->get_currency(),
        'dateCreated'         => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
        'datePaid'            => $order->get_date_paid() ? $order->get_date_paid()->date( 'c' ) : null,
        'paymentMethod'       => $order->get_payment_method(),
        'paymentMethodTitle'  => $order->get_payment_method_title(),
        'transactionId'       => $order->get_transaction_id(),
        'customerNote'        => $order->get_customer_note(),
        'ticketsReady'        => count( $tickets ) > 0,
        'ticketCount'         => count( $tickets ),
        'createdVia'          => $order->get_created_via(),
        'reservationExpiresAt'=> $reservation_expires_at !== '' ? $reservation_expires_at : null,
        'paymentAttemptStatus'=> $attempt_status !== '' ? $attempt_status : null,
        'paymentPendingUntil' => absint( $order->get_meta( '_lamako_v2_payment_pending_until' ) ) > 0
            ? gmdate( 'c', absint( $order->get_meta( '_lamako_v2_payment_pending_until' ) ) )
            : null,
        'paymentLastCheckedAt'=> absint( $order->get_meta( '_lamako_v2_payment_last_checked_at' ) ) > 0
            ? gmdate( 'c', absint( $order->get_meta( '_lamako_v2_payment_last_checked_at' ) ) )
            : null,
        'paymentPollCount'    => absint( $order->get_meta( '_lamako_v2_payment_poll_count' ) ),
        'requiresManualReview'=> 'review' === $payment_status,
    ];

    if ( $include_items ) {
        if ( $include_tickets ) {
            // Ticket counters already resolve these records. Returning them on
            // demand avoids one authenticated request per order on mobile.
            $data['tickets'] = $tickets;
        }
        $data['billing'] = [
            'firstName' => $order->get_billing_first_name(),
            'lastName'  => $order->get_billing_last_name(),
            'email'     => $order->get_billing_email(),
            'phone'     => $order->get_billing_phone(),
        ];
        $data['items'] = [];
        foreach ( $order->get_items() as $item_id => $item ) {
            $product = $item->get_product();
            $quantity = max( 1, (int) $item->get_quantity() );
            $seat_labels_raw = (string) $item->get_meta( '_lamako_seat_labels', true );
            if ( $seat_labels_raw === '' ) {
                $seat_labels_raw = (string) $item->get_meta( 'Place', true );
            }
            $seat_ids_raw = (string) $item->get_meta( '_lamako_seat_ids', true );
            $chart_ids_raw = (string) $item->get_meta( '_lamako_chart_ids', true );
            $seat_labels = array_values( array_filter( array_map( 'trim', explode( ',', $seat_labels_raw ) ) ) );
            $seat_ids = array_values( array_filter( array_map( 'trim', explode( ',', $seat_ids_raw ) ) ) );
            $chart_ids = array_values( array_filter( array_map( 'absint', explode( ',', $chart_ids_raw ) ) ) );
            $is_seating = ! empty( $seat_labels )
                || ( $product && 'yes' === get_post_meta( $product->get_id(), '_tc_used_for_seatings', true ) );
            $data['items'][] = [
                'id'         => $item_id,
                'name'       => html_entity_decode( $item->get_name(), ENT_QUOTES, 'UTF-8' ),
                'quantity'   => $quantity,
                'productId'  => $item->get_product_id(),
                'total'      => $item->get_total(),
                'subtotal'   => $item->get_subtotal(),
                'price'      => (float) $item->get_total() / $quantity,
                'sku'        => $product ? $product->get_sku() : '',
                'isSeating'  => $is_seating,
                'seatLabels' => $seat_labels,
                'seatIds'    => $seat_ids,
                'chartIds'   => $chart_ids,
            ];
        }
    }

    return $data;
}

function lamako_mobile_v2_get_checkout_status( WP_REST_Request $request ) {
    $order = lamako_mobile_v2_find_order_by_token( $request['token'] );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_checkout_not_found', 'Checkout not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this checkout.', [ 'status' => 403 ] );
    }

    $order_summary = lamako_mobile_v2_order_summary( $order, true );
    if ( lamako_mobile_v2_is_checkout_expired( $order ) && ! lamako_mobile_v2_order_has_protected_payment_attempt( $order ) && in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
        $order_summary['paymentStatus'] = 'expired';
    }

    return rest_ensure_response( [
        'checkoutToken' => $request['token'],
        'order'         => $order_summary,
    ] );
}

function lamako_mobile_v2_get_orders( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    $limit   = min( max( absint( $request->get_param( 'limit' ) ?: 20 ), 1 ), 50 );
    $page    = max( absint( $request->get_param( 'page' ) ?: 1 ), 1 );
    $status  = sanitize_text_field( $request->get_param( 'status' ) ?: '' );

    $args = [
        'customer_id' => $user_id,
        'limit'       => $limit,
        'paged'       => $page,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ];
    if ( $status !== '' ) {
        $args['status'] = array_map( 'trim', explode( ',', $status ) );
    }

    $include_tickets = rest_sanitize_boolean( $request->get_param( 'include_tickets' ) );
    $orders = wc_get_orders( $args );
    $ticket_map = $include_tickets ? lamako_mobile_v2_get_tickets_for_orders( $orders ) : [];
    $items  = array_map( function( $order ) use ( $include_tickets, $ticket_map ) {
        $preloaded_tickets = $include_tickets
            ? ( $ticket_map[ $order->get_id() ] ?? [] )
            : null;
        return lamako_mobile_v2_order_summary( $order, true, $include_tickets, $preloaded_tickets );
    }, $orders );

    return rest_ensure_response( [
        'orders' => $items,
        'page'   => $page,
        'limit'  => $limit,
    ] );
}

function lamako_mobile_v2_get_order( WP_REST_Request $request ) {
    $order = wc_get_order( absint( $request['order_id'] ) );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_order_not_found', 'Order not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this order.', [ 'status' => 403 ] );
    }

    return rest_ensure_response( lamako_mobile_v2_order_summary( $order, true ) );
}

function lamako_mobile_v2_ticket_item_context( WC_Order $order, $item ) {
    $product_id = $item->get_product_id();
    $event_id = (int) get_post_meta( $product_id, '_event_name', true );
    $event_date = $event_id ? lamako_mobile_v2_meta_first( $event_id, [ 'event_date_time', '_event_date_time', 'event_start_date', '_event_start_date' ], '' ) : '';
    $event_end_date = $event_id ? lamako_mobile_v2_meta_first( $event_id, [ 'event_end_date_time', '_event_end_date_time', 'event_end_date', '_event_end_date' ], '' ) : '';
    $event_location = $event_id ? ( get_post_meta( $event_id, 'event_location', true ) ?: get_post_meta( $event_id, '_event_location', true ) ) : '';
    $event_image = lamako_mobile_v2_ticket_event_image( $event_id, $product_id );
    $quantity = max( 1, (int) $item->get_quantity() );

    return [
        'orderId'       => $order->get_id(),
        'orderStatus'   => $order->get_status(),
        'productId'     => (int) $product_id,
        'productName'   => html_entity_decode( $item->get_name(), ENT_QUOTES, 'UTF-8' ),
        'price'         => (float) $item->get_total() / $quantity,
        'eventId'       => $event_id,
        'eventName'     => $event_id ? get_the_title( $event_id ) : '',
        'eventDate'     => is_scalar( $event_date ) ? (string) $event_date : '',
        'eventEndDate'  => is_scalar( $event_end_date ) ? (string) $event_end_date : '',
        'eventLocation' => is_scalar( $event_location ) ? html_entity_decode( (string) $event_location, ENT_QUOTES, 'UTF-8' ) : '',
        'eventImage'    => is_string( $event_image ) ? esc_url_raw( $event_image ) : '',
    ];
}

function lamako_mobile_v2_ticket_checkin_state( $instance_id ) {
    $checkins = get_post_meta( absint( $instance_id ), 'tc_checkins', true );
    if ( ! is_array( $checkins ) || empty( $checkins ) ) {
        return [
            'checkedIn'    => false,
            'checkedInAt'  => '',
            'checkinCount' => 0,
        ];
    }

    $checked_in    = false;
    $checked_in_at = 0;
    $checkin_count = 0;

    foreach ( $checkins as $checkin ) {
        if ( ! is_array( $checkin ) ) {
            continue;
        }

        $status    = sanitize_key( $checkin['status'] ?? 'checked_in' );
        $timestamp = absint( $checkin['date_checked'] ?? $checkin['date'] ?? 0 );

        if ( in_array( $status, [ 'checked_in', 'pass' ], true ) ) {
            $checked_in = true;
            $checkin_count++;
            if ( $timestamp > 0 ) {
                $checked_in_at = $timestamp;
            }
        } elseif ( $status === 'checked_out' ) {
            $checked_in    = false;
            $checked_in_at = 0;
        }
    }

    return [
        'checkedIn'    => $checked_in,
        'checkedInAt'  => $checked_in && $checked_in_at > 0 ? gmdate( 'c', $checked_in_at ) : '',
        'checkinCount' => $checkin_count,
    ];
}

function lamako_mobile_v2_ticket_instance_data( array $context, $instance_id ) {
    $wallet = function_exists( 'lamako_mobile_v2_wallet_availability' )
        ? lamako_mobile_v2_wallet_availability()
        : [ 'apple' => false, 'google' => false ];
    return array_merge( $context, lamako_mobile_v2_ticket_checkin_state( $instance_id ), [
        'instanceId' => (int) $instance_id,
        'ticketCode' => get_post_meta( $instance_id, 'ticket_code', true ),
        'seatLabel'  => get_post_meta( $instance_id, 'seat_label', true ),
        'seatId'     => get_post_meta( $instance_id, 'seat_id', true ),
        'status'     => get_post_status( $instance_id ),
        'appleWalletAvailable' => ! empty( $wallet['apple'] ),
        'googleWalletAvailable'=> ! empty( $wallet['google'] ),
    ] );
}

function lamako_mobile_v2_get_tickets_for_orders( array $orders ) {
    $tickets_by_order = [];
    $tickets_by_item = [];
    $item_contexts = [];
    $item_expected_counts = [];
    $order_item_ids = [];

    foreach ( $orders as $order ) {
        if ( ! $order instanceof WC_Order ) {
            continue;
        }

        $order_id = $order->get_id();
        $tickets_by_order[ $order_id ] = [];
        $order_item_ids[ $order_id ] = [];
        if ( ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
            continue;
        }

        foreach ( $order->get_items() as $item_id => $item ) {
            $product_id = $item->get_product_id();
            if ( get_post_meta( $product_id, '_tc_is_ticket', true ) !== 'yes' ) {
                continue;
            }

            $item_id = (int) $item_id;
            $item_contexts[ $item_id ] = lamako_mobile_v2_ticket_item_context( $order, $item );
            $tickets_by_item[ $item_id ] = [];
            $item_expected_counts[ $item_id ] = max( 1, (int) $item->get_quantity() );
            $order_item_ids[ $order_id ][] = $item_id;
        }
    }

    $instance_counts = [];
    if ( ! empty( $item_contexts ) ) {
        $instance_ids = get_posts( [
            'post_type'      => 'tc_tickets_instances',
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'no_found_rows'  => true,
            'meta_query'     => [
                [
                    'key'     => 'item_id',
                    'value'   => array_keys( $item_contexts ),
                    'compare' => 'IN',
                    'type'    => 'NUMERIC',
                ],
            ],
        ] );

        if ( ! empty( $instance_ids ) ) {
            update_meta_cache( 'post', $instance_ids );
        }

        foreach ( $instance_ids as $instance_id ) {
            $item_id = (int) get_post_meta( $instance_id, 'item_id', true );
            if ( ! isset( $item_contexts[ $item_id ] ) ) {
                continue;
            }

            $tickets_by_item[ $item_id ][] = lamako_mobile_v2_ticket_instance_data( $item_contexts[ $item_id ], $instance_id );
            $instance_counts[ $item_id ] = ( $instance_counts[ $item_id ] ?? 0 ) + 1;
        }
    }

    foreach ( $orders as $order ) {
        if ( ! $order instanceof WC_Order || ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
            continue;
        }

        $order_id = $order->get_id();
        $use_legacy_fallback = false;
        foreach ( $order_item_ids[ $order_id ] ?? [] as $item_id ) {
            if ( ( $instance_counts[ $item_id ] ?? 0 ) < $item_expected_counts[ $item_id ] ) {
                // Preserve compatibility with legacy Tickera orders that only
                // link instances through tc_orders and post_parent.
                $tickets_by_order[ $order_id ] = lamako_mobile_v2_get_tickets_for_order( $order );
                $use_legacy_fallback = true;
                break;
            }
        }
        if ( $use_legacy_fallback ) {
            continue;
        }

        foreach ( $order_item_ids[ $order_id ] ?? [] as $item_id ) {
            $tickets_by_order[ $order_id ] = array_merge(
                $tickets_by_order[ $order_id ],
                $tickets_by_item[ $item_id ] ?? []
            );
        }
    }

    return $tickets_by_order;
}

function lamako_mobile_v2_get_tickets_for_order( WC_Order $order ) {
    $tickets = [];

    if ( ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        return $tickets;
    }

    foreach ( $order->get_items() as $item_id => $item ) {
        $product_id = $item->get_product_id();
        if ( get_post_meta( $product_id, '_tc_is_ticket', true ) !== 'yes' ) {
            continue;
        }

        $instance_ids = get_posts( [
            'post_type'      => 'tc_tickets_instances',
            'post_status'    => 'any',
            'posts_per_page' => max( 1, $item->get_quantity() ) + 5,
            'fields'         => 'ids',
            'meta_query'     => [
                [
                    'key'   => 'item_id',
                    'value' => $item_id,
                ],
            ],
        ] );

        if ( empty( $instance_ids ) ) {
            $tc_order_ids = get_posts( [
                'post_type'      => 'tc_orders',
                'post_status'    => 'any',
                'posts_per_page' => 5,
                'fields'         => 'ids',
                'meta_query'     => [
                    [
                        'key'   => 'tc_wc_order_id',
                        'value' => $order->get_id(),
                    ],
                ],
            ] );

            foreach ( $tc_order_ids as $tc_order_id ) {
                $children = get_posts( [
                    'post_type'      => 'tc_tickets_instances',
                    'post_status'    => 'any',
                    'post_parent'    => $tc_order_id,
                    'posts_per_page' => -1,
                    'fields'         => 'ids',
                    'meta_query'     => [
                        [
                            'key'   => 'ticket_type_id',
                            'value' => $product_id,
                        ],
                    ],
                ] );
                $instance_ids = array_merge( $instance_ids, $children );
            }
        }

        $context = lamako_mobile_v2_ticket_item_context( $order, $item );
        foreach ( array_unique( $instance_ids ) as $instance_id ) {
            $tickets[] = lamako_mobile_v2_ticket_instance_data( $context, $instance_id );
        }
    }

    return $tickets;
}

function lamako_mobile_v2_get_order_tickets_route( WP_REST_Request $request ) {
    $order = wc_get_order( absint( $request['order_id'] ) );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_order_not_found', 'Order not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access tickets for this order.', [ 'status' => 403 ] );
    }

    if ( ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        return rest_ensure_response( [
            'orderId'      => $order->get_id(),
            'orderStatus'  => $order->get_status(),
            'ticketsReady' => false,
            'tickets'      => [],
        ] );
    }

    $tickets = lamako_mobile_v2_get_tickets_for_order( $order );

    return rest_ensure_response( [
        'orderId'      => $order->get_id(),
        'orderStatus'  => $order->get_status(),
        'ticketsReady' => count( $tickets ) > 0,
        'tickets'      => $tickets,
    ] );
}

function lamako_mobile_v2_register_push_token( WP_REST_Request $request ) {
    $body     = $request->get_json_params();
    $body     = is_array( $body ) ? $body : [];
    $token    = sanitize_text_field( $body['token'] ?? '' );
    $platform = sanitize_text_field( $body['platform'] ?? 'unknown' );
    $device_id = sanitize_text_field( $body['deviceId'] ?? $body['device_id'] ?? '' );
    $has_preferences = isset( $body['preferences'] ) && is_array( $body['preferences'] );
    $preference_input = $has_preferences ? $body['preferences'] : [];
    $preferences = [
        'newEvents'      => ! array_key_exists( 'newEvents', $preference_input ) || rest_sanitize_boolean( $preference_input['newEvents'] ),
        'orderUpdates'   => ! array_key_exists( 'orderUpdates', $preference_input ) || rest_sanitize_boolean( $preference_input['orderUpdates'] ),
        'eventReminders' => ! array_key_exists( 'eventReminders', $preference_input ) || rest_sanitize_boolean( $preference_input['eventReminders'] ),
        'promotions'     => ! array_key_exists( 'promotions', $preference_input ) || rest_sanitize_boolean( $preference_input['promotions'] ),
    ];
    $user_id  = get_current_user_id();

    if ( $token === '' ) {
        return new WP_Error( 'lamako_v2_push_token_required', 'Push token is required.', [ 'status' => 400 ] );
    }

    $tokens = get_option( 'lamako_push_tokens', [] );
    if ( ! is_array( $tokens ) ) {
        $tokens = [];
    }

    $found = false;
    foreach ( $tokens as &$existing ) {
        if ( isset( $existing['token'] ) && $existing['token'] === $token ) {
            $existing['user_id']    = $user_id;
            $existing['platform']   = $platform;
            $existing['device_id']  = $device_id;
            if ( $has_preferences || ! isset( $existing['preferences'] ) || ! is_array( $existing['preferences'] ) ) {
                $existing['preferences'] = $preferences;
            }
            $existing['updated_at'] = current_time( 'mysql' );
            $found = true;
            break;
        }
    }
    unset( $existing );

    if ( ! $found ) {
        $tokens[] = [
            'token'      => $token,
            'user_id'    => $user_id,
            'platform'   => $platform,
            'device_id'  => $device_id,
            'preferences' => $preferences,
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        ];
    }

    update_option( 'lamako_push_tokens', $tokens, false );

    return rest_ensure_response( [ 'success' => true ] );
}

function lamako_mobile_v2_unregister_push_token( WP_REST_Request $request ) {
    $body    = $request->get_json_params();
    $body    = is_array( $body ) ? $body : [];
    $token   = sanitize_text_field( $body['token'] ?? '' );
    $user_id = get_current_user_id();

    if ( $token === '' ) {
        return new WP_Error( 'lamako_v2_push_token_required', 'Push token is required.', [ 'status' => 400 ] );
    }

    $tokens = get_option( 'lamako_push_tokens', [] );
    $tokens = is_array( $tokens ) ? $tokens : [];
    $kept   = array_values( array_filter( $tokens, static function ( $entry ) use ( $token, $user_id ) {
        if ( ! is_array( $entry ) ) {
            return false;
        }
        return ! ( ( $entry['token'] ?? '' ) === $token && (int) ( $entry['user_id'] ?? 0 ) === $user_id );
    } ) );

    update_option( 'lamako_push_tokens', $kept, false );

    return rest_ensure_response( [
        'success' => true,
        'removed' => count( $tokens ) - count( $kept ),
    ] );
}

function lamako_mobile_v2_rewards_balance() {
    $user_id = get_current_user_id();
    if ( ! function_exists( 'mycred_get_users_balance' ) ) {
        return new WP_Error( 'lamako_v2_mycred_missing', 'myCred is not available.', [ 'status' => 500 ] );
    }

    $balance = mycred_get_users_balance( $user_id );
    $total   = function_exists( 'lr_get_total_earned' ) ? lr_get_total_earned( $user_id ) : (float) get_user_meta( $user_id, 'mycred_default_total', true );
    $tier    = function_exists( 'lr_get_tier' ) ? lr_get_tier( $total ) : 'fan';

    return rest_ensure_response( [
        'userId'           => $user_id,
        'balance'          => (float) $balance,
        'totalEarned'      => (float) $total,
        'tier'             => $tier,
        'tierName'         => function_exists( 'lr_get_tier_name' ) ? lr_get_tier_name( $tier ) : ucfirst( $tier ),
        'nextTier'         => function_exists( 'lr_get_next_tier' ) ? lr_get_next_tier( $tier ) : '',
        'pointsToNextTier' => function_exists( 'lr_get_points_to_next_tier' ) ? lr_get_points_to_next_tier( $total ) : 0,
        'canRedeem'        => defined( 'LR_REDEMPTION_MIN_LIFETIME' ) ? $total >= LR_REDEMPTION_MIN_LIFETIME : false,
    ] );
}

function lamako_mobile_v2_rewards_config( WP_REST_Request $request ) {
    if ( function_exists( 'lr_rewards_public_config' ) ) {
        return rest_ensure_response( lr_rewards_public_config( 'mobile' ) );
    }

    return rest_ensure_response( [
        'version' => 1,
        'platform' => 'mobile',
        'program' => [
            'enabled' => true,
            'signup_bonus_points' => 100,
            'earn_rate' => [
                'points' => 1,
                'amount_ariary' => 1000,
            ],
            'minimum_redeem_points' => 750,
            'redemption_options' => [
                [ 'points' => 1000, 'amount_ariary' => 20000 ],
                [ 'points' => 2000, 'amount_ariary' => 40000 ],
            ],
            'referral' => [
                'referrer_points' => 75,
                'referred_points' => 25,
            ],
        ],
        'popup' => [
            'mobile' => [
                'enabled' => true,
                'audience' => 'guests',
                'delay_seconds' => 12,
                'frequency_days' => 7,
                'max_impressions_per_user' => 3,
                'cta_route' => '/rewards',
            ],
        ],
        'copy' => [
            'earn_message' => 'Gagnez des points sur vos achats eligibles.',
            'redeem_message' => 'Utilisez vos points sur les evenements et offres participants Lamako Rewards.',
            'minimum_redeem_message' => 'Les reductions Rewards sont debloquees a partir de 750 points.',
        ],
    ] );
}

function lamako_mobile_v2_rewards_is_order_ref( $ref, $description = '' ) {
    $ref         = strtolower( (string) $ref );
    $description = strtolower( (string) $description );

    return strpos( $ref, 'woocommerce' ) !== false
        || strpos( $ref, 'order' ) !== false
        || strpos( $ref, 'purchase' ) !== false
        || preg_match( '/(?:order|commande)\s*#?\d+/i', $description );
}

function lamako_mobile_v2_rewards_order_reference( $ref_id, $description = '', $ref = '' ) {
    if ( ! lamako_mobile_v2_rewards_is_order_ref( $ref, $description ) ) {
        return [ 0, '' ];
    }

    $order_id = absint( $ref_id );
    if ( ! $order_id && preg_match( '/(?:order|commande|#)\s*#?(\d+)/i', (string) $description, $matches ) ) {
        $order_id = absint( $matches[1] );
    }

    if ( ! $order_id ) {
        return [ 0, '' ];
    }

    $number = $order_id;
    if ( function_exists( 'wc_get_order' ) ) {
        $order = wc_get_order( $order_id );
        if ( $order ) {
            $number = $order->get_order_number();
        }
    }

    return [ $order_id, sprintf( 'Commande #%s', $number ) ];
}

function lamako_mobile_v2_rewards_history_description( $row ) {
    $ref         = strtolower( (string) $row->type );
    $points      = (float) $row->points;
    $raw         = trim( wp_strip_all_tags( (string) $row->description ) );
    $raw         = trim( preg_replace( '/%[a-zA-Z0-9_]+%/', '', $raw ) );
    [ $order_id, $order_reference ] = lamako_mobile_v2_rewards_order_reference( $row->ref_id ?? 0, $raw, $ref );

    if ( $points < 0 ) {
        if ( strpos( $ref, 'redeem' ) !== false || strpos( $ref, 'redemption' ) !== false || strpos( $ref, 'coupon' ) !== false || strpos( $ref, 'reward' ) !== false ) {
            if ( preg_match( '/(\d+)\s*pts?/i', $raw, $matches ) ) {
                return sprintf( 'Réduction LamakoRewards : %s points utilisés', number_format_i18n( (int) $matches[1] ) );
            }
            return $order_reference ? 'Points utilisés - ' . $order_reference : 'Points utilisés pour une réduction';
        }
        return $order_reference ? 'Points débités - ' . $order_reference : 'Points débités';
    }

    if ( lamako_mobile_v2_rewards_is_order_ref( $ref, $raw ) ) {
        $parts   = [];
        $parts[] = $order_reference ? 'Achat ' . $order_reference : 'Achat validé';
        if ( preg_match( '/\(([0-9\s,.]+)\s*Ar\)/i', $raw, $matches ) ) {
            $parts[] = trim( $matches[1] ) . ' Ar';
        }
        if ( preg_match( '/x([0-9]+(?:\.[0-9]+)?)/i', $raw, $matches ) ) {
            $parts[] = 'multiplicateur x' . $matches[1];
        }
        $parts[] = '+' . number_format_i18n( abs( $points ) ) . ' pts';
        return implode( ' - ', $parts );
    }
    if ( strpos( $ref, 'registration' ) !== false || strpos( $ref, 'register' ) !== false || strpos( $ref, 'signup' ) !== false ) {
        return 'Bonus de bienvenue';
    }
    if ( strpos( $ref, 'referral' ) !== false || strpos( $ref, 'parrain' ) !== false ) {
        return 'Bonus de parrainage';
    }
    if ( strpos( $ref, 'login' ) !== false ) {
        return 'Bonus de connexion';
    }
    if ( strpos( $ref, 'attendance' ) !== false || strpos( $ref, 'scan' ) !== false ) {
        return 'Bonus présence événement';
    }
    if ( strpos( $ref, 'review' ) !== false || strpos( $ref, 'avis' ) !== false ) {
        return 'Bonus avis';
    }
    if ( strpos( $ref, 'birthday' ) !== false || strpos( $ref, 'anniversaire' ) !== false ) {
        return 'Bonus anniversaire';
    }

    if ( $raw ) {
        $translated = str_ireplace(
            [ 'Points for order', 'Product Purchase', 'Purchase', 'Order', 'Manual adjustment', 'Point payout', 'points', 'redemption', 'redeem' ],
            [ 'Points pour commande', 'Achat produit', 'Achat', 'Commande', 'Ajustement manuel', 'Attribution de points', 'points', 'réduction', 'échange' ],
            $raw
        );
        return $translated;
    }

    return 'Mouvement de points';
}

function lamako_mobile_v2_rewards_history( WP_REST_Request $request ) {
    global $wpdb;
    $user_id = get_current_user_id();
    $limit   = min( max( absint( $request->get_param( 'limit' ) ?: 20 ), 1 ), 100 );
    $table   = $wpdb->prefix . 'myCRED_log';

    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, ref AS type, ref_id, creds AS points, entry AS description, time FROM {$table} WHERE user_id = %d ORDER BY time DESC, id DESC LIMIT %d",
        $user_id,
        $limit
    ) );

    $history = [];
    foreach ( $results as $row ) {
        [ $order_id, $order_reference ] = lamako_mobile_v2_rewards_order_reference( $row->ref_id ?? 0, $row->description ?? '', $row->type ?? '' );
        $history[] = [
            'id'          => (string) $row->id,
            'type'        => (float) $row->points >= 0 ? 'earn' : 'redeem',
            'reference'   => $order_reference ?: (string) $row->type,
            'orderId'     => $order_id,
            'amount'      => abs( (float) $row->points ),
            'description' => lamako_mobile_v2_rewards_history_description( $row ),
            'date'        => wp_date( 'c', (int) $row->time ),
        ];
    }

    // myCred only records purchases that actually earned points. Merge paid
    // WooCommerce purchases so low-value orders and historical purchases are
    // still visible in the Rewards activity without creating fake credits.
    if ( function_exists( 'wc_get_orders' ) ) {
        $seen_order_ids = [];
        foreach ( $history as $entry ) {
            if ( ! empty( $entry['orderId'] ) ) {
                $seen_order_ids[ absint( $entry['orderId'] ) ] = true;
            }
        }
        $orders = wc_get_orders( [
            'customer_id' => $user_id,
            'status'      => [ 'processing', 'completed', 'cs-complete' ],
            'limit'       => $limit,
            'orderby'     => 'date',
            'order'       => 'DESC',
            'return'      => 'objects',
        ] );
        foreach ( $orders as $order ) {
            if ( ! $order instanceof WC_Order || ! lamako_mobile_v2_payment_is_confirmed( $order ) || isset( $seen_order_ids[ $order->get_id() ] ) ) {
                continue;
            }
            $points = max( 0, (float) $order->get_meta( '_lamako_points_awarded', true ) );
            $date   = $order->get_date_paid() ?: $order->get_date_created();
            $total  = number_format_i18n( (float) $order->get_total(), 0 );
            $history[] = [
                'id'          => 'order-' . $order->get_id(),
                'type'        => 'earn',
                'reference'   => sprintf( 'Commande #%s', $order->get_order_number() ),
                'orderId'     => $order->get_id(),
                'amount'      => $points,
                'description' => $points > 0
                    ? sprintf( 'Achat Commande #%s - %s Ar - +%s pts', $order->get_order_number(), $total, number_format_i18n( $points ) )
                    : sprintf( 'Achat Commande #%s - %s Ar - aucun point attribué', $order->get_order_number(), $total ),
                'date'        => $date ? $date->date( 'c' ) : wp_date( 'c' ),
            ];
        }
        usort( $history, static function ( $left, $right ) {
            return strtotime( (string) $right['date'] ) <=> strtotime( (string) $left['date'] );
        } );
        $history = array_slice( $history, 0, $limit );
    }

    return rest_ensure_response( [ 'history' => $history ] );
}

function lamako_mobile_v2_rewards_redeem( WP_REST_Request $request ) {
    if ( ! function_exists( 'mycred_get_users_balance' ) || ! function_exists( 'mycred_subtract' ) ) {
        return new WP_Error( 'lamako_v2_mycred_missing', 'myCred is not available.', [ 'status' => 500 ] );
    }
    if ( ! class_exists( 'WC_Coupon' ) ) {
        return new WP_Error( 'lamako_v2_wc_missing', 'WooCommerce is not available.', [ 'status' => 500 ] );
    }

    $body    = $request->get_json_params();
    $body    = is_array( $body ) ? $body : [];
    $user_id = get_current_user_id();
    $points  = absint( $body['points'] ?? 0 );

    $minimum_redeem_points = function_exists( 'lr_rewards_minimum_redeem_points' ) ? lr_rewards_minimum_redeem_points() : 750;
    $valid_tiers = [];
    if ( function_exists( 'lr_rewards_redemption_options' ) ) {
        foreach ( lr_rewards_redemption_options() as $option ) {
            $option_points = absint( $option['points'] ?? 0 );
            $option_value  = absint( $option['amount_ariary'] ?? $option['value'] ?? 0 );
            if ( $option_points > 0 && $option_value > 0 ) {
                $valid_tiers[ $option_points ] = $option_value;
            }
        }
    }
    if ( empty( $valid_tiers ) ) {
        $valid_tiers = [ 1000 => 20000, 2000 => 40000 ];
    }

    if ( ! isset( $valid_tiers[ $points ] ) ) {
        return new WP_Error( 'lamako_v2_invalid_reward_points', 'Invalid redemption tier.', [ 'status' => 400 ] );
    }

    $total_earned = function_exists( 'lr_get_total_earned' ) ? lr_get_total_earned( $user_id ) : (float) get_user_meta( $user_id, 'mycred_default_total', true );
    if ( $total_earned < $minimum_redeem_points ) {
        return new WP_Error( 'lamako_v2_rewards_locked', 'Rewards redemption is not unlocked for this account.', [ 'status' => 403 ] );
    }

    $balance = mycred_get_users_balance( $user_id );
    if ( $balance < $minimum_redeem_points ) {
        return new WP_Error( 'lamako_v2_rewards_minimum_balance_required', 'Rewards redemption requires at least 750 available points.', [ 'status' => 403 ] );
    }
    if ( $balance < $points ) {
        return new WP_Error( 'lamako_v2_insufficient_points', 'Insufficient rewards balance.', [ 'status' => 400 ] );
    }

    $idempotency_key = sanitize_text_field( $body['idempotencyKey'] ?? $body['idempotency_key'] ?? '' );
    if ( $idempotency_key !== '' ) {
        $existing = get_user_meta( $user_id, '_lamako_v2_reward_redeem_' . md5( $idempotency_key ), true );
        if ( is_array( $existing ) && ! empty( $existing['couponCode'] ) ) {
            return rest_ensure_response( $existing );
        }
    }

    $discount_value = $valid_tiers[ $points ];
    mycred_subtract( 'redemption', $user_id, $points, sprintf( 'Lamako Mobile v2 redemption %d pts', $points ) );

    $coupon_code = 'LR-' . strtoupper( wp_generate_password( 8, false ) );
    $coupon = new WC_Coupon();
    $coupon->set_code( $coupon_code );
    $coupon->set_discount_type( 'fixed_cart' );
    $coupon->set_amount( $discount_value );
    $coupon->set_usage_limit( 1 );
    $coupon->set_usage_limit_per_user( 1 );
    $coupon->set_date_expires( strtotime( '+30 days' ) );
    $coupon->set_description( sprintf( 'Lamako Mobile v2 rewards coupon for user #%d, %d points.', $user_id, $points ) );
    $coupon->save();

    $response = [
        'success'       => true,
        'couponCode'    => $coupon_code,
        'discountValue' => $discount_value,
        'pointsDeducted'=> $points,
        'newBalance'    => mycred_get_users_balance( $user_id ),
        'expiresAt'     => date( 'c', strtotime( '+30 days' ) ),
    ];

    if ( $idempotency_key !== '' ) {
        update_user_meta( $user_id, '_lamako_v2_reward_redeem_' . md5( $idempotency_key ), $response );
    }

    return rest_ensure_response( $response );
}

function lamako_mobile_v2_referral_code() {
    $user_id = get_current_user_id();
    if ( function_exists( 'lr_generate_referral_code' ) ) {
        $code = lr_generate_referral_code( $user_id );
    } else {
        $code = get_user_meta( $user_id, '_lamako_referral_code', true );
        if ( ! $code ) {
            $code = 'TBL-' . strtoupper( wp_generate_password( 8, false ) );
            update_user_meta( $user_id, '_lamako_referral_code', $code );
        }
    }

    return rest_ensure_response( [
        'code'          => $code,
        'referralCount' => (int) get_user_meta( $user_id, '_lamako_referral_count', true ),
    ] );
}

function lamako_mobile_v2_referral_bonus_value() {
    return defined( 'LR_REFEREE_BONUS' ) ? (int) LR_REFEREE_BONUS : 25;
}

function lamako_mobile_v2_find_referrer_by_code( $code ) {
    global $wpdb;
    $code = sanitize_text_field( $code );
    if ( $code === '' ) {
        return 0;
    }

    return (int) $wpdb->get_var( $wpdb->prepare(
        "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_lamako_referral_code' AND meta_value = %s LIMIT 1",
        $code
    ) );
}

function lamako_mobile_v2_validate_referral_code( WP_REST_Request $request ) {
    $body = $request->get_json_params();
    $body = is_array( $body ) ? $body : [];
    $code = sanitize_text_field( $body['code'] ?? '' );

    if ( $code === '' ) {
        return new WP_Error( 'lamako_v2_missing_referral_code', 'Referral code is required.', [ 'status' => 400 ] );
    }

    $referrer_id = lamako_mobile_v2_find_referrer_by_code( $code );
    if ( $referrer_id <= 0 ) {
        return rest_ensure_response( [
            'valid'   => false,
            'message' => 'Code invalide.',
        ] );
    }

    $user = get_userdata( $referrer_id );
    return rest_ensure_response( [
        'valid'        => true,
        'referrerName' => $user ? $user->display_name : 'Utilisateur',
        'bonus'        => lamako_mobile_v2_referral_bonus_value(),
    ] );
}

function lamako_mobile_v2_register_referral( WP_REST_Request $request ) {
    $body = $request->get_json_params();
    $body = is_array( $body ) ? $body : [];
    $code = sanitize_text_field( $body['referrerCode'] ?? $body['referrer_code'] ?? '' );

    if ( $code === '' ) {
        return new WP_Error( 'lamako_v2_missing_referral_code', 'Referral code is required.', [ 'status' => 400 ] );
    }

    $user_id = get_current_user_id();
    if ( $user_id <= 0 ) {
        return new WP_Error( 'lamako_v2_not_authenticated', 'Authentication required.', [ 'status' => 401 ] );
    }

    if ( function_exists( 'lr_register_referral' ) ) {
        $result = lr_register_referral( $user_id, $code );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( [
            'success'      => ! empty( $result['success'] ),
            'referrerId'   => (int) ( $result['referrer_id'] ?? 0 ),
            'refereeBonus' => (int) ( $result['referee_bonus'] ?? lamako_mobile_v2_referral_bonus_value() ),
        ] );
    }

    $referrer_id = lamako_mobile_v2_find_referrer_by_code( $code );
    if ( $referrer_id <= 0 ) {
        return new WP_Error( 'lamako_v2_invalid_referral_code', 'Code de parrainage invalide.', [ 'status' => 400 ] );
    }
    if ( $referrer_id === $user_id ) {
        return new WP_Error( 'lamako_v2_self_referral', 'Vous ne pouvez pas vous parrainer vous-meme.', [ 'status' => 400 ] );
    }
    if ( get_user_meta( $user_id, '_lamako_referred_by', true ) ) {
        return new WP_Error( 'lamako_v2_already_referred', 'Vous avez deja un parrain.', [ 'status' => 409 ] );
    }

    update_user_meta( $user_id, '_lamako_referred_by', $referrer_id );
    update_user_meta( $user_id, '_lamako_referral_code_used', $code );
    update_user_meta( $user_id, '_lamako_referral_date', current_time( 'mysql' ) );
    update_user_meta( $referrer_id, '_lamako_referral_count', (int) get_user_meta( $referrer_id, '_lamako_referral_count', true ) + 1 );

    $bonus = lamako_mobile_v2_referral_bonus_value();
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'referral_signup', $user_id, $bonus, 'Bonus parrainage (inscription)' );
    }

    return rest_ensure_response( [
        'success'      => true,
        'referrerId'   => $referrer_id,
        'refereeBonus' => $bonus,
    ] );
}
