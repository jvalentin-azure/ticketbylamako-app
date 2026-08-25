<?php
/**
 * Secure Sign in with Apple flow for the public WordPress website.
 *
 * Provider credentials are read from server-only constants. The private key
 * must live outside the public web root and must never be committed.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'admin_post_nopriv_lamako_apple_start', 'lamako_web_apple_start' );
add_action( 'admin_post_lamako_apple_start', 'lamako_web_apple_start' );
add_action( 'admin_post_nopriv_lamako_apple_callback', 'lamako_web_apple_callback' );
add_action( 'admin_post_lamako_apple_callback', 'lamako_web_apple_callback' );
add_action( 'init', 'lamako_web_apple_intercept_admin_post', -1000 );
add_action( 'lamako_web_apple_cleanup_session', 'lamako_web_apple_cleanup_session' );
add_shortcode( 'lamako_apple_login', 'lamako_web_apple_login_shortcode' );

/**
 * Run the Apple actions before third-party admin redirects can hijack
 * admin-post.php. The exact script and action checks keep this isolated.
 */
function lamako_web_apple_intercept_admin_post() {
    $script_name = isset( $_SERVER['SCRIPT_NAME'] ) ? wp_unslash( $_SERVER['SCRIPT_NAME'] ) : '';
    if ( basename( $script_name ) !== 'admin-post.php' ) {
        return;
    }

    $action = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( $_REQUEST['action'] ) ) : '';
    if ( $action === 'lamako_apple_start' ) {
        lamako_web_apple_start();
    }
    if ( $action === 'lamako_apple_callback' ) {
        lamako_web_apple_callback();
    }
}

function lamako_web_apple_config() {
    $config = [
        'client_id'        => defined( 'LAMAKO_APPLE_WEB_CLIENT_ID' ) ? trim( (string) LAMAKO_APPLE_WEB_CLIENT_ID ) : '',
        'team_id'          => defined( 'LAMAKO_APPLE_TEAM_ID' ) ? trim( (string) LAMAKO_APPLE_TEAM_ID ) : '',
        'key_id'           => defined( 'LAMAKO_APPLE_KEY_ID' ) ? trim( (string) LAMAKO_APPLE_KEY_ID ) : '',
        'private_key_path' => defined( 'LAMAKO_APPLE_PRIVATE_KEY_PATH' ) ? trim( (string) LAMAKO_APPLE_PRIVATE_KEY_PATH ) : '',
    ];

    return apply_filters( 'lamako_web_apple_config', $config );
}

function lamako_web_apple_is_configured() {
    $config = lamako_web_apple_config();

    if ( in_array( '', array_values( $config ), true ) ) {
        return false;
    }

    $private_key_path = realpath( $config['private_key_path'] );
    $web_root         = realpath( ABSPATH );
    if ( ! $private_key_path || ! is_readable( $private_key_path ) ) {
        return false;
    }

    // Refuse private keys stored under public_html, even if misconfigured.
    if ( $web_root && strpos( wp_normalize_path( $private_key_path ), trailingslashit( wp_normalize_path( $web_root ) ) ) === 0 ) {
        return false;
    }

    return true;
}

function lamako_web_apple_callback_url() {
    return add_query_arg( 'action', 'lamako_apple_callback', admin_url( 'admin-post.php' ) );
}

function lamako_web_apple_current_url() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
    $target      = home_url( '/' . ltrim( $request_uri, '/' ) );

    return wp_validate_redirect( $target, home_url( '/' ) );
}

function lamako_web_apple_session_key( $state ) {
    return 'lamako_apple_web_' . hash( 'sha256', (string) $state );
}

function lamako_web_apple_session_option_key( $session_key ) {
    return 'lamako_apple_session_' . hash( 'sha256', (string) $session_key );
}

/**
 * Keep the OAuth state in both the object cache and the database. Some managed
 * WordPress caches can evict short-lived transients before Apple posts back.
 */
