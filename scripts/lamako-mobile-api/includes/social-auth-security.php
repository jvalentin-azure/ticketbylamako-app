<?php
/**
 * Provider-token verification for Lamako social authentication.
 *
 * Secrets must be defined in wp-config.php or the server environment. They
 * must never be committed to this plugin or sent to a mobile/web client.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function lamako_mobile_base64url_decode( $value ) {
    $value   = (string) $value;
    $padding = strlen( $value ) % 4;
    if ( $padding ) {
        $value .= str_repeat( '=', 4 - $padding );
    }

    return base64_decode( strtr( $value, '-_', '+/' ), true );
}

function lamako_mobile_parse_config_list( $value ) {
    if ( is_array( $value ) ) {
        $items = $value;
    } else {
        $items = preg_split( '/[\s,]+/', (string) $value, -1, PREG_SPLIT_NO_EMPTY );
    }

    return array_values( array_unique( array_filter( array_map( 'trim', (array) $items ) ) ) );
}

function lamako_mobile_server_provider_settings( $option_name ) {
    $settings = get_option( $option_name, [] );

    for ( $attempt = 0; $attempt < 3 && is_string( $settings ) && is_serialized( $settings ); $attempt++ ) {
        $settings = maybe_unserialize( $settings );
    }

    return is_array( $settings ) ? $settings : [];
}

function lamako_mobile_google_client_ids() {
    $configured = defined( 'LAMAKO_GOOGLE_CLIENT_IDS' ) ? LAMAKO_GOOGLE_CLIENT_IDS : '';
    $ids        = lamako_mobile_parse_config_list( $configured );
    $settings   = lamako_mobile_server_provider_settings( 'nsl_google' );

    if ( ! empty( $settings['client_id'] ) ) {
        $ids[] = sanitize_text_field( $settings['client_id'] );
    }

    return apply_filters( 'lamako_mobile_google_client_ids', array_values( array_unique( array_filter( $ids ) ) ) );
}

function lamako_mobile_apple_client_ids() {
    $configured = defined( 'LAMAKO_APPLE_CLIENT_IDS' ) ? LAMAKO_APPLE_CLIENT_IDS : '';
    $ids        = array_merge( [ 'com.ticketbylamako.app' ], lamako_mobile_parse_config_list( $configured ) );

    if ( defined( 'LAMAKO_APPLE_WEB_CLIENT_ID' ) ) {
        $ids[] = trim( (string) LAMAKO_APPLE_WEB_CLIENT_ID );
    }

    return apply_filters( 'lamako_mobile_apple_client_ids', array_values( array_unique( array_filter( $ids ) ) ) );
}

function lamako_mobile_facebook_server_credentials() {
    $settings   = lamako_mobile_server_provider_settings( 'nsl_facebook' );
    $app_id     = defined( 'LAMAKO_FACEBOOK_APP_ID' ) ? (string) LAMAKO_FACEBOOK_APP_ID : (string) ( $settings['appid'] ?? '' );
    $app_secret = defined( 'LAMAKO_FACEBOOK_APP_SECRET' ) ? (string) LAMAKO_FACEBOOK_APP_SECRET : (string) ( $settings['secret'] ?? '' );

    return apply_filters( 'lamako_mobile_facebook_server_credentials', [
        'app_id'     => trim( $app_id ),
        'app_secret' => trim( $app_secret ),
    ] );
}

function lamako_mobile_asn1_length( $length ) {
    if ( $length <= 0x7f ) {
        return chr( $length );
    }

    $encoded = '';
    while ( $length > 0 ) {
        $encoded = chr( $length & 0xff ) . $encoded;
        $length >>= 8;
    }

    return chr( 0x80 | strlen( $encoded ) ) . $encoded;
}

function lamako_mobile_asn1_integer( $value ) {
    $value = ltrim( (string) $value, "\x00" );
    if ( $value === '' ) {
        $value = "\x00";
    }
    if ( ord( $value[0] ) > 0x7f ) {
        $value = "\x00" . $value;
    }

    return "\x02" . lamako_mobile_asn1_length( strlen( $value ) ) . $value;
}

function lamako_mobile_jwk_to_pem( $jwk ) {
    if ( empty( $jwk['n'] ) || empty( $jwk['e'] ) || ( $jwk['kty'] ?? '' ) !== 'RSA' ) {
        return new WP_Error( 'social_jwk_invalid', 'Cle publique du fournisseur invalide.', [ 'status' => 503 ] );
    }

    $modulus  = lamako_mobile_base64url_decode( $jwk['n'] );
    $exponent = lamako_mobile_base64url_decode( $jwk['e'] );
    if ( $modulus === false || $exponent === false ) {
        return new WP_Error( 'social_jwk_invalid', 'Cle publique du fournisseur illisible.', [ 'status' => 503 ] );
    }

    $rsa_key = lamako_mobile_asn1_integer( $modulus ) . lamako_mobile_asn1_integer( $exponent );
    $rsa_key = "\x30" . lamako_mobile_asn1_length( strlen( $rsa_key ) ) . $rsa_key;

    $algorithm_identifier = hex2bin( '300d06092a864886f70d0101010500' );
    $bit_string           = "\x00" . $rsa_key;
    $subject_key          = $algorithm_identifier . "\x03" . lamako_mobile_asn1_length( strlen( $bit_string ) ) . $bit_string;
    $subject_key          = "\x30" . lamako_mobile_asn1_length( strlen( $subject_key ) ) . $subject_key;

    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split( base64_encode( $subject_key ), 64, "\n" ) . "-----END PUBLIC KEY-----\n";
}

function lamako_mobile_fetch_jwks( $url, $cache_key, $force_refresh = false ) {
    if ( ! $force_refresh ) {
        $cached = get_transient( $cache_key );
        if ( is_array( $cached ) && ! empty( $cached['keys'] ) ) {
            return $cached['keys'];
        }
    }

    $response = wp_safe_remote_get( $url, [
        'timeout'     => 8,
        'redirection' => 0,
        'headers'     => [ 'Accept' => 'application/json' ],
    ] );
    if ( is_wp_error( $response ) ) {
        return new WP_Error( 'social_keys_unavailable', 'Verification du fournisseur temporairement indisponible.', [ 'status' => 503 ] );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( wp_remote_retrieve_response_code( $response ) !== 200 || empty( $body['keys'] ) || ! is_array( $body['keys'] ) ) {
        return new WP_Error( 'social_keys_invalid', 'Reponse de verification du fournisseur invalide.', [ 'status' => 503 ] );
    }

    set_transient( $cache_key, [ 'keys' => $body['keys'] ], 6 * HOUR_IN_SECONDS );
    return $body['keys'];
}

function lamako_mobile_verify_oidc_token( $token, $config ) {
    if ( ! function_exists( 'openssl_verify' ) ) {
        return new WP_Error( 'social_crypto_unavailable', 'Verification cryptographique indisponible.', [ 'status' => 503 ] );
    }

    $parts = explode( '.', (string) $token );
    if ( count( $parts ) !== 3 ) {
        return new WP_Error( 'social_token_invalid', 'Jeton de connexion invalide.', [ 'status' => 401 ] );
    }

    $header_json  = lamako_mobile_base64url_decode( $parts[0] );
    $payload_json = lamako_mobile_base64url_decode( $parts[1] );
    $signature    = lamako_mobile_base64url_decode( $parts[2] );
    $header       = json_decode( (string) $header_json, true );
    $payload      = json_decode( (string) $payload_json, true );

    if ( ! is_array( $header ) || ! is_array( $payload ) || $signature === false ) {
        return new WP_Error( 'social_token_invalid', 'Jeton de connexion illisible.', [ 'status' => 401 ] );
    }
    if ( ( $header['alg'] ?? '' ) !== 'RS256' || empty( $header['kid'] ) ) {
        return new WP_Error( 'social_token_algorithm', 'Algorithme de signature non autorise.', [ 'status' => 401 ] );
    }

    $keys = lamako_mobile_fetch_jwks( $config['jwks_url'], $config['cache_key'] );
    if ( is_wp_error( $keys ) ) {
        return $keys;
    }

    $matching_key = null;
    foreach ( $keys as $key ) {
        if ( isset( $key['kid'] ) && hash_equals( (string) $key['kid'], (string) $header['kid'] ) ) {
            $matching_key = $key;
            break;
        }
    }
    if ( ! $matching_key ) {
        $keys = lamako_mobile_fetch_jwks( $config['jwks_url'], $config['cache_key'], true );
        if ( is_wp_error( $keys ) ) {
            return $keys;
        }
        foreach ( $keys as $key ) {
            if ( isset( $key['kid'] ) && hash_equals( (string) $key['kid'], (string) $header['kid'] ) ) {
                $matching_key = $key;
                break;
            }
        }
        if ( ! $matching_key ) {
            return new WP_Error( 'social_key_not_found', 'Cle de signature du fournisseur introuvable.', [ 'status' => 401 ] );
        }
    }

    $public_key = lamako_mobile_jwk_to_pem( $matching_key );
    if ( is_wp_error( $public_key ) ) {
        return $public_key;
    }

    $verified = openssl_verify( $parts[0] . '.' . $parts[1], $signature, $public_key, OPENSSL_ALGO_SHA256 );
    if ( $verified !== 1 ) {
        return new WP_Error( 'social_signature_invalid', 'Signature du jeton de connexion invalide.', [ 'status' => 401 ] );
    }

    $now     = time();
    $issuers = (array) $config['issuers'];
    if ( empty( $payload['iss'] ) || ! in_array( $payload['iss'], $issuers, true ) ) {
        return new WP_Error( 'social_issuer_invalid', 'Emetteur du jeton non autorise.', [ 'status' => 401 ] );
    }

    $audiences       = isset( $payload['aud'] ) ? (array) $payload['aud'] : [];
    $allowed_clients = array_values( array_filter( (array) $config['client_ids'] ) );
    if ( empty( $allowed_clients ) ) {
        return new WP_Error( 'social_client_unconfigured', 'Connexion sociale non configuree sur le serveur.', [ 'status' => 503 ] );
    }
    if ( empty( array_intersect( $audiences, $allowed_clients ) ) ) {
        return new WP_Error( 'social_audience_invalid', 'Application destinataire du jeton invalide.', [ 'status' => 401 ] );
    }

    if ( empty( $payload['exp'] ) || (int) $payload['exp'] < $now - 30 ) {
        return new WP_Error( 'social_token_expired', 'Jeton de connexion expire.', [ 'status' => 401 ] );
    }
    if ( ! empty( $payload['iat'] ) && (int) $payload['iat'] > $now + 60 ) {
        return new WP_Error( 'social_token_future', 'Date du jeton de connexion invalide.', [ 'status' => 401 ] );
    }

    $expected_nonce = isset( $config['nonce'] ) ? (string) $config['nonce'] : '';
    if ( $expected_nonce !== '' ) {
        if ( empty( $payload['nonce'] ) || ! hash_equals( $expected_nonce, (string) $payload['nonce'] ) ) {
            return new WP_Error( 'social_nonce_invalid', 'Session de connexion invalide ou deja utilisee.', [ 'status' => 401 ] );
        }
    } elseif ( defined( 'LAMAKO_REQUIRE_SOCIAL_NONCE' ) && LAMAKO_REQUIRE_SOCIAL_NONCE ) {
        return new WP_Error( 'social_nonce_required', 'Mettez a jour l application pour continuer.', [ 'status' => 426 ] );
    }

    return $payload;
}

function lamako_mobile_enforce_social_rate_limit() {
    $address = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
    $key     = 'lamako_social_' . md5( $address );
    $count   = (int) get_transient( $key );
    if ( $count >= 20 ) {
        return new WP_Error( 'social_rate_limited', 'Trop de tentatives. Reessayez dans quelques minutes.', [ 'status' => 429 ] );
    }

    set_transient( $key, $count + 1, 5 * MINUTE_IN_SECONDS );
    return true;
}

/**
 * Authentication bootstrap routes are intentionally reachable before login.
 * Their handlers validate provider proofs and enforce per-IP/account limits.
 */
