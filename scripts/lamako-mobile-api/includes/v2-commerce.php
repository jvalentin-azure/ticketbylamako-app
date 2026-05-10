<?php
/**
 * Lamako Mobile API v2.
 *
 * Adds JWT-authenticated commerce, order, ticket, push token, and rewards
 * endpoints beside the legacy v1 WooCommerce-key endpoints. The v2 surface is
 * intentionally additive so production can migrate screen by screen.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'LAMAKO_MOBILE_V2_CHECKOUT_TTL' ) ) {
    define( 'LAMAKO_MOBILE_V2_CHECKOUT_TTL', 30 * MINUTE_IN_SECONDS );
}

if ( ! defined( 'LAMAKO_MOBILE_V2_SEATING_TTL' ) ) {
    define( 'LAMAKO_MOBILE_V2_SEATING_TTL', 30 * MINUTE_IN_SECONDS );
}

add_action( 'rest_api_init', 'lamako_mobile_v2_register_routes' );
add_action( 'template_redirect', 'lamako_mobile_v2_maybe_serve_payment_return', 2 );
add_action( 'template_redirect', 'lamako_mobile_v2_bridge_checkout_token', 4 );
add_action( 'template_redirect', 'lamako_mobile_v2_begin_seating_checkout', 4 );
add_action( 'template_redirect', 'lamako_mobile_v2_maybe_serve_seating_flow', 3 );
add_action( 'woocommerce_checkout_create_order', 'lamako_mobile_v2_mark_seating_order', 20, 2 );
add_action( 'woocommerce_checkout_order_created', 'lamako_mobile_v2_link_seating_order_created', 20 );
add_filter( 'woocommerce_get_return_url', 'lamako_mobile_v2_payment_return_url', 10000, 2 );
add_filter( 'woocommerce_get_cancel_order_url', 'lamako_mobile_v2_payment_cancel_url', 10000, 2 );
add_filter( 'tc_seat_chart_add_to_cart_url', 'lamako_mobile_v2_seating_cart_url', 10000 );

function lamako_mobile_v2_register_routes() {
    $namespace = 'lamako-mobile/v2';

    register_rest_route( $namespace, '/public/home-data', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_home_data',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/events-data', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_events_data',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/shop-data', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_shop_data',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/public/products/(?P<product_id>\d+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_public_product',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/checkouts', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_create_checkout',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/checkouts/(?P<token>[A-Za-z0-9_-]+)/status', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_checkout_status',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/seating-sessions', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_create_seating_session',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/seating-sessions/(?P<token>[A-Za-z0-9_-]+)/status', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_seating_session_status',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/payment-return/(?P<token>[A-Za-z0-9_-]+)/status', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_payment_return_status',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/orders', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_orders',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/orders/(?P<order_id>\d+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_order',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/orders/(?P<order_id>\d+)/tickets', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_get_order_tickets_route',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/push-token', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_register_push_token',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/rewards/balance', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_rewards_balance',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/rewards/history', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_rewards_history',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/rewards/redeem', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_rewards_redeem',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/referral/code', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'lamako_mobile_v2_referral_code',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );

    register_rest_route( $namespace, '/referral/validate', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_validate_referral_code',
        'permission_callback' => '__return_true',
    ] );

    register_rest_route( $namespace, '/referral/register', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'lamako_mobile_v2_register_referral',
        'permission_callback' => 'lamako_mobile_v2_require_user',
    ] );
}

function lamako_mobile_v2_require_user( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( $user_id <= 0 ) {
        return new WP_Error( 'lamako_v2_not_authenticated', 'Authentication required.', [ 'status' => 401 ] );
    }
    return true;
}

function lamako_mobile_v2_meta_first( $post_id, array $keys, $default = '' ) {
    foreach ( $keys as $key ) {
        $value = get_post_meta( $post_id, $key, true );
        if ( $value !== '' && $value !== null && $value !== false ) {
            return maybe_unserialize( $value );
        }
    }
    return $default;
}

function lamako_mobile_v2_truthy_meta( $post_id, array $keys ) {
    $value = lamako_mobile_v2_meta_first( $post_id, $keys, '' );
    return in_array( strtolower( (string) $value ), [ '1', 'yes', 'true', 'on' ], true );
}

function lamako_mobile_v2_image_url_from_value( $value, $size = 'large' ) {
    if ( is_numeric( $value ) ) {
        $url = wp_get_attachment_image_url( absint( $value ), $size );
        return $url ? $url : '';
    }
    if ( is_string( $value ) && preg_match( '#^https?://#', $value ) ) {
        return esc_url_raw( $value );
    }
    return '';
}

function lamako_mobile_v2_public_gallery( $post_id, array $keys ) {
    $raw = lamako_mobile_v2_meta_first( $post_id, $keys, [] );
    if ( is_string( $raw ) ) {
        $raw = array_filter( array_map( 'trim', explode( ',', $raw ) ) );
    }
    if ( ! is_array( $raw ) ) {
        return [];
    }

    $urls = [];
    foreach ( $raw as $item ) {
        if ( is_array( $item ) ) {
            $item = $item['url'] ?? $item['src'] ?? $item['id'] ?? '';
        }
        $url = lamako_mobile_v2_image_url_from_value( $item );
        if ( $url ) {
            $urls[] = $url;
        }
    }
    return array_values( array_unique( $urls ) );
}

function lamako_mobile_v2_public_practical_info( $post_id ) {
    $raw = lamako_mobile_v2_meta_first( $post_id, [
        'lamako_mobile_practical_info',
        '_lamako_mobile_practical_info',
        'mobile_practical_info',
        '_mobile_practical_info',
        'practical_info',
        '_practical_info',
    ], [] );

    if ( ! is_array( $raw ) ) {
        return [];
    }

    $items = [];
    foreach ( $raw as $row ) {
        if ( ! is_array( $row ) ) {
            continue;
        }
        $label = sanitize_text_field( $row['label'] ?? $row['title'] ?? '' );
        $value = sanitize_text_field( $row['value'] ?? $row['text'] ?? '' );
        if ( $label !== '' || $value !== '' ) {
            $items[] = [
                'label' => $label,
                'value' => $value,
            ];
        }
    }
    return $items;
}

function lamako_mobile_v2_public_event_categories() {
    $terms = get_terms( [
        'taxonomy'   => 'event_category',
        'hide_empty' => false,
        'number'     => 100,
    ] );

    if ( is_wp_error( $terms ) ) {
        return [];
    }

    return array_map( function( $term ) {
        return [
            'id'     => (int) $term->term_id,
            'name'   => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
            'slug'   => $term->slug,
            'count'  => (int) $term->count,
            'parent' => (int) $term->parent,
        ];
    }, $terms );
}

function lamako_mobile_v2_public_product_categories( $product_id ) {
    $terms = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'all' ] );
    if ( is_wp_error( $terms ) ) {
        return [];
    }

    return array_map( function( $term ) {
        return [
            'id'   => (int) $term->term_id,
            'name' => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
            'slug' => $term->slug,
        ];
    }, $terms );
}

function lamako_mobile_v2_is_boutique_product( $product_id ) {
    $terms = wp_get_post_terms( $product_id, 'product_cat', [ 'fields' => 'all' ] );
    if ( is_wp_error( $terms ) || empty( $terms ) ) {
        return false;
    }

    foreach ( $terms as $term ) {
        if ( strpos( $term->slug, 'boutique-' ) === 0 ) {
            return true;
        }

        $parent_id = (int) $term->parent;
        while ( $parent_id > 0 ) {
            $parent = get_term( $parent_id, 'product_cat' );
            if ( ! $parent || is_wp_error( $parent ) ) {
                break;
            }
            if ( strpos( $parent->slug, 'boutique-' ) === 0 ) {
                return true;
            }
            $parent_id = (int) $parent->parent;
        }
    }

    return false;
}

function lamako_mobile_v2_public_shop_categories() {
    $terms = get_terms( [
        'taxonomy'   => 'product_cat',
        'hide_empty' => false,
        'number'     => 100,
    ] );

    if ( is_wp_error( $terms ) ) {
        return [];
    }

    $categories = [];
    foreach ( $terms as $term ) {
        $include = strpos( $term->slug, 'boutique-' ) === 0;
        if ( ! $include && $term->parent > 0 ) {
            $parent = get_term( $term->parent, 'product_cat' );
            $include = $parent && ! is_wp_error( $parent ) && strpos( $parent->slug, 'boutique-' ) === 0;
        }
        if ( ! $include ) {
            continue;
        }

        $categories[] = [
            'id'     => (int) $term->term_id,
            'name'   => html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' ),
            'slug'   => $term->slug,
            'count'  => (int) $term->count,
            'image'  => null,
            'parent' => (int) $term->parent,
        ];
    }
    return $categories;
}

function lamako_mobile_v2_public_product_images( WC_Product $product ) {
    $image_ids = [];
    $main_id = $product->get_image_id();
    if ( $main_id ) {
        $image_ids[] = $main_id;
    }
    foreach ( $product->get_gallery_image_ids() as $image_id ) {
        $image_ids[] = $image_id;
    }

    $images = [];
    foreach ( array_unique( array_filter( $image_ids ) ) as $image_id ) {
        $src = wp_get_attachment_image_url( $image_id, 'large' );
        if ( $src ) {
            $images[] = [
                'id'  => (int) $image_id,
                'src' => $src,
                'alt' => get_post_meta( $image_id, '_wp_attachment_image_alt', true ),
            ];
        }
    }
    return $images;
}

function lamako_mobile_v2_public_product_mobile_fields( $product_id ) {
    return [
        'description'    => lamako_mobile_v2_meta_first( $product_id, [
            'lamako_mobile_description',
            '_lamako_mobile_description',
            'mobile_description',
            '_mobile_description',
        ], null ),
        'gallery'        => lamako_mobile_v2_public_gallery( $product_id, [
            'lamako_mobile_gallery',
            '_lamako_mobile_gallery',
            'mobile_gallery',
            '_mobile_gallery',
        ] ),
        'practical_info' => lamako_mobile_v2_public_practical_info( $product_id ),
    ];
}

function lamako_mobile_v2_public_product_summary( WC_Product $product, $include_details = false ) {
    $product_id = $product->get_id();
    $post = get_post( $product_id );
    if ( ! $post || $post->post_status !== 'publish' ) {
        return null;
    }

    $data = [
        'id'              => $product_id,
        'name'            => html_entity_decode( $product->get_name(), ENT_QUOTES, 'UTF-8' ),
        'slug'            => $post->post_name,
        'permalink'       => get_permalink( $product_id ),
        'price'           => $product->get_price(),
        'regular_price'   => $product->get_regular_price(),
        'sale_price'      => $product->get_sale_price(),
        'description'     => $include_details ? wp_kses_post( $product->get_description() ) : '',
        'short_description' => $include_details ? wp_kses_post( $product->get_short_description() ) : '',
        'images'          => lamako_mobile_v2_public_product_images( $product ),
        'categories'      => lamako_mobile_v2_public_product_categories( $product_id ),
        'stock_status'    => $product->get_stock_status(),
        'type'            => $product->get_type(),
        'meta_data'       => [],
        'date_created'    => $product->get_date_created() ? $product->get_date_created()->date( 'c' ) : '',
        'lamako_mobile'   => $include_details ? lamako_mobile_v2_public_product_mobile_fields( $product_id ) : null,
    ];

    return $data;
}

function lamako_mobile_v2_public_shop_products( $limit = 100, $include_details = false ) {
    if ( ! function_exists( 'wc_get_product' ) ) {
        return [];
    }

    $posts = get_posts( [
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => min( max( absint( $limit ), 1 ), 100 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
        'fields'         => 'ids',
    ] );

    $products = [];
    foreach ( $posts as $product_id ) {
        if ( lamako_mobile_v2_truthy_meta( $product_id, [ '_tc_is_ticket' ] ) ) {
            continue;
        }
        if ( ! lamako_mobile_v2_is_boutique_product( $product_id ) ) {
            continue;
        }
        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            continue;
        }
        $summary = lamako_mobile_v2_public_product_summary( $product, $include_details );
        if ( $summary ) {
            $products[] = $summary;
        }
    }
    return $products;
}

function lamako_mobile_v2_public_ticket_map() {
    if ( ! function_exists( 'wc_get_product' ) ) {
        return [];
    }

    $posts = get_posts( [
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => 300,
        'fields'         => 'ids',
        'meta_query'     => [
            [
                'key'     => '_tc_is_ticket',
                'value'   => [ 'yes', '1' ],
                'compare' => 'IN',
            ],
        ],
    ] );

    $map = [];
    foreach ( $posts as $product_id ) {
        $event_id = absint( get_post_meta( $product_id, '_event_name', true ) );
        if ( $event_id <= 0 ) {
            continue;
        }
        $product = wc_get_product( $product_id );
        if ( ! $product ) {
            continue;
        }

        if ( ! isset( $map[ $event_id ] ) ) {
            $map[ $event_id ] = [];
        }
        $map[ $event_id ][] = [
            'id'           => $product_id,
            'name'         => html_entity_decode( $product->get_name(), ENT_QUOTES, 'UTF-8' ),
            'price'        => $product->get_price(),
            'stock_status' => $product->get_stock_status(),
            'usesSeating'  => lamako_mobile_v2_truthy_meta( $product_id, [ '_tc_used_for_seatings' ] ),
            'eventId'      => (string) $event_id,
        ];
    }
    return $map;
}

function lamako_mobile_v2_public_event_mobile_fields( $event_id ) {
    return [
        'description'         => lamako_mobile_v2_meta_first( $event_id, [
            'lamako_mobile_description',
            '_lamako_mobile_description',
            'mobile_description',
            '_mobile_description',
        ], null ),
        'gallery'             => lamako_mobile_v2_public_gallery( $event_id, [
            'lamako_mobile_gallery',
            '_lamako_mobile_gallery',
            'mobile_gallery',
            '_mobile_gallery',
        ] ),
        'practical_info'      => lamako_mobile_v2_public_practical_info( $event_id ),
        'event_date_time'     => lamako_mobile_v2_meta_first( $event_id, [ 'event_date_time', '_event_date_time', 'event_start_date', '_event_start_date' ], null ),
        'event_end_date_time' => lamako_mobile_v2_meta_first( $event_id, [ 'event_end_date_time', '_event_end_date_time', 'event_end_date', '_event_end_date' ], null ),
        'event_location'      => lamako_mobile_v2_meta_first( $event_id, [ 'event_location', '_event_location' ], null ),
        'event_terms'         => lamako_mobile_v2_meta_first( $event_id, [ 'event_terms', '_event_terms' ], null ),
        'event_logo'          => lamako_mobile_v2_image_url_from_value( lamako_mobile_v2_meta_first( $event_id, [ 'event_logo', '_event_logo' ], '' ) ),
        'sponsors_logo'       => lamako_mobile_v2_image_url_from_value( lamako_mobile_v2_meta_first( $event_id, [ 'sponsors_logo', '_sponsors_logo' ], '' ) ),
    ];
}

function lamako_mobile_v2_public_event_summary( WP_Post $event, array $ticket_map ) {
    $event_id = $event->ID;
    $terms = wp_get_post_terms( $event_id, 'event_category', [ 'fields' => 'all' ] );
    $category_ids = [];
    $category_names = [];
    if ( ! is_wp_error( $terms ) ) {
        foreach ( $terms as $term ) {
            $category_ids[] = (int) $term->term_id;
            $category_names[] = html_entity_decode( $term->name, ENT_QUOTES, 'UTF-8' );
        }
    }

    $tickets = $ticket_map[ $event_id ] ?? [];
    $prices = [];
    foreach ( $tickets as $ticket ) {
        $price = isset( $ticket['price'] ) ? (float) $ticket['price'] : 0;
        if ( $price > 0 ) {
            $prices[] = $price;
        }
    }

    $thumb_id = get_post_thumbnail_id( $event_id );
    $featured = $thumb_id ? wp_get_attachment_image_url( $thumb_id, 'large' ) : '';

    return [
        'id'              => $event_id,
        'date'            => get_post_time( 'c', true, $event ),
        'slug'            => $event->post_name,
        'status'          => $event->post_status,
        'title'           => [ 'rendered' => html_entity_decode( get_the_title( $event ), ENT_QUOTES, 'UTF-8' ) ],
        'content'         => [ 'rendered' => apply_filters( 'the_content', $event->post_content ) ],
        'featured_media'  => (int) $thumb_id,
        'event_category'  => $category_ids,
        'link'            => get_permalink( $event_id ),
        'featuredImage'   => $featured ?: null,
        'categoryNames'   => $category_names,
        'mobileFields'    => lamako_mobile_v2_public_event_mobile_fields( $event_id ),
        'tickets'         => $tickets,
        'minPrice'        => ! empty( $prices ) ? min( $prices ) : null,
        'maxPrice'        => ! empty( $prices ) ? max( $prices ) : null,
        'hasSeatingChart' => ! empty( array_filter( $tickets, function( $ticket ) {
            return ! empty( $ticket['usesSeating'] );
        } ) ) || lamako_mobile_v2_find_chart_for_event( $event_id ) > 0,
    ];
}

function lamako_mobile_v2_public_events( $limit = 50 ) {
    $events = get_posts( [
        'post_type'      => 'tc_events',
        'post_status'    => 'publish',
        'posts_per_page' => min( max( absint( $limit ), 1 ), 100 ),
        'orderby'        => 'date',
        'order'          => 'DESC',
    ] );

    $ticket_map = lamako_mobile_v2_public_ticket_map();
    return array_map( function( $event ) use ( $ticket_map ) {
        return lamako_mobile_v2_public_event_summary( $event, $ticket_map );
    }, $events );
}

function lamako_mobile_v2_public_home_data( WP_REST_Request $request ) {
    return rest_ensure_response( [
        'events'     => lamako_mobile_v2_public_events( absint( $request->get_param( 'events_limit' ) ?: 50 ) ),
        'products'   => lamako_mobile_v2_public_shop_products( absint( $request->get_param( 'products_limit' ) ?: 12 ) ),
        'categories' => lamako_mobile_v2_public_event_categories(),
    ] );
}

function lamako_mobile_v2_public_events_data( WP_REST_Request $request ) {
    return rest_ensure_response( [
        'events'     => lamako_mobile_v2_public_events( absint( $request->get_param( 'limit' ) ?: 50 ) ),
        'categories' => lamako_mobile_v2_public_event_categories(),
    ] );
}

function lamako_mobile_v2_public_shop_data( WP_REST_Request $request ) {
    return rest_ensure_response( [
        'products'   => lamako_mobile_v2_public_shop_products( absint( $request->get_param( 'limit' ) ?: 100 ) ),
        'categories' => lamako_mobile_v2_public_shop_categories(),
    ] );
}

function lamako_mobile_v2_public_product( WP_REST_Request $request ) {
    if ( ! function_exists( 'wc_get_product' ) ) {
        return new WP_Error( 'lamako_v2_woocommerce_missing', 'WooCommerce is not available.', [ 'status' => 500 ] );
    }

    $product_id = absint( $request['product_id'] );
    if ( $product_id <= 0 || lamako_mobile_v2_truthy_meta( $product_id, [ '_tc_is_ticket' ] ) || ! lamako_mobile_v2_is_boutique_product( $product_id ) ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found.', [ 'status' => 404 ] );
    }

    $product = wc_get_product( $product_id );
    if ( ! $product ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found.', [ 'status' => 404 ] );
    }

    $summary = lamako_mobile_v2_public_product_summary( $product, true );
    if ( ! $summary ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found.', [ 'status' => 404 ] );
    }

    return rest_ensure_response( $summary );
}

function lamako_mobile_v2_token() {
    if ( function_exists( 'random_bytes' ) ) {
        return rtrim( strtr( base64_encode( random_bytes( 32 ) ), '+/', '-_' ), '=' );
    }
    return wp_generate_password( 48, false, false );
}

function lamako_mobile_v2_token_hash( $token ) {
    return hash_hmac( 'sha256', (string) $token, wp_salt( 'auth' ) );
}

function lamako_mobile_v2_seating_transient_key( $token ) {
    return 'lamako_v2_seat_' . lamako_mobile_v2_token_hash( $token );
}

function lamako_mobile_v2_get_seating_flow( $token ) {
    if ( empty( $token ) ) {
        return false;
    }

    $flow = get_transient( lamako_mobile_v2_seating_transient_key( $token ) );
    return is_array( $flow ) ? $flow : false;
}

function lamako_mobile_v2_save_seating_flow( $token, array $flow ) {
    set_transient( lamako_mobile_v2_seating_transient_key( $token ), $flow, LAMAKO_MOBILE_V2_SEATING_TTL + ( 5 * MINUTE_IN_SECONDS ) );
}

function lamako_mobile_v2_extract_seating_token_from_request() {
    if ( ! empty( $_GET['lamako_seating_token'] ) ) {
        return sanitize_text_field( wp_unslash( $_GET['lamako_seating_token'] ) );
    }

    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    $path = $request_uri ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
    if ( ! $path ) {
        return '';
    }

    if ( preg_match( '#/lamako-mobile/seat/([A-Za-z0-9_-]+)#', $path, $matches ) ) {
        return sanitize_text_field( $matches[1] );
    }

    return '';
}

function lamako_mobile_v2_find_chart_for_event( $event_id ) {
    $event_id = absint( $event_id );
    if ( $event_id <= 0 ) {
        return 0;
    }

    $charts = get_posts( [
        'post_type'      => 'tc_seat_charts',
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_query'     => [
            [
                'key'     => 'event_name',
                'value'   => $event_id,
                'compare' => '=',
            ],
        ],
    ] );

    if ( ! empty( $charts ) ) {
        return (int) $charts[0];
    }

    $event = get_post( $event_id );
    if ( ! $event ) {
        return 0;
    }

    if ( preg_match( '/data-seating-map-id="(\d+)"/', $event->post_content, $matches ) ) {
        return (int) $matches[1];
    }

    $rendered = apply_filters( 'the_content', $event->post_content );
    if ( preg_match( '/data-seating-map-id="(\d+)"/', $rendered, $matches ) ) {
        return (int) $matches[1];
    }

    return 0;
}

function lamako_mobile_v2_find_order_by_token( $token ) {
    if ( empty( $token ) || ! function_exists( 'wc_get_order' ) ) {
        return false;
    }

    $hash     = lamako_mobile_v2_token_hash( $token );
    $order_id = get_transient( 'lamako_v2_checkout_' . $hash );
    if ( $order_id ) {
        $order = wc_get_order( (int) $order_id );
        if ( $order ) {
            return $order;
        }
    }

    $orders = wc_get_orders( [
        'limit'      => 1,
        'meta_key'   => '_lamako_v2_checkout_token_hash',
        'meta_value' => $hash,
        'orderby'    => 'date',
        'order'      => 'DESC',
    ] );

    return ! empty( $orders ) ? $orders[0] : false;
}

function lamako_mobile_v2_is_checkout_expired( WC_Order $order ) {
    $expires_at = $order->get_meta( '_lamako_v2_checkout_expires_at' );
    if ( ! $expires_at ) {
        return false;
    }

    return strtotime( (string) $expires_at ) < time();
}

function lamako_mobile_v2_is_order_owner( WC_Order $order, $user_id = 0 ) {
    $user_id = $user_id ? (int) $user_id : get_current_user_id();
    if ( $user_id <= 0 ) {
        return false;
    }

    if ( (int) $order->get_customer_id() === $user_id ) {
        return true;
    }

    $user = get_user_by( 'id', $user_id );
    if ( $user && $order->get_billing_email() && strcasecmp( $order->get_billing_email(), $user->user_email ) === 0 ) {
        return true;
    }

    return current_user_can( 'manage_woocommerce' );
}

function lamako_mobile_v2_get_billing_from_request( $billing, WP_User $user ) {
    $billing = is_array( $billing ) ? $billing : [];
    $first_name = $billing['first_name'] ?? get_user_meta( $user->ID, 'billing_first_name', true );
    $last_name  = $billing['last_name'] ?? get_user_meta( $user->ID, 'billing_last_name', true );
    $email      = $billing['email'] ?? get_user_meta( $user->ID, 'billing_email', true );
    $phone      = $billing['phone'] ?? get_user_meta( $user->ID, 'billing_phone', true );
    $address_1  = $billing['address_1'] ?? get_user_meta( $user->ID, 'billing_address_1', true );
    $city       = $billing['city'] ?? get_user_meta( $user->ID, 'billing_city', true );
    $country    = $billing['country'] ?? get_user_meta( $user->ID, 'billing_country', true );

    if ( ! $first_name ) {
        $first_name = get_user_meta( $user->ID, 'first_name', true );
    }
    if ( ! $last_name ) {
        $last_name = get_user_meta( $user->ID, 'last_name', true );
    }
    if ( ! $email ) {
        $email = $user->user_email;
    }
    if ( ! $country ) {
        $country = 'MG';
    }

    return [
        'first_name' => sanitize_text_field( $first_name ),
        'last_name'  => sanitize_text_field( $last_name ),
        'email'      => sanitize_email( $email ),
        'phone'      => sanitize_text_field( $phone ),
        'address_1'  => sanitize_text_field( $address_1 ),
        'city'       => sanitize_text_field( $city ),
        'country'    => sanitize_text_field( $country ),
    ];
}

function lamako_mobile_v2_set_order_address( WC_Order $order, array $billing, $shipping = [] ) {
    $order->set_billing_first_name( $billing['first_name'] );
    $order->set_billing_last_name( $billing['last_name'] );
    $order->set_billing_email( $billing['email'] );
    $order->set_billing_phone( $billing['phone'] );
    $order->set_billing_address_1( $billing['address_1'] );
    $order->set_billing_city( $billing['city'] );
    $order->set_billing_country( $billing['country'] );

    if ( is_array( $shipping ) && ! empty( $shipping ) ) {
        $order->set_shipping_first_name( sanitize_text_field( $shipping['first_name'] ?? $billing['first_name'] ) );
        $order->set_shipping_last_name( sanitize_text_field( $shipping['last_name'] ?? $billing['last_name'] ) );
        $order->set_shipping_address_1( sanitize_text_field( $shipping['address_1'] ?? $billing['address_1'] ) );
        $order->set_shipping_city( sanitize_text_field( $shipping['city'] ?? $billing['city'] ) );
        $order->set_shipping_country( sanitize_text_field( $shipping['country'] ?? $billing['country'] ) );
    }
}

function lamako_mobile_v2_product_base_id( WC_Product $product, $requested_product_id ) {
    $parent_id = $product->get_parent_id();
    return $parent_id ? (int) $parent_id : (int) $requested_product_id;
}

function lamako_mobile_v2_validate_checkout_item( $raw_item, $index ) {
    $product_id   = isset( $raw_item['product_id'] ) ? absint( $raw_item['product_id'] ) : 0;
    $variation_id = isset( $raw_item['variation_id'] ) ? absint( $raw_item['variation_id'] ) : 0;
    $quantity     = isset( $raw_item['quantity'] ) ? absint( $raw_item['quantity'] ) : 1;

    if ( $product_id <= 0 || $quantity <= 0 ) {
        return new WP_Error( 'lamako_v2_invalid_item', 'Invalid product or quantity at item ' . ( $index + 1 ) . '.', [ 'status' => 400 ] );
    }

    if ( $quantity > 20 ) {
        return new WP_Error( 'lamako_v2_quantity_too_high', 'Quantity is too high at item ' . ( $index + 1 ) . '.', [ 'status' => 400 ] );
    }

    $product = wc_get_product( $variation_id ?: $product_id );
    if ( ! $product ) {
        return new WP_Error( 'lamako_v2_product_not_found', 'Product not found: ' . $product_id, [ 'status' => 404 ] );
    }

    $base_id       = lamako_mobile_v2_product_base_id( $product, $product_id );
    $is_ticket     = get_post_meta( $base_id, '_tc_is_ticket', true ) === 'yes';
    $uses_seating  = get_post_meta( $base_id, '_tc_used_for_seatings', true ) === 'yes';
    $event_id      = get_post_meta( $base_id, '_event_name', true );
    $product_post  = get_post( $base_id );

    if ( ! $product_post || $product_post->post_status !== 'publish' ) {
        return new WP_Error( 'lamako_v2_product_unavailable', 'Product is not published: ' . $base_id, [ 'status' => 400 ] );
    }

    if ( $uses_seating ) {
        return new WP_Error( 'lamako_v2_seating_required', 'Seating products must be purchased through the seating chart flow.', [ 'status' => 409 ] );
    }

    if ( $is_ticket ) {
        if ( empty( $event_id ) || ! get_post( (int) $event_id ) ) {
            return new WP_Error( 'lamako_v2_ticket_event_missing', 'Ticket product is not linked to a valid event.', [ 'status' => 400 ] );
        }

        if ( class_exists( '\Tickera\TC_Ticket' ) && method_exists( '\Tickera\TC_Ticket', 'is_sales_available' ) ) {
            $available = \Tickera\TC_Ticket::is_sales_available( $base_id );
            if ( ! $available ) {
                return new WP_Error( 'lamako_v2_ticket_sales_closed', 'Ticket sales are not available for this product.', [ 'status' => 409 ] );
            }
        }
    }

    if ( ! $product->is_in_stock() ) {
        return new WP_Error( 'lamako_v2_out_of_stock', 'Product is out of stock: ' . $base_id, [ 'status' => 409 ] );
    }

    if ( method_exists( $product, 'has_enough_stock' ) && ! $product->has_enough_stock( $quantity ) ) {
        return new WP_Error( 'lamako_v2_not_enough_stock', 'Not enough stock for product: ' . $base_id, [ 'status' => 409 ] );
    }

    return [
        'product'      => $product,
        'product_id'   => $product_id,
        'base_id'      => $base_id,
        'variation_id' => $variation_id,
        'quantity'     => $quantity,
        'is_ticket'    => $is_ticket,
        'event_id'     => $event_id ? (int) $event_id : 0,
    ];
}

function lamako_mobile_v2_temporarily_disable_legacy_product_overrides() {
    $removed = [
        'purchasable' => false,
        'stock'       => false,
    ];

    if ( function_exists( 'lamako_force_all_purchasable' ) ) {
        $removed['purchasable'] = remove_filter( 'woocommerce_is_purchasable', 'lamako_force_all_purchasable', 9999 );
    }
    if ( function_exists( 'lamako_force_all_in_stock' ) ) {
        $removed['stock'] = remove_filter( 'woocommerce_product_is_in_stock', 'lamako_force_all_in_stock', 9999 );
    }

    return $removed;
}

function lamako_mobile_v2_restore_legacy_product_overrides( array $removed ) {
    if ( ! empty( $removed['purchasable'] ) && function_exists( 'lamako_force_all_purchasable' ) ) {
        add_filter( 'woocommerce_is_purchasable', 'lamako_force_all_purchasable', 9999, 2 );
    }
    if ( ! empty( $removed['stock'] ) && function_exists( 'lamako_force_all_in_stock' ) ) {
        add_filter( 'woocommerce_product_is_in_stock', 'lamako_force_all_in_stock', 9999, 2 );
    }
}

function lamako_mobile_v2_create_checkout( WP_REST_Request $request ) {
    if ( ! function_exists( 'wc_create_order' ) ) {
        return new WP_Error( 'lamako_v2_wc_missing', 'WooCommerce is not available.', [ 'status' => 500 ] );
    }

    $body  = $request->get_json_params();
    $body  = is_array( $body ) ? $body : [];
    $items = isset( $body['items'] ) && is_array( $body['items'] ) ? $body['items'] : [];

    if ( empty( $items ) ) {
        return new WP_Error( 'lamako_v2_items_required', 'Checkout items are required.', [ 'status' => 400 ] );
    }

    $validated = [];
    foreach ( $items as $index => $item ) {
        $validated_item = lamako_mobile_v2_validate_checkout_item( $item, $index );
        if ( is_wp_error( $validated_item ) ) {
            return $validated_item;
        }
        $validated[] = $validated_item;
    }

    $user_id = get_current_user_id();
    $user    = get_user_by( 'id', $user_id );
    if ( ! $user ) {
        return new WP_Error( 'lamako_v2_user_missing', 'Current user not found.', [ 'status' => 401 ] );
    }

    $token      = lamako_mobile_v2_token();
    $token_hash = lamako_mobile_v2_token_hash( $token );
    $expires_at = time() + LAMAKO_MOBILE_V2_CHECKOUT_TTL;
    $billing    = lamako_mobile_v2_get_billing_from_request( $body['billing'] ?? [], $user );
    $shipping   = $body['shipping'] ?? [];
    $source     = sanitize_text_field( $body['source'] ?? 'native_cart' );
    $coupon     = sanitize_text_field( $body['couponCode'] ?? $body['coupon_code'] ?? '' );

    $removed_filters = lamako_mobile_v2_temporarily_disable_legacy_product_overrides();

    try {
        $order = wc_create_order( [
            'customer_id' => $user_id,
            'created_via' => 'lamako_mobile_v2',
        ] );

        if ( is_wp_error( $order ) ) {
            lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
            return new WP_Error( 'lamako_v2_order_create_failed', $order->get_error_message(), [ 'status' => 500 ] );
        }

        lamako_mobile_v2_set_order_address( $order, $billing, $shipping );

        foreach ( $validated as $item ) {
            $added = $order->add_product( $item['product'], $item['quantity'] );
            if ( is_wp_error( $added ) ) {
                $order->delete( true );
                lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
                return new WP_Error( 'lamako_v2_add_product_failed', $added->get_error_message(), [ 'status' => 409 ] );
            }
        }

        if ( $coupon !== '' ) {
            $coupon_result = $order->apply_coupon( $coupon );
            if ( is_wp_error( $coupon_result ) ) {
                $order->delete( true );
                lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
                return new WP_Error( 'lamako_v2_coupon_invalid', $coupon_result->get_error_message(), [ 'status' => 400 ] );
            }
        }

        $order->calculate_totals();
        $order->set_status( 'pending' );
        $order->set_created_via( 'lamako_mobile_v2' );
        $order->update_meta_data( '_lamako_mobile_order', 'yes' );
        $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
        $order->update_meta_data( '_lamako_checkout_source', $source );
        $order->update_meta_data( '_lamako_v2_checkout_token_hash', $token_hash );
        $order->update_meta_data( '_lamako_v2_checkout_expires_at', gmdate( 'c', $expires_at ) );
        $order->add_order_note( 'Lamako Mobile v2 checkout session created.' );
        $order->save();

        $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $order );
        if ( is_wp_error( $ticket_result ) ) {
            $order->delete( true );
            lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
            return new WP_Error( 'lamako_v2_ticket_create_failed', $ticket_result->get_error_message(), [ 'status' => 500 ] );
        }
    } catch ( Exception $e ) {
        lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );
        return new WP_Error( 'lamako_v2_checkout_failed', $e->getMessage(), [ 'status' => 500 ] );
    }

    lamako_mobile_v2_restore_legacy_product_overrides( $removed_filters );

    set_transient( 'lamako_v2_checkout_' . $token_hash, $order->get_id(), LAMAKO_MOBILE_V2_CHECKOUT_TTL + ( 5 * MINUTE_IN_SECONDS ) );

    return rest_ensure_response( [
        'checkoutToken' => $token,
        'checkoutUrl'   => home_url( '/?lamako_checkout_token=' . rawurlencode( $token ) ),
        'orderId'       => $order->get_id(),
        'expiresAt'     => gmdate( 'c', $expires_at ),
        'total'         => $order->get_total(),
        'currency'      => $order->get_currency(),
        'itemCount'     => $order->get_item_count(),
    ] );
}

function lamako_mobile_v2_create_seating_session( WP_REST_Request $request ) {
    $body     = $request->get_json_params();
    $body     = is_array( $body ) ? $body : [];
    $event_id = absint( $body['eventId'] ?? $body['event_id'] ?? 0 );

    if ( $event_id <= 0 ) {
        return new WP_Error( 'lamako_v2_event_required', 'Event ID is required.', [ 'status' => 400 ] );
    }

    $event = get_post( $event_id );
    if ( ! $event || $event->post_type !== 'tc_events' || $event->post_status !== 'publish' ) {
        return new WP_Error( 'lamako_v2_event_not_found', 'Event not found.', [ 'status' => 404 ] );
    }

    $chart_id = lamako_mobile_v2_find_chart_for_event( $event_id );
    if ( $chart_id <= 0 ) {
        return new WP_Error( 'lamako_v2_seating_chart_not_found', 'No seating chart is linked to this event.', [ 'status' => 404 ] );
    }

    $user_id    = get_current_user_id();
    $token      = lamako_mobile_v2_token();
    $token_hash = lamako_mobile_v2_token_hash( $token );
    $expires_at = time() + LAMAKO_MOBILE_V2_SEATING_TTL;
    $flow_id    = 'seat_' . substr( $token_hash, 0, 16 );

    $flow = [
        'flow_id'          => $flow_id,
        'token_hash'       => $token_hash,
        'user_id'          => $user_id,
        'event_id'         => $event_id,
        'chart_id'         => $chart_id,
        'created_at'       => time(),
        'expires_at'       => $expires_at,
        'cart_initialized' => false,
        'order_id'         => 0,
    ];

    lamako_mobile_v2_save_seating_flow( $token, $flow );

    return rest_ensure_response( [
        'flowId'    => $flow_id,
        'flowToken' => $token,
        'eventId'   => $event_id,
        'chartId'   => $chart_id,
        'seatUrl'   => home_url( '/lamako-mobile/seat/' . rawurlencode( $token ) ),
        'expiresAt' => gmdate( 'c', $expires_at ),
    ] );
}

function lamako_mobile_v2_find_seating_order( array $flow ) {
    if ( ! empty( $flow['order_id'] ) && function_exists( 'wc_get_order' ) ) {
        $order = wc_get_order( (int) $flow['order_id'] );
        if ( $order ) {
            return $order;
        }
    }

    if ( empty( $flow['token_hash'] ) || ! function_exists( 'wc_get_orders' ) ) {
        return false;
    }

    $orders = wc_get_orders( [
        'limit'      => 1,
        'meta_key'   => '_lamako_seating_flow_hash',
        'meta_value' => $flow['token_hash'],
        'orderby'    => 'date',
        'order'      => 'DESC',
    ] );

    return ! empty( $orders ) ? $orders[0] : false;
}

function lamako_mobile_v2_get_seating_session_status( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! $flow ) {
        return new WP_Error( 'lamako_v2_seating_session_not_found', 'Seating session not found.', [ 'status' => 404 ] );
    }

    if ( (int) $flow['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_woocommerce' ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating session.', [ 'status' => 403 ] );
    }

    $order = lamako_mobile_v2_find_seating_order( $flow );
    if ( $order && ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating order.', [ 'status' => 403 ] );
    }

    $status = 'active';
    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        $status = 'expired';
    }
    if ( $order ) {
        $status = lamako_mobile_v2_normalize_payment_status( $order );
    }

    return rest_ensure_response( [
        'flowId'        => $flow['flow_id'] ?? '',
        'eventId'       => (int) ( $flow['event_id'] ?? 0 ),
        'chartId'       => (int) ( $flow['chart_id'] ?? 0 ),
        'status'        => $status,
        'expiresAt'     => ! empty( $flow['expires_at'] ) ? gmdate( 'c', (int) $flow['expires_at'] ) : null,
        'seatUrl'       => home_url( '/lamako-mobile/seat/' . rawurlencode( $token ) ),
        'checkoutUrl'   => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' ),
        'order'         => $order ? lamako_mobile_v2_order_summary( $order, true ) : null,
        'ticketsReady'  => $order ? count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0 : false,
    ] );
}

function lamako_mobile_v2_get_payment_return_status( WP_REST_Request $request ) {
    $token = sanitize_text_field( $request['token'] ?? '' );
    $kind  = sanitize_key( $request->get_param( 'kind' ) );

    if ( ! in_array( $kind, [ 'checkout', 'seating' ], true ) ) {
        return new WP_Error( 'lamako_v2_invalid_payment_return_kind', 'Payment return kind must be checkout or seating.', [ 'status' => 400 ] );
    }

    if ( $kind === 'checkout' ) {
        $order = lamako_mobile_v2_find_order_by_token( $token );
        if ( ! $order ) {
            return new WP_Error( 'lamako_v2_checkout_not_found', 'Checkout not found.', [ 'status' => 404 ] );
        }
        if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
            return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this checkout.', [ 'status' => 403 ] );
        }

        $order_summary = lamako_mobile_v2_order_summary( $order, true );
        if ( lamako_mobile_v2_is_checkout_expired( $order ) && in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
            $order_summary['paymentStatus'] = 'expired';
        }

        return rest_ensure_response( [
            'kind'         => 'checkout',
            'token'        => $token,
            'status'       => $order_summary['paymentStatus'],
            'order'        => $order_summary,
            'ticketsReady' => (bool) $order_summary['ticketsReady'],
        ] );
    }

    $flow = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! $flow ) {
        return new WP_Error( 'lamako_v2_seating_session_not_found', 'Seating session not found.', [ 'status' => 404 ] );
    }

    if ( (int) $flow['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_woocommerce' ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating session.', [ 'status' => 403 ] );
    }

    $order = lamako_mobile_v2_find_seating_order( $flow );
    if ( $order && ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this seating order.', [ 'status' => 403 ] );
    }

    $status = 'active';
    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        $status = 'expired';
    }
    if ( $order ) {
        $status = lamako_mobile_v2_normalize_payment_status( $order );
    }

    return rest_ensure_response( [
        'kind'         => 'seating',
        'token'        => $token,
        'status'       => $status,
        'order'        => $order ? lamako_mobile_v2_order_summary( $order, true ) : null,
        'ticketsReady' => $order ? count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0 : false,
    ] );
}

function lamako_mobile_v2_set_cookie( $name, $value, $expires, $http_only = true ) {
    $args = [
        'expires'  => $expires,
        'path'     => defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/',
        'secure'   => is_ssl(),
        'httponly' => $http_only,
        'samesite' => 'Lax',
    ];
    if ( defined( 'COOKIE_DOMAIN' ) && COOKIE_DOMAIN ) {
        $args['domain'] = COOKIE_DOMAIN;
    }
    setcookie( $name, $value, $args );
    $_COOKIE[ $name ] = $value;
}

function lamako_mobile_v2_payment_page_url( $token, $kind, $page = 'payment-return', $status = '' ) {
    $args = [
        'kind' => $kind,
    ];
    if ( $status !== '' ) {
        $args['status'] = $status;
    }

    return add_query_arg( $args, home_url( '/lamako-mobile/' . $page . '/' . rawurlencode( $token ) ) );
}

function lamako_mobile_v2_app_payment_return_url( $token, $kind, $status = '' ) {
    $url = 'ticketbylamako://payment-return?kind=' . rawurlencode( $kind ) . '&token=' . rawurlencode( $token );
    if ( $status !== '' ) {
        $url .= '&status=' . rawurlencode( $status );
    }
    return $url;
}

function lamako_mobile_v2_seating_checkout_url( $token ) {
    return add_query_arg( 'lamako_seating_checkout', rawurlencode( $token ), home_url( '/' ) );
}

function lamako_mobile_v2_get_cookie_token( $name ) {
    if ( empty( $_COOKIE[ $name ] ) ) {
        return '';
    }

    return sanitize_text_field( wp_unslash( $_COOKIE[ $name ] ) );
}

function lamako_mobile_v2_seating_cart_url( $url ) {
    $token = lamako_mobile_v2_get_cookie_token( 'lamako_mobile_seat_flow' );
    $flow  = $token ? lamako_mobile_v2_get_seating_flow( $token ) : false;

    if ( ! is_array( $flow ) || empty( $flow['expires_at'] ) || (int) $flow['expires_at'] < time() ) {
        return $url;
    }

    return lamako_mobile_v2_seating_checkout_url( $token );
}

function lamako_mobile_v2_maybe_apply_payment_return_hint( $order, $status_hint ) {
    if ( ! $order instanceof WC_Order || ! in_array( $status_hint, [ 'cancelled', 'failed' ], true ) ) {
        return $order;
    }

    if ( in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
        $new_status = $status_hint === 'cancelled' ? 'cancelled' : 'failed';
        $order->update_status( $new_status, 'Lamako Mobile payment return marked this order as ' . $new_status . '.' );
    }

    return wc_get_order( $order->get_id() );
}

function lamako_mobile_v2_return_url_for_order( $return_url, $order, $page = 'payment-return', $status = '' ) {
    if ( ! $order instanceof WC_Order ) {
        return $return_url;
    }

    if ( $order->get_meta( '_lamako_mobile_v2' ) !== 'yes' ) {
        return $return_url;
    }

    $source = (string) $order->get_meta( '_lamako_checkout_source' );

    if ( $source === 'seating' ) {
        $seat_token = lamako_mobile_v2_get_cookie_token( 'lamako_mobile_seat_flow' );
        $flow       = $seat_token ? lamako_mobile_v2_get_seating_flow( $seat_token ) : false;
        $order_hash = (string) $order->get_meta( '_lamako_seating_flow_hash' );

        if ( is_array( $flow ) && $order_hash !== '' && hash_equals( $order_hash, (string) ( $flow['token_hash'] ?? '' ) ) ) {
            return lamako_mobile_v2_payment_page_url( $seat_token, 'seating', $page, $status );
        }
    }

    $checkout_token = lamako_mobile_v2_get_cookie_token( 'lamako_mobile_checkout_token' );
    $checkout_hash  = (string) $order->get_meta( '_lamako_v2_checkout_token_hash' );

    if ( $checkout_token !== '' && $checkout_hash !== '' && hash_equals( $checkout_hash, lamako_mobile_v2_token_hash( $checkout_token ) ) ) {
        return lamako_mobile_v2_payment_page_url( $checkout_token, 'checkout', $page, $status );
    }

    return $return_url;
}

function lamako_mobile_v2_payment_return_url( $return_url, $order ) {
    return lamako_mobile_v2_return_url_for_order( $return_url, $order, 'payment-return', '' );
}

function lamako_mobile_v2_payment_cancel_url( $cancel_url, $order ) {
    return lamako_mobile_v2_return_url_for_order( $cancel_url, $order, 'payment-cancel', 'cancelled' );
}

function lamako_mobile_v2_extract_payment_return_request() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    $path        = $request_uri ? wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
    if ( ! $path ) {
        return false;
    }

    if ( ! preg_match( '#/lamako-mobile/(payment-return|payment-failed|payment-cancel)/([A-Za-z0-9_-]+)#', $path, $matches ) ) {
        return false;
    }

    $page = sanitize_key( $matches[1] );
    $kind = ! empty( $_GET['kind'] ) ? sanitize_key( wp_unslash( $_GET['kind'] ) ) : '';
    if ( ! in_array( $kind, [ 'checkout', 'seating' ], true ) ) {
        $kind = '';
    }

    $status_hint = '';
    if ( $page === 'payment-failed' ) {
        $status_hint = 'failed';
    } elseif ( $page === 'payment-cancel' ) {
        $status_hint = 'cancelled';
    } elseif ( ! empty( $_GET['status'] ) ) {
        $status_hint = sanitize_key( wp_unslash( $_GET['status'] ) );
    }

    return [
        'page'       => $page,
        'token'      => sanitize_text_field( $matches[2] ),
        'kind'       => $kind,
        'statusHint' => $status_hint,
    ];
}

function lamako_mobile_v2_payment_context_from_token( $token, $kind = '', $status_hint = '' ) {
    $context = [
        'kind'        => $kind ?: 'checkout',
        'flowId'      => 'return_' . substr( lamako_mobile_v2_token_hash( $token ), 0, 16 ),
        'status'      => $status_hint ?: 'unknown',
        'statusHint'  => $status_hint,
        'order'       => null,
        'ticketsReady'=> false,
        'found'       => false,
    ];

    if ( $kind !== 'seating' ) {
        $order = lamako_mobile_v2_find_order_by_token( $token );
        if ( $order instanceof WC_Order ) {
            $order  = lamako_mobile_v2_maybe_apply_payment_return_hint( $order, $status_hint );
            $status = lamako_mobile_v2_normalize_payment_status( $order );
            if ( lamako_mobile_v2_is_checkout_expired( $order ) && in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
                $status = 'expired';
            }

            $context['kind']         = 'checkout';
            $context['status']       = $status;
            $context['order']        = lamako_mobile_v2_order_summary( $order, false );
            $context['ticketsReady'] = count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0;
            $context['found']        = true;
            return $context;
        }
    }

    if ( $kind !== 'checkout' ) {
        $flow = lamako_mobile_v2_get_seating_flow( $token );
        if ( is_array( $flow ) ) {
            $order  = lamako_mobile_v2_find_seating_order( $flow );
            $status = 'pending';
            if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
                $status = 'expired';
            }
            if ( $order instanceof WC_Order ) {
                $order = lamako_mobile_v2_maybe_apply_payment_return_hint( $order, $status_hint );
                $status = lamako_mobile_v2_normalize_payment_status( $order );
            } elseif ( in_array( $status_hint, [ 'failed', 'cancelled' ], true ) ) {
                $status = $status_hint;
            }

            $context['kind']         = 'seating';
            $context['flowId']       = (string) ( $flow['flow_id'] ?? $context['flowId'] );
            $context['status']       = $status;
            $context['order']        = $order instanceof WC_Order ? lamako_mobile_v2_order_summary( $order, false ) : null;
            $context['ticketsReady'] = $order instanceof WC_Order ? count( lamako_mobile_v2_get_tickets_for_order( $order ) ) > 0 : false;
            $context['found']        = true;
            return $context;
        }
    }

    return $context;
}

function lamako_mobile_v2_maybe_serve_payment_return() {
    $request = lamako_mobile_v2_extract_payment_return_request();
    if ( ! is_array( $request ) ) {
        return;
    }

    $token   = $request['token'];
    $context = lamako_mobile_v2_payment_context_from_token( $token, $request['kind'], $request['statusHint'] );
    $kind    = $context['kind'];
    $status  = $context['status'];
    $order   = is_array( $context['order'] ) ? $context['order'] : null;
    $app_url = lamako_mobile_v2_app_payment_return_url( $token, $kind, $status );

    $title = 'Retour paiement';
    if ( $status === 'success' ) {
        $title = 'Paiement confirme';
    } elseif ( $status === 'pending' ) {
        $title = 'Paiement en attente';
    } elseif ( in_array( $status, [ 'failed', 'cancelled', 'expired' ], true ) ) {
        $title = 'Paiement non confirme';
    }

    nocache_headers();
    status_header( $context['found'] ? 200 : 404 );
    ?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="<?php echo esc_attr( get_bloginfo( 'charset' ) ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo esc_html( $title ); ?></title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #f7f3ed; color: #2f2116; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wrap { min-height: 100vh; box-sizing: border-box; padding: 48px 22px; display: flex; align-items: center; justify-content: center; text-align: center; }
    .panel { width: 100%; max-width: 420px; }
    .icon { width: 68px; height: 68px; margin: 0 auto 18px; border-radius: 34px; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 900; }
    .success { background: #dcfce7; color: #15803d; }
    .pending { background: #fef3c7; color: #b45309; }
    .error { background: #fee2e2; color: #b91c1c; }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    p { margin: 12px 0 0; color: #6f6256; font-size: 15px; line-height: 1.45; }
    a { display: block; margin-top: 24px; border-radius: 14px; padding: 15px 18px; background: #663d17; color: #fff; text-decoration: none; font-weight: 800; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="panel">
      <div class="icon <?php echo esc_attr( $status === 'success' ? 'success' : ( $status === 'pending' ? 'pending' : 'error' ) ); ?>">
        <?php echo esc_html( $status === 'success' ? 'OK' : ( $status === 'pending' ? '...' : '!' ) ); ?>
      </div>
      <h1><?php echo esc_html( $title ); ?></h1>
      <p>
        <?php if ( $status === 'success' ) : ?>
          Votre paiement est enregistre. Retour vers l'application pour verifier la commande.
        <?php elseif ( $status === 'pending' ) : ?>
          Votre paiement est en cours de confirmation. L'application va verifier le statut serveur.
        <?php elseif ( ! $context['found'] ) : ?>
          Cette session de paiement est introuvable ou expiree.
        <?php else : ?>
          Le paiement n'est pas confirme. L'application va verifier le statut serveur.
        <?php endif; ?>
      </p>
      <a href="<?php echo esc_url( $app_url, [ 'ticketbylamako' ] ); ?>">Retourner dans TicketByLamako</a>
    </section>
  </main>
  <script>
    (function() {
      var envelope = {
        source: "lamako-mobile-web",
        version: 1,
        flowId: <?php echo wp_json_encode( $context['flowId'] ); ?>,
        type: "PAYMENT_RESULT",
        payload: {
          kind: <?php echo wp_json_encode( $kind ); ?>,
          status: <?php echo wp_json_encode( $status ); ?>,
          statusHint: <?php echo wp_json_encode( $context['statusHint'] ); ?>,
          token: <?php echo wp_json_encode( $token ); ?>,
          orderId: <?php echo wp_json_encode( $order['id'] ?? null ); ?>,
          orderNumber: <?php echo wp_json_encode( $order['number'] ?? null ); ?>,
          ticketsReady: <?php echo wp_json_encode( (bool) $context['ticketsReady'] ); ?>
        },
        ts: Date.now(),
        signature: ""
      };
      function post(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }
      post(envelope);
      setTimeout(function() {
        post(Object.assign({}, envelope, { type: "RETURN_TO_APP", payload: Object.assign({}, envelope.payload, { reason: "payment_return" }) }));
      }, 250);
      setTimeout(function() {
        window.location.href = <?php echo wp_json_encode( $app_url ); ?>;
      }, 900);
    })();
  </script>
</body>
</html>
    <?php
    exit;
}

function lamako_mobile_v2_prepare_seating_web_session( $token, array &$flow ) {
    $user_id = (int) ( $flow['user_id'] ?? 0 );
    if ( $user_id <= 0 ) {
        return;
    }

    wp_set_current_user( $user_id );
    wp_set_auth_cookie( $user_id, false, is_ssl() );

    $expires = ! empty( $flow['expires_at'] ) ? (int) $flow['expires_at'] : time() + LAMAKO_MOBILE_V2_SEATING_TTL;
    lamako_mobile_v2_set_cookie( 'lamako_mobile_session', '1', $expires, true );
    lamako_mobile_v2_set_cookie( 'lamako_mobile_seat_flow', $token, $expires, true );

    if ( function_exists( 'wc_load_cart' ) ) {
        wc_load_cart();
    }

    if ( function_exists( 'WC' ) ) {
        if ( WC()->session && ! WC()->session->has_session() ) {
            WC()->session->set_customer_session_cookie( true );
        }
        if ( class_exists( 'WC_Customer' ) ) {
            WC()->customer = new WC_Customer( $user_id, true );
        }
        if ( WC()->cart && empty( $flow['cart_initialized'] ) ) {
            WC()->cart->empty_cart( true );
            $flow['cart_initialized'] = true;
            lamako_mobile_v2_save_seating_flow( $token, $flow );
        }
    }
}

function lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, $title, $message, $response = 200 ) {
    $flow_id  = is_array( $flow ) ? (string) ( $flow['flow_id'] ?? '' ) : '';
    $seat_url = $token ? home_url( '/lamako-mobile/seat/' . rawurlencode( $token ) ) : home_url( '/' );

    nocache_headers();
    status_header( $response );
    ?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="<?php echo esc_attr( get_bloginfo( 'charset' ) ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title><?php echo esc_html( $title ); ?></title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #f7f3ed; color: #2f2116; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wrap { min-height: 100vh; box-sizing: border-box; padding: 42px 22px; display: flex; align-items: center; justify-content: center; text-align: center; }
    .panel { width: 100%; max-width: 420px; }
    .icon { width: 66px; height: 66px; border-radius: 33px; margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; background: #fef3c7; color: #b45309; font-size: 34px; font-weight: 900; }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    p { margin: 12px 0 0; color: #6f6256; font-size: 15px; line-height: 1.45; }
    a { display: block; margin-top: 24px; border-radius: 14px; padding: 15px 18px; background: #663d17; color: #fff; text-decoration: none; font-weight: 800; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="panel">
      <div class="icon">!</div>
      <h1><?php echo esc_html( $title ); ?></h1>
      <p><?php echo esc_html( $message ); ?></p>
      <a href="<?php echo esc_url( $seat_url ); ?>">Retour au plan de salle</a>
    </section>
  </main>
  <script>
    (function() {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        source: "lamako-mobile-web",
        version: 1,
        flowId: <?php echo wp_json_encode( $flow_id ); ?>,
        type: "SEAT_SELECTION_CHANGED",
        payload: { seats: [], count: 0, inCartCount: 0, message: <?php echo wp_json_encode( $message ); ?> },
        ts: Date.now(),
        signature: ""
      }));
    })();
  </script>
</body>
</html>
    <?php
    exit;
}

function lamako_mobile_v2_get_seating_cart_cookie() {
    if ( class_exists( 'TC_Seat_Chart' ) && method_exists( 'TC_Seat_Chart', 'get_cart_seats_cookie' ) ) {
        $seats = TC_Seat_Chart::get_cart_seats_cookie();
        return is_array( $seats ) ? $seats : [];
    }

    $cookie_id = 'tc_cart_seats_' . COOKIEHASH;
    if ( empty( $_COOKIE[ $cookie_id ] ) ) {
        return [];
    }

    $decoded = json_decode( stripslashes( wp_unslash( $_COOKIE[ $cookie_id ] ) ), true );
    return is_array( $decoded ) ? $decoded : [];
}

function lamako_mobile_v2_expand_seating_cookie_for_ticket_type( array $seat_cookie, $ticket_type_id ) {
    $ticket_type_id = (int) $ticket_type_id;
    $raw_seats      = [];

    if ( isset( $seat_cookie[ $ticket_type_id ] ) && is_array( $seat_cookie[ $ticket_type_id ] ) ) {
        $raw_seats = $seat_cookie[ $ticket_type_id ];
    } elseif ( isset( $seat_cookie[ (string) $ticket_type_id ] ) && is_array( $seat_cookie[ (string) $ticket_type_id ] ) ) {
        $raw_seats = $seat_cookie[ (string) $ticket_type_id ];
    }

    $expanded = [];
    foreach ( $raw_seats as $seat ) {
        if ( ! is_array( $seat ) ) {
            continue;
        }

        $quantity = max( 1, absint( $seat[3] ?? 1 ) );
        $entry    = [
            'seat_id'    => sanitize_text_field( (string) ( $seat[0] ?? '' ) ),
            'seat_label' => sanitize_text_field( (string) ( $seat[1] ?? '' ) ),
            'chart_id'   => absint( $seat[2] ?? 0 ),
        ];

        for ( $i = 0; $i < $quantity; $i++ ) {
            $expanded[] = $entry;
        }
    }

    return $expanded;
}

function lamako_mobile_v2_get_ticket_instances_for_item( $order_id, $item_id, $ticket_type_id = 0 ) {
    $meta_query = [
        [
            'key'   => 'item_id',
            'value' => (string) $item_id,
        ],
    ];

    if ( $ticket_type_id ) {
        $meta_query[] = [
            'key'   => 'ticket_type_id',
            'value' => (string) $ticket_type_id,
        ];
    }

    if ( count( $meta_query ) > 1 ) {
        $meta_query['relation'] = 'AND';
    }

    $ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft', 'trash' ],
        'post_parent'    => (int) $order_id,
        'fields'         => 'ids',
        'posts_per_page' => -1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
        'meta_query'     => $meta_query,
    ] );

    return array_map( 'intval', $ids );
}

function lamako_mobile_v2_next_ticket_code_slot( $order_id ) {
    $ids = get_posts( [
        'post_type'      => 'tc_tickets_instances',
        'post_status'    => [ 'publish', 'draft', 'trash' ],
        'post_parent'    => (int) $order_id,
        'fields'         => 'ids',
        'posts_per_page' => -1,
    ] );

    $used = [];
    foreach ( $ids as $id ) {
        $code = (string) get_post_meta( $id, 'ticket_code', true );
        if ( preg_match( '/-(\d+)$/', $code, $matches ) ) {
            $used[ (int) $matches[1] ] = true;
        } elseif ( preg_match( '/^' . preg_quote( (string) $order_id, '/' ) . '(\d+)$/', $code, $matches ) ) {
            $used[ (int) $matches[1] ] = true;
        }
    }

    for ( $slot = 1; $slot < 10000; $slot++ ) {
        if ( empty( $used[ $slot ] ) ) {
            return $slot;
        }
    }

    return count( $ids ) + 1;
}

function lamako_mobile_v2_create_ticket_instance_for_item( WC_Order $order, $item_id, $item, $ticket_type_id, $seat = null, array $flow = [] ) {
    $order_id   = $order->get_id();
    $product_id = (int) $item->get_product_id();
    $event_id   = absint( get_post_meta( $product_id, '_event_name', true ) );
    if ( $event_id <= 0 && ! empty( $flow['event_id'] ) ) {
        $event_id = absint( $flow['event_id'] );
    }

    $owner_name = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
    if ( $owner_name === '' ) {
        $owner_name = $order->get_billing_email();
    }
    if ( $owner_name === '' ) {
        $owner_name = 'Ticket';
    }

    $ticket_id = wp_insert_post( [
        'post_author'  => (int) $order->get_customer_id(),
        'post_parent'  => (int) $order_id,
        'post_excerpt' => '',
        'post_content' => '',
        'post_status'  => 'publish',
        'post_title'   => sanitize_text_field( $owner_name ),
        'post_type'    => 'tc_tickets_instances',
    ], true );

    if ( is_wp_error( $ticket_id ) ) {
        return $ticket_id;
    }

    $slot = lamako_mobile_v2_next_ticket_code_slot( $order_id );
    if ( apply_filters( 'tc_use_only_digit_order_number', false ) == true ) {
        $ticket_code = apply_filters( 'tc_ticket_code', $order_id . '' . $slot, $ticket_type_id, $ticket_id );
    } else {
        $ticket_code = apply_filters( 'tc_ticket_code', $order_id . '-' . $slot, $ticket_type_id, $ticket_id );
    }

    update_post_meta( $ticket_id, 'ticket_type_id', (int) $ticket_type_id );
    update_post_meta( $ticket_id, 'ticket_code', sanitize_text_field( $ticket_code ) );
    update_post_meta( $ticket_id, 'event_id', (int) $event_id );
    update_post_meta( $ticket_id, 'item_id', (int) $item_id );

    if ( $order->get_billing_first_name() ) {
        update_post_meta( $ticket_id, 'first_name', sanitize_text_field( $order->get_billing_first_name() ) );
    }
    if ( $order->get_billing_last_name() ) {
        update_post_meta( $ticket_id, 'last_name', sanitize_text_field( $order->get_billing_last_name() ) );
    }
    if ( $order->get_billing_email() ) {
        update_post_meta( $ticket_id, 'owner_email', sanitize_email( $order->get_billing_email() ) );
    }

    if ( is_array( $seat ) ) {
        update_post_meta( $ticket_id, 'chart_id', absint( $seat['chart_id'] ?? 0 ) );
        update_post_meta( $ticket_id, 'seat_id', sanitize_text_field( (string) ( $seat['seat_id'] ?? '' ) ) );
        update_post_meta( $ticket_id, 'seat_label', sanitize_text_field( (string) ( $seat['seat_label'] ?? '' ) ) );
    }

    do_action( 'tc_created_order_ticket_instance', $ticket_id, $order_id, false );

    return (int) $ticket_id;
}

function lamako_mobile_v2_ensure_ticket_instances_for_order( WC_Order $order, array $seat_cookie = [], array $flow = [] ) {
    $cart_contents = [];

    foreach ( $order->get_items() as $item_id => $item ) {
        if ( ! is_object( $item ) || ! method_exists( $item, 'get_product_id' ) ) {
            continue;
        }

        $product_id     = (int) $item->get_product_id();
        $variation_id   = method_exists( $item, 'get_variation_id' ) ? (int) $item->get_variation_id() : 0;
        $ticket_type_id = $variation_id > 0 ? $variation_id : $product_id;

        if ( get_post_meta( $product_id, '_tc_is_ticket', true ) !== 'yes' ) {
            continue;
        }

        $quantity = max( 1, (int) $item->get_quantity() );
        if ( ! isset( $cart_contents[ $ticket_type_id ] ) ) {
            $cart_contents[ $ticket_type_id ] = 0;
        }
        $cart_contents[ $ticket_type_id ] += $quantity;

        $seats     = lamako_mobile_v2_expand_seating_cookie_for_ticket_type( $seat_cookie, $ticket_type_id );
        $instances = lamako_mobile_v2_get_ticket_instances_for_item( $order->get_id(), $item_id, $ticket_type_id );

        while ( count( $instances ) < $quantity ) {
            $next_index = count( $instances );
            $created    = lamako_mobile_v2_create_ticket_instance_for_item( $order, $item_id, $item, $ticket_type_id, $seats[ $next_index ] ?? null, $flow );
            if ( is_wp_error( $created ) ) {
                return $created;
            }
            $instances[] = (int) $created;
        }

        $seat_labels = [];
        $seat_ids    = [];
        $chart_ids   = [];
        for ( $i = 0; $i < $quantity; $i++ ) {
            if ( empty( $instances[ $i ] ) || empty( $seats[ $i ] ) ) {
                continue;
            }

            $seat = $seats[ $i ];
            update_post_meta( $instances[ $i ], 'chart_id', absint( $seat['chart_id'] ?? 0 ) );
            update_post_meta( $instances[ $i ], 'seat_id', sanitize_text_field( (string) ( $seat['seat_id'] ?? '' ) ) );
            update_post_meta( $instances[ $i ], 'seat_label', sanitize_text_field( (string) ( $seat['seat_label'] ?? '' ) ) );

            if ( ! empty( $seat['seat_label'] ) ) {
                $seat_labels[] = sanitize_text_field( (string) $seat['seat_label'] );
            }
            if ( ! empty( $seat['seat_id'] ) ) {
                $seat_ids[] = sanitize_text_field( (string) $seat['seat_id'] );
            }
            if ( ! empty( $seat['chart_id'] ) ) {
                $chart_ids[] = absint( $seat['chart_id'] );
            }
        }

        if ( ! empty( $seat_labels ) ) {
            $item->update_meta_data( '_lamako_seat_labels', implode( ', ', array_unique( $seat_labels ) ) );
            $item->update_meta_data( '_lamako_seat_ids', implode( ',', array_unique( $seat_ids ) ) );
            $item->update_meta_data( '_lamako_chart_ids', implode( ',', array_unique( $chart_ids ) ) );
            $item->update_meta_data( 'Place', implode( ', ', array_unique( $seat_labels ) ) );
            $item->save();
        }
    }

    if ( ! empty( $cart_contents ) ) {
        $order->update_meta_data( 'tc_cart_contents', array_filter( $cart_contents ) );
        $cart_info = $order->get_meta( 'tc_cart_info' );
        if ( ! is_array( $cart_info ) ) {
            $order->update_meta_data( 'tc_cart_info', [
                'buyer_data' => [],
                'owner_data' => [],
            ] );
        }
        $order->save();
    }

    return true;
}

function lamako_mobile_v2_clear_seating_cart_state() {
    if ( class_exists( 'TC_Seat_Chart' ) && method_exists( 'TC_Seat_Chart', 'set_seats_cookie' ) ) {
        TC_Seat_Chart::set_seats_cookie( [] );
    } else {
        $cookie_id = 'tc_cart_seats_' . COOKIEHASH;
        unset( $_COOKIE[ $cookie_id ] );
        setcookie( $cookie_id, '', time() - HOUR_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN );
    }

    if ( get_current_user_id() ) {
        update_user_meta( get_current_user_id(), '_seatings_persistent_cart', [ 'seats_cart' => [] ] );
    }

    if ( function_exists( 'WC' ) ) {
        if ( WC()->cart ) {
            WC()->cart->empty_cart( true );
        }
        if ( WC()->session ) {
            WC()->session->set( 'tc_seat_cart_items', null );
            WC()->session->set( 'tc_cart_seats', null );
        }
    }
}

function lamako_mobile_v2_begin_seating_checkout() {
    if ( empty( $_GET['lamako_seating_checkout'] ) ) {
        return;
    }

    $token = sanitize_text_field( wp_unslash( $_GET['lamako_seating_checkout'] ) );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );

    if ( ! is_array( $flow ) ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, [], 'Session introuvable', 'Cette session de reservation est introuvable. Merci de relancer le choix des places.', 404 );
    }

    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Session expiree', 'Cette session de reservation a expire. Merci de relancer le choix des places.', 410 );
    }

    lamako_mobile_v2_prepare_seating_web_session( $token, $flow );

    if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Panier indisponible', 'Le panier WooCommerce est indisponible pour cette session.', 500 );
    }

    WC()->cart->calculate_totals();
    if ( WC()->cart->is_empty() ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Aucun siege confirme', 'Selectionnez un siege, puis confirmez-le dans la fenetre du plan de salle avant de passer au paiement.', 200 );
    }

    $seat_cookie = lamako_mobile_v2_get_seating_cart_cookie();
    if ( empty( $seat_cookie ) ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Aucun siege confirme', 'Selectionnez un siege, puis confirmez-le dans la fenetre du plan de salle avant de passer au paiement.', 200 );
    }

    $existing_order = lamako_mobile_v2_find_seating_order( $flow );
    if ( $existing_order instanceof WC_Order && in_array( $existing_order->get_status(), [ 'processing', 'completed', 'on-hold' ], true ) ) {
        wp_safe_redirect( home_url( '/?lamako_checkout=1&order_id=' . absint( $existing_order->get_id() ) . '&order_key=' . rawurlencode( $existing_order->get_order_key() ) ) );
        exit;
    }

    if ( $existing_order instanceof WC_Order && in_array( $existing_order->get_status(), [ 'pending', 'on-hold', 'checkout-draft' ], true ) ) {
        $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $existing_order, $seat_cookie, $flow );
        if ( is_wp_error( $ticket_result ) ) {
            lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Paiement indisponible', $ticket_result->get_error_message(), 500 );
        }
        lamako_mobile_v2_clear_seating_cart_state();
        wp_safe_redirect( home_url( '/?lamako_checkout=1&order_id=' . absint( $existing_order->get_id() ) . '&order_key=' . rawurlencode( $existing_order->get_order_key() ) ) );
        exit;
    }

    try {
        $checkout = WC()->checkout();
        $order_id = $checkout->create_order( [] );

        if ( is_wp_error( $order_id ) ) {
            throw new Exception( $order_id->get_error_message() );
        }

        $order = wc_get_order( $order_id );
        if ( ! $order ) {
            throw new Exception( 'Order could not be created.' );
        }

        $user_id = (int) ( $flow['user_id'] ?? 0 );
        if ( $user_id > 0 ) {
            $user = get_userdata( $user_id );
            $order->set_customer_id( $user_id );
            if ( $user ) {
                if ( ! $order->get_billing_email() ) {
                    $order->set_billing_email( $user->user_email );
                }
                if ( ! $order->get_billing_first_name() ) {
                    $order->set_billing_first_name( get_user_meta( $user_id, 'first_name', true ) ?: $user->display_name );
                }
                if ( ! $order->get_billing_last_name() ) {
                    $order->set_billing_last_name( get_user_meta( $user_id, 'last_name', true ) );
                }
            }
        }

        $order->set_created_via( 'lamako_mobile_seating_v2' );
        $order->set_status( 'pending' );
        $order->update_meta_data( '_lamako_mobile_order', 'yes' );
        $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
        $order->update_meta_data( '_lamako_checkout_source', 'seating' );
        $order->update_meta_data( '_lamako_seating_flow_hash', $flow['token_hash'] ?? lamako_mobile_v2_token_hash( $token ) );
        $order->update_meta_data( '_lamako_seating_event_id', (int) ( $flow['event_id'] ?? 0 ) );
        $order->update_meta_data( '_lamako_seating_chart_id', (int) ( $flow['chart_id'] ?? 0 ) );
        $order->add_order_note( 'Lamako Mobile v2 seating order created from WebView cart.' );
        $order->calculate_totals();
        $order->save();

        $ticket_result = lamako_mobile_v2_ensure_ticket_instances_for_order( $order, $seat_cookie, $flow );
        if ( is_wp_error( $ticket_result ) ) {
            throw new Exception( $ticket_result->get_error_message() );
        }

        $flow['order_id'] = $order->get_id();
        lamako_mobile_v2_save_seating_flow( $token, $flow );

        lamako_mobile_v2_clear_seating_cart_state();

        wp_safe_redirect( home_url( '/?lamako_checkout=1&order_id=' . absint( $order->get_id() ) . '&order_key=' . rawurlencode( $order->get_order_key() ) ) );
        exit;
    } catch ( Exception $e ) {
        lamako_mobile_v2_render_seating_checkout_notice( $token, $flow, 'Paiement indisponible', $e->getMessage(), 500 );
    }
}

function lamako_mobile_v2_maybe_serve_seating_flow() {
    $token = lamako_mobile_v2_extract_seating_token_from_request();
    if ( $token === '' ) {
        return;
    }

    $flow = lamako_mobile_v2_get_seating_flow( $token );
    if ( ! $flow ) {
        wp_die( 'Seating session not found.', 'Lamako Mobile', [ 'response' => 404 ] );
    }

    if ( ! empty( $flow['expires_at'] ) && (int) $flow['expires_at'] < time() ) {
        wp_die( 'Seating session expired.', 'Lamako Mobile', [ 'response' => 410 ] );
    }

    $event_id = (int) ( $flow['event_id'] ?? 0 );
    $chart_id = (int) ( $flow['chart_id'] ?? 0 );
    if ( $event_id <= 0 || $chart_id <= 0 ) {
        wp_die( 'Invalid seating session.', 'Lamako Mobile', [ 'response' => 400 ] );
    }

    lamako_mobile_v2_prepare_seating_web_session( $token, $flow );

    $flow_id      = esc_js( $flow['flow_id'] ?? '' );
    $event_title  = get_the_title( $event_id );
    $checkout_url = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' );
    $seating_checkout_url = lamako_mobile_v2_seating_checkout_url( $token );

    nocache_headers();
    ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex,nofollow" />
<title><?php echo esc_html( $event_title ?: 'Plan de salle' ); ?> - TicketByLamako</title>
<style>
html, body { margin: 0 !important; padding: 0 !important; min-height: 100%; background: #f7f3ed !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
body.lamako-mobile-seat-flow { overflow-x: hidden !important; }
#wpadminbar, header, footer, nav, aside, .site-header, .site-footer, #masthead, #colophon, .woocommerce-breadcrumb, .gt-breadcrumb, .gt-page-title-bar, .sidebar, [class*="whatsapp"], [id*="whatsapp"], [class*="qlwapp"], [id*="qlwapp"], [class*="cookie"], [class*="consent"], #fkcart-floating-toggler, .fkcart-main-wrapper, [class*="tidio"], [id*="tidio"], [class*="tawk"], [id*="tawk"], [class*="crisp"], [id*="crisp"] { display: none !important; visibility: hidden !important; }
.lamako-seat-shell { min-height: 100vh; padding: 12px 12px 24px; box-sizing: border-box; }
.lamako-seat-title { margin: 0 0 10px; color: #2f2116; font-size: 16px; font-weight: 800; line-height: 1.25; }
.lamako-seat-helper { margin: 0 0 12px; color: #6f6256; font-size: 13px; line-height: 1.35; }
.tc_seating_map_button, button.tc_seating_map_button { display: block !important; width: 100% !important; max-width: 360px !important; margin: 12px auto !important; padding: 14px 18px !important; border: 0 !important; border-radius: 12px !important; background: #663d17 !important; color: #fff !important; font-size: 16px !important; font-weight: 800 !important; text-align: center !important; }
.tc_seating_map, [class*="tc_seating_map"], .tc_seat_chart_wrap, .tc_seat_chart_modal, .tc_seat_chart_container, .tc_seating_chart, .fancybox-overlay, .fancybox-wrap { visibility: visible !important; z-index: 9999 !important; }
.tc_zoom_in, .tc_zoom_out, .tc-zoom-in, .tc-zoom-out, [class*="zoom_in"], [class*="zoom_out"] { display: block !important; visibility: visible !important; }
.woocommerce, .woocommerce-cart, .woocommerce-checkout { max-width: 100% !important; padding: 10px !important; box-sizing: border-box !important; }
.wc-proceed-to-checkout a, .checkout-button, #place_order { display: block !important; width: 100% !important; border-radius: 12px !important; padding: 14px !important; font-size: 16px !important; font-weight: 800 !important; text-align: center !important; }
.tc-checkout-button, .tc_cart_button, a.tc-checkout-button { background: #16a34a !important; color: #fff !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; border-radius: 12px !important; font-weight: 900 !important; box-shadow: 0 10px 24px rgba(22,163,74,.24) !important; }
.tc-checkout-button:hover, .tc_cart_button:hover, a.tc-checkout-button:hover, .tc-checkout-button:focus, .tc_cart_button:focus, a.tc-checkout-button:focus, .tc-checkout-button:active, .tc_cart_button:active, a.tc-checkout-button:active { background: #15803d !important; color: #fff !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; }
.tc-checkout-button.is-lamako-loading, .tc_cart_button.is-lamako-loading, .tc-checkout-button.is-lamako-loading:disabled, .tc_cart_button.is-lamako-loading:disabled { background: #15803d !important; color: #fff !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; visibility: visible !important; pointer-events: none !important; cursor: progress !important; }
.lamako-seat-notice { position: fixed; left: 12px; right: 12px; bottom: 76px; z-index: 100000; display: none; border-radius: 12px; padding: 12px 14px; background: #fff7ed; color: #9a3412; font-size: 14px; font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.14); }
.lamako-seat-notice.is-visible { display: block; }
</style>
<?php wp_head(); ?>
</head>
<body class="lamako-mobile-seat-flow">
<main class="lamako-seat-shell">
    <h1 class="lamako-seat-title"><?php echo esc_html( $event_title ?: 'Choisissez vos places' ); ?></h1>
    <p class="lamako-seat-helper">Sélectionnez vos sièges avec le plan officiel, puis confirmez votre sélection pour continuer vers le paiement.</p>
    <?php echo do_shortcode( '[tc_seat_chart id="' . absint( $chart_id ) . '" show_legend="true" button_title="Choisir mes sieges" cart_title="Passer au paiement"]' ); ?>
</main>
<div class="lamako-seat-notice" id="lamako-seat-notice"></div>
<?php wp_footer(); ?>
<script>
(function() {
  var flowId = "<?php echo $flow_id; ?>";
  var checkoutUrl = "<?php echo esc_js( $checkout_url ); ?>";
  var seatingCheckoutUrl = "<?php echo esc_js( $seating_checkout_url ); ?>";
  var lastSeatKey = "";
  var noticeTimer = null;
  function post(type, payload) {
    if (!window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      source: "lamako-mobile-web",
      version: 1,
      flowId: flowId,
      type: type,
      payload: payload || {},
      ts: Date.now(),
      signature: ""
    }));
  }
  function showNotice(message) {
    var notice = document.getElementById("lamako-seat-notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = "lamako-seat-notice is-visible";
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function() {
      notice.className = "lamako-seat-notice";
    }, 3600);
  }
  function seatLabel(el) {
    if (!el) return "";
    var p = el.querySelector("span p, p, span");
    return (p ? p.textContent : el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function inCartCount() {
    var input = document.querySelector(".tc-seatchart-in-cart-count");
    var value = input ? parseInt(input.value || "0", 10) : 0;
    if (!isNaN(value) && value > 0) return value;
    return document.querySelectorAll(".tc_seat_in_cart").length;
  }
  function selectedSeats() {
    var selectors = [
      ".tc_seat_unit.ui-selected",
      ".tc_seat_unit.tc-selected",
      ".tc_seat_unit.selected",
      ".tc_seat_unit.tc_seat_in_cart",
      ".tc_seat_unit.in_cart",
      ".tc_seat_unit.tc_in_cart",
      ".tc_seat_unit[data-in-cart='1']"
    ];
    var seen = {};
    var seats = [];
    selectors.forEach(function(selector) {
      document.querySelectorAll(selector).forEach(function(el) {
        var id = el.id || el.getAttribute("data-seat-id") || seatLabel(el);
        if (!id || seen[id]) return;
        seen[id] = true;
        seats.push({ id: id, label: seatLabel(el) });
      });
    });
    return seats;
  }
  function reportSeats() {
    var seats = selectedSeats();
    var cartCount = inCartCount();
    var key = JSON.stringify({ seats: seats, cartCount: cartCount });
    if (key === lastSeatKey) return;
    lastSeatKey = key;
    post("SEAT_SELECTION_CHANGED", { seats: seats, count: cartCount, selectedCount: seats.length, inCartCount: cartCount });
  }
  function reportLocation() {
    var url = window.location.href;
    if (url.indexOf("/checkout") !== -1 || url.indexOf("/commande") !== -1 || url.indexOf("lamako_checkout") !== -1) {
      post("CHECKOUT_READY", { url: url });
    }
    if (url.indexOf("order-received") !== -1 || url.indexOf("commande-recue") !== -1 || url.indexOf("thankyou") !== -1) {
      post("PAYMENT_RESULT", { status: "success", url: url });
      post("RETURN_TO_APP", { reason: "payment_result" });
    }
  }
  function goToCheckout(source) {
    reportSeats();
    if (inCartCount() <= 0) {
      showNotice("Choisissez un siege, puis confirmez-le dans la fenetre du plan de salle.");
      return false;
    }
    document.querySelectorAll(".tc-checkout-button, .tc_cart_button").forEach(function(el) {
      el.classList.add("is-lamako-loading");
      el.textContent = "Ouverture du paiement...";
      if ("disabled" in el) el.disabled = true;
      el.setAttribute("aria-busy", "true");
      el.style.cssText += ";background:#15803d!important;color:#fff!important;-webkit-text-fill-color:#fff!important;opacity:1!important;visibility:visible!important;";
    });
    post("CHECKOUT_READY", { url: seatingCheckoutUrl, requested: true, source: source || "seat_flow" });
    window.location.href = seatingCheckoutUrl;
    return true;
  }
  window.lamakoGoToCheckoutFromApp = function() {
    return goToCheckout("native_badge");
  };
  document.addEventListener("click", function(event) {
    var target = event.target;
    var checkoutLink = target && target.closest ? target.closest(".tc-checkout-button") : null;
    if (checkoutLink) {
      event.preventDefault();
      event.stopPropagation();
      goToCheckout("tickera_cart_button");
      return;
    }
    setTimeout(reportSeats, 150);
  }, true);
  document.addEventListener("touchend", function() { setTimeout(reportSeats, 250); }, true);
  var observer = new MutationObserver(function() {
    reportSeats();
    reportLocation();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-in-cart"] });
  post("FLOW_READY", { eventId: <?php echo (int) $event_id; ?>, chartId: <?php echo (int) $chart_id; ?>, checkoutUrl: seatingCheckoutUrl, wooCheckoutUrl: checkoutUrl });
  reportSeats();
  reportLocation();
  setInterval(function() {
    reportSeats();
    reportLocation();
  }, 1500);
})();
</script>
</body>
</html>
    <?php
    exit;
}

function lamako_mobile_v2_current_seating_flow_from_cookie() {
    if ( empty( $_COOKIE['lamako_mobile_seat_flow'] ) ) {
        return [ '', false ];
    }

    $token = sanitize_text_field( wp_unslash( $_COOKIE['lamako_mobile_seat_flow'] ) );
    $flow  = lamako_mobile_v2_get_seating_flow( $token );
    return [ $token, $flow ];
}

function lamako_mobile_v2_mark_seating_order( $order, $data ) {
    list( $token, $flow ) = lamako_mobile_v2_current_seating_flow_from_cookie();
    if ( ! $token || ! is_array( $flow ) || ! $order instanceof WC_Order ) {
        return;
    }

    $user_id = (int) ( $flow['user_id'] ?? 0 );
    if ( $user_id > 0 ) {
        $order->set_customer_id( $user_id );
    }
    $order->set_created_via( 'lamako_mobile_seating_v2' );
    $order->update_meta_data( '_lamako_mobile_order', 'yes' );
    $order->update_meta_data( '_lamako_mobile_v2', 'yes' );
    $order->update_meta_data( '_lamako_checkout_source', 'seating' );
    $order->update_meta_data( '_lamako_seating_flow_hash', $flow['token_hash'] ?? lamako_mobile_v2_token_hash( $token ) );
    $order->update_meta_data( '_lamako_seating_event_id', (int) ( $flow['event_id'] ?? 0 ) );
    $order->update_meta_data( '_lamako_seating_chart_id', (int) ( $flow['chart_id'] ?? 0 ) );
    $order->add_order_note( 'Lamako Mobile v2 seating checkout created.' );
}

function lamako_mobile_v2_link_seating_order_created( $order ) {
    list( $token, $flow ) = lamako_mobile_v2_current_seating_flow_from_cookie();
    if ( ! $token || ! is_array( $flow ) || ! $order instanceof WC_Order ) {
        return;
    }

    $flow['order_id'] = $order->get_id();
    lamako_mobile_v2_save_seating_flow( $token, $flow );
}

function lamako_mobile_v2_bridge_checkout_token() {
    if ( empty( $_GET['lamako_checkout_token'] ) ) {
        return;
    }

    $token = sanitize_text_field( wp_unslash( $_GET['lamako_checkout_token'] ) );
    $order = lamako_mobile_v2_find_order_by_token( $token );

    if ( ! $order ) {
        wp_die( 'Checkout session not found.', 'Lamako Mobile', [ 'response' => 404 ] );
    }

    if ( lamako_mobile_v2_is_checkout_expired( $order ) && $order->has_status( 'pending' ) ) {
        $order->update_status( 'cancelled', 'Lamako Mobile v2 checkout expired before payment.' );
        wp_die( 'Checkout session expired.', 'Lamako Mobile', [ 'response' => 410 ] );
    }

    $expires_at = strtotime( (string) $order->get_meta( '_lamako_v2_checkout_expires_at' ) );
    $expires    = $expires_at && $expires_at > time() ? $expires_at : time() + LAMAKO_MOBILE_V2_CHECKOUT_TTL;
    lamako_mobile_v2_set_cookie( 'lamako_mobile_session', '1', $expires, true );
    lamako_mobile_v2_set_cookie( 'lamako_mobile_checkout_token', $token, $expires, true );

    $_GET['lamako_checkout'] = '1';
    $_GET['order_id']        = $order->get_id();
    $_GET['order_key']       = $order->get_order_key();
}

function lamako_mobile_v2_normalize_payment_status( WC_Order $order ) {
    $status = $order->get_status();

    if ( in_array( $status, [ 'completed', 'processing', 'cs-complete' ], true ) ) {
        return 'success';
    }
    if ( in_array( $status, [ 'pending', 'on-hold', 'cs-pending', 'cs-review', 'checkout-draft' ], true ) ) {
        return 'pending';
    }
    if ( in_array( $status, [ 'cancelled', 'failed', 'refunded', 'cs-error', 'cs-reject', 'cs-failed', 'cs-declined' ], true ) ) {
        return $status === 'cancelled' ? 'cancelled' : 'failed';
    }

    return 'unknown';
}

function lamako_mobile_v2_order_allows_ticket_display( WC_Order $order ) {
    return in_array( $order->get_status(), [ 'completed', 'processing', 'cs-complete' ], true );
}

function lamako_mobile_v2_order_summary( WC_Order $order, $include_items = false ) {
    $tickets = lamako_mobile_v2_order_allows_ticket_display( $order ) ? lamako_mobile_v2_get_tickets_for_order( $order ) : [];
    $data = [
        'id'                  => $order->get_id(),
        'number'              => $order->get_order_number(),
        'status'              => $order->get_status(),
        'paymentStatus'       => lamako_mobile_v2_normalize_payment_status( $order ),
        'total'               => $order->get_total(),
        'subtotal'            => method_exists( $order, 'get_subtotal' ) ? $order->get_subtotal() : '',
        'totalTax'            => $order->get_total_tax(),
        'discountTotal'       => $order->get_discount_total(),
        'shippingTotal'       => $order->get_shipping_total(),
        'currency'            => $order->get_currency(),
        'dateCreated'         => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
        'datePaid'            => $order->get_date_paid() ? $order->get_date_paid()->date( 'c' ) : null,
        'paymentMethod'       => $order->get_payment_method(),
        'paymentMethodTitle'  => $order->get_payment_method_title(),
        'transactionId'       => $order->get_transaction_id(),
        'customerNote'        => $order->get_customer_note(),
        'ticketsReady'        => count( $tickets ) > 0,
        'ticketCount'         => count( $tickets ),
        'createdVia'          => $order->get_created_via(),
    ];

    if ( $include_items ) {
        $data['billing'] = [
            'firstName' => $order->get_billing_first_name(),
            'lastName'  => $order->get_billing_last_name(),
            'email'     => $order->get_billing_email(),
            'phone'     => $order->get_billing_phone(),
        ];
        $data['items'] = [];
        foreach ( $order->get_items() as $item_id => $item ) {
            $product = $item->get_product();
            $quantity = max( 1, (int) $item->get_quantity() );
            $data['items'][] = [
                'id'        => $item_id,
                'name'      => html_entity_decode( $item->get_name(), ENT_QUOTES, 'UTF-8' ),
                'quantity'  => $quantity,
                'productId' => $item->get_product_id(),
                'total'     => $item->get_total(),
                'subtotal'  => $item->get_subtotal(),
                'price'     => (float) $item->get_total() / $quantity,
                'sku'       => $product ? $product->get_sku() : '',
            ];
        }
    }

    return $data;
}

function lamako_mobile_v2_get_checkout_status( WP_REST_Request $request ) {
    $order = lamako_mobile_v2_find_order_by_token( $request['token'] );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_checkout_not_found', 'Checkout not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this checkout.', [ 'status' => 403 ] );
    }

    $order_summary = lamako_mobile_v2_order_summary( $order, true );
    if ( lamako_mobile_v2_is_checkout_expired( $order ) && in_array( $order->get_status(), [ 'pending', 'checkout-draft' ], true ) ) {
        $order_summary['paymentStatus'] = 'expired';
    }

    return rest_ensure_response( [
        'checkoutToken' => $request['token'],
        'order'         => $order_summary,
    ] );
}

function lamako_mobile_v2_get_orders( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    $limit   = min( max( absint( $request->get_param( 'limit' ) ?: 20 ), 1 ), 50 );
    $page    = max( absint( $request->get_param( 'page' ) ?: 1 ), 1 );
    $status  = sanitize_text_field( $request->get_param( 'status' ) ?: '' );

    $args = [
        'customer_id' => $user_id,
        'limit'       => $limit,
        'paged'       => $page,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ];
    if ( $status !== '' ) {
        $args['status'] = array_map( 'trim', explode( ',', $status ) );
    }

    $orders = wc_get_orders( $args );
    $items  = array_map( function( $order ) {
        return lamako_mobile_v2_order_summary( $order, true );
    }, $orders );

    return rest_ensure_response( [
        'orders' => $items,
        'page'   => $page,
        'limit'  => $limit,
    ] );
}

function lamako_mobile_v2_get_order( WP_REST_Request $request ) {
    $order = wc_get_order( absint( $request['order_id'] ) );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_order_not_found', 'Order not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access this order.', [ 'status' => 403 ] );
    }

    return rest_ensure_response( lamako_mobile_v2_order_summary( $order, true ) );
}

function lamako_mobile_v2_get_tickets_for_order( WC_Order $order ) {
    $tickets = [];

    if ( ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        return $tickets;
    }

    foreach ( $order->get_items() as $item_id => $item ) {
        $product_id = $item->get_product_id();
        if ( get_post_meta( $product_id, '_tc_is_ticket', true ) !== 'yes' ) {
            continue;
        }

        $instance_ids = get_posts( [
            'post_type'      => 'tc_tickets_instances',
            'post_status'    => 'any',
            'posts_per_page' => max( 1, $item->get_quantity() ) + 5,
            'fields'         => 'ids',
            'meta_query'     => [
                [
                    'key'   => 'item_id',
                    'value' => $item_id,
                ],
            ],
        ] );

        if ( empty( $instance_ids ) ) {
            $tc_order_ids = get_posts( [
                'post_type'      => 'tc_orders',
                'post_status'    => 'any',
                'posts_per_page' => 5,
                'fields'         => 'ids',
                'meta_query'     => [
                    [
                        'key'   => 'tc_wc_order_id',
                        'value' => $order->get_id(),
                    ],
                ],
            ] );

            foreach ( $tc_order_ids as $tc_order_id ) {
                $children = get_posts( [
                    'post_type'      => 'tc_tickets_instances',
                    'post_status'    => 'any',
                    'post_parent'    => $tc_order_id,
                    'posts_per_page' => -1,
                    'fields'         => 'ids',
                    'meta_query'     => [
                        [
                            'key'   => 'ticket_type_id',
                            'value' => $product_id,
                        ],
                    ],
                ] );
                $instance_ids = array_merge( $instance_ids, $children );
            }
        }

        $event_id = (int) get_post_meta( $product_id, '_event_name', true );
        $event_date = $event_id ? ( get_post_meta( $event_id, 'event_date_time', true ) ?: get_post_meta( $event_id, '_event_date_time', true ) ) : '';
        $event_location = $event_id ? ( get_post_meta( $event_id, 'event_location', true ) ?: get_post_meta( $event_id, '_event_location', true ) ) : '';
        $quantity = max( 1, (int) $item->get_quantity() );
        $price = (float) $item->get_total() / $quantity;
        foreach ( array_unique( $instance_ids ) as $instance_id ) {
            $tickets[] = [
                'instanceId'    => (int) $instance_id,
                'ticketCode'    => get_post_meta( $instance_id, 'ticket_code', true ),
                'productId'     => (int) $product_id,
                'productName'   => html_entity_decode( $item->get_name(), ENT_QUOTES, 'UTF-8' ),
                'price'         => $price,
                'orderId'       => $order->get_id(),
                'orderStatus'   => $order->get_status(),
                'eventId'       => $event_id,
                'eventName'     => $event_id ? get_the_title( $event_id ) : '',
                'eventDate'     => is_scalar( $event_date ) ? (string) $event_date : '',
                'eventLocation' => is_scalar( $event_location ) ? html_entity_decode( (string) $event_location, ENT_QUOTES, 'UTF-8' ) : '',
                'seatLabel'     => get_post_meta( $instance_id, 'seat_label', true ),
                'seatId'        => get_post_meta( $instance_id, 'seat_id', true ),
                'status'        => get_post_status( $instance_id ),
            ];
        }
    }

    return $tickets;
}

function lamako_mobile_v2_get_order_tickets_route( WP_REST_Request $request ) {
    $order = wc_get_order( absint( $request['order_id'] ) );
    if ( ! $order ) {
        return new WP_Error( 'lamako_v2_order_not_found', 'Order not found.', [ 'status' => 404 ] );
    }
    if ( ! lamako_mobile_v2_is_order_owner( $order ) ) {
        return new WP_Error( 'lamako_v2_forbidden', 'You cannot access tickets for this order.', [ 'status' => 403 ] );
    }

    if ( ! lamako_mobile_v2_order_allows_ticket_display( $order ) ) {
        return rest_ensure_response( [
            'orderId'      => $order->get_id(),
            'orderStatus'  => $order->get_status(),
            'ticketsReady' => false,
            'tickets'      => [],
        ] );
    }

    $tickets = lamako_mobile_v2_get_tickets_for_order( $order );

    return rest_ensure_response( [
        'orderId'      => $order->get_id(),
        'orderStatus'  => $order->get_status(),
        'ticketsReady' => count( $tickets ) > 0,
        'tickets'      => $tickets,
    ] );
}

function lamako_mobile_v2_register_push_token( WP_REST_Request $request ) {
    $body     = $request->get_json_params();
    $body     = is_array( $body ) ? $body : [];
    $token    = sanitize_text_field( $body['token'] ?? '' );
    $platform = sanitize_text_field( $body['platform'] ?? 'unknown' );
    $device_id = sanitize_text_field( $body['deviceId'] ?? $body['device_id'] ?? '' );
    $user_id  = get_current_user_id();

    if ( $token === '' ) {
        return new WP_Error( 'lamako_v2_push_token_required', 'Push token is required.', [ 'status' => 400 ] );
    }

    $tokens = get_option( 'lamako_push_tokens', [] );
    if ( ! is_array( $tokens ) ) {
        $tokens = [];
    }

    $found = false;
    foreach ( $tokens as &$existing ) {
        if ( isset( $existing['token'] ) && $existing['token'] === $token ) {
            $existing['user_id']    = $user_id;
            $existing['platform']   = $platform;
            $existing['device_id']  = $device_id;
            $existing['updated_at'] = current_time( 'mysql' );
            $found = true;
            break;
        }
    }
    unset( $existing );

    if ( ! $found ) {
        $tokens[] = [
            'token'      => $token,
            'user_id'    => $user_id,
            'platform'   => $platform,
            'device_id'  => $device_id,
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        ];
    }

    update_option( 'lamako_push_tokens', $tokens, false );

    return rest_ensure_response( [ 'success' => true ] );
}

function lamako_mobile_v2_rewards_balance() {
    $user_id = get_current_user_id();
    if ( ! function_exists( 'mycred_get_users_balance' ) ) {
        return new WP_Error( 'lamako_v2_mycred_missing', 'myCred is not available.', [ 'status' => 500 ] );
    }

    $balance = mycred_get_users_balance( $user_id );
    $total   = function_exists( 'lr_get_total_earned' ) ? lr_get_total_earned( $user_id ) : (float) get_user_meta( $user_id, 'mycred_default_total', true );
    $tier    = function_exists( 'lr_get_tier' ) ? lr_get_tier( $total ) : 'fan';

    return rest_ensure_response( [
        'userId'           => $user_id,
        'balance'          => (float) $balance,
        'totalEarned'      => (float) $total,
        'tier'             => $tier,
        'tierName'         => function_exists( 'lr_get_tier_name' ) ? lr_get_tier_name( $tier ) : ucfirst( $tier ),
        'nextTier'         => function_exists( 'lr_get_next_tier' ) ? lr_get_next_tier( $tier ) : '',
        'pointsToNextTier' => function_exists( 'lr_get_points_to_next_tier' ) ? lr_get_points_to_next_tier( $total ) : 0,
        'canRedeem'        => defined( 'LR_REDEMPTION_MIN_LIFETIME' ) ? $total >= LR_REDEMPTION_MIN_LIFETIME : false,
    ] );
}

function lamako_mobile_v2_rewards_is_order_ref( $ref, $description = '' ) {
    $ref         = strtolower( (string) $ref );
    $description = strtolower( (string) $description );

    return strpos( $ref, 'woocommerce' ) !== false
        || strpos( $ref, 'order' ) !== false
        || strpos( $ref, 'purchase' ) !== false
        || preg_match( '/(?:order|commande)\s*#?\d+/i', $description );
}

function lamako_mobile_v2_rewards_order_reference( $ref_id, $description = '', $ref = '' ) {
    if ( ! lamako_mobile_v2_rewards_is_order_ref( $ref, $description ) ) {
        return [ 0, '' ];
    }

    $order_id = absint( $ref_id );
    if ( ! $order_id && preg_match( '/(?:order|commande|#)\s*#?(\d+)/i', (string) $description, $matches ) ) {
        $order_id = absint( $matches[1] );
    }

    if ( ! $order_id ) {
        return [ 0, '' ];
    }

    $number = $order_id;
    if ( function_exists( 'wc_get_order' ) ) {
        $order = wc_get_order( $order_id );
        if ( $order ) {
            $number = $order->get_order_number();
        }
    }

    return [ $order_id, sprintf( 'Commande #%s', $number ) ];
}

function lamako_mobile_v2_rewards_history_description( $row ) {
    $ref         = strtolower( (string) $row->type );
    $points      = (float) $row->points;
    $raw         = trim( wp_strip_all_tags( (string) $row->description ) );
    $raw         = trim( preg_replace( '/%[a-zA-Z0-9_]+%/', '', $raw ) );
    [ $order_id, $order_reference ] = lamako_mobile_v2_rewards_order_reference( $row->ref_id ?? 0, $raw, $ref );

    if ( $points < 0 ) {
        if ( strpos( $ref, 'redeem' ) !== false || strpos( $ref, 'redemption' ) !== false || strpos( $ref, 'coupon' ) !== false || strpos( $ref, 'reward' ) !== false ) {
            if ( preg_match( '/(\d+)\s*pts?/i', $raw, $matches ) ) {
                return sprintf( 'Réduction LamakoRewards: %s points utilisés', number_format_i18n( (int) $matches[1] ) );
            }
            return $order_reference ? 'Points utilisés - ' . $order_reference : 'Points utilisés pour une réduction';
        }
        return $order_reference ? 'Points débités - ' . $order_reference : 'Points débités';
    }

    if ( lamako_mobile_v2_rewards_is_order_ref( $ref, $raw ) ) {
        $parts   = [];
        $parts[] = $order_reference ? 'Achat ' . $order_reference : 'Achat validé';
        if ( preg_match( '/\(([0-9\s,.]+)\s*Ar\)/i', $raw, $matches ) ) {
            $parts[] = trim( $matches[1] ) . ' Ar';
        }
        if ( preg_match( '/x([0-9]+(?:\.[0-9]+)?)/i', $raw, $matches ) ) {
            $parts[] = 'multiplicateur x' . $matches[1];
        }
        $parts[] = '+' . number_format_i18n( abs( $points ) ) . ' pts';
        return implode( ' - ', $parts );
    }
    if ( strpos( $ref, 'registration' ) !== false || strpos( $ref, 'register' ) !== false || strpos( $ref, 'signup' ) !== false ) {
        return 'Bonus de bienvenue';
    }
    if ( strpos( $ref, 'referral' ) !== false || strpos( $ref, 'parrain' ) !== false ) {
        return 'Bonus de parrainage';
    }
    if ( strpos( $ref, 'login' ) !== false ) {
        return 'Bonus de connexion';
    }
    if ( strpos( $ref, 'attendance' ) !== false || strpos( $ref, 'scan' ) !== false ) {
        return 'Bonus présence événement';
    }
    if ( strpos( $ref, 'review' ) !== false || strpos( $ref, 'avis' ) !== false ) {
        return 'Bonus avis';
    }
    if ( strpos( $ref, 'birthday' ) !== false || strpos( $ref, 'anniversaire' ) !== false ) {
        return 'Bonus anniversaire';
    }

    if ( $raw ) {
        $translated = str_ireplace(
            [ 'Points for order', 'Product Purchase', 'Purchase', 'Order', 'Manual adjustment', 'Point payout', 'points', 'redemption', 'redeem' ],
            [ 'Points pour commande', 'Achat produit', 'Achat', 'Commande', 'Ajustement manuel', 'Attribution de points', 'points', 'réduction', 'échange' ],
            $raw
        );
        return $translated;
    }

    return 'Mouvement de points';
}

function lamako_mobile_v2_rewards_history( WP_REST_Request $request ) {
    global $wpdb;
    $user_id = get_current_user_id();
    $limit   = min( max( absint( $request->get_param( 'limit' ) ?: 20 ), 1 ), 100 );
    $table   = $wpdb->prefix . 'myCRED_log';

    $results = $wpdb->get_results( $wpdb->prepare(
        "SELECT id, ref AS type, ref_id, creds AS points, entry AS description, time FROM {$table} WHERE user_id = %d ORDER BY time DESC LIMIT %d",
        $user_id,
        $limit
    ) );

    $history = [];
    foreach ( $results as $row ) {
        [ $order_id, $order_reference ] = lamako_mobile_v2_rewards_order_reference( $row->ref_id ?? 0, $row->description ?? '', $row->type ?? '' );
        $history[] = [
            'id'          => (string) $row->id,
            'type'        => (float) $row->points >= 0 ? 'earn' : 'redeem',
            'reference'   => $order_reference ?: (string) $row->type,
            'orderId'     => $order_id,
            'amount'      => abs( (float) $row->points ),
            'description' => lamako_mobile_v2_rewards_history_description( $row ),
            'date'        => date( 'c', (int) $row->time ),
        ];
    }

    return rest_ensure_response( [ 'history' => $history ] );
}

function lamako_mobile_v2_rewards_redeem( WP_REST_Request $request ) {
    if ( ! function_exists( 'mycred_get_users_balance' ) || ! function_exists( 'mycred_subtract' ) ) {
        return new WP_Error( 'lamako_v2_mycred_missing', 'myCred is not available.', [ 'status' => 500 ] );
    }
    if ( ! class_exists( 'WC_Coupon' ) ) {
        return new WP_Error( 'lamako_v2_wc_missing', 'WooCommerce is not available.', [ 'status' => 500 ] );
    }

    $body    = $request->get_json_params();
    $body    = is_array( $body ) ? $body : [];
    $user_id = get_current_user_id();
    $points  = absint( $body['points'] ?? 0 );

    $valid_tiers = [ 500 => 10000, 1000 => 20000, 2000 => 40000, 5000 => 100000 ];
    if ( ! isset( $valid_tiers[ $points ] ) ) {
        return new WP_Error( 'lamako_v2_invalid_reward_points', 'Invalid redemption tier.', [ 'status' => 400 ] );
    }

    $total_earned = function_exists( 'lr_get_total_earned' ) ? lr_get_total_earned( $user_id ) : (float) get_user_meta( $user_id, 'mycred_default_total', true );
    if ( defined( 'LR_REDEMPTION_MIN_LIFETIME' ) && $total_earned < LR_REDEMPTION_MIN_LIFETIME ) {
        return new WP_Error( 'lamako_v2_rewards_locked', 'Rewards redemption is not unlocked for this account.', [ 'status' => 403 ] );
    }

    $balance = mycred_get_users_balance( $user_id );
    if ( $balance < $points ) {
        return new WP_Error( 'lamako_v2_insufficient_points', 'Insufficient rewards balance.', [ 'status' => 400 ] );
    }

    $idempotency_key = sanitize_text_field( $body['idempotencyKey'] ?? $body['idempotency_key'] ?? '' );
    if ( $idempotency_key !== '' ) {
        $existing = get_user_meta( $user_id, '_lamako_v2_reward_redeem_' . md5( $idempotency_key ), true );
        if ( is_array( $existing ) && ! empty( $existing['couponCode'] ) ) {
            return rest_ensure_response( $existing );
        }
    }

    $discount_value = $valid_tiers[ $points ];
    mycred_subtract( 'redemption', $user_id, $points, sprintf( 'Lamako Mobile v2 redemption %d pts', $points ) );

    $coupon_code = 'LR-' . strtoupper( wp_generate_password( 8, false ) );
    $coupon = new WC_Coupon();
    $coupon->set_code( $coupon_code );
    $coupon->set_discount_type( 'fixed_cart' );
    $coupon->set_amount( $discount_value );
    $coupon->set_usage_limit( 1 );
    $coupon->set_usage_limit_per_user( 1 );
    $coupon->set_date_expires( strtotime( '+30 days' ) );
    $coupon->set_description( sprintf( 'Lamako Mobile v2 rewards coupon for user #%d, %d points.', $user_id, $points ) );
    $coupon->save();

    $response = [
        'success'       => true,
        'couponCode'    => $coupon_code,
        'discountValue' => $discount_value,
        'pointsDeducted'=> $points,
        'newBalance'    => mycred_get_users_balance( $user_id ),
        'expiresAt'     => date( 'c', strtotime( '+30 days' ) ),
    ];

    if ( $idempotency_key !== '' ) {
        update_user_meta( $user_id, '_lamako_v2_reward_redeem_' . md5( $idempotency_key ), $response );
    }

    return rest_ensure_response( $response );
}

function lamako_mobile_v2_referral_code() {
    $user_id = get_current_user_id();
    if ( function_exists( 'lr_generate_referral_code' ) ) {
        $code = lr_generate_referral_code( $user_id );
    } else {
        $code = get_user_meta( $user_id, '_lamako_referral_code', true );
        if ( ! $code ) {
            $code = 'TBL-' . strtoupper( wp_generate_password( 8, false ) );
            update_user_meta( $user_id, '_lamako_referral_code', $code );
        }
    }

    return rest_ensure_response( [
        'code'          => $code,
        'referralCount' => (int) get_user_meta( $user_id, '_lamako_referral_count', true ),
    ] );
}

function lamako_mobile_v2_referral_bonus_value() {
    return defined( 'LR_REFEREE_BONUS' ) ? (int) LR_REFEREE_BONUS : 25;
}

function lamako_mobile_v2_find_referrer_by_code( $code ) {
    global $wpdb;
    $code = sanitize_text_field( $code );
    if ( $code === '' ) {
        return 0;
    }

    return (int) $wpdb->get_var( $wpdb->prepare(
        "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_lamako_referral_code' AND meta_value = %s LIMIT 1",
        $code
    ) );
}

function lamako_mobile_v2_validate_referral_code( WP_REST_Request $request ) {
    $body = $request->get_json_params();
    $body = is_array( $body ) ? $body : [];
    $code = sanitize_text_field( $body['code'] ?? '' );

    if ( $code === '' ) {
        return new WP_Error( 'lamako_v2_missing_referral_code', 'Referral code is required.', [ 'status' => 400 ] );
    }

    $referrer_id = lamako_mobile_v2_find_referrer_by_code( $code );
    if ( $referrer_id <= 0 ) {
        return rest_ensure_response( [
            'valid'   => false,
            'message' => 'Code invalide.',
        ] );
    }

    $user = get_userdata( $referrer_id );
    return rest_ensure_response( [
        'valid'        => true,
        'referrerName' => $user ? $user->display_name : 'Utilisateur',
        'bonus'        => lamako_mobile_v2_referral_bonus_value(),
    ] );
}

function lamako_mobile_v2_register_referral( WP_REST_Request $request ) {
    $body = $request->get_json_params();
    $body = is_array( $body ) ? $body : [];
    $code = sanitize_text_field( $body['referrerCode'] ?? $body['referrer_code'] ?? '' );

    if ( $code === '' ) {
        return new WP_Error( 'lamako_v2_missing_referral_code', 'Referral code is required.', [ 'status' => 400 ] );
    }

    $user_id = get_current_user_id();
    if ( $user_id <= 0 ) {
        return new WP_Error( 'lamako_v2_not_authenticated', 'Authentication required.', [ 'status' => 401 ] );
    }

    if ( function_exists( 'lr_register_referral' ) ) {
        $result = lr_register_referral( $user_id, $code );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( [
            'success'      => ! empty( $result['success'] ),
            'referrerId'   => (int) ( $result['referrer_id'] ?? 0 ),
            'refereeBonus' => (int) ( $result['referee_bonus'] ?? lamako_mobile_v2_referral_bonus_value() ),
        ] );
    }

    $referrer_id = lamako_mobile_v2_find_referrer_by_code( $code );
    if ( $referrer_id <= 0 ) {
        return new WP_Error( 'lamako_v2_invalid_referral_code', 'Code de parrainage invalide.', [ 'status' => 400 ] );
    }
    if ( $referrer_id === $user_id ) {
        return new WP_Error( 'lamako_v2_self_referral', 'Vous ne pouvez pas vous parrainer vous-meme.', [ 'status' => 400 ] );
    }
    if ( get_user_meta( $user_id, '_lamako_referred_by', true ) ) {
        return new WP_Error( 'lamako_v2_already_referred', 'Vous avez deja un parrain.', [ 'status' => 409 ] );
    }

    update_user_meta( $user_id, '_lamako_referred_by', $referrer_id );
    update_user_meta( $user_id, '_lamako_referral_code_used', $code );
    update_user_meta( $user_id, '_lamako_referral_date', current_time( 'mysql' ) );
    update_user_meta( $referrer_id, '_lamako_referral_count', (int) get_user_meta( $referrer_id, '_lamako_referral_count', true ) + 1 );

    $bonus = lamako_mobile_v2_referral_bonus_value();
    if ( function_exists( 'mycred_add' ) ) {
        mycred_add( 'referral_signup', $user_id, $bonus, 'Bonus parrainage (inscription)' );
    }

    return rest_ensure_response( [
        'success'      => true,
        'referrerId'   => $referrer_id,
        'refereeBonus' => $bonus,
    ] );
}