function lamako_web_apple_store_session( $state, $session ) {
    $session_key = lamako_web_apple_session_key( $state );
    set_transient( $session_key, $session, 10 * MINUTE_IN_SECONDS );
    update_option( lamako_web_apple_session_option_key( $session_key ), $session, false );

    wp_schedule_single_event(
        time() + 15 * MINUTE_IN_SECONDS,
        'lamako_web_apple_cleanup_session',
        [ $session_key ]
    );
}

function lamako_web_apple_consume_session( $state ) {
    $session_key = lamako_web_apple_session_key( $state );
    $option_key  = lamako_web_apple_session_option_key( $session_key );
    $session     = get_transient( $session_key );

    if ( ! is_array( $session ) ) {
        $session = get_option( $option_key, false );
    }

    lamako_web_apple_cleanup_session( $session_key );

    return $session;
}

function lamako_web_apple_cleanup_session( $session_key ) {
    $session_key = sanitize_key( (string) $session_key );
    if ( strpos( $session_key, 'lamako_apple_web_' ) !== 0 ) {
        return;
    }

    delete_transient( $session_key );
    delete_option( lamako_web_apple_session_option_key( $session_key ) );
    wp_clear_scheduled_hook( 'lamako_web_apple_cleanup_session', [ $session_key ] );
}

function lamako_web_apple_login_shortcode( $attributes = [] ) {
    if ( is_user_logged_in() || ! lamako_web_apple_is_configured() ) {
        return '';
    }

    $attributes  = shortcode_atts( [ 'redirect_to' => '' ], $attributes, 'lamako_apple_login' );
    $redirect_to = $attributes['redirect_to'] ? wp_validate_redirect( $attributes['redirect_to'], home_url( '/' ) ) : lamako_web_apple_current_url();
    $start_url   = add_query_arg( [
        'action'      => 'lamako_apple_start',
        'redirect_to' => $redirect_to,
    ], admin_url( 'admin-post.php' ) );

    $notice = '';
    if ( isset( $_GET['lamako_auth_error'] ) && sanitize_key( wp_unslash( $_GET['lamako_auth_error'] ) ) === 'apple' ) {
        $notice = '<div class="lamako-apple-login__error" role="alert">Connexion Apple impossible. Veuillez reessayer.</div>';
    }

    return $notice
        . '<a class="lamako-apple-login" href="' . esc_url( $start_url ) . '">'
        . '<span class="lamako-apple-login__mark" aria-hidden="true">A</span>'
        . '<span>Continuer avec Apple</span>'
        . '</a>'
        . '<style>'
        . '.lamako-apple-login{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:44px;margin-top:10px;padding:10px 16px;border:1px solid #111;border-radius:4px;background:#000;color:#fff!important;font-family:inherit;font-size:14px;font-weight:600;line-height:1.4;letter-spacing:0;text-decoration:none!important}'
        . '.lamako-apple-login:hover,.lamako-apple-login:focus{background:#222;color:#fff!important}'
        . '.lamako-apple-login:focus-visible{outline:3px solid #f3b400;outline-offset:2px}'
        . '.lamako-apple-login__mark{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#fff;color:#000;font-size:12px;font-weight:700}'
        . '.lamako-apple-login__error{margin:10px 0 0;padding:10px;border-left:3px solid #b42318;background:#fff2f0;color:#7a271a;font-size:13px}'
        . '</style>';
}

function lamako_web_apple_start() {
    if ( ! lamako_web_apple_is_configured() ) {
        lamako_web_apple_fail( home_url( '/' ), 'unconfigured' );
    }

    $rate_limit = lamako_mobile_enforce_public_auth_rate_limit( 'apple_web_start', 12, 5 * MINUTE_IN_SECONDS );
    if ( is_wp_error( $rate_limit ) ) {
        lamako_web_apple_fail( home_url( '/' ), 'rate_limited' );
    }

    $state       = lamako_web_apple_random_value( 32 );
    $nonce       = lamako_web_apple_random_value( 32 );
    $redirect_to = isset( $_GET['redirect_to'] ) ? wp_validate_redirect( wp_unslash( $_GET['redirect_to'] ), home_url( '/' ) ) : home_url( '/' );

    lamako_web_apple_store_session( $state, [
        'nonce'       => $nonce,
        'redirect_to' => $redirect_to,
        'created_at'  => time(),
    ] );

    $config        = lamako_web_apple_config();
    $authorize_url = add_query_arg( [
        'client_id'     => $config['client_id'],
        'redirect_uri'  => lamako_web_apple_callback_url(),
        'response_type' => 'code',
        'response_mode' => 'form_post',
        'scope'         => 'name email',
        'state'         => $state,
        'nonce'         => $nonce,
    ], 'https://appleid.apple.com/auth/authorize' );

    wp_redirect( $authorize_url, 302, 'TicketByLamako' );
    exit;
}

