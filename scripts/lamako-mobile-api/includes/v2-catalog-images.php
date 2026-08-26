<?php
/**
 * Non-destructive modern image variants for the mobile catalogue.
 *
 * Originals and WordPress-generated sizes remain untouched. WebP and AVIF
 * derivatives live in their own uploads directory and can be removed safely.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_filter( 'wp_update_attachment_metadata', 'lamako_mobile_v2_generate_catalog_variants_on_upload', 20, 2 );
add_filter( 'rest_request_after_callbacks', 'lamako_mobile_v2_add_catalog_image_variants', 20, 3 );

function lamako_mobile_v2_catalog_variant_formats() {
    return [
        'webp' => [ 'mime' => 'image/webp', 'quality' => 80 ],
        'avif' => [ 'mime' => 'image/avif', 'quality' => 68 ],
    ];
}

function lamako_mobile_v2_catalog_variant_root() {
    $uploads = wp_upload_dir();
    if ( ! empty( $uploads['error'] ) ) {
        return new WP_Error( 'lamako_catalog_uploads_unavailable', $uploads['error'] );
    }

    return [
        'path' => trailingslashit( $uploads['basedir'] ) . 'lamako-catalog-variants',
        'url'  => trailingslashit( $uploads['baseurl'] ) . 'lamako-catalog-variants',
    ];
}

function lamako_mobile_v2_catalog_image_source( $attachment_id, $size, $metadata = null ) {
    $attachment_id = absint( $attachment_id );
    $size          = sanitize_key( $size );
    $original_path = get_attached_file( $attachment_id );
    $metadata      = is_array( $metadata ) ? $metadata : wp_get_attachment_metadata( $attachment_id );

    if ( ! $attachment_id || ! is_string( $original_path ) || ! is_file( $original_path ) || ! is_array( $metadata ) ) {
        return null;
    }

    $path   = $original_path;
    $width  = absint( $metadata['width'] ?? 0 );
    $height = absint( $metadata['height'] ?? 0 );
    if ( isset( $metadata['sizes'][ $size ]['file'] ) ) {
        $candidate = trailingslashit( dirname( $original_path ) ) . wp_basename( $metadata['sizes'][ $size ]['file'] );
        if ( is_file( $candidate ) ) {
            $path   = $candidate;
            $width  = absint( $metadata['sizes'][ $size ]['width'] ?? $width );
            $height = absint( $metadata['sizes'][ $size ]['height'] ?? $height );
        }
    }

    $source = wp_get_attachment_image_src( $attachment_id, $size );
    $url    = is_array( $source ) && ! empty( $source[0] ) ? esc_url_raw( $source[0] ) : '';
    if ( $url === '' && ! empty( $metadata['file'] ) ) {
        $uploads      = wp_upload_dir();
        $relative_dir = dirname( wp_normalize_path( $metadata['file'] ) );
        $relative_dir = $relative_dir === '.' ? '' : trailingslashit( $relative_dir );
        $url          = trailingslashit( $uploads['baseurl'] ) . $relative_dir . wp_basename( $path );
    }

    return [
        'path'   => $path,
        'url'    => esc_url_raw( $url ),
        'width'  => $width,
        'height' => $height,
        'mtime'  => (int) filemtime( $path ),
    ];
}

function lamako_mobile_v2_catalog_variant_target( $attachment_id, $size, $format, array $source ) {
    $root = lamako_mobile_v2_catalog_variant_root();
    if ( is_wp_error( $root ) ) {
        return $root;
    }

    $attachment_id = absint( $attachment_id );
    $size          = sanitize_key( $size );
    $format        = sanitize_key( $format );
    $directory     = trailingslashit( $root['path'] ) . $attachment_id;
    $filename      = sprintf( '%s-%d.%s', $size, absint( $source['mtime'] ), $format );

    return [
        'directory' => $directory,
        'path'      => trailingslashit( $directory ) . $filename,
        'url'       => trailingslashit( $root['url'] ) . $attachment_id . '/' . $filename,
    ];
}

function lamako_mobile_v2_catalog_image_variants( $attachment_id, $size = 'medium_large' ) {
    $source = lamako_mobile_v2_catalog_image_source( $attachment_id, $size );
    if ( ! $source ) {
        return null;
    }

    $variants = [
        'width'  => $source['width'],
        'height' => $source['height'],
        'webp'   => null,
        'avif'   => null,
    ];

    foreach ( lamako_mobile_v2_catalog_variant_formats() as $format => $settings ) {
        $target = lamako_mobile_v2_catalog_variant_target( $attachment_id, $size, $format, $source );
        if ( ! is_wp_error( $target ) && is_readable( $target['path'] ) ) {
            $variants[ $format ] = esc_url_raw( $target['url'] );
        }
    }

    return $variants;
}

function lamako_mobile_v2_generate_catalog_image_variants( $attachment_id, $metadata = null ) {
    $attachment_id = absint( $attachment_id );
    if ( ! $attachment_id || strpos( (string) get_post_mime_type( $attachment_id ), 'image/' ) !== 0 ) {
        return [];
    }

    $generated = [];
    foreach ( [ 'medium_large', 'large' ] as $size ) {
        $source = lamako_mobile_v2_catalog_image_source( $attachment_id, $size, $metadata );
        if ( ! $source ) {
            continue;
        }

        foreach ( lamako_mobile_v2_catalog_variant_formats() as $format => $settings ) {
            if ( ! wp_image_editor_supports( [ 'mime_type' => $settings['mime'] ] ) ) {
                continue;
            }

            $target = lamako_mobile_v2_catalog_variant_target( $attachment_id, $size, $format, $source );
            if ( is_wp_error( $target ) ) {
                continue;
            }
            if ( is_readable( $target['path'] ) ) {
                $generated[] = $target['path'];
                continue;
            }
            if ( ! wp_mkdir_p( $target['directory'] ) ) {
                continue;
            }

            $lock = fopen( $target['path'] . '.lock', 'c' );
            if ( ! $lock || ! flock( $lock, LOCK_EX ) ) {
                if ( $lock ) fclose( $lock );
                continue;
            }

            if ( ! is_readable( $target['path'] ) ) {
                $editor = wp_get_image_editor( $source['path'] );
                if ( ! is_wp_error( $editor ) ) {
                    $editor->set_quality( absint( $settings['quality'] ) );
                    $temporary = $target['path'] . '.tmp-' . wp_generate_password( 8, false, false ) . '.' . $format;
                    $saved     = $editor->save( $temporary, $settings['mime'] );
                    $saved_path = ! is_wp_error( $saved ) && ! empty( $saved['path'] ) ? $saved['path'] : '';
                    if ( $saved_path && is_file( $saved_path ) && rename( $saved_path, $target['path'] ) ) {
                        $generated[] = $target['path'];
                    } elseif ( $saved_path && is_file( $saved_path ) ) {
                        unlink( $saved_path );
                    }
                }
            } else {
                $generated[] = $target['path'];
            }

            flock( $lock, LOCK_UN );
            fclose( $lock );
            if ( is_file( $target['path'] . '.lock' ) ) {
                unlink( $target['path'] . '.lock' );
            }
        }
    }

    return array_values( array_unique( $generated ) );
}

function lamako_mobile_v2_generate_catalog_variants_on_upload( $metadata, $attachment_id ) {
    if ( is_array( $metadata ) ) {
        lamako_mobile_v2_generate_catalog_image_variants( $attachment_id, $metadata );
    }
    return $metadata;
}

function lamako_mobile_v2_add_event_image_variants( array $event, $size ) {
    $attachment_id = absint( $event['featured_media'] ?? 0 );
    if ( $attachment_id ) {
        $event['featuredImageVariants'] = lamako_mobile_v2_catalog_image_variants( $attachment_id, $size );
    }
    return $event;
}

function lamako_mobile_v2_add_product_image_variants( array $product, $size ) {
    if ( empty( $product['images'] ) || ! is_array( $product['images'] ) ) {
        return $product;
    }

    foreach ( $product['images'] as $index => $image ) {
        if ( is_array( $image ) && ! empty( $image['id'] ) ) {
            $product['images'][ $index ]['variants'] = lamako_mobile_v2_catalog_image_variants( $image['id'], $size );
        }
    }
    return $product;
}

function lamako_mobile_v2_add_catalog_image_variants( $response, $handler, $request ) {
    unset( $handler );

    if ( is_wp_error( $response ) || ! $response instanceof WP_REST_Response || ! $request instanceof WP_REST_Request ) {
        return $response;
    }

    $route = $request->get_route();
    if ( strpos( $route, '/lamako-mobile/v2/public/' ) !== 0 ) {
        return $response;
    }

    $data = $response->get_data();
    if ( ! is_array( $data ) ) {
        return $response;
    }

    $is_detail = preg_match( '#^/lamako-mobile/v2/public/(events|products)/\d+$#', $route ) === 1;
    $size      = $is_detail ? 'large' : 'medium_large';

    if ( isset( $data['events'] ) && is_array( $data['events'] ) ) {
        $data['events'] = array_map( function( $event ) use ( $size ) {
            return is_array( $event ) ? lamako_mobile_v2_add_event_image_variants( $event, $size ) : $event;
        }, $data['events'] );
    } elseif ( preg_match( '#/public/events/\d+$#', $route ) && isset( $data['featured_media'] ) ) {
        $data = lamako_mobile_v2_add_event_image_variants( $data, $size );
    }

    if ( isset( $data['products'] ) && is_array( $data['products'] ) ) {
        $data['products'] = array_map( function( $product ) use ( $size ) {
            return is_array( $product ) ? lamako_mobile_v2_add_product_image_variants( $product, $size ) : $product;
        }, $data['products'] );
    } elseif ( preg_match( '#/public/products/\d+$#', $route ) && isset( $data['images'] ) ) {
        $data = lamako_mobile_v2_add_product_image_variants( $data, $size );
    }

    $response->set_data( $data );
    return $response;
}
