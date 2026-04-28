<?php
/**
 * Plugin Name: Lamako Mobile API
 * Plugin URI: https://www.ticketbylamako.com
 * Description: REST API endpoints for the TicketByLamako mobile app - ticket instances, seating chart embed, and more.
 * Version: 1.0.0
 * Author: Lamako Events
 * Author URI: https://www.ticketbylamako.com
 * License: GPL v2 or later
 * 
 * Endpoints:
 * - GET /wp-json/lamako-mobile/v1/order-tickets/{order_id}  → ticket instances for an order
 * - GET /wp-json/lamako-mobile/v1/seat-chart-url/{event_id} → seating chart embed URL for an event
 * - GET /?lamako_seat_embed=1&chart_id={id}                 → clean embed page for seating chart
 * 
 * Authentication: WooCommerce consumer_key + consumer_secret (same as WC REST API)
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

// ============================================================
// 1. SEATING CHART EMBED TEMPLATE (template_redirect hook)
// ============================================================

add_action( 'template_redirect', 'lamako_mobile_maybe_serve_seat_embed', 5 );

function lamako_mobile_maybe_serve_seat_embed() {
    if ( ! isset( $_GET['lamako_seat_embed'] ) ) return;
    
    $chart_id = isset( $_GET['chart_id'] ) ? (int) $_GET['chart_id'] : 0;
    if ( $chart_id <= 0 ) {
        wp_die( 'Invalid chart ID', 'Error', [ 'response' => 400 ] );
    }
    
    // Verify the chart post exists and is a tc_seat_charts post
    $chart_post = get_post( $chart_id );
    if ( ! $chart_post || $chart_post->post_type !== 'tc_seat_charts' ) {
        wp_die( 'Seating chart not found', 'Error', [ 'response' => 404 ] );
    }
    
    // Output a minimal HTML page with just the seating chart shortcode
    // wp_head() and wp_footer() load all Tickera scripts (Firebase, jQuery UI, etc.)
    ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
<style>
    /* Reset */
    * { box-sizing: border-box; }
    body {
        margin: 0 !important;
        padding: 0 !important;
        background: #f8f9fa !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    /* Hide all theme elements */
    header, .site-header, .page-header, #masthead, .header-wrapper,
    footer, .site-footer, .page-footer, #colophon, .footer-wrapper,
    nav, .navigation, .nav-links, .breadcrumbs, .breadcrumb,
    .sidebar, #sidebar, aside,
    .woocommerce-breadcrumb, #wpadminbar,
    .header-main, .header-top, .header-bottom,
    .footer-1, .footer-2, .absolute-footer,
    .page-title-inner, .page-title,
    .comments-area, #comments,
    [class*="whatsapp"], .joinchat, [id*="whatsapp"],
    .qlwapp__container, [class*="qlwapp"],
    [class*="cookie"], [class*="consent"],
    #fkcart-floating-toggler, #fkcart-modal, .fkcart-main-wrapper,
    [class*="fkcart"],
    .woocommerce-mini-cart, .cart-icon, .shopping-cart,
    [class*="tidio"], [id*="tidio"], [class*="chat-widget"],
    [class*="crisp"], [id*="crisp"],
    [class*="tawk"], [id*="tawk"],
    [class*="intercom"], [id*="intercom"],
    [class*="drift"], [id*="drift"],
    [class*="livechat"], [id*="livechat"],
    .wc-block-mini-cart, .wp-block-woocommerce-mini-cart
    { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
    
    /* Style the seating chart button */
    .tc_seating_map_button {
        display: block !important;
        margin: 20px auto !important;
        padding: 16px 40px !important;
        font-size: 17px !important;
        font-weight: 700 !important;
        background: #663d17 !important;
        color: #fff !important;
        border: none !important;
        border-radius: 14px !important;
        cursor: pointer !important;
        text-align: center !important;
        width: 90% !important;
        max-width: 400px !important;
        box-shadow: 0 4px 14px rgba(102, 61, 23, 0.3) !important;
    }
    
    /* DO NOT override .tc_seating_map or .tc-wrapper positioning */
    /* Let Tickera's own JS handle the seating chart layout and zoom */
    /* Only ensure the map is scrollable on touch devices */
    .tc_seating_map {
        -webkit-overflow-scrolling: touch !important;
        touch-action: manipulation !important;
    }
    
    /* HIDE checkout elements - seating chart is for seat selection only */
    .tc-seatchart-go-to-cart, a.tc-seatchart-go-to-cart,
    .tc-seatchart-subtotal,
    .tc-checkout-bar,
    .tc_in_cart {
        display: none !important;
    }
    
    /* Custom confirm button - injected by JS after seats are selected */
    .lamako-confirm-btn {
        display: none;
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000010;
        background: #663d17;
        color: #fff;
        padding: 16px 40px;
        border-radius: 14px;
        border: none;
        font-weight: 700;
        font-size: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 14px rgba(102,61,23,0.4);
        cursor: pointer;
        white-space: nowrap;
        min-width: 260px;
        text-align: center;
    }
    .lamako-confirm-btn.visible {
        display: block;
    }
    
    /* Seat count badge at top */
    .lamako-seat-count {
        display: none;
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000010;
        background: rgba(255,255,255,0.95);
        color: #663d17;
        padding: 8px 20px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        text-align: center;
    }
    .lamako-seat-count.visible {
        display: block;
    }
    
    /* Instruction text */
    .lamako-embed-instruction {
        text-align: center;
        color: #687076;
        font-size: 14px;
        margin: 16px 0 8px;
        padding: 0 16px;
    }
</style>
<script>
// After Tickera loads, watch for seat selections and show confirm button
document.addEventListener('DOMContentLoaded', function() {
    // Wait for seating chart to initialize
    setTimeout(function() {
        // Create confirm button
        var confirmBtn = document.createElement('button');
        confirmBtn.className = 'lamako-confirm-btn';
        confirmBtn.textContent = 'Confirmer et payer';
        document.body.appendChild(confirmBtn);
        
        // Create seat count display
        var seatCount = document.createElement('div');
        seatCount.className = 'lamako-seat-count';
        document.body.appendChild(seatCount);
        
        // Helper: extract seat data from DOM
        function extractSeatData() {
            var selectedSeats = [];
            // Get ticket type info for price lookup
            var ticketTypes = {};
            document.querySelectorAll('.tc-ticket-listing').forEach(function(li) {
                var ttId = li.getAttribute('data-ticket-type-id');
                if (ttId) {
                    ticketTypes[ttId] = {
                        price: li.getAttribute('data-tt-price') || '',
                        title: li.getAttribute('data-tt-title') || ''
                    };
                }
            });
            // Collect seats that are in cart
            document.querySelectorAll('.tc_seat_in_cart').forEach(function(seat) {
                var ttId = seat.getAttribute('data-tt-id') || '';
                var ttInfo = ticketTypes[ttId] || {};
                var priceStr = ttInfo.price || '';
                // Parse price: "Ar 150,000" -> 150000
                var priceNum = 0;
                if (priceStr) {
                    priceNum = parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;
                }
                selectedSeats.push({
                    seatId: seat.id || '',
                    label: seat.textContent.trim() || '',
                    ticketTypeId: ttId,
                    ticketTypeName: ttInfo.title || '',
                    price: priceNum
                });
            });
            return selectedSeats;
        }
        
        // When confirm is clicked:
        // 1. Extract seat data and send to app (for local cart display)
        // 2. Navigate to /checkout/ in the SAME page (WC cart already has seats)
        confirmBtn.addEventListener('click', function() {
            var seats = extractSeatData();
            // Send seat data to React Native app for local cart
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'seats_confirmed',
                    seats: seats,
                    count: seats.length
                }));
            }
            // Small delay to let postMessage process, then navigate to checkout
            setTimeout(function() {
                // Notify app we're navigating to checkout
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'navigating_to_checkout'
                    }));
                }
                window.location.href = '<?php echo home_url('/checkout/'); ?>';
            }, 300);
        });
        
        // Watch for seat changes using MutationObserver
        // Tickera uses tc_seat_in_cart class (set by Firebase front.js after AJAX add-to-cart)
        function updateSeatCount() {
            var seats = document.querySelectorAll('.tc_seat_in_cart');
            var count = seats.length;
            if (count > 0) {
                seatCount.textContent = count + (count === 1 ? ' siège sélectionné' : ' sièges sélectionnés');
                seatCount.classList.add('visible');
                confirmBtn.textContent = 'Confirmer et payer (' + count + ')';
                confirmBtn.classList.add('visible');
            } else {
                seatCount.classList.remove('visible');
                confirmBtn.classList.remove('visible');
            }
        }
        
        // Observe DOM changes for seat selections
        var observer = new MutationObserver(function() {
            updateSeatCount();
        });
        
        // Start observing once the seating map is open
        function startObserving() {
            var mapContainer = document.querySelector('.tc_seating_map, .tc-wrapper, .tc_seat_chart_container');
            if (mapContainer) {
                observer.observe(mapContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
                // Also poll periodically as backup (tc_seat_in_cart is set async via Firebase)
                setInterval(updateSeatCount, 1500);
            } else {
                setTimeout(startObserving, 500);
            }
        }
        startObserving();
        
        // Also hide WhatsApp and FKCart that may load late
        function hideWidgets() {
            var widgets = document.querySelectorAll('.qlwapp__container, [class*="qlwapp"], #fkcart-floating-toggler, [class*="fkcart"]');
            widgets.forEach(function(w) {
                w.style.display = 'none';
                w.style.visibility = 'hidden';
            });
        }
        hideWidgets();
        setInterval(hideWidgets, 2000);
    }, 2000);
});
</script>
<?php wp_head(); ?>
</head>
<body>
    <p class="lamako-embed-instruction">Appuyez sur le bouton ci-dessous pour choisir votre siège</p>
    <?php echo do_shortcode( '[tc_seat_chart id="' . $chart_id . '" show_legend="true"]' ); ?>
