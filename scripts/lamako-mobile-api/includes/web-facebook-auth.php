<?php
/**
 * Secure Facebook OAuth flow for the public WordPress website.
 *
 * The authorization code and provider access token are consumed server-side.
 * Browser JavaScript receives only the resulting HttpOnly WordPress session.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'admin_post_nopriv_lamako_facebook_start', 'lamako_web_facebook_start' );
add_action( 'admin_post_lamako_facebook_start', 'lamako_web_facebook_start' );
add_action( 'init', 'lamako_web_facebook_intercept_admin_post', -1000 );
add_action( 'template_redirect', 'lamako_web_facebook_maybe_handle_callback', 0 );
add_action( 'lamako_web_facebook_cleanup_session', 'lamako_web_facebook_cleanup_session' );

/**
 * Run the start action before third-party admin redirects can hijack
 * admin-post.php. The exact script and action checks keep this isolated.
 */
function lamako_web_facebook_intercept_admin_post() {
    $script_name = isset( $_SERVER['SCRIPT_NAME'] ) ? wp_unslash( $_SERVER['SCRIPT_NAME'] ) : '';
    if ( basename( $script_name ) !== 'admin-post.php' ) {
        return;
    }

    $action = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( $_REQUEST['action'] ) ) : '';
    if ( $action === 'lamako_facebook_start' ) {
        lamako_web_facebook_start();
    }
}

function lamako_web_facebook_is_configured() {
    if ( ! function_exists( 'lamako_mobile_facebook_server_credentials' ) ) {
        return false;
    }

    $credentials = lamako_mobile_facebook_server_credentials();
    return ! empty( $credentials['app_id'] ) && ! empty( $credentials['app_secret'] );
}

/**
 * Keep this URL identical to the URI already allowlisted in Meta.
 */
function lamako_web_facebook_callback_url() {
    return home_url( '/lamako-mobile/oauth/facebook-callback' );
}

function lamako_web_facebook_validate_redirect( $value ) {
    $fallback    = home_url( '/' );
    $redirect_to = wp_validate_redirect( (string) $value, $fallback );
    $home_host   = strtolower( (string) wp_parse_url( $fallback, PHP_URL_HOST ) );
    $target_host = strtolower( (string) wp_parse_url( $redirect_to, PHP_URL_HOST ) );
    $home_scheme = strtolower( (string) wp_parse_url( $fallback, PHP_URL_SCHEME ) );
    $target_scheme = strtolower( (string) wp_parse_url( $redirect_to, PHP_URL_SCHEME ) );

    if (
        $home_host === '' ||
        $target_host === '' ||
        ! hash_equals( $home_host, $target_host ) ||
        ! hash_equals( $home_scheme, $target_scheme )
    ) {
        return $fallback;
    }

    return $redirect_to;
}

function lamako_web_facebook_browser_cookie_name() {
    return 'lamako_facebook_oauth';
}

function lamako_web_facebook_set_browser_cookie( $value, $expires ) {
    if ( headers_sent() ) {
        return false;
    }

    $name   = lamako_web_facebook_browser_cookie_name();
    $result = setcookie( $name, (string) $value, [
        'expires'  => (int) $expires,
        'path'     => '/',
        'secure'   => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    ] );

    if ( (int) $expires <= time() ) {
        unset( $_COOKIE[ $name ] );
    } else {
        $_COOKIE[ $name ] = (string) $value;
    }

    return $result;
}

function lamako_web_facebook_clear_browser_cookie() {
    lamako_web_facebook_set_browser_cookie( '', time() - HOUR_IN_SECONDS );
}

function lamako_web_facebook_session_key( $state ) {
    return 'lamako_facebook_web_' . hash( 'sha256', (string) $state );
}

function lamako_web_facebook_session_option_key( $session_key ) {
    return 'lamako_facebook_session_' . hash( 'sha256', (string) $session_key );
}

/**
 * Mirror the state to the database because managed object caches may evict a
 * transient while the user is authenticating at Facebook.
 */
function lamako_web_facebook_store_session( $state, $session ) {
    $session_key = lamako_web_facebook_session_key( $state );
    set_transient( $session_key, $session, 10 * MINUTE_IN_SECONDS );
    update_option( lamako_web_facebook_session_option_key( $session_key ), $session, false );

    wp_schedule_single_event(
        time() + 15 * MINUTE_IN_SECONDS,
        'lamako_web_facebook_cleanup_session',
        [ $session_key ]
    );
}

function lamako_web_facebook_get_session( $state ) {
    $session_key = lamako_web_facebook_session_key( $state );
    $session     = get_transient( $session_key );

    if ( ! is_array( $session ) ) {
        $session = get_option( lamako_web_facebook_session_option_key( $session_key ), false );
    }

    return $session;
}

function lamako_web_facebook_consume_session( $state ) {
    $session_key = lamako_web_facebook_session_key( $state );
    $session     = lamako_web_facebook_get_session( $state );

    lamako_web_facebook_cleanup_session( $session_key );
    return $session;
}

