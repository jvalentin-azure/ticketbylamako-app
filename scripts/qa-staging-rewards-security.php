<?php
/**
 * Staging-only Rewards security smoke test.
 *
 * Run with:
 *   wp eval-file scripts/qa-staging-rewards-security.php
 *
 * The script creates one synthetic user, credits synthetic myCred points,
 * exercises JWT object authorization and redemption idempotency, then removes
 * the coupon, idempotency ledger, myCred log entries and user in finally.
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
    fwrite( STDERR, "This script must run through WP-CLI.\n" );
    exit( 1 );
}

$site_host = (string) wp_parse_url( home_url(), PHP_URL_HOST );
if ( 'staging.ticketbylamako.com' !== strtolower( $site_host ) ) {
    WP_CLI::error( 'Refusing to run Rewards QA outside TicketByLamako staging.' );
}

if ( ! function_exists( 'lr_redeem_points_for_user' ) || ! function_exists( 'mycred_add' ) ) {
    WP_CLI::error( 'Required Rewards or myCred functions are unavailable.' );
}

function tblqa_rewards_assert( $condition, $message ) {
    if ( ! $condition ) {
        throw new RuntimeException( $message );
    }
}

function tblqa_rewards_base64url( $value ) {
    return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
}

function tblqa_rewards_jwt( $user_id ) {
    $issued_at = time();
    $header    = tblqa_rewards_base64url( wp_json_encode( array( 'typ' => 'JWT', 'alg' => 'HS256' ) ) );
    $payload   = tblqa_rewards_base64url( wp_json_encode( array(
        'iss'  => home_url(),
        'iat'  => $issued_at,
        'nbf'  => $issued_at - 1,
        'exp'  => $issued_at + 600,
        'data' => array( 'user' => array( 'id' => (int) $user_id ) ),
    ) ) );
    $secret    = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : wp_salt( 'auth' );
    $signature = tblqa_rewards_base64url( hash_hmac( 'sha256', $header . '.' . $payload, $secret, true ) );
    return $header . '.' . $payload . '.' . $signature;
}

function tblqa_rewards_request( $method, $route, $jwt = '', $body = array(), $idempotency_key = '' ) {
    $request = new WP_REST_Request( $method, $route );
    if ( $jwt ) {
        $request->set_header( 'Authorization', 'Bearer ' . $jwt );
    }
    if ( $idempotency_key ) {
        $request->set_header( 'Idempotency-Key', $idempotency_key );
    }
    if ( ! empty( $body ) ) {
        $request->set_header( 'Content-Type', 'application/json' );
        $request->set_body( wp_json_encode( $body ) );
    }
    return rest_do_request( $request );
}

global $wpdb;

$suffix             = strtolower( wp_generate_password( 10, false, false ) );
$username           = 'tblqa_rewards_' . $suffix;
$email              = $username . '@example.invalid';
$user_id            = 0;
$coupon_id          = 0;
$idempotency_option = '';
$failure            = null;

try {
    $user_id = wp_create_user( $username, wp_generate_password( 32, true, true ), $email );
    tblqa_rewards_assert( ! is_wp_error( $user_id ) && (int) $user_id > 0, 'Unable to create the synthetic Rewards user.' );
    $user_id = (int) $user_id;

    $options = function_exists( 'lr_rewards_redemption_options' ) ? lr_rewards_redemption_options() : array(
        array( 'points' => 1000, 'value' => 20000 ),
        array( 'points' => 2000, 'value' => 40000 ),
    );
    $tiers = array_values( array_unique( array_filter( array_map( static function( $option ) {
        return absint( $option['points'] ?? 0 );
    }, is_array( $options ) ? $options : array() ) ) ) );
    sort( $tiers, SORT_NUMERIC );
    tblqa_rewards_assert( count( $tiers ) >= 2, 'At least two configured redemption tiers are required for the conflict test.' );

    $points          = $tiers[0];
    $conflict_points = $tiers[1];
    $seed_points     = max( 5000, $conflict_points + 1000 );
    $credited        = mycred_add( 'tblqa_rewards_seed', $user_id, $seed_points, 'Synthetic staging Rewards security QA.' );
    tblqa_rewards_assert( (bool) $credited, 'Unable to seed synthetic Rewards points.' );

    $jwt             = tblqa_rewards_jwt( $user_id );
    $idempotency_key = 'tblqa-' . wp_generate_uuid4();
    $context         = lr_rewards_idempotency_context( $user_id, $points, $idempotency_key );
    tblqa_rewards_assert( is_array( $context ) && ! empty( $context['option_name'] ), 'Unable to derive the idempotency ledger key.' );
    $idempotency_option = (string) $context['option_name'];

    $balance_before = (float) mycred_get_users_balance( $user_id );
    $first          = tblqa_rewards_request(
        'POST',
        '/lamako-rewards/v1/redeem',
        $jwt,
        array( 'user_id' => $user_id, 'points' => $points ),
        $idempotency_key
    );
    $first_data = $first->get_data();
    tblqa_rewards_assert( 200 === $first->get_status(), 'Initial redemption did not return HTTP 200.' );
    tblqa_rewards_assert( is_array( $first_data ) && ! empty( $first_data['coupon_code'] ), 'Initial redemption returned no coupon.' );
    $coupon_id = (int) wc_get_coupon_id_by_code( (string) $first_data['coupon_code'] );
    tblqa_rewards_assert( $coupon_id > 0, 'The returned coupon does not exist.' );

    $coupon = new WC_Coupon( $coupon_id );
    tblqa_rewards_assert( 1 === (int) $coupon->get_usage_limit(), 'Coupon usage limit is not one.' );
    tblqa_rewards_assert( in_array( $email, $coupon->get_email_restrictions(), true ), 'Coupon is not restricted to the synthetic user email.' );
    tblqa_rewards_assert( (int) get_post_meta( $coupon_id, '_lamako_rewards_user_id', true ) === $user_id, 'Coupon user binding is missing.' );

    $balance_after_first = (float) mycred_get_users_balance( $user_id );
    tblqa_rewards_assert( abs( ( $balance_before - $points ) - $balance_after_first ) < 0.001, 'The first redemption did not debit exactly once.' );

    $replay      = tblqa_rewards_request(
        'POST',
        '/lamako-rewards/v1/redeem',
        $jwt,
        array( 'user_id' => $user_id, 'points' => $points ),
        $idempotency_key
    );
    $replay_data = $replay->get_data();
    tblqa_rewards_assert( 200 === $replay->get_status(), 'Idempotent replay did not return HTTP 200.' );
    tblqa_rewards_assert( ! empty( $replay_data['idempotent_replay'] ), 'Idempotent replay was not identified.' );
    tblqa_rewards_assert( (string) $first_data['coupon_code'] === (string) $replay_data['coupon_code'], 'Replay returned a different coupon.' );
    tblqa_rewards_assert( abs( $balance_after_first - (float) mycred_get_users_balance( $user_id ) ) < 0.001, 'Replay debited the balance again.' );

    $conflict = tblqa_rewards_request(
        'POST',
        '/lamako-rewards/v1/redeem',
        $jwt,
        array( 'user_id' => $user_id, 'points' => $conflict_points ),
        $idempotency_key
    );
    tblqa_rewards_assert( 409 === $conflict->get_status(), 'Reusing the key for another tier was not rejected.' );

    $other_user_request = new WP_REST_Request( 'GET', '/lamako-rewards/v1/balance' );
    $other_user_request->set_header( 'Authorization', 'Bearer ' . $jwt );
    $other_user_request->set_query_params( array( 'user_id' => $user_id + 1000000 ) );
    $other_user = rest_do_request( $other_user_request );
    tblqa_rewards_assert( 403 === $other_user->get_status(), 'JWT object authorization did not reject another user ID.' );

    if ( defined( 'LR_API_KEY' ) && LR_API_KEY ) {
        $legacy = new WP_REST_Request( 'GET', '/lamako-rewards/v1/balance' );
        $legacy->set_query_params( array( 'user_id' => $user_id, 'api_key' => LR_API_KEY ) );
        $legacy_response = rest_do_request( $legacy );
        tblqa_rewards_assert( 403 === $legacy_response->get_status(), 'A legacy API key was accepted on a user-scoped route.' );
    }

    WP_CLI::success( 'Rewards security smoke passed: JWT binding, single debit, coupon binding, replay and conflict checks.' );
} catch ( Throwable $error ) {
    $failure = $error;
} finally {
    if ( $idempotency_option ) {
        $coupon_ids = get_posts( array(
            'post_type'      => 'shop_coupon',
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'meta_query'     => array(
                array( 'key' => '_lamako_rewards_idempotency_hash', 'value' => $idempotency_option ),
            ),
        ) );
        foreach ( $coupon_ids as $fixture_coupon_id ) {
            wp_delete_post( (int) $fixture_coupon_id, true );
        }
        delete_option( $idempotency_option );
        wp_cache_delete( $idempotency_option, 'options' );
    } elseif ( $coupon_id > 0 ) {
        wp_delete_post( $coupon_id, true );
    }

    if ( $user_id > 0 ) {
        $wpdb->delete( $wpdb->prefix . 'myCRED_log', array( 'user_id' => $user_id ), array( '%d' ) );
        require_once ABSPATH . 'wp-admin/includes/user.php';
        wp_delete_user( $user_id );
    }

    $cleanup_ok = ! username_exists( $username )
        && ! email_exists( $email )
        && ( ! $idempotency_option || null === get_option( $idempotency_option, null ) );
    if ( ! $cleanup_ok && ! $failure ) {
        $failure = new RuntimeException( 'Rewards QA cleanup verification failed.' );
    }
}

if ( $failure ) {
    WP_CLI::error( 'Rewards security smoke failed safely: ' . $failure->getMessage() );
}

WP_CLI::success( 'Rewards QA fixtures and idempotency state were removed.' );
