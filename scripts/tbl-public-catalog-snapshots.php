<?php
/**
 * Plugin Name: TicketByLamako Public Catalog Snapshots
 * Description: Generates anonymous mobile catalogue snapshots outside the WordPress request path.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

const TBL_CATALOG_SNAPSHOT_CRON = 'tbl_catalog_snapshot_refresh';

add_filter( 'cron_schedules', 'tbl_catalog_snapshot_cron_schedules' );
add_action( 'init', 'tbl_catalog_snapshot_ensure_schedule' );
add_action( TBL_CATALOG_SNAPSHOT_CRON, 'tbl_catalog_snapshot_generate_all' );
add_action( 'updated_option', 'tbl_catalog_snapshot_on_option_updated', 10, 3 );
add_action( 'added_option', 'tbl_catalog_snapshot_on_option_added', 10, 2 );

function tbl_catalog_snapshot_cron_schedules( $schedules ) {
    $schedules['tbl_catalog_two_minutes'] = [
        'interval' => 2 * MINUTE_IN_SECONDS,
        'display'  => 'TicketByLamako catalogue every two minutes',
    ];
    return $schedules;
}

function tbl_catalog_snapshot_ensure_schedule() {
    if ( ! wp_next_scheduled( TBL_CATALOG_SNAPSHOT_CRON ) ) {
        wp_schedule_event( time() + 30, 'tbl_catalog_two_minutes', TBL_CATALOG_SNAPSHOT_CRON );
    }
}

function tbl_catalog_snapshot_on_option_updated( $option, $old_value, $value ) {
    unset( $old_value );

    if ( $option !== 'lamako_mobile_v2_catalog_cache_version' ) {
        return;
    }

    $directory = tbl_catalog_snapshot_directory();
    if ( ! is_wp_error( $directory ) && wp_mkdir_p( $directory ) ) {
        tbl_catalog_snapshot_publish_marker(
            trailingslashit( $directory ) . '.invalidated',
            (string) max( 1, absint( $value ) )
        );
    }

    if ( ! wp_next_scheduled( TBL_CATALOG_SNAPSHOT_CRON, [ 'content-change' ] ) ) {
        wp_schedule_single_event( time(), TBL_CATALOG_SNAPSHOT_CRON, [ 'content-change' ] );
    }
}

function tbl_catalog_snapshot_on_option_added( $option, $value ) {
    tbl_catalog_snapshot_on_option_updated( $option, null, $value );
}

function tbl_catalog_snapshot_directory() {
    $uploads = wp_upload_dir();
    if ( ! empty( $uploads['error'] ) ) {
        return new WP_Error( 'tbl_catalog_uploads_unavailable', $uploads['error'] );
    }

    return trailingslashit( $uploads['basedir'] ) . 'lamako-catalog-cache';
}

function tbl_catalog_snapshot_definitions() {
    return [
        'home' => [
            'route'  => '/lamako-mobile/v2/public/home-data',
            'params' => [
                'summary'        => true,
                'events_limit'   => 12,
                'products_limit' => 8,
            ],
        ],
        'events' => [
            'route'  => '/lamako-mobile/v2/public/events-data',
            'params' => [
                'summary' => true,
                'limit'   => 80,
            ],
        ],
        'shop' => [
            'route'  => '/lamako-mobile/v2/public/shop-data',
            'params' => [],
        ],
    ];
}

function tbl_catalog_snapshot_generate_all( $reason = null ) {
    unset( $reason );

    $directory = tbl_catalog_snapshot_directory();
    if ( is_wp_error( $directory ) ) {
        error_log( '[TBL catalog snapshot] ' . $directory->get_error_message() );
        return;
    }

    if ( ! wp_mkdir_p( $directory ) ) {
        error_log( '[TBL catalog snapshot] Unable to create snapshot directory.' );
        return;
    }

    $version = (string) max( 1, absint( get_option( 'lamako_mobile_v2_catalog_cache_version', 1 ) ) );
    foreach ( tbl_catalog_snapshot_definitions() as $scope => $definition ) {
        $result = tbl_catalog_snapshot_generate( $scope, $definition, $directory );
        if ( is_wp_error( $result ) ) {
            error_log( sprintf(
                '[TBL catalog snapshot] %s: %s',
                $scope,
                $result->get_error_message()
            ) );
            continue;
        }

        tbl_catalog_snapshot_publish_marker(
            trailingslashit( $directory ) . '.' . sanitize_key( $scope ) . '.version',
            $version
        );
    }
}

function tbl_catalog_snapshot_publish_marker( $target, $value ) {
    $temp = $target . '.tmp-' . wp_generate_password( 8, false, false );
    if ( file_put_contents( $temp, $value, LOCK_EX ) === false ) {
        return false;
    }

    if ( ! rename( $temp, $target ) ) {
        @unlink( $temp );
        return false;
    }

    return true;
}

function tbl_catalog_snapshot_generate( $scope, array $definition, $directory ) {
    $request = new WP_REST_Request( 'GET', $definition['route'] );
    $request->set_query_params( $definition['params'] );
    $response = rest_do_request( $request );
    $response = rest_ensure_response( $response );

    if ( $response->get_status() >= 400 ) {
        return new WP_Error(
            'tbl_catalog_snapshot_api_error',
            sprintf( 'Catalogue route returned HTTP %d.', $response->get_status() )
        );
    }

    $data = $response->get_data();
    if ( ! is_array( $data ) ) {
        return new WP_Error( 'tbl_catalog_snapshot_invalid_data', 'Catalogue response is not an array.' );
    }

    $data['_snapshot'] = [
        'scope'       => $scope,
        'generatedAt' => gmdate( 'c' ),
    ];

    $json = wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
    if ( ! is_string( $json ) ) {
        return new WP_Error( 'tbl_catalog_snapshot_encode_error', 'Unable to encode catalogue response.' );
    }

    $target = trailingslashit( $directory ) . sanitize_key( $scope ) . '.json';
    $temp   = $target . '.tmp-' . wp_generate_password( 8, false, false );

    if ( file_put_contents( $temp, $json, LOCK_EX ) === false ) {
        return new WP_Error( 'tbl_catalog_snapshot_write_error', 'Unable to write temporary snapshot.' );
    }

    if ( ! rename( $temp, $target ) ) {
        @unlink( $temp );
        return new WP_Error( 'tbl_catalog_snapshot_rename_error', 'Unable to publish snapshot atomically.' );
    }

    return true;
}