function lamako_web_facebook_cleanup_session( $session_key ) {
    $session_key = sanitize_key( (string) $session_key );
    if ( strpos( $session_key, 'lamako_facebook_web_' ) !== 0 ) {
        return;
    }

    delete_transient( $session_key );
    delete_option( lamako_web_facebook_session_option_key( $session_key ) );
    wp_clear_scheduled_hook( 'lamako_web_facebook_cleanup_session', [ $session_key ] );
}

function lamako_web_facebook_random_value( $bytes ) {
    return rtrim( strtr( base64_encode( random_bytes( $bytes ) ), '+/', '-_' ), '=' );
}

function lamako_web_facebook_start() {
    $redirect_to = isset( $_GET['redirect_to'] )
        ? lamako_web_facebook_validate_redirect( wp_unslash( $_GET['redirect_to'] ) )
        : home_url( '/' );

    if ( ! lamako_web_facebook_is_configured() ) {
        lamako_web_facebook_fail( $redirect_to, 'unconfigured' );
    }

    $rate_limit = lamako_mobile_enforce_public_auth_rate_limit( 'facebook_web_start', 12, 5 * MINUTE_IN_SECONDS );
    if ( is_wp_error( $rate_limit ) ) {
        lamako_web_facebook_fail( $redirect_to, 'rate_limited' );
    }

    $state         = lamako_web_facebook_random_value( 32 );
    $browser_nonce = lamako_web_facebook_random_value( 32 );
    if ( ! lamako_web_facebook_set_browser_cookie( $browser_nonce, time() + 10 * MINUTE_IN_SECONDS ) ) {
        lamako_web_facebook_fail( $redirect_to, 'cookie' );
    }

    lamako_web_facebook_store_session( $state, [
        'redirect_to'        => $redirect_to,
        'browser_nonce_hash' => hash( 'sha256', $browser_nonce ),
        'created_at'         => time(),
    ] );

    $credentials   = lamako_mobile_facebook_server_credentials();
    $authorize_url = add_query_arg( [
        'client_id'     => (string) $credentials['app_id'],
        'redirect_uri'  => lamako_web_facebook_callback_url(),
        'response_type' => 'code',
        'scope'         => 'email,public_profile',
        'state'         => $state,
    ], 'https://www.facebook.com/v24.0/dialog/oauth' );

    wp_redirect( $authorize_url, 302, 'TicketByLamako' );
    exit;
}

/**
 * Intercept only server-side code callbacks. Native implicit callbacks contain
 * their token and JSON state in the URL fragment, which never reaches PHP and
 * therefore continue to the existing bridge page.
 */
function lamako_web_facebook_maybe_handle_callback() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
    $path        = untrailingslashit( (string) parse_url( $request_uri, PHP_URL_PATH ) );
    if ( $path !== '/lamako-mobile/oauth/facebook-callback' || ! isset( $_GET['state'] ) ) {
        return;
    }

    lamako_web_facebook_callback();
}

function lamako_web_facebook_callback() {
    if ( strtoupper( isset( $_SERVER['REQUEST_METHOD'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) : '' ) !== 'GET' ) {
        lamako_web_facebook_fail( home_url( '/' ), 'method' );
    }

    $state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : '';
    if ( strlen( $state ) < 32 || strlen( $state ) > 128 ) {
        lamako_web_facebook_fail( home_url( '/' ), 'state' );
    }

    $session = lamako_web_facebook_get_session( $state );
    if ( ! is_array( $session ) || empty( $session['browser_nonce_hash'] ) || empty( $session['created_at'] ) || (int) $session['created_at'] < time() - 10 * MINUTE_IN_SECONDS ) {
        lamako_web_facebook_fail( home_url( '/' ), 'session' );
    }

    $cookie_name   = lamako_web_facebook_browser_cookie_name();
    $browser_nonce = isset( $_COOKIE[ $cookie_name ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ $cookie_name ] ) ) : '';
    if ( $browser_nonce === '' || ! hash_equals( (string) $session['browser_nonce_hash'], hash( 'sha256', $browser_nonce ) ) ) {
        lamako_web_facebook_fail( home_url( '/' ), 'browser' );
    }

    $session = lamako_web_facebook_consume_session( $state );
    if ( ! is_array( $session ) ) {
        lamako_web_facebook_fail( home_url( '/' ), 'replay' );
    }
    lamako_web_facebook_clear_browser_cookie();

    $redirect_to = lamako_web_facebook_validate_redirect( $session['redirect_to'] ?? '' );
    if ( ! empty( $_GET['error'] ) ) {
        lamako_web_facebook_fail( $redirect_to, 'provider' );
    }

    $rate_limit = lamako_mobile_enforce_public_auth_rate_limit( 'facebook_web_callback', 12, 5 * MINUTE_IN_SECONDS );
    if ( is_wp_error( $rate_limit ) ) {
        lamako_web_facebook_fail( $redirect_to, 'rate_limited' );
    }

    $code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : '';
    if ( $code === '' || strlen( $code ) > 4096 ) {
        lamako_web_facebook_fail( $redirect_to, 'code' );
    }

    $access_token = lamako_web_facebook_exchange_code( $code );
    if ( is_wp_error( $access_token ) ) {
        lamako_web_facebook_fail( $redirect_to, $access_token->get_error_code() );
    }

    $identity = lamako_mobile_validate_facebook_identity( $access_token );
    if ( is_wp_error( $identity ) ) {
        lamako_web_facebook_fail( $redirect_to, $identity->get_error_code() );
    }

    $permission = lamako_web_facebook_can_link_identity( $identity );
    if ( is_wp_error( $permission ) ) {
        lamako_web_facebook_fail( $redirect_to, 'account' );
    }

    $nonce_result = lamako_mobile_consume_social_nonce( 'facebook_web', $state, $identity['provider_id'] ?? '' );
    if ( is_wp_error( $nonce_result ) ) {
        lamako_web_facebook_fail( $redirect_to, 'replay' );
    }

    $result = lamako_find_or_create_social_user( 'facebook', $identity );
    if ( is_wp_error( $result ) || empty( $result['user']->ID ) ) {
        lamako_web_facebook_fail( $redirect_to, 'account' );
    }

    $user = $result['user'];
    wp_set_current_user( $user->ID );
    wp_set_auth_cookie( $user->ID, false, is_ssl() );
    do_action( 'wp_login', $user->user_login, $user );

    wp_safe_redirect( add_query_arg( 'lamako_auth', 'facebook', $redirect_to ) );
    exit;
}

