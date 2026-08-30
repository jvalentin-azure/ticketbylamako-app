<?php

declare(strict_types=1);

if ( $argc < 6 || $argc > 8 ) {
    fwrite( STDERR, "Usage: php mobile-web-router-harness.php <path> <rollout> <singular|none> <id> <enabled> [request-state] [request-method]\n" );
    exit( 2 );
}

define( 'ABSPATH', __DIR__ . DIRECTORY_SEPARATOR );
define( 'LAMAKO_MOBILE_WEB_ENABLED', $argv[5] === '1' );
define( 'LAMAKO_MOBILE_WEB_ROLLOUT_PERCENT', $argv[2] );

$_SERVER['REQUEST_URI'] = (string) $argv[1];
$_SERVER['REQUEST_METHOD'] = strtoupper( (string) ( $argv[7] ?? 'GET' ) );
$GLOBALS['tbl_router_singular'] = (string) $argv[3];
$GLOBALS['tbl_router_object_id'] = (int) $argv[4];
$GLOBALS['tbl_router_actions'] = [];
$GLOBALS['tbl_router_request_state'] = (string) ( $argv[6] ?? 'none' );

if ( $GLOBALS['tbl_router_request_state'] === 'rest' ) {
    define( 'REST_REQUEST', true );
}

function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ): void {
    $GLOBALS['tbl_router_actions'][] = [ $hook, $callback, $priority, $accepted_args ];
}

function wp_unslash( $value ) {
    return $value;
}

function wp_parse_url( $url, $component = -1 ) {
    return parse_url( (string) $url, $component );
}

function is_admin(): bool {
    return $GLOBALS['tbl_router_request_state'] === 'admin';
}

function wp_doing_ajax(): bool {
    return $GLOBALS['tbl_router_request_state'] === 'ajax';
}

function is_feed(): bool {
    return $GLOBALS['tbl_router_request_state'] === 'feed';
}

function is_robots(): bool {
    return $GLOBALS['tbl_router_request_state'] === 'robots';
}

function is_trackback(): bool {
    return $GLOBALS['tbl_router_request_state'] === 'trackback';
}

function is_preview(): bool {
    return $GLOBALS['tbl_router_request_state'] === 'preview';
}

function is_singular( $type ): bool {
    return $GLOBALS['tbl_router_singular'] === (string) $type;
}

function get_queried_object_id(): int {
    return (int) $GLOBALS['tbl_router_object_id'];
}

function absint( $value ): int {
    return abs( (int) $value );
}

function home_url( $path = '' ): string {
    return 'https://staging.ticketbylamako.com/' . ltrim( (string) $path, '/' );
}

function wp_json_encode( $value ): string {
    return (string) json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
}

require dirname( __DIR__, 2 ) . DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR
    . 'lamako-mobile-api' . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'mobile-web-router.php';

ob_start();
lamako_mobile_web_render_router();
$rendered = (string) ob_get_clean();

echo json_encode(
    [
        'excluded' => lamako_mobile_web_is_excluded_request(),
        'target'   => lamako_mobile_web_target_path(),
        'rendered' => $rendered,
        'actions'  => $GLOBALS['tbl_router_actions'],
    ],
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