<?php wp_footer(); ?>
</body>
</html>
    <?php
    exit; // Prevent theme template from rendering
}

// ============================================================
// 2. REST API ROUTES
// ============================================================

add_action( 'rest_api_init', function () {
    // Ticket instances for an order
    register_rest_route( 'lamako-mobile/v1', '/order-tickets/(?P<order_id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'lamako_mobile_get_order_tickets',
        'permission_callback' => 'lamako_mobile_check_wc_auth',
        'args' => [
            'order_id' => [
                'required' => true,
                'validate_callback' => function( $param ) {
                    return is_numeric( $param ) && (int) $param > 0;
                },
            ],
        ],
    ] );
    
    // Seating chart URL for an event
    register_rest_route( 'lamako-mobile/v1', '/seat-chart-url/(?P<event_id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'lamako_mobile_get_seat_chart_url',
        'permission_callback' => 'lamako_mobile_check_wc_auth',
        'args' => [
            'event_id' => [
                'required' => true,
                'validate_callback' => function( $param ) {
                    return is_numeric( $param ) && (int) $param > 0;
                },
            ],
        ],
    ] );
} );

/**
 * Authenticate using WooCommerce consumer key/secret
 */
function lamako_mobile_check_wc_auth( $request ) {
    $consumer_key = $request->get_param( 'consumer_key' );
    $consumer_secret = $request->get_param( 'consumer_secret' );
    
    if ( ! $consumer_key || ! $consumer_secret ) {
        return new WP_Error( 'unauthorized', 'WC credentials required', [ 'status' => 401 ] );
    }
    
    // Verify WC API key
    global $wpdb;
    $key = $wpdb->get_row( $wpdb->prepare(
        "SELECT consumer_secret, permissions FROM {$wpdb->prefix}woocommerce_api_keys WHERE consumer_key = %s",
        wc_api_hash( $consumer_key )
    ) );
    
    if ( ! $key || ! hash_equals( $key->consumer_secret, $consumer_secret ) ) {
        return new WP_Error( 'unauthorized', 'Invalid WC credentials', [ 'status' => 401 ] );
    }
    
    return true;
}

