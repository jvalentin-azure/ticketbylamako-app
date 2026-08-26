<?php
/**
 * Static catalogue transport. This file intentionally does not bootstrap WordPress.
 */

$scope = isset( $_GET['scope'] ) && is_string( $_GET['scope'] )
    ? strtolower( trim( $_GET['scope'] ) )
    : '';
$allowed = [ 'home', 'events', 'shop' ];

if ( ! in_array( $scope, $allowed, true ) ) {
    http_response_code( 404 );
    header( 'Content-Type: application/json; charset=UTF-8' );
    header( 'Cache-Control: no-store', true );
    echo '{"code":"catalog_snapshot_not_found"}';
    exit;
}

$root = dirname( __DIR__ );
$directory = $root . '/wp-content/uploads/lamako-catalog-cache';
$file = $directory . '/' . $scope . '.json';

if ( ! is_dir( $directory ) && ! mkdir( $directory, 0755, true ) && ! is_dir( $directory ) ) {
    tbl_catalog_unavailable_response( 'catalog_snapshot_unavailable' );
}

$version_file     = $directory . '/.' . $scope . '.version';
$invalidated_file = dirname( $file ) . '/.invalidated';
$version          = is_readable( $version_file ) ? (int) trim( (string) file_get_contents( $version_file ) ) : 0;
$invalidated      = is_readable( $invalidated_file ) ? (int) trim( (string) file_get_contents( $invalidated_file ) ) : 0;
$missing          = ! is_file( $file ) || ! is_readable( $file );

if ( $missing || $invalidated > $version ) {
    $lock = fopen( $directory . '/.' . $scope . '.lock', 'c' );
    $owns_lock = is_resource( $lock ) && flock( $lock, LOCK_EX | LOCK_NB );

    http_response_code( 503 );
    header( 'Content-Type: application/json; charset=UTF-8' );
    header( 'Cache-Control: no-store', true );
    $body = $missing
        ? '{"code":"catalog_snapshot_unavailable"}'
        : '{"code":"catalog_snapshot_stale"}';
    header( 'Content-Length: ' . strlen( $body ) );
    echo $body;

    if ( ! $owns_lock ) {
        if ( is_resource( $lock ) ) {
            fclose( $lock );
        }
        exit;
    }

    ignore_user_abort( true );
    if ( function_exists( 'fastcgi_finish_request' ) ) {
        fastcgi_finish_request();
    } else {
        flush();
    }

    tbl_catalog_refresh_snapshot( $scope, $directory, $file, $invalidated );
    flock( $lock, LOCK_UN );
    fclose( $lock );
    exit;
}

$etag = '"' . hash_file( 'sha256', $file ) . '"';
$if_none_match = isset( $_SERVER['HTTP_IF_NONE_MATCH'] )
    ? trim( (string) $_SERVER['HTTP_IF_NONE_MATCH'] )
    : '';

header( 'Content-Type: application/json; charset=UTF-8' );
header( 'Cache-Control: public, max-age=60, stale-while-revalidate=300', true );
header( 'ETag: ' . $etag );
header( 'X-Content-Type-Options: nosniff' );
header( 'Access-Control-Allow-Origin: *' );

if ( $if_none_match === $etag ) {
    http_response_code( 304 );
    exit;
}

$size = filesize( $file );
if ( is_int( $size ) ) {
    header( 'Content-Length: ' . $size );
}

readfile( $file );

function tbl_catalog_unavailable_response( $code ) {
    http_response_code( 503 );
    header( 'Content-Type: application/json; charset=UTF-8' );
    header( 'Cache-Control: no-store', true );
    echo json_encode( [ 'code' => $code ] );
    exit;
}

function tbl_catalog_refresh_snapshot( $scope, $directory, $target, $version ) {
    $host = isset( $_SERVER['HTTP_HOST'] ) ? strtolower( trim( (string) $_SERVER['HTTP_HOST'] ) ) : '';
    $host = preg_replace( '/:\d+$/', '', $host );
    $origins = [
        'staging.ticketbylamako.com' => 'https://staging.ticketbylamako.com',
        'ticketbylamako.com'         => 'https://www.ticketbylamako.com',
        'www.ticketbylamako.com'     => 'https://www.ticketbylamako.com',
    ];
    $routes = [
        'home'   => '/wp-json/lamako-mobile/v2/public/home-data?summary=1&events_limit=12&products_limit=8',
        'events' => '/wp-json/lamako-mobile/v2/public/events-data?summary=1&limit=80',
        'shop'   => '/wp-json/lamako-mobile/v2/public/shop-data',
    ];

    if ( ! isset( $origins[ $host ], $routes[ $scope ] ) ) {
        error_log( '[TBL catalog snapshot] Refused refresh for an unknown host.' );
        return false;
    }

    $context = stream_context_create( [
        'http' => [
            'method'        => 'GET',
            'timeout'       => 20,
            'ignore_errors' => true,
            'header'        => "Accept: application/json\r\nUser-Agent: TicketByLamako-Catalog-Snapshot/1.0\r\n",
        ],
    ] );
    $json = file_get_contents( $origins[ $host ] . $routes[ $scope ], false, $context );
    $data = is_string( $json ) ? json_decode( $json, true ) : null;
    $required = $scope === 'home' ? [ 'events', 'products', 'categories' ] : ( $scope === 'events' ? [ 'events', 'categories' ] : [ 'products', 'categories' ] );

    if ( ! is_array( $data ) ) {
        error_log( '[TBL catalog snapshot] Background refresh returned invalid JSON.' );
        return false;
    }

    foreach ( $required as $key ) {
        if ( ! isset( $data[ $key ] ) || ! is_array( $data[ $key ] ) ) {
            error_log( '[TBL catalog snapshot] Background refresh returned an incomplete payload.' );
            return false;
        }
    }

    $data['_snapshot'] = [
        'scope'       => $scope,
        'generatedAt' => gmdate( 'c' ),
    ];
    $encoded = json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
    if ( ! is_string( $encoded ) || ! tbl_catalog_atomic_write( $target, $encoded ) ) {
        error_log( '[TBL catalog snapshot] Background refresh could not publish the snapshot.' );
        return false;
    }

    return tbl_catalog_atomic_write( $directory . '/.' . $scope . '.version', (string) $version );
}

function tbl_catalog_atomic_write( $target, $contents ) {
    try {
        $suffix = bin2hex( random_bytes( 4 ) );
    } catch ( Exception $exception ) {
        $suffix = uniqid( '', true );
    }

    $temp = $target . '.tmp-' . $suffix;
    if ( file_put_contents( $temp, $contents, LOCK_EX ) === false ) {
        return false;
    }

    if ( ! rename( $temp, $target ) ) {
        @unlink( $temp );
        return false;
    }

    return true;
}