function lamako_mobile_public_auth_permission() {
    return true;
}

function lamako_mobile_enforce_public_auth_rate_limit( $action, $limit, $window, $dimension = '' ) {
    $address = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
    $key     = 'lamako_auth_' . md5( sanitize_key( $action ) . '|' . $address . '|' . strtolower( (string) $dimension ) );
    $count   = (int) get_transient( $key );
    if ( $count >= max( 1, (int) $limit ) ) {
        return new WP_Error( 'auth_rate_limited', 'Trop de tentatives. Reessayez dans quelques minutes.', [ 'status' => 429 ] );
    }

    set_transient( $key, $count + 1, max( MINUTE_IN_SECONDS, (int) $window ) );
    return true;
}

function lamako_mobile_consume_social_nonce( $provider, $nonce, $provider_id ) {
    if ( $nonce === '' ) {
        return true;
    }

    $key = 'lamako_nonce_' . md5( sanitize_key( $provider ) . '|' . (string) $provider_id . '|' . (string) $nonce );
    if ( get_transient( $key ) ) {
        return new WP_Error( 'social_nonce_replayed', 'Cette preuve de connexion a deja ete utilisee. Recommencez la connexion.', [ 'status' => 401 ] );
    }

    set_transient( $key, 1, 10 * MINUTE_IN_SECONDS );
    return true;
}