// ============================================================
// 3. SEAT CHART URL ENDPOINT
// ============================================================

/**
 * Get the seating chart embed URL for a Tickera event.
 * Looks up tc_seat_charts post by event_name meta (same as POS plugin).
 */
function lamako_mobile_get_seat_chart_url( $request ) {
    $event_id = (int) $request['event_id'];
    
    // Verify the event exists
    $event = get_post( $event_id );
    if ( ! $event || $event->post_type !== 'tc_events' ) {
        return new WP_Error( 'not_found', 'Event not found', [ 'status' => 404 ] );
    }
    
    // Find the tc_seat_charts post linked to this event
    // Tickera stores the event ID in the 'event_name' meta field of tc_seat_charts
    $charts = get_posts( [
        'post_type'      => 'tc_seat_charts',
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'meta_query'     => [
            [
                'key'     => 'event_name',
                'value'   => $event_id,
                'compare' => '=',
            ],
        ],
    ] );
    
    if ( empty( $charts ) ) {
        // Fallback: try to find chart by scraping event content for data-seating-map-id
        $content = $event->post_content;
        if ( preg_match( '/data-seating-map-id="(\d+)"/', $content, $m ) ) {
            $chart_id = (int) $m[1];
        } else {
            // Try rendered content
            $rendered = apply_filters( 'the_content', $content );
            if ( preg_match( '/data-seating-map-id="(\d+)"/', $rendered, $m ) ) {
                $chart_id = (int) $m[1];
            } else {
                return [
                    'event_id'  => $event_id,
                    'has_chart' => false,
                    'chart_id'  => 0,
                    'embed_url' => '',
                ];
            }
        }
    } else {
        $chart_id = $charts[0]->ID;
    }
    
    // Build the embed URL using our custom template_redirect handler
    $embed_url = home_url( '/?lamako_seat_embed=1&chart_id=' . $chart_id );
    
    return [
        'event_id'  => $event_id,
        'has_chart' => true,
        'chart_id'  => $chart_id,
        'embed_url' => $embed_url,
    ];
}

