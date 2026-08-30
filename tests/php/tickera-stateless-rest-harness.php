<?php

declare(strict_types=1);

namespace Tickera {
    function session_start(): bool {
        $GLOBALS['tbl_tickera_test_session_start_calls']++;
        return true;
    }

    class TC {
        public string $version = '3.6.0.2';

        public function update_cart(): void {
            session_start();
        }
    }
}

namespace {
    if ( $argc !== 2 ) {
        fwrite( STDERR, "Usage: php tickera-stateless-rest-harness.php <scenario>\n" );
        exit( 2 );
    }

    $scenarios = [
        'pretty-get-home' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'pretty-head-event' => [ 'HEAD', '/wp-json/lamako-mobile/v2/public/events/13459', [], 10, false ],
        'pretty-options-product' => [ 'OPTIONS', '/wp-json/lamako-mobile/v2/public/products/13845', [], 10, false ],
        'pretty-get-events' => [ 'GET', '/wp-json/lamako-mobile/v2/public/events-data?summary=1&limit=80', [ 'summary' => '1', 'limit' => '80' ], 10, false ],
        'pretty-get-shop' => [ 'GET', '/wp-json/lamako-mobile/v2/public/shop-data?limit=40', [ 'limit' => '40' ], 10, false ],
        'pretty-head-rewards' => [ 'HEAD', '/wp-json/lamako-mobile/v2/rewards/config', [], 10, false ],
        'pretty-options-session' => [ 'OPTIONS', '/wp-json/lamako-mobile/v2/web-session', [], 10, false ],
        'query-get-rewards' => [ 'GET', '/?rest_route=/lamako-mobile/v2/rewards/config', [ 'rest_route' => '/lamako-mobile/v2/rewards/config' ], 10, false ],
        'query-head-session' => [ 'HEAD', '/index.php?rest_route=/lamako-mobile/v2/web-session', [ 'rest_route' => '/lamako-mobile/v2/web-session' ], 10, false ],
        'query-get-home' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data&summary=1&events_limit=12&products_limit=8',
            [
                'rest_route' => '/lamako-mobile/v2/public/home-data',
                'summary' => '1',
                'events_limit' => '12',
                'products_limit' => '8',
            ],
            10,
            false,
        ],
        'query-options-events' => [
            'OPTIONS',
            '/?rest_route=/lamako-mobile/v2/public/events-data&summary=1&limit=80',
            [ 'rest_route' => '/lamako-mobile/v2/public/events-data', 'summary' => '1', 'limit' => '80' ],
            10,
            false,
        ],
        'query-head-shop' => [
            'HEAD',
            '/?rest_route=/lamako-mobile/v2/public/shop-data&limit=40',
            [ 'rest_route' => '/lamako-mobile/v2/public/shop-data', 'limit' => '40' ],
            10,
            false,
        ],
        'query-get-event' => [ 'GET', '/?rest_route=/lamako-mobile/v2/public/events/13459', [ 'rest_route' => '/lamako-mobile/v2/public/events/13459' ], 10, false ],
        'query-options-product' => [ 'OPTIONS', '/?rest_route=/lamako-mobile/v2/public/products/13845', [ 'rest_route' => '/lamako-mobile/v2/public/products/13845' ], 10, false ],
        'late-register-get-home' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data', [], null, false, null, true ],
        'post-allowlist' => [ 'POST', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'delete-allowlist' => [ 'DELETE', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'missing-method' => [ null, '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'lowercase-method' => [ 'get', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'whitespace-method' => [ ' GET ', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'pretty-trailing-slash' => [ 'GET', '/wp-json/lamako-mobile/v2/public/events-data/', [], 10, false ],
        'cart-post' => [ 'POST', '/cart/', [], 10, false ],
        'unknown-route' => [ 'GET', '/wp-json/lamako-mobile/v2/profile', [], 10, false ],
        'near-route-prefix' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data-extra', [], 10, false ],
        'nonnumeric-id' => [ 'GET', '/wp-json/lamako-mobile/v2/public/events/current', [], 10, false ],
        'dot-segment' => [ 'GET', '/wp-json/lamako-mobile/v2/public/../home-data', [], 10, false ],
        'absolute-uri' => [ 'GET', 'https://example.test/wp-json/lamako-mobile/v2/public/home-data', [], 10, false ],
        'unknown-query-key' => [ 'GET', '/wp-json/lamako-mobile/v2/public/shop-data?search=livre', [ 'search' => 'livre' ], 10, false ],
        'duplicate-safe-query-key' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/events-data?limit=10&limit=20',
            [ 'limit' => '20' ],
            10,
            false,
        ],
        'checkout-fields' => [ 'GET', '/wp-json/lamako-mobile/v2/public/events/13459/checkout-fields', [], 10, false ],
        'payment-route' => [ 'GET', '/wp-json/lamako-mobile/v2/payments/test-token/methods', [], 10, false ],
        'encoded-slash-pretty' => [ 'GET', '/wp-json/lamako-mobile/v2/public%2Fevents-data', [], 10, false ],
        'double-encoded-pretty' => [ 'GET', '/wp-json/lamako-mobile/v2/public%252Fevents-data', [], 10, false ],
        'malformed-percent' => [ 'GET', '/wp-json/lamako-mobile/v2/public/events-data%2', [], 10, false ],
        'repeated-slash' => [ 'GET', '/wp-json/lamako-mobile/v2/public//events-data', [], 10, false ],
        'duplicate-rest-route' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data&rest_route=/lamako-mobile/v2/public/shop-data',
            [ 'rest_route' => '/lamako-mobile/v2/public/shop-data' ],
            10,
            false,
        ],
        'encoded-rest-route' => [
            'GET',
            '/?rest_route=%2Flamako-mobile%2Fv2%2Fpublic%2Fhome-data',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data' ],
            10,
            false,
        ],
        'array-rest-route' => [
            'GET',
            '/?rest_route[]=/lamako-mobile/v2/public/home-data',
            [ 'rest_route' => [ '/lamako-mobile/v2/public/home-data' ] ],
            10,
            false,
        ],
        'pretty-plus-query-route' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?rest_route=/lamako-mobile/v2/public/shop-data',
            [ 'rest_route' => '/lamako-mobile/v2/public/shop-data' ],
            10,
            false,
        ],
        'query-get-mismatch' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data',
            [ 'rest_route' => '/lamako-mobile/v2/public/shop-data' ],
            10,
            false,
        ],
        'query-method-override' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data&_method=POST',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data', '_method' => 'POST' ],
            10,
            false,
        ],
        'header-method-override' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data',
            [],
            10,
            false,
            'POST',
        ],
        'encoded-method-override' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data&%5Fmethod=POST',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data', '_method' => 'POST' ],
            10,
            false,
        ],
        'array-method-override' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data&_method[]=POST',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data', '_method' => [ 'POST' ] ],
            10,
            false,
        ],
        'dot-route-alias' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data&rest.route=/lamako-mobile/v2/public/home-data',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data' ],
            10,
            false,
        ],
        'encoded-route-key' => [
            'GET',
            '/?%72est_route=/lamako-mobile/v2/public/home-data',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data' ],
            10,
            false,
        ],
        'semicolon-query' => [
            'GET',
            '/?rest_route=/lamako-mobile/v2/public/home-data;ignored=1',
            [ 'rest_route' => '/lamako-mobile/v2/public/home-data' ],
            10,
            false,
        ],
        'stateful-add-to-cart' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?add-to-cart=13845',
            [ 'add-to-cart' => '13845' ],
            10,
            false,
        ],
        'stateful-wc-ajax' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?wc-ajax=get_refreshed_fragments',
            [ 'wc-ajax' => 'get_refreshed_fragments' ],
            10,
            false,
        ],
        'stateful-normalized-alias' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?wc.api=callback',
            [ 'wc_api' => 'callback' ],
            10,
            false,
        ],
        'stateful-encoded-key' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?%61dd-to-cart=13845',
            [ 'add-to-cart' => '13845' ],
            10,
            false,
        ],
        'stateful-cart-action' => [
            'GET',
            '/wp-json/lamako-mobile/v2/public/home-data?cart_action=update_cart',
            [ 'cart_action' => 'update_cart' ],
            10,
            false,
        ],
        'wrong-hook-priority' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data', [], 11, false ],
        'wrong-tickera-version' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false, null, false, '3.6.0.3' ],
        'remove-failure' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, true ],
        'remove-success-hook-remains' => [ 'GET', '/wp-json/lamako-mobile/v2/public/home-data', [], 10, false, null, false, '3.6.0.2', true ],
    ];

    $scenario = (string) $argv[1];
    if ( ! isset( $scenarios[ $scenario ] ) ) {
        fwrite( STDERR, "Unknown scenario\n" );
        exit( 2 );
    }

    [ $method, $uri, $get, $tickera_priority, $remove_fails ] = $scenarios[ $scenario ];
    $method_override   = isset( $scenarios[ $scenario ][5] ) ? $scenarios[ $scenario ][5] : null;
    $late_registration = ! empty( $scenarios[ $scenario ][6] );
    $tickera_version   = isset( $scenarios[ $scenario ][7] )
        ? (string) $scenarios[ $scenario ][7]
        : '3.6.0.2';
    $remove_leaves_hook = ! empty( $scenarios[ $scenario ][8] );

    define( 'ABSPATH', __DIR__ . DIRECTORY_SEPARATOR );
    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['REQUEST_URI'] = $uri;
    if ( $method_override !== null ) {
        $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] = $method_override;
    }
    $_GET = $get;
    $_POST = $scenario === 'cart-post' ? [ 'cart_action' => 'update_cart' ] : [];

    $GLOBALS['tbl_tickera_test_hooks'] = [];
    $GLOBALS['tbl_tickera_test_session_start_calls'] = 0;
    $GLOBALS['tbl_tickera_test_unrelated_wp_loaded_calls'] = 0;
    $GLOBALS['tbl_tickera_test_provider_calls'] = 0;
    $GLOBALS['tbl_tickera_test_writes'] = 0;
    $GLOBALS['tbl_tickera_test_remove_fails'] = $remove_fails;
    $GLOBALS['tbl_tickera_test_remove_leaves_hook'] = $remove_leaves_hook;
    $GLOBALS['tbl_tickera_test_restore_calls'] = 0;

    function tbl_tickera_test_callback_id( $callback ): string {
        if ( is_string( $callback ) ) {
            return $callback;
        }
        if ( is_array( $callback ) && count( $callback ) === 2 ) {
            $owner = is_object( $callback[0] )
                ? 'object:' . spl_object_id( $callback[0] )
                : 'class:' . (string) $callback[0];
            return $owner . '::' . (string) $callback[1];
        }
        return 'callback:' . md5( serialize( $callback ) );
    }

    function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ): bool {
        $id = tbl_tickera_test_callback_id( $callback );
        if (
            $GLOBALS['tbl_tickera_test_remove_leaves_hook']
            && isset( $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ (int) $priority ][ $id ] )
            && is_array( $callback )
            && ( $callback[1] ?? null ) === 'update_cart'
        ) {
            $GLOBALS['tbl_tickera_test_restore_calls']++;
        }
        $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ (int) $priority ][ $id ] = [
            'callback'      => $callback,
            'accepted_args' => (int) $accepted_args,
        ];
        return true;
    }

    function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ): bool {
        return add_action( $hook, $callback, $priority, $accepted_args );
    }

    function has_action( $hook, $callback = false ) {
        if ( empty( $GLOBALS['tbl_tickera_test_hooks'][ $hook ] ) ) {
            return false;
        }
        if ( $callback === false ) {
            return true;
        }

        $id = tbl_tickera_test_callback_id( $callback );
        foreach ( $GLOBALS['tbl_tickera_test_hooks'][ $hook ] as $priority => $callbacks ) {
            if ( isset( $callbacks[ $id ] ) ) {
                return (int) $priority;
            }
        }
        return false;
    }

    function remove_action( $hook, $callback, $priority = 10 ): bool {
        if ( $GLOBALS['tbl_tickera_test_remove_fails'] ) {
            return false;
        }

        $id = tbl_tickera_test_callback_id( $callback );
        if ( ! isset( $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ (int) $priority ][ $id ] ) ) {
            return false;
        }

        if ( $GLOBALS['tbl_tickera_test_remove_leaves_hook'] ) {
            return true;
        }

        unset( $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ (int) $priority ][ $id ] );
        return true;
    }

    function do_action( $hook, ...$arguments ): void {
        if ( empty( $GLOBALS['tbl_tickera_test_hooks'][ $hook ] ) ) {
            return;
        }

        ksort( $GLOBALS['tbl_tickera_test_hooks'][ $hook ], SORT_NUMERIC );
        $priorities = array_keys( $GLOBALS['tbl_tickera_test_hooks'][ $hook ] );
        foreach ( $priorities as $priority ) {
            $callback_ids = array_keys(
                $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ $priority ] ?? []
            );
            foreach ( $callback_ids as $callback_id ) {
                if ( ! isset( $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ $priority ][ $callback_id ] ) ) {
                    continue;
                }
                $entry = $GLOBALS['tbl_tickera_test_hooks'][ $hook ][ $priority ][ $callback_id ];
                call_user_func_array(
                    $entry['callback'],
                    array_slice( $arguments, 0, $entry['accepted_args'] )
                );
            }
        }
    }

    function wp_unslash( $value ) {
        return $value;
    }

    function tbl_tickera_test_unrelated_wp_loaded(): void {
        $GLOBALS['tbl_tickera_test_unrelated_wp_loaded_calls']++;
    }

    function tbl_tickera_test_cors_filter( $served ) {
        return $served;
    }

    function tbl_tickera_test_jwt_filter( $user ) {
        return $user;
    }

    function tbl_tickera_test_late_register(): void {
        add_action( 'wp_loaded', [ $GLOBALS['tc'], 'update_cart' ], 10 );
    }

    $tc = new \Tickera\TC();
    $tc->version = $tickera_version;
    $GLOBALS['tc'] = $tc;
    if ( $tickera_priority !== null ) {
        add_action( 'wp_loaded', [ $tc, 'update_cart' ], $tickera_priority );
    }
    if ( $late_registration ) {
        add_action( 'plugins_loaded', 'tbl_tickera_test_late_register', 999 );
    }
    add_action( 'wp_loaded', 'tbl_tickera_test_unrelated_wp_loaded', 20 );
    add_action( 'admin_post_tickera_cart', [ $tc, 'update_cart' ], 10 );
    add_action( 'admin_post_nopriv_tickera_cart', [ $tc, 'update_cart' ], 10 );
    add_filter( 'rest_pre_serve_request', 'tbl_tickera_test_cors_filter', 10 );
    add_filter( 'authenticate', 'tbl_tickera_test_jwt_filter', 99 );

    require dirname( __DIR__, 2 ) . DIRECTORY_SEPARATOR . 'scripts'
        . DIRECTORY_SEPARATOR . 'tbl-tickera-stateless-rest.php';

    $guard_priority = has_action(
        'wp_loaded',
        'tbl_tickera_stateless_rest_disable_global_cart_bootstrap'
    );
    do_action( 'plugins_loaded' );
    $allowlisted = tbl_tickera_stateless_rest_request_is_allowlisted();
    $wp_loaded_priority_before = has_action( 'wp_loaded', [ $tc, 'update_cart' ] );
    do_action( 'wp_loaded' );
    $wp_loaded_priority_after = has_action( 'wp_loaded', [ $tc, 'update_cart' ] );

    echo json_encode(
        [
            'scenario' => $scenario,
            'allowlisted' => $allowlisted,
            'guardRunsFirst' => $guard_priority === PHP_INT_MIN,
            'wpLoadedPriorityBefore' => $wp_loaded_priority_before,
            'wpLoadedPriorityAfter' => $wp_loaded_priority_after,
            'sessionStartCalls' => $GLOBALS['tbl_tickera_test_session_start_calls'],
            'unrelatedWpLoadedCalls' => $GLOBALS['tbl_tickera_test_unrelated_wp_loaded_calls'],
            'adminPostPriority' => has_action( 'admin_post_tickera_cart', [ $tc, 'update_cart' ] ),
            'adminPostNoPrivPriority' => has_action( 'admin_post_nopriv_tickera_cart', [ $tc, 'update_cart' ] ),
            'corsPriority' => has_action( 'rest_pre_serve_request', 'tbl_tickera_test_cors_filter' ),
            'jwtPriority' => has_action( 'authenticate', 'tbl_tickera_test_jwt_filter' ),
            'providerCalls' => $GLOBALS['tbl_tickera_test_provider_calls'],
            'writes' => $GLOBALS['tbl_tickera_test_writes'],
            'restoreCalls' => $GLOBALS['tbl_tickera_test_restore_calls'],
        ],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
}