function lamako_mobile_social_claim_is_true( $value ) {
    return $value === true || $value === 1 || $value === '1' || $value === 'true';
}

function lamako_mobile_social_identity_is_linked( $provider, $provider_id ) {
    if ( empty( $provider ) || empty( $provider_id ) ) {
        return false;
    }

    $meta_keys = [
        '_lamako_social_' . sanitize_key( $provider ) . '_id',
        '_social_login_' . sanitize_key( $provider ) . '_id',
    ];
    foreach ( $meta_keys as $meta_key ) {
        $users = get_users( [
            'meta_key'   => $meta_key,
            'meta_value' => (string) $provider_id,
            'number'     => 1,
            'fields'     => 'ids',
        ] );
        if ( ! empty( $users ) ) {
            return true;
        }
    }

    return false;
}

function lamako_mobile_validate_google_identity( $token, $nonce = '' ) {
    if ( substr_count( (string) $token, '.' ) === 2 ) {
        $payload = lamako_mobile_verify_oidc_token( $token, [
            'jwks_url'   => 'https://www.googleapis.com/oauth2/v3/certs',
            'cache_key'  => 'lamako_google_jwks',
            'issuers'    => [ 'https://accounts.google.com', 'accounts.google.com' ],
            'client_ids' => lamako_mobile_google_client_ids(),
            'nonce'      => $nonce,
        ] );
        if ( is_wp_error( $payload ) ) {
            return $payload;
        }

        if ( empty( $payload['sub'] ) || empty( $payload['email'] ) || ! lamako_mobile_social_claim_is_true( $payload['email_verified'] ?? false ) ) {
            return new WP_Error( 'google_identity_invalid', 'Le compte Google ne fournit pas une adresse e-mail verifiee.', [ 'status' => 401 ] );
        }

        return [
            'provider_id' => (string) $payload['sub'],
            'email'       => sanitize_email( $payload['email'] ),
            'first_name'  => sanitize_text_field( $payload['given_name'] ?? '' ),
            'last_name'   => sanitize_text_field( $payload['family_name'] ?? '' ),
            'avatar'      => esc_url_raw( $payload['picture'] ?? '' ),
        ];
    }

    // Temporary compatibility for the client build already submitted to Apple.
    if ( defined( 'LAMAKO_ALLOW_LEGACY_GOOGLE_ACCESS_TOKEN' ) && ! LAMAKO_ALLOW_LEGACY_GOOGLE_ACCESS_TOKEN ) {
        return new WP_Error( 'google_client_update_required', 'Mettez a jour l application pour continuer avec Google.', [ 'status' => 426 ] );
    }

    $token_info = wp_safe_remote_get( add_query_arg( 'access_token', $token, 'https://oauth2.googleapis.com/tokeninfo' ), [
        'timeout'     => 8,
        'redirection' => 0,
    ] );
    $token_body = is_wp_error( $token_info ) ? [] : json_decode( wp_remote_retrieve_body( $token_info ), true );
    if ( is_wp_error( $token_info ) || wp_remote_retrieve_response_code( $token_info ) !== 200 || empty( $token_body['aud'] ) ) {
        return new WP_Error( 'google_invalid', 'Token Google invalide ou expire.', [ 'status' => 401 ] );
    }
    if ( ! in_array( (string) $token_body['aud'], lamako_mobile_google_client_ids(), true ) ) {
        return new WP_Error( 'google_audience_invalid', 'Application Google non autorisee.', [ 'status' => 401 ] );
    }

    $userinfo = wp_safe_remote_get( 'https://www.googleapis.com/oauth2/v3/userinfo', [
        'headers'     => [ 'Authorization' => 'Bearer ' . $token ],
        'timeout'     => 8,
        'redirection' => 0,
    ] );
    $profile = is_wp_error( $userinfo ) ? [] : json_decode( wp_remote_retrieve_body( $userinfo ), true );
    if ( is_wp_error( $userinfo ) || wp_remote_retrieve_response_code( $userinfo ) !== 200 || empty( $profile['sub'] ) || empty( $profile['email'] ) || ! lamako_mobile_social_claim_is_true( $profile['email_verified'] ?? false ) ) {
        return new WP_Error( 'google_identity_invalid', 'Identite Google non verifiable.', [ 'status' => 401 ] );
    }

    return [
        'provider_id' => (string) $profile['sub'],
        'email'       => sanitize_email( $profile['email'] ),
        'first_name'  => sanitize_text_field( $profile['given_name'] ?? '' ),
        'last_name'   => sanitize_text_field( $profile['family_name'] ?? '' ),
        'avatar'      => esc_url_raw( $profile['picture'] ?? '' ),
    ];
}

