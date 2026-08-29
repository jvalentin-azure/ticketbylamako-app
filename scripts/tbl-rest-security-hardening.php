<?php
/**
 * Plugin Name: TicketByLamako REST Security Hardening
 * Description: Restricts credentialed REST CORS, hardens REST headers and PHP sessions, and normalizes JWT login failures.
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! function_exists( 'tbl_rest_session_is_secure_request' ) ) {
    function tbl_rest_session_is_secure_request() {
        if ( function_exists( 'is_ssl' ) && is_ssl() ) {
            return true;
        }

        $https = isset( $_SERVER['HTTPS'] ) ? strtolower( trim( (string) $_SERVER['HTTPS'] ) ) : '';
        if ( $https !== '' && $https !== 'off' && $https !== '0' ) {
            return true;
        }

        $forwarded_proto = isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] )
            ? strtolower( trim( explode( ',', (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] )[0] ) )
            : '';
        if ( $forwarded_proto === 'https' ) {
            return true;
        }

        if ( isset( $_SERVER['SERVER_PORT'] ) && (int) $_SERVER['SERVER_PORT'] === 443 ) {
            return true;
        }

        return function_exists( 'wp_get_environment_type' ) && wp_get_environment_type() === 'production';
    }
}

if ( ! function_exists( 'tbl_rest_session_cookie_policy' ) ) {
    function tbl_rest_session_cookie_policy() {
        return [
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => tbl_rest_session_is_secure_request(),
            'httponly' => true,
            'samesite' => 'Lax',
        ];
    }
}

if ( ! function_exists( 'tbl_rest_harden_php_session_cookie' ) ) {
    /**
     * Apply the policy before Tickera, Seating Charts, Breeze or another
     * plugin starts PHP's global session. This function never starts one.
     */
    function tbl_rest_harden_php_session_cookie() {
        if ( session_status() !== PHP_SESSION_NONE || headers_sent() ) {
            return false;
        }

        $policy = tbl_rest_session_cookie_policy();
        if ( PHP_VERSION_ID >= 70300 ) {
            session_set_cookie_params( $policy );
        } else {
            session_set_cookie_params(
                0,
                '/; samesite=Lax',
                '',
                $policy['secure'],
                true
            );
        }

        ini_set( 'session.cookie_path', '/' );
        ini_set( 'session.cookie_httponly', '1' );
        ini_set( 'session.cookie_samesite', 'Lax' );
        ini_set( 'session.cookie_secure', $policy['secure'] ? '1' : '0' );
        ini_set( 'session.use_cookies', '1' );
        ini_set( 'session.use_only_cookies', '1' );
        ini_set( 'session.use_strict_mode', '1' );
        return true;
    }
}

// MU plugins run before normal plugins. Reapply on Tickera's explicit hook in
// case another early component changed PHP's session INI values meanwhile.
tbl_rest_harden_php_session_cookie();
add_action( 'tickera_before_session_start', 'tbl_rest_harden_php_session_cookie', PHP_INT_MIN );

if ( ! function_exists( 'tbl_rest_normalize_origin' ) ) {
    function tbl_rest_normalize_origin( $origin ) {
        $parts = wp_parse_url( trim( (string) $origin ) );
        if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
            return '';
        }
        $scheme = strtolower( (string) $parts['scheme'] );
        if ( ! in_array( $scheme, [ 'http', 'https' ], true ) ) {
            return '';
        }
        $normalized = $scheme . '://' . strtolower( (string) $parts['host'] );
        if ( ! empty( $parts['port'] ) ) {
            $normalized .= ':' . absint( $parts['port'] );
        }
        return $normalized;
    }
}

if ( ! function_exists( 'tbl_rest_allowed_origins' ) ) {
    function tbl_rest_allowed_origins() {
        $origins = [
            home_url(),
            site_url(),
            'https://www.ticketbylamako.com',
            'https://staging.ticketbylamako.com',
        ];
        if ( defined( 'TBL_REST_ALLOWED_ORIGINS' ) ) {
            $origins = array_merge( $origins, preg_split( '/[\s,]+/', (string) TBL_REST_ALLOWED_ORIGINS ) );
        }
        $origins = apply_filters( 'tbl_rest_allowed_origins', $origins );
        return array_values( array_unique( array_filter( array_map( 'tbl_rest_normalize_origin', (array) $origins ) ) ) );
    }
}

if ( ! function_exists( 'tbl_rest_origin_is_allowed' ) ) {
    function tbl_rest_origin_is_allowed( $origin ) {
        $normalized = tbl_rest_normalize_origin( $origin );
        return $normalized !== '' && in_array( $normalized, tbl_rest_allowed_origins(), true );
    }
}