// ============================================================
// 4. ORDER TICKETS ENDPOINT
// ============================================================

/**
 * Get ticket instances for a WooCommerce order.
 * Uses the same logic as the POS plugin to find tc_tickets_instances.
 */
function lamako_mobile_get_order_tickets( $request ) {
    $order_id = (int) $request['order_id'];
    $order = wc_get_order( $order_id );
    
    if ( ! $order ) {
        return new WP_Error( 'not_found', 'Order not found', [ 'status' => 404 ] );
    }
    
    $tickets = [];
    
    foreach ( $order->get_items() as $item_id => $item ) {
        $product_id   = $item->get_product_id();
        $variation_id = $item->get_variation_id();
        $product_name = html_entity_decode( $item->get_name(), ENT_QUOTES, 'UTF-8' );
        $qty          = $item->get_quantity();
        $price        = (float) $item->get_total() / max( 1, $qty );
        
        // Check if this is a ticket product
        $is_ticket = get_post_meta( $product_id, '_tc_is_ticket', true );
        if ( $is_ticket !== 'yes' ) continue;
        
        $ticket_type_id = $variation_id > 0 ? $variation_id : $product_id;
        $instances = [];
        
        // Method 1: Query by item_id meta
        $instances = get_posts( [
            'post_type'      => 'tc_tickets_instances',
            'post_status'    => 'any',
            'posts_per_page' => $qty + 5,
            'meta_query'     => [
                [ 'key' => 'item_id', 'value' => $item_id ],
            ],
            'fields' => 'ids',
        ] );
        
        // Method 2: Try by ticket_type_id + tc_orders parent
        if ( empty( $instances ) ) {
            $tc_order_ids = get_posts( [
                'post_type'      => 'tc_orders',
                'post_status'    => 'any',
                'posts_per_page' => 5,
                'meta_query'     => [
                    [ 'key' => 'tc_wc_order_id', 'value' => $order_id ],
                ],
                'fields' => 'ids',
            ] );
            
            if ( ! empty( $tc_order_ids ) ) {
                foreach ( $tc_order_ids as $tc_oid ) {
                    $child = get_posts( [
                        'post_type'      => 'tc_tickets_instances',
                        'post_status'    => 'any',
                        'post_parent'    => $tc_oid,
                        'posts_per_page' => -1,
                        'meta_query'     => [
                            [ 'key' => 'ticket_type_id', 'value' => $ticket_type_id ],
                        ],
                        'fields' => 'ids',
                    ] );
                    $instances = array_merge( $instances, $child );
                }
            }
        }
        
        // Method 3: Fallback by ticket_type_id (broader search)
        if ( empty( $instances ) ) {
            $instances = get_posts( [
                'post_type'      => 'tc_tickets_instances',
                'post_status'    => 'any',
                'posts_per_page' => $qty,
                'orderby'        => 'ID',
                'order'          => 'DESC',
                'meta_query'     => [
                    [ 'key' => 'ticket_type_id', 'value' => $ticket_type_id ],
                ],
                'fields' => 'ids',
            ] );
        }
        
        // Get event info
        $event_id = (int) get_post_meta( $product_id, '_event_name', true );
        $event_name = $event_id > 0 ? get_the_title( $event_id ) : '';
        $event_date = '';
        $event_location = '';
        
        if ( $event_id > 0 ) {
            $date_start = get_post_meta( $event_id, 'event_date_time', true );
            if ( ! $date_start ) $date_start = get_post_meta( $event_id, 'event_start_date', true );
            if ( $date_start ) {
                $event_date = is_numeric( $date_start ) ? date_i18n( 'd/m/Y H:i', (int) $date_start ) : $date_start;
            }
            $event_location = get_post_meta( $event_id, 'event_location', true );
            if ( ! $event_location ) $event_location = get_post_meta( $event_id, 'event_location_name', true );
        }
        
        if ( ! empty( $instances ) ) {
            $count = 0;
            foreach ( $instances as $inst_id ) {
                if ( $count >= $qty ) break;
                $ticket_code = get_post_meta( $inst_id, 'ticket_code', true );
                $seat_label  = get_post_meta( $inst_id, 'seat_label', true );
                $seat_id     = get_post_meta( $inst_id, 'seat_id', true );
                
                $tickets[] = [
                    'instance_id'    => $inst_id,
                    'ticket_code'    => $ticket_code ?: ( 'ORD-' . $order_id . '-' . $inst_id ),
                    'product_name'   => $product_name,
                    'product_id'     => $product_id,
                    'price'          => $price,
                    'seat_label'     => $seat_label ?: '',
                    'seat_id'        => $seat_id ?: '',
                    'event_id'       => $event_id,
                    'event_name'     => $event_name,
                    'event_date'     => $event_date,
                    'event_location' => $event_location ?: '',
                ];
                $count++;
            }
        } else {
            // No instances found - create placeholder entries from order data
            $cart_info = get_post_meta( $order_id, 'tc_cart_info', true );
            $seat_labels = [];
            if ( is_array( $cart_info ) && isset( $cart_info['owner_data']['seat_label_post_meta'][ $ticket_type_id ] ) ) {
                $seat_labels = $cart_info['owner_data']['seat_label_post_meta'][ $ticket_type_id ];
            }
            
            for ( $i = 0; $i < $qty; $i++ ) {
                $tickets[] = [
                    'instance_id'    => 0,
                    'ticket_code'    => 'ORD-' . $order_id . '-' . $item_id . '-' . ( $i + 1 ),
                    'product_name'   => $product_name,
                    'product_id'     => $product_id,
                    'price'          => $price,
                    'seat_label'     => isset( $seat_labels[ $i ] ) ? $seat_labels[ $i ] : '',
                    'seat_id'        => '',
                    'event_id'       => $event_id,
                    'event_name'     => $event_name,
                    'event_date'     => $event_date,
                    'event_location' => $event_location ?: '',
                ];
            }
        }
    }
    
    return [
        'order_id'       => $order_id,
        'order_status'   => $order->get_status(),
        'order_date'     => $order->get_date_created() ? $order->get_date_created()->format( 'Y-m-d H:i:s' ) : '',
        'billing_name'   => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
        'billing_email'  => $order->get_billing_email(),
        'total'          => $order->get_total(),
        'tickets'        => $tickets,
    ];
}