function lamako_mobile_validate_facebook_identity( $token ) {
    $credentials = lamako_mobile_facebook_server_credentials();
    $app_id      = (string) ( $credentials['app_id'] ?? '' );
    $app_secret  = (string) ( $credentials['app_secret'] ?? '' );

    if ( $app_id === '' || $app_secret === '' ) {
        return new WP_Error( 'facebook_unconfigured', 'Connexion Facebook temporairement indisponible.', [ 'status' => 503 ] );
    }

    $graph_base = 'https://graph.facebook.com/v24.0';
    $debug_url = add_query_arg( [
        'input_token'  => $token,
        'access_token' => $app_id . '|' . $app_secret,
    ], $graph_base . '/debug_token' );
    $debug_response = wp_safe_remote_get( $debug_url, [
        'timeout'     => 8,
        'redirection' => 0,
    ] );
    $debug_body = is_wp_error( $debug_response ) ? [] : json_decode( wp_remote_retrieve_body( $debug_response ), true );
    $debug_data = $debug_body['data'] ?? [];
    if (
        is_wp_error( $debug_response ) ||
        wp_remote_retrieve_response_code( $debug_response ) !== 200 ||
        empty( $debug_data['is_valid'] ) ||
        empty( $debug_data['user_id'] ) ||
        ! hash_equals( $app_id, (string) ( $debug_data['app_id'] ?? '' ) )
    ) {
        return new WP_Error( 'facebook_invalid', 'Token Facebook invalide ou expire.', [ 'status' => 401 ] );
    }

    $profile_url = add_query_arg( 'fields', 'id,email,first_name,last_name,picture.type(large)', $graph_base . '/me' );
    $profile_response = wp_safe_remote_get( $profile_url, [
        'headers'     => [ 'Authorization' => 'Bearer ' . $token ],
        'timeout'     => 8,
        'redirection' => 0,
    ] );
    $profile = is_wp_error( $profile_response ) ? [] : json_decode( wp_remote_retrieve_body( $profile_response ), true );
    if (
        is_wp_error( $profile_response ) ||
        wp_remote_retrieve_response_code( $profile_response ) !== 200 ||
        empty( $profile['id'] ) ||
        ! hash_equals( (string) $debug_data['user_id'], (string) $profile['id'] ) ||
        empty( $profile['email'] )
    ) {
        return new WP_Error( 'facebook_identity_invalid', 'Le compte Facebook ne fournit pas une adresse e-mail verifiable.', [ 'status' => 401 ] );
    }

    return [
        'provider_id' => (string) $profile['id'],
        'email'       => sanitize_email( $profile['email'] ),
        'first_name'  => sanitize_text_field( $profile['first_name'] ?? '' ),
        'last_name'   => sanitize_text_field( $profile['last_name'] ?? '' ),
        'avatar'      => esc_url_raw( $profile['picture']['data']['url'] ?? '' ),
    ];
}

