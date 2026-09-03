<?php
/**
 * Plugin Name: TicketByLamako Tickera Stateless Public Guard
 * Description: Prevents Tickera's global cart bootstrap from opening PHP sessions on explicitly stateless public reads.
 * Version: 0.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_method_is_safe' ) ) {
    function tbl_tickera_stateless_rest_method_is_safe() {
        $method = isset( $_SERVER['REQUEST_METHOD'] ) && is_string( $_SERVER['REQUEST_METHOD'] )
            ? $_SERVER['REQUEST_METHOD']
            : '';

        return in_array( $method, [ 'GET', 'HEAD', 'OPTIONS' ], true );
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_server_field_empty' ) ) {
    function tbl_tickera_stateless_server_field_empty( $key ) {
        return ! array_key_exists( $key, $_SERVER ) || $_SERVER[ $key ] === '';
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_content_length_empty_or_zero' ) ) {
    function tbl_tickera_stateless_content_length_empty_or_zero() {
        return tbl_tickera_stateless_server_field_empty( 'CONTENT_LENGTH' )
            || $_SERVER['CONTENT_LENGTH'] === '0';
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_public_home_has_stateful_context' ) ) {
    /**
     * Treat every authentication, PHP-session or commerce cookie as stateful.
     * Unrelated consent/analytics cookies do not need to force Tickera's PHP
     * session open on an otherwise passive homepage request.
     */
    function tbl_tickera_stateless_public_home_has_stateful_context() {
        if (
            ! function_exists( 'session_status' )
            || session_status() !== PHP_SESSION_NONE
        ) {
            return true;
        }

        $session_cookie = function_exists( 'session_name' ) ? (string) session_name() : 'PHPSESSID';
        if (
            $session_cookie === ''
            || ! preg_match( '/^[A-Za-z0-9_-]+$/D', $session_cookie )
        ) {
            return true;
        }

        foreach ( (array) $_COOKIE as $key => $value ) {
            if ( ! is_string( $key ) || is_array( $value ) ) {
                return true;
            }

            $normalized = strtolower( $key );
            if (
                $key === $session_cookie
                || strpos( $normalized, 'wordpress_' ) === 0
                || strpos( $normalized, 'wp_woocommerce_session_' ) === 0
                || in_array(
                    $normalized,
                    [ 'woocommerce_items_in_cart', 'woocommerce_cart_hash' ],
                    true
                )
            ) {
                return true;
            }
        }

        return false;
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_public_home_request_is_allowlisted' ) ) {
    /**
     * The only non-REST request eligible for the bypass is a truly passive,
     * anonymous canonical homepage GET/HEAD. Every alternate path, query,
     * body, upload, authorization header or stateful cookie fails closed.
     */
    function tbl_tickera_stateless_public_home_request_is_allowlisted() {
        $method = isset( $_SERVER['REQUEST_METHOD'] ) && is_string( $_SERVER['REQUEST_METHOD'] )
            ? $_SERVER['REQUEST_METHOD']
            : '';
        if ( ! in_array( $method, [ 'GET', 'HEAD' ], true ) ) {
            return false;
        }

        if (
            array_key_exists( 'HTTP_X_HTTP_METHOD_OVERRIDE', $_SERVER )
            || array_key_exists( 'HTTP_AUTHORIZATION', $_SERVER )
            || array_key_exists( 'REDIRECT_HTTP_AUTHORIZATION', $_SERVER )
            || array_key_exists( 'PHP_AUTH_USER', $_SERVER )
            || array_key_exists( 'PHP_AUTH_PW', $_SERVER )
            || array_key_exists( 'AUTH_TYPE', $_SERVER )
            || array_key_exists( 'REMOTE_USER', $_SERVER )
            || ! tbl_tickera_stateless_content_length_empty_or_zero()
            || ! tbl_tickera_stateless_server_field_empty( 'CONTENT_TYPE' )
            || ! tbl_tickera_stateless_server_field_empty( 'HTTP_TRANSFER_ENCODING' )
        ) {
            return false;
        }

        $request_uri = isset( $_SERVER['REQUEST_URI'] ) && is_string( $_SERVER['REQUEST_URI'] )
            ? (string) wp_unslash( $_SERVER['REQUEST_URI'] )
            : '';
        $query_string = isset( $_SERVER['QUERY_STRING'] ) && is_string( $_SERVER['QUERY_STRING'] )
            ? (string) $_SERVER['QUERY_STRING']
            : '';

        return $request_uri === '/'
            && $query_string === ''
            && empty( $_GET )
            && empty( $_POST )
            && empty( $_FILES )
            && ! tbl_tickera_stateless_public_home_has_stateful_context();
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_bridge_blocks_callback' ) ) {
    function tbl_tickera_stateless_bridge_blocks_callback() {
        global $wp_filter;

        $hook = isset( $wp_filter['woocommerce_blocks_loaded'] )
            ? $wp_filter['woocommerce_blocks_loaded']
            : null;
        if (
            ! is_object( $hook )
            || ! property_exists( $hook, 'callbacks' )
            || ! is_array( $hook->callbacks )
        ) {
            return null;
        }

        $matches = [];
        foreach ( (array) ( $hook->callbacks[10] ?? [] ) as $entry ) {
            $callback = is_array( $entry ) ? ( $entry['function'] ?? null ) : null;
            if (
                is_array( $callback )
                && count( $callback ) === 2
                && is_object( $callback[0] )
                && $callback[0] instanceof TC_WooCommerce_Bridge
                && $callback[1] === 'init_block_integration'
                && is_callable( $callback )
            ) {
                $matches[] = $callback;
            }
        }

        return count( $matches ) === 1 ? $matches[0] : null;
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_disable_bridge_blocks_bootstrap' ) ) {
    /**
     * The WooCommerce bridge eagerly reads Tickera's cart when Blocks loads,
     * even when the current request cannot render or mutate checkout state.
     */
    function tbl_tickera_stateless_disable_bridge_blocks_bootstrap() {
        if ( ! tbl_tickera_stateless_request_is_allowlisted() ) {
            return false;
        }

        if (
            ! class_exists( 'TC_WooCommerce_Bridge', false )
        ) {
            return false;
        }

        $callback = tbl_tickera_stateless_bridge_blocks_callback();
        if ( ! is_array( $callback ) ) {
            return false;
        }
        if ( has_action( 'woocommerce_blocks_loaded', $callback ) !== 10 ) {
            return false;
        }
        if ( ! remove_action( 'woocommerce_blocks_loaded', $callback, 10 ) ) {
            return false;
        }
        if ( has_action( 'woocommerce_blocks_loaded', $callback ) === false ) {
            return true;
        }

        add_action( 'woocommerce_blocks_loaded', $callback, 10 );
        return false;
    }
}

add_action(
    'plugins_loaded',
    'tbl_tickera_stateless_disable_bridge_blocks_bootstrap',
    PHP_INT_MIN
);

if ( ! function_exists( 'tbl_tickera_stateless_rest_route_is_canonical' ) ) {
    function tbl_tickera_stateless_rest_route_is_canonical( $route ) {
        $route = (string) $route;
        if (
            $route === ''
            || $route[0] !== '/'
            || strpos( $route, '%' ) !== false
            || strpos( $route, '\\' ) !== false
            || strpos( $route, '//' ) !== false
            || strpos( $route, '?' ) !== false
            || strpos( $route, '#' ) !== false
            || preg_match( '/[\x00-\x20\x7f]/', $route )
            || preg_match( '#(?:^|/)\.{1,2}(?:/|$)#', $route )
        ) {
            return false;
        }

        return true;
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_query_key_is_stateful' ) ) {
    function tbl_tickera_stateless_rest_query_key_is_stateful( $key ) {
        return in_array(
            strtolower( (string) $key ),
            [
                'lamako_checkout',
                'lamako_checkout_token',
                'lamako_seat_embed',
                'lamako_seating_checkout',
                'lamako_seating_token',
                'pay_for_order',
                'wc-api',
                'wc_api',
                'wc-ajax',
                'add-to-cart',
                'remove_item',
                'apply_coupon',
                'update_cart',
                'cart_action',
            ],
            true
        );
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_query_route' ) ) {
    /**
     * Read the raw query instead of parse_str() so duplicate or array-shaped
     * rest_route keys cannot be collapsed into an apparently safe value.
     *
     * @return array{present: bool, valid: bool, route: string, method_override: bool, stateful_query: bool}
     */
    function tbl_tickera_stateless_rest_query_route( $raw_query ) {
        $result = [
            'present' => false,
            'valid'   => true,
            'route'   => '',
            'method_override' => false,
            'stateful_query'  => false,
        ];

        $raw_query = (string) $raw_query;
        if ( $raw_query === '' ) {
            return $result;
        }

        // A semicolon can be configured as a PHP query separator. Refuse it
        // instead of allowing PHP and this classifier to see different keys.
        if ( strpos( $raw_query, ';' ) !== false ) {
            $result['valid'] = false;
            return $result;
        }

        foreach ( explode( '&', $raw_query ) as $pair ) {
            $parts     = explode( '=', $pair, 2 );
            $raw_key   = $parts[0];
            $raw_value = isset( $parts[1] ) ? $parts[1] : '';
            $key        = str_replace( '+', ' ', $raw_key );
            $decoded    = rawurldecode( $key );
            $normalized = str_replace( [ '.', ' ' ], '_', $decoded );

            $looks_like_route = strcasecmp( $normalized, 'rest_route' ) === 0
                || preg_match( '/^rest_route\[.*\]$/i', $normalized );
            $looks_like_override = strcasecmp( $normalized, '_method' ) === 0
                || preg_match( '/^_method\[.*\]$/i', $normalized );
            if ( tbl_tickera_stateless_rest_query_key_is_stateful( $normalized ) ) {
                $result['valid']          = false;
                $result['stateful_query'] = true;
                continue;
            }

            if ( $looks_like_override ) {
                $result['valid']           = false;
                $result['method_override'] = true;
                continue;
            }

            if ( ! $looks_like_route ) {
                continue;
            }

            if (
                $result['present']
                || $raw_key !== 'rest_route'
                || $decoded !== 'rest_route'
                || strpos( $raw_value, '%' ) !== false
                || strpos( $raw_value, '+' ) !== false
            ) {
                $result['present'] = true;
                $result['valid']   = false;
                continue;
            }

            $result['present'] = true;
            $result['route']   = $raw_value;
        }

        return $result;
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_route_from_request' ) ) {
    function tbl_tickera_stateless_rest_route_from_request() {
        if ( array_key_exists( 'HTTP_X_HTTP_METHOD_OVERRIDE', $_SERVER ) ) {
            return '';
        }

        $request_uri = isset( $_SERVER['REQUEST_URI'] )
            ? (string) wp_unslash( $_SERVER['REQUEST_URI'] )
            : '';
        if (
            $request_uri === ''
            || $request_uri[0] !== '/'
            || strpos( $request_uri, '#' ) !== false
            || preg_match( '/[\x00-\x1f\x7f]/', $request_uri )
        ) {
            return '';
        }

        $uri_parts = explode( '?', $request_uri, 2 );
        $path      = $uri_parts[0];
        $raw_query = isset( $uri_parts[1] ) ? $uri_parts[1] : '';
        if ( ! tbl_tickera_stateless_rest_route_is_canonical( $path ) ) {
            return '';
        }

        $query_route = tbl_tickera_stateless_rest_query_route( $raw_query );
        if (
            ! $query_route['valid']
            || $query_route['method_override']
            || $query_route['stateful_query']
        ) {
            return '';
        }

        $get_route   = null;
        $get_matches = 0;
        foreach ( (array) $_GET as $key => $value ) {
            $key = (string) $key;
            if ( tbl_tickera_stateless_rest_query_key_is_stateful( $key ) ) {
                return '';
            }

            if (
                strcasecmp( $key, '_method' ) === 0
                || preg_match( '/^_method\[.*\]$/i', $key )
            ) {
                return '';
            }

            if (
                strcasecmp( $key, 'rest_route' ) === 0
                || preg_match( '/^rest_route\[.*\]$/i', $key )
            ) {
                $get_matches++;
                if ( $key === 'rest_route' && is_string( $value ) ) {
                    $get_route = (string) wp_unslash( $value );
                }
            }
        }

        if ( $query_route['present'] ) {
            if (
                $get_matches !== 1
                || $get_route === null
                || $get_route !== $query_route['route']
                || ( $path !== '/' && $path !== '/index.php' )
                || ! tbl_tickera_stateless_rest_route_is_canonical( $query_route['route'] )
            ) {
                return '';
            }

            return $query_route['route'];
        }

        if ( $get_matches !== 0 || strpos( $path, '/wp-json/' ) !== 0 ) {
            return '';
        }

        $route = substr( $path, strlen( '/wp-json' ) );
        return tbl_tickera_stateless_rest_route_is_canonical( $route ) ? $route : '';
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_query_is_allowlisted' ) ) {
    function tbl_tickera_stateless_rest_query_is_allowlisted( $route ) {
        $allowed_keys = [ 'rest_route' ];
        if ( $route === '/lamako-mobile/v2/public/home-data' ) {
            $allowed_keys = array_merge( $allowed_keys, [ 'summary', 'events_limit', 'products_limit' ] );
        } elseif ( $route === '/lamako-mobile/v2/public/events-data' ) {
            $allowed_keys = array_merge( $allowed_keys, [ 'summary', 'limit' ] );
        } elseif ( $route === '/lamako-mobile/v2/public/shop-data' ) {
            $allowed_keys[] = 'limit';
        }

        $request_uri = isset( $_SERVER['REQUEST_URI'] ) && is_string( $_SERVER['REQUEST_URI'] )
            ? (string) wp_unslash( $_SERVER['REQUEST_URI'] )
            : '';
        $uri_parts   = explode( '?', $request_uri, 2 );
        $raw_query   = isset( $uri_parts[1] ) ? $uri_parts[1] : '';
        if ( $raw_query === '' ) {
            return empty( $_GET );
        }

        $seen = [];
        foreach ( explode( '&', $raw_query ) as $pair ) {
            if ( $pair === '' ) {
                return false;
            }

            $parts   = explode( '=', $pair, 2 );
            $raw_key = $parts[0];
            if (
                $raw_key === ''
                || preg_match( '/[^a-z0-9_-]/', $raw_key )
                || ! in_array( $raw_key, $allowed_keys, true )
                || isset( $seen[ $raw_key ] )
            ) {
                return false;
            }
            $seen[ $raw_key ] = true;
        }

        if ( count( $seen ) !== count( (array) $_GET ) ) {
            return false;
        }
        foreach ( (array) $_GET as $key => $value ) {
            if (
                ! is_string( $key )
                || ! isset( $seen[ $key ] )
                || ! is_string( $value )
            ) {
                return false;
            }
        }

        return true;
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_request_is_allowlisted' ) ) {
    function tbl_tickera_stateless_rest_request_is_allowlisted() {
        if ( ! tbl_tickera_stateless_rest_method_is_safe() ) {
            return false;
        }

        $route = tbl_tickera_stateless_rest_route_from_request();
        $route_is_allowlisted = (bool) preg_match(
            '#^/lamako-mobile/v2/(?:rewards/config|web-session|public/(?:home-data|events-data|shop-data|events/[0-9]+|products/[0-9]+))$#D',
            $route
        );
        return $route_is_allowlisted
            && tbl_tickera_stateless_rest_query_is_allowlisted( $route );
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_request_is_allowlisted' ) ) {
    function tbl_tickera_stateless_request_is_allowlisted() {
        return tbl_tickera_stateless_rest_request_is_allowlisted()
            || tbl_tickera_stateless_public_home_request_is_allowlisted();
    }
}

if ( ! function_exists( 'tbl_tickera_stateless_rest_disable_global_cart_bootstrap' ) ) {
    /**
     * Remove only Tickera's unconditional wp_loaded cart bootstrap. Tickera's
     * admin-post, payment, cart, checkout and Seating hooks remain untouched.
     */
    function tbl_tickera_stateless_rest_disable_global_cart_bootstrap() {
        if ( ! tbl_tickera_stateless_request_is_allowlisted() ) {
            return false;
        }

        global $tc;
        if (
            ! class_exists( '\\Tickera\\TC', false )
            || ! is_object( $tc )
            || ! ( $tc instanceof \Tickera\TC )
            || ! property_exists( $tc, 'version' )
            || ! isset( $tc->version )
            || (string) $tc->version !== '3.6.0.2'
            || ! is_callable( [ $tc, 'update_cart' ] )
        ) {
            return false;
        }

        $callback = [ $tc, 'update_cart' ];
        $priority = has_action( 'wp_loaded', $callback );
        if ( $priority !== 10 ) {
            return false;
        }

        if ( ! remove_action( 'wp_loaded', $callback, 10 ) ) {
            return false;
        }

        if ( has_action( 'wp_loaded', $callback ) === false ) {
            return true;
        }

        // Restore the proven baseline if post-removal verification is not
        // exact. Leaving Tickera stateful is safer than a partial hook change.
        add_action( 'wp_loaded', $callback, 10 );
        return false;
    }
}

add_action(
    'wp_loaded',
    'tbl_tickera_stateless_rest_disable_global_cart_bootstrap',
    PHP_INT_MIN
);