function lamako_web_apple_callback() {
    if ( strtoupper( isset( $_SERVER['REQUEST_METHOD'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) : '' ) !== 'POST' ) {
        lamako_web_apple_fail( home_url( '/' ), 'method' );
    }

    $state = isset( $_POST['state'] ) ? sanitize_text_field( wp_unslash( $_POST['state'] ) ) : '';
    if ( strlen( $state ) < 32 || strlen( $state ) > 128 ) {
        lamako_web_apple_fail( home_url( '/' ), 'state' );
    }

    $session = lamako_web_apple_consume_session( $state );
    if ( ! is_array( $session ) || empty( $session['nonce'] ) || empty( $session['created_at'] ) || (int) $session['created_at'] < time() - 10 * MINUTE_IN_SECONDS ) {
        lamako_web_apple_fail( home_url( '/' ), 'session' );
    }

    $redirect_to = wp_validate_redirect( $session['redirect_to'] ?? '', home_url( '/' ) );
    if ( ! empty( $_POST['error'] ) ) {
        lamako_web_apple_fail( $redirect_to, 'provider' );
    }

    $rate_limit = lamako_mobile_enforce_public_auth_rate_limit( 'apple_web_callback', 12, 5 * MINUTE_IN_SECONDS );
    if ( is_wp_error( $rate_limit ) ) {
        lamako_web_apple_fail( $redirect_to, 'rate_limited' );
    }

    $code = isset( $_POST['code'] ) ? sanitize_text_field( wp_unslash( $_POST['code'] ) ) : '';
    if ( $code === '' || strlen( $code ) > 2048 ) {
        lamako_web_apple_fail( $redirect_to, 'code' );
    }

    $tokens = lamako_web_apple_exchange_code( $code );
    if ( is_wp_error( $tokens ) || empty( $tokens['id_token'] ) ) {
        $exchange_reason = is_wp_error( $tokens ) ? $tokens->get_error_code() : 'apple_exchange_missing_token';
        lamako_web_apple_fail( $redirect_to, $exchange_reason );
    }

    $first_name = '';
    $last_name  = '';
    if ( isset( $_POST['user'] ) ) {
        $apple_user = json_decode( wp_unslash( $_POST['user'] ), true );
        if ( is_array( $apple_user ) && isset( $apple_user['name'] ) && is_array( $apple_user['name'] ) ) {
            $first_name = sanitize_text_field( $apple_user['name']['firstName'] ?? '' );
            $last_name  = sanitize_text_field( $apple_user['name']['lastName'] ?? '' );
        }
    }

    $identity = lamako_mobile_validate_apple_identity( $tokens['id_token'], (string) $session['nonce'], $first_name, $last_name );
    if ( is_wp_error( $identity ) ) {
        lamako_web_apple_fail( $redirect_to, $identity->get_error_code() );
    }
    if ( empty( $identity['email'] ) && ! lamako_mobile_social_identity_is_linked( 'apple', $identity['provider_id'] ?? '' ) ) {
        lamako_web_apple_fail( $redirect_to, 'email' );
    }

    $permission = lamako_web_apple_can_link_identity( $identity );
    if ( is_wp_error( $permission ) ) {
        lamako_web_apple_fail( $redirect_to, 'account' );
    }

    $nonce_result = lamako_mobile_consume_social_nonce( 'apple', (string) $session['nonce'], $identity['provider_id'] ?? '' );
    if ( is_wp_error( $nonce_result ) ) {
        lamako_web_apple_fail( $redirect_to, 'replay' );
    }

    $result = lamako_find_or_create_social_user( 'apple', $identity );
    if ( is_wp_error( $result ) || empty( $result['user']->ID ) ) {
        lamako_web_apple_fail( $redirect_to, 'account' );
    }

    $user = $result['user'];
    wp_set_current_user( $user->ID );
    wp_set_auth_cookie( $user->ID, false, is_ssl() );
    do_action( 'wp_login', $user->user_login, $user );

    wp_safe_redirect( add_query_arg( 'lamako_auth', 'apple', $redirect_to ) );
    exit;
}

function lamako_web_apple_can_link_identity( $identity ) {
    $provider_id = (string) ( $identity['provider_id'] ?? '' );
    if ( lamako_mobile_social_identity_is_linked( 'apple', $provider_id ) ) {
        return true;
    }

    $email = sanitize_email( $identity['email'] ?? '' );
    $user  = $email ? get_user_by( 'email', $email ) : false;
    if ( ! $user ) {
        return true;
    }

    $privileged_roles = [ 'administrator', 'editor', 'shop_manager', 'organisateur', 'responsable_vente', 'staff_checkin' ];
    if ( array_intersect( $privileged_roles, (array) $user->roles ) ) {
        return new WP_Error( 'apple_privileged_account', 'Use password login for privileged accounts.' );
    }

    return true;
}

function lamako_web_apple_exchange_code( $code ) {
    $config        = lamako_web_apple_config();
    $client_secret = lamako_web_apple_create_client_secret( $config );
    if ( is_wp_error( $client_secret ) ) {
        return $client_secret;
    }

    $response = wp_safe_remote_post( 'https://appleid.apple.com/auth/token', [
        'timeout'     => 12,
        'redirection' => 0,
        'headers'     => [ 'Accept' => 'application/json' ],
        'body'        => [
            'client_id'     => $config['client_id'],
            'client_secret' => $client_secret,
            'code'          => $code,
            'grant_type'    => 'authorization_code',
            'redirect_uri'  => lamako_web_apple_callback_url(),
        ],
    ] );
    if ( is_wp_error( $response ) ) {
        return new WP_Error( 'apple_exchange_unavailable', 'Apple token exchange unavailable.' );
    }

    $body        = json_decode( wp_remote_retrieve_body( $response ), true );
    $status_code = wp_remote_retrieve_response_code( $response );
    if ( $status_code !== 200 || ! is_array( $body ) || empty( $body['id_token'] ) ) {
        $provider_error = sanitize_key( is_array( $body ) ? ( $body['error'] ?? 'unknown' ) : 'invalid_response' );
        set_transient( 'lamako_apple_web_last_exchange', [
            'at'             => time(),
            'http_status'    => (int) $status_code,
            'provider_error' => $provider_error,
        ], 15 * MINUTE_IN_SECONDS );
        update_option( 'lamako_apple_web_last_diagnostic', [
            'at'             => time(),
            'stage'          => 'exchange',
            'http_status'    => (int) $status_code,
            'provider_error' => $provider_error,
        ], false );
        error_log( sprintf( '[Lamako Apple Web] exchange_failed status=%d provider_error=%s', (int) $status_code, $provider_error ) );
        return new WP_Error( 'apple_exchange_invalid', 'Apple token exchange rejected.' );
    }

    return $body;
}

function lamako_web_apple_create_client_secret( $config ) {
    if ( ! lamako_web_apple_is_configured() || ! function_exists( 'openssl_sign' ) ) {
        return new WP_Error( 'apple_signing_unavailable', 'Apple signing unavailable.' );
    }

    $private_key = file_get_contents( $config['private_key_path'] );
    if ( $private_key === false ) {
        return new WP_Error( 'apple_key_unreadable', 'Apple signing key unavailable.' );
    }

    $now     = time();
    $header  = lamako_web_apple_base64url_encode( wp_json_encode( [ 'alg' => 'ES256', 'kid' => $config['key_id'] ] ) );
    $payload = lamako_web_apple_base64url_encode( wp_json_encode( [
        'iss' => $config['team_id'],
        'iat' => $now - 30,
        'exp' => $now + 5 * MINUTE_IN_SECONDS,
        'aud' => 'https://appleid.apple.com',
        'sub' => $config['client_id'],
    ] ) );
    $input   = $header . '.' . $payload;
    $der     = '';

    if ( ! openssl_sign( $input, $der, $private_key, OPENSSL_ALGO_SHA256 ) ) {
        return new WP_Error( 'apple_signing_failed', 'Apple client secret signing failed.' );
    }

    $signature = lamako_web_apple_ecdsa_der_to_jose( $der, 32 );
    if ( is_wp_error( $signature ) ) {
        return $signature;
    }

    return $input . '.' . lamako_web_apple_base64url_encode( $signature );
}

function lamako_web_apple_ecdsa_der_to_jose( $der, $part_length ) {
    $offset = 0;
    if ( ! isset( $der[$offset] ) || ord( $der[$offset++] ) !== 0x30 ) {
        return new WP_Error( 'apple_signature_invalid', 'Invalid Apple signature.' );
    }
    $sequence_length = lamako_web_apple_asn1_read_length( $der, $offset );
    if ( $sequence_length < 1 || ! isset( $der[$offset] ) || ord( $der[$offset++] ) !== 0x02 ) {
        return new WP_Error( 'apple_signature_invalid', 'Invalid Apple signature.' );
    }
    $r_length = lamako_web_apple_asn1_read_length( $der, $offset );
    $r        = substr( $der, $offset, $r_length );
    $offset  += $r_length;
    if ( ! isset( $der[$offset] ) || ord( $der[$offset++] ) !== 0x02 ) {
        return new WP_Error( 'apple_signature_invalid', 'Invalid Apple signature.' );
    }
    $s_length = lamako_web_apple_asn1_read_length( $der, $offset );
    $s        = substr( $der, $offset, $s_length );

    $r = str_pad( substr( ltrim( $r, "\x00" ), -$part_length ), $part_length, "\x00", STR_PAD_LEFT );
    $s = str_pad( substr( ltrim( $s, "\x00" ), -$part_length ), $part_length, "\x00", STR_PAD_LEFT );

    return $r . $s;
}

function lamako_web_apple_asn1_read_length( $data, &$offset ) {
    if ( ! isset( $data[$offset] ) ) {
        return 0;
    }

    $length = ord( $data[$offset++] );
    if ( ( $length & 0x80 ) === 0 ) {
        return $length;
    }

    $bytes  = $length & 0x7f;
    $length = 0;
    for ( $index = 0; $index < $bytes; $index++ ) {
        if ( ! isset( $data[$offset] ) ) {
            return 0;
        }
        $length = ( $length << 8 ) | ord( $data[$offset++] );
    }

    return $length;
}

function lamako_web_apple_random_value( $bytes ) {
    return lamako_web_apple_base64url_encode( random_bytes( $bytes ) );
}

function lamako_web_apple_base64url_encode( $value ) {
    return rtrim( strtr( base64_encode( (string) $value ), '+/', '-_' ), '=' );
}

function lamako_web_apple_fail( $redirect_to, $reason ) {
    $reason = sanitize_key( $reason );
    set_transient( 'lamako_apple_web_last_failure', [
        'at'     => time(),
        'reason' => $reason,
    ], 15 * MINUTE_IN_SECONDS );
    update_option( 'lamako_apple_web_last_failure', [
        'at'     => time(),
        'reason' => $reason,
    ], false );
    error_log( sprintf( '[Lamako Apple Web] auth_failed reason=%s', $reason ) );
    do_action( 'lamako_web_apple_auth_failed', $reason );
    $redirect_to = wp_validate_redirect( $redirect_to, home_url( '/' ) );
    wp_safe_redirect( add_query_arg( 'lamako_auth_error', 'apple', $redirect_to ) );
    exit;
}