if ( ! function_exists( 'tbl_rest_remove_default_cors' ) ) {
    function tbl_rest_remove_default_cors() {
        remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
    }
}
add_action( 'init', 'tbl_rest_remove_default_cors', 100 );
add_action( 'rest_api_init', 'tbl_rest_remove_default_cors', 1 );

if ( ! function_exists( 'tbl_rest_restricted_cors_headers' ) ) {
    function tbl_rest_restricted_cors_headers( $served ) {
        $origin = get_http_origin();
        if ( ! $origin || ! tbl_rest_origin_is_allowed( $origin ) ) {
            return $served;
        }
        header( 'Access-Control-Allow-Origin: ' . esc_url_raw( tbl_rest_normalize_origin( $origin ) ) );
        header( 'Access-Control-Allow-Credentials: true' );
        header( 'Access-Control-Allow-Methods: OPTIONS, GET, POST, PUT, PATCH, DELETE' );
        header( 'Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-WP-Nonce' );
        header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages, Link' );
        header( 'Vary: Origin', false );
        return $served;
    }
}
add_filter( 'rest_pre_serve_request', 'tbl_rest_restricted_cors_headers', 10 );

if ( ! function_exists( 'tbl_rest_reject_untrusted_origin' ) ) {
    function tbl_rest_reject_untrusted_origin( $result, $server, $request ) {
        $origin = get_http_origin();
        if ( $origin && ! tbl_rest_origin_is_allowed( $origin ) ) {
            return new WP_Error( 'rest_origin_forbidden', 'Origin is not allowed for this REST API.', [ 'status' => 403 ] );
        }
        return $result;
    }
}
add_filter( 'rest_pre_dispatch', 'tbl_rest_reject_untrusted_origin', 1, 3 );

// WordPress and WooCommerce may add their own CORS headers after plugins are
// loaded. Normalize the final response at the latest filter priority so an
// earlier reflected origin cannot survive alongside this allowlist.
if ( ! function_exists( 'tbl_rest_finalize_cors_headers' ) ) {
    function tbl_rest_finalize_cors_headers( $served ) {
        foreach ( [
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Credentials',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers',
            'Access-Control-Expose-Headers',
            'Access-Control-Max-Age',
        ] as $name ) {
            header_remove( $name );
        }

        $origin = get_http_origin();
        if ( ! $origin || ! tbl_rest_origin_is_allowed( $origin ) ) {
            return $served;
        }
        header( 'Access-Control-Allow-Origin: ' . esc_url_raw( tbl_rest_normalize_origin( $origin ) ) );
        header( 'Access-Control-Allow-Credentials: true' );
        header( 'Access-Control-Allow-Methods: OPTIONS, GET, POST, PUT, PATCH, DELETE' );
        header( 'Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-WP-Nonce' );
        header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages, Link' );
        header( 'Vary: Origin', false );
        return $served;
    }
}
add_filter( 'rest_pre_serve_request', 'tbl_rest_finalize_cors_headers', PHP_INT_MAX );

if ( ! function_exists( 'tbl_rest_security_headers' ) ) {
    function tbl_rest_security_headers( $served, $result, $request ) {
        header( 'X-Content-Type-Options: nosniff' );
        header( 'X-Frame-Options: DENY' );
        header( 'Referrer-Policy: no-referrer' );
        $route = $request instanceof WP_REST_Request ? (string) $request->get_route() : '';
        if ( preg_match( '#^/(?:tbl-|lamako-mobile/|lamako-pos/|jwt-auth/)#', $route ) ) {
            header( "Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox" );
            header( 'Cache-Control: no-store, private' );
        }
        if ( is_ssl() ) {
            header( 'Strict-Transport-Security: max-age=31536000; includeSubDomains' );
        }
        return $served;
    }
}
add_filter( 'rest_pre_serve_request', 'tbl_rest_security_headers', 20, 3 );

if ( ! function_exists( 'tbl_normalize_jwt_authentication_error' ) ) {
    function tbl_normalize_jwt_authentication_error( $user ) {
        if ( ! is_wp_error( $user ) || ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
            return $user;
        }
        $route = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
        if ( strpos( $route, '/wp-json/jwt-auth/v1/token' ) === false ) {
            return $user;
        }
        $sensitive_codes = [
            'invalid_username',
            'invalid_email',
            'incorrect_password',
            'authentication_failed',
            'empty_username',
            'empty_password',
        ];
        if ( count( array_intersect( $sensitive_codes, $user->get_error_codes() ) ) === 0 ) {
            return $user;
        }
        return new WP_Error(
            'authentication_failed',
            'Identifiant ou mot de passe incorrect.',
            [ 'status' => 403 ]
        );
    }
}
add_filter( 'authenticate', 'tbl_normalize_jwt_authentication_error', 99, 1 );