function lamako_web_facebook_exchange_code( $code ) {
    $credentials = lamako_mobile_facebook_server_credentials();
    $response    = wp_safe_remote_post( 'https://graph.facebook.com/v24.0/oauth/access_token', [
        'timeout'     => 12,
        'redirection' => 0,
        'headers'     => [ 'Accept' => 'application/json' ],
        'body'        => [
            'client_id'     => (string) $credentials['app_id'],
            'client_secret' => (string) $credentials['app_secret'],
            'redirect_uri'  => lamako_web_facebook_callback_url(),
            'code'          => $code,
        ],
    ] );
    if ( is_wp_error( $response ) ) {
        return new WP_Error( 'facebook_exchange_unavailable', 'Facebook token exchange unavailable.' );
    }

    $status_code = wp_remote_retrieve_response_code( $response );
    $body        = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( $status_code !== 200 || ! is_array( $body ) || empty( $body['access_token'] ) ) {
        $provider_error = sanitize_key( is_array( $body ) ? ( $body['error']['type'] ?? 'unknown' ) : 'invalid_response' );
        lamako_web_facebook_record_diagnostic( 'exchange', $status_code, $provider_error );
        return new WP_Error( 'facebook_exchange_invalid', 'Facebook token exchange rejected.' );
    }

    return (string) $body['access_token'];
}

function lamako_web_facebook_can_link_identity( $identity ) {
    $provider_id = (string) ( $identity['provider_id'] ?? '' );
    if ( lamako_mobile_social_identity_is_linked( 'facebook', $provider_id ) ) {
        return true;
    }

    $email = sanitize_email( $identity['email'] ?? '' );
    $user  = $email ? get_user_by( 'email', $email ) : false;
    if ( ! $user ) {
        return true;
    }

    $privileged_roles = [ 'administrator', 'editor', 'shop_manager', 'organisateur', 'responsable_vente', 'staff_checkin' ];
    if ( array_intersect( $privileged_roles, (array) $user->roles ) ) {
        return new WP_Error( 'facebook_privileged_account', 'Use password login for privileged accounts.' );
    }

    return true;
}

function lamako_web_facebook_record_diagnostic( $stage, $http_status, $provider_error ) {
    $diagnostic = [
        'at'             => time(),
        'stage'          => sanitize_key( $stage ),
        'http_status'    => (int) $http_status,
        'provider_error' => sanitize_key( $provider_error ),
    ];
    set_transient( 'lamako_facebook_web_last_diagnostic', $diagnostic, 15 * MINUTE_IN_SECONDS );
    update_option( 'lamako_facebook_web_last_diagnostic', $diagnostic, false );
}

function lamako_web_facebook_fail( $redirect_to, $reason ) {
    $reason = sanitize_key( $reason );
    $failure = [
        'at'     => time(),
        'reason' => $reason,
    ];
    set_transient( 'lamako_facebook_web_last_failure', $failure, 15 * MINUTE_IN_SECONDS );
    update_option( 'lamako_facebook_web_last_failure', $failure, false );
    error_log( sprintf( '[Lamako Facebook Web] auth_failed reason=%s', $reason ) );
    do_action( 'lamako_web_facebook_auth_failed', $reason );

    lamako_web_facebook_clear_browser_cookie();
    $redirect_to = lamako_web_facebook_validate_redirect( $redirect_to );
    wp_safe_redirect( add_query_arg( 'lamako_auth_error', 'facebook', $redirect_to ) );
    exit;
}