function lamako_mobile_validate_apple_identity( $token, $nonce = '', $first_name = '', $last_name = '' ) {
    $payload = lamako_mobile_verify_oidc_token( $token, [
        'jwks_url'   => 'https://appleid.apple.com/auth/keys',
        'cache_key'  => 'lamako_apple_jwks',
        'issuers'    => [ 'https://appleid.apple.com' ],
        'client_ids' => lamako_mobile_apple_client_ids(),
        'nonce'      => $nonce,
    ] );
    if ( is_wp_error( $payload ) ) {
        return $payload;
    }
    if ( empty( $payload['sub'] ) ) {
        return new WP_Error( 'apple_identity_invalid', 'Identite Apple non verifiable.', [ 'status' => 401 ] );
    }
    if ( ! empty( $payload['email'] ) && ! lamako_mobile_social_claim_is_true( $payload['email_verified'] ?? false ) ) {
        return new WP_Error( 'apple_email_unverified', 'Le compte Apple ne fournit pas une adresse e-mail verifiee.', [ 'status' => 401 ] );
    }

    return [
        'provider_id' => (string) $payload['sub'],
        'email'       => sanitize_email( $payload['email'] ?? '' ),
        'first_name'  => sanitize_text_field( $first_name ),
        'last_name'   => sanitize_text_field( $last_name ),
        'avatar'      => '',
    ];
}
