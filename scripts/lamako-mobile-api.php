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
// 0. ALLOW PAY-FOR-ORDER WITHOUT LOGIN (for mobile app checkout)
// ============================================================

/**
 * Allow guests to pay for orders without logging in.
 * The pay-for-order URL includes the order key for security.
 * This is essential for the mobile app checkout flow where users
 * are not logged into WordPress.
 */
add_filter( 'user_has_cap', 'lamako_mobile_allow_pay_without_login', 9999, 3 );

function lamako_mobile_allow_pay_without_login( $allcaps, $caps, $args ) {
    if ( isset( $caps[0], $_GET['key'] ) ) {
        if ( $caps[0] === 'pay_for_order' ) {
            $order_id = isset( $args[2] ) ? $args[2] : null;
            if ( $order_id ) {
                $order = wc_get_order( $order_id );
                if ( $order && $order->get_order_key() === sanitize_text_field( $_GET['key'] ) ) {
                    $allcaps['pay_for_order'] = true;
                }
            }
        }
    }
    return $allcaps;
}

/**
 * Disable WooCommerce email verification requirement for order-pay pages.
 * This prevents the "verify your email" screen from appearing.
 */
add_filter( 'woocommerce_order_email_verification_required', '__return_false', 9999 );

/**
 * Force products to be purchasable on pay-for-order pages.
 * Tickera ticket products may have purchasability restrictions that
 * prevent them from being paid for via the mobile app checkout.
 */
add_filter( 'woocommerce_is_purchasable', 'lamako_mobile_force_purchasable', 9999, 2 );

function lamako_mobile_force_purchasable( $purchasable, $product ) {
    // Only override on pay-for-order pages (mobile app checkout)
    if ( isset( $_GET['pay_for_order'], $_GET['key'] ) && $_GET['pay_for_order'] === 'true' ) {
        // Verify the order key matches a real order for security
        $order_id = absint( get_query_var( 'order-pay' ) );
        if ( $order_id > 0 ) {
            $order = wc_get_order( $order_id );
            if ( $order && $order->get_order_key() === sanitize_text_field( $_GET['key'] ) ) {
                return true;
            }
        }
    }
    return $purchasable;
}

/**
 * Also force stock status check to pass on pay-for-order pages.
 * Some Tickera products may show as out of stock.
 */
add_filter( 'woocommerce_product_is_in_stock', 'lamako_mobile_force_in_stock', 9999, 2 );

function lamako_mobile_force_in_stock( $in_stock, $product ) {
    if ( isset( $_GET['pay_for_order'], $_GET['key'] ) && $_GET['pay_for_order'] === 'true' ) {
        $order_id = absint( get_query_var( 'order-pay' ) );
        if ( $order_id > 0 ) {
            $order = wc_get_order( $order_id );
            if ( $order && $order->get_order_key() === sanitize_text_field( $_GET['key'] ) ) {
                return true;
            }
        }
    }
    return $in_stock;
}

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
    
    /* HIDE checkout navigation - seating chart is for seat selection only */
    /* Keep .tc_in_cart visible so Tickera can track selected seats properly */
    .tc-seatchart-go-to-cart, a.tc-seatchart-go-to-cart,
    .tc-checkout-bar {
        display: none !important;
    }
    /* Style the in-cart summary to be compact and informative */
    .tc_in_cart {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 998 !important;
        background: rgba(255,255,255,0.97) !important;
        border-top: 1px solid #e5e7eb !important;
        padding: 8px 16px !important;
        font-size: 13px !important;
        max-height: 120px !important;
        overflow-y: auto !important;
    }
    .tc-seatchart-subtotal {
        font-weight: 600 !important;
        color: #663d17 !important;
    }
    
    /* CRITICAL: Only boost z-index for jQuery UI dialog - do NOT override Tickera's layout */
    /* Tickera's own CSS handles dialog positioning, content layout, and button styling */
    .ui-widget-overlay {
        z-index: 100000 !important;
    }
    .ui-dialog {
        z-index: 100001 !important;
    }
    /* Make Add to Cart / Remove buttons more touch-friendly on mobile */
    .tc-seat-dialog .tc_cart_button,
    .tc-seat-dialog .tickera_button {
        min-height: 44px !important;
        font-size: 16px !important;
        padding: 12px 20px !important;
    }
    .tc-seat-dialog .tc_remove_from_cart_button {
        min-height: 44px !important;
        font-size: 16px !important;
        padding: 12px 20px !important;
    }
    
    /* Seat count badge at top */
    .lamako-seat-count {
        display: none;
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
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
// Enhanced: seat count badge, AJAX error monitoring, and debug logging
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        // Create seat count display
        var seatCount = document.createElement('div');
        seatCount.className = 'lamako-seat-count';
        
        // Append to seating map container
        var mapContainer = document.querySelector('.tc_seating_map.active, .tc_seating_map');
        if (mapContainer) {
            mapContainer.appendChild(seatCount);
        } else {
            document.body.appendChild(seatCount);
            var retryAppend = setInterval(function() {
                var mc = document.querySelector('.tc_seating_map.active');
                if (mc) {
                    mc.appendChild(seatCount);
                    clearInterval(retryAppend);
                }
            }, 1000);
        }
        
        // Watch for seat changes - show count badge
        function updateSeatCount() {
            var seats = document.querySelectorAll('.tc_seat_in_cart');
            var count = seats.length;
            if (count > 0) {
                seatCount.textContent = count + (count === 1 ? ' siège sélectionné' : ' sièges sélectionnés');
                seatCount.classList.add('visible');
                // Also notify the React Native app
                try {
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'seat_count_update',
                            count: count
                        }));
                    }
                } catch(e) {}
            } else {
                seatCount.classList.remove('visible');
            }
        }
        
        // Monitor AJAX calls for errors (Tickera uses jQuery AJAX for seat add-to-cart)
        if (window.jQuery) {
            jQuery(document).ajaxError(function(event, jqXHR, settings, error) {
                console.log('AJAX Error:', settings.url, error);
                try {
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'ajax_error',
                            url: settings.url,
                            status: jqXHR.status,
                            error: error
                        }));
                    }
                } catch(e) {}
            });
            
            // Monitor successful AJAX calls to detect seat additions
            jQuery(document).ajaxSuccess(function(event, jqXHR, settings) {
                // After any AJAX success, check for seat count changes
                setTimeout(updateSeatCount, 500);
            });
        }
        
        // Observe DOM changes for seat selections
        var observer = new MutationObserver(function(mutations) {
            updateSeatCount();
        });
        
        function startObserving() {
            var mc = document.querySelector('.tc_seating_map, .tc-wrapper, .tc_seat_chart_container');
            if (mc) {
                observer.observe(mc, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
                setInterval(updateSeatCount, 1500);
            } else {
                setTimeout(startObserving, 500);
            }
        }
        startObserving();
        
        // Hide WhatsApp and FKCart that may load late
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
<?php
    // Initialize WooCommerce session so Tickera seat selection AJAX works
    if ( function_exists( 'WC' ) && WC()->session && ! WC()->session->has_session() ) {
        WC()->session->set_customer_session_cookie( true );
    }
?>
    <p class="lamako-embed-instruction">Appuyez sur le bouton ci-dessous, puis sélectionnez un siège et cliquez "Add to Cart" pour chaque siège souhaité</p>
    <?php echo do_shortcode( '[tc_seat_chart id="' . $chart_id . '" show_legend="true"]' ); ?>
<?php wp_footer(); ?>
</body>
</html>
    <?php
    exit; // Prevent theme template from rendering
}

// ============================================================
// 1b. DEDICATED MOBILE CHECKOUT PAGE (template_redirect hook)
// ============================================================

add_action( 'template_redirect', 'lamako_mobile_maybe_serve_checkout', 5 );

function lamako_mobile_maybe_serve_checkout() {
    if ( ! isset( $_GET['lamako_checkout'] ) ) return;
    
    $order_id  = isset( $_GET['order_id'] ) ? (int) $_GET['order_id'] : 0;
    $order_key = isset( $_GET['order_key'] ) ? sanitize_text_field( $_GET['order_key'] ) : '';
    
    if ( $order_id <= 0 || empty( $order_key ) ) {
        wp_die( 'Invalid order parameters', 'Error', [ 'response' => 400 ] );
    }
    
    // Verify order exists and key matches
    $order = wc_get_order( $order_id );
    if ( ! $order || $order->get_order_key() !== $order_key ) {
        wp_die( 'Order not found', 'Error', [ 'response' => 404 ] );
    }
    
    // Force products to be purchasable for this request
    add_filter( 'woocommerce_is_purchasable', '__return_true', 99999 );
    add_filter( 'woocommerce_product_is_in_stock', '__return_true', 99999 );
    
    // Set up the pay-for-order context so WC renders the payment form
    global $wp;
    $wp->query_vars['order-pay'] = $order_id;
    $_GET['pay_for_order'] = 'true';
    $_GET['key'] = $order_key;
    
    // Get order items for display
    $items = [];
    foreach ( $order->get_items() as $item ) {
        $items[] = [
            'name' => html_entity_decode( $item->get_name(), ENT_QUOTES, 'UTF-8' ),
            'qty'  => $item->get_quantity(),
            'total' => wc_price( $item->get_total() ),
        ];
    }
    
    $total = $order->get_formatted_order_total();
    
    ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Paiement - TicketByLamako</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: #f5f5f5;
        color: #1a1a1a;
        -webkit-font-smoothing: antialiased;
        padding-bottom: 100px;
    }
    .lamako-checkout-header {
        background: #fff;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 12px;
        position: sticky;
        top: 0;
        z-index: 100;
    }
    .lamako-checkout-header h1 {
        font-size: 18px;
        font-weight: 600;
        flex: 1;
    }
    .lamako-checkout-header .lamako-secure {
        font-size: 12px;
        color: #22c55e;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .lamako-section {
        background: #fff;
        margin: 12px 16px;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .lamako-section-title {
        font-size: 15px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .lamako-order-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #f3f4f6;
    }
    .lamako-order-item:last-child { border-bottom: none; }
    .lamako-order-item .item-name {
        font-size: 14px;
        font-weight: 500;
        flex: 1;
        padding-right: 12px;
    }
    .lamako-order-item .item-qty {
        font-size: 13px;
        color: #6b7280;
        margin-right: 16px;
        white-space: nowrap;
    }
    .lamako-order-item .item-price {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
    }
    .lamako-total-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-top: 2px solid #e5e7eb;
        margin-top: 8px;
    }
    .lamako-total-row .label {
        font-size: 16px;
        font-weight: 700;
    }
    .lamako-total-row .amount {
        font-size: 18px;
        font-weight: 700;
        color: #dc2626;
    }
    /* Payment methods */
    .woocommerce-checkout-payment { margin: 0; padding: 0; }
    .wc_payment_methods { list-style: none; padding: 0; margin: 0; }
    .wc_payment_method {
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        margin-bottom: 10px;
        padding: 14px 16px;
        transition: all 0.2s;
        cursor: pointer;
    }
    .wc_payment_method:has(input:checked) {
        border-color: #dc2626;
        background: #fef2f2;
    }
    .wc_payment_method label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        width: 100%;
    }
    .wc_payment_method label img {
        height: 28px;
        width: auto;
        object-fit: contain;
    }
    .wc_payment_method input[type="radio"] {
        width: 20px;
        height: 20px;
        accent-color: #dc2626;
        flex-shrink: 0;
    }
    .payment_box {
        padding: 10px 0 0 30px;
        font-size: 13px;
        color: #6b7280;
    }
    /* Terms */
    .lamako-terms {
        padding: 16px 0 0;
        font-size: 13px;
        color: #6b7280;
        line-height: 1.5;
    }
    .lamako-terms label {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        cursor: pointer;
    }
    .lamako-terms input[type="checkbox"] {
        width: 20px;
        height: 20px;
        accent-color: #dc2626;
        flex-shrink: 0;
        margin-top: 2px;
    }
    .lamako-terms a {
        color: #dc2626;
        text-decoration: underline;
    }
    /* Place order button */
    #place_order {
        display: block !important;
        width: calc(100% - 32px) !important;
        margin: 16px auto !important;
        padding: 16px !important;
        background: #dc2626 !important;
        color: #fff !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 17px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        position: fixed !important;
        bottom: 16px !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 999 !important;
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4) !important;
        -webkit-appearance: none !important;
    }
    #place_order:active {
        transform: scale(0.98) !important;
        opacity: 0.9 !important;
    }
    #place_order[hidden] {
        display: block !important;
    }
    /* Hide WC default elements */
    .wc-block-components-notice-banner,
    .woocommerce-error,
    .woocommerce-info,
    .woocommerce-message,
    #wpadminbar,
    .wc-block-components-notice-banner__content {
        display: none !important;
    }
    .woocommerce-privacy-policy-text {
        font-size: 12px;
        color: #9ca3af;
        line-height: 1.5;
        padding: 8px 0;
    }
    .woocommerce-privacy-policy-text a {
        color: #dc2626;
    }
    .blockUI.blockOverlay {
        background: rgba(255,255,255,0.7) !important;
    }
    .shop_table { display: none; }
    @media (max-width: 400px) {
        .lamako-section { margin: 8px 12px; padding: 16px; }
        .lamako-checkout-header { padding: 12px 16px; }
    }
</style>
<?php wp_head(); ?>
</head>
<body class="lamako-mobile-checkout">

<div class="lamako-checkout-header">
    <h1>Paiement</h1>
    <span class="lamako-secure">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Securise
    </span>
</div>

<!-- Order Summary -->
<div class="lamako-section">
    <div class="lamako-section-title">Resume de la commande</div>
    <?php foreach ( $items as $item ) : ?>
    <div class="lamako-order-item">
        <span class="item-name"><?php echo esc_html( $item['name'] ); ?></span>
        <span class="item-qty">x<?php echo esc_html( $item['qty'] ); ?></span>
        <span class="item-price"><?php echo $item['total']; ?></span>
    </div>
    <?php endforeach; ?>
    <div class="lamako-total-row">
        <span class="label">Total</span>
        <span class="amount"><?php echo $total; ?></span>
    </div>
</div>

<!-- Payment Methods -->
<div class="lamako-section">
    <div class="lamako-section-title">Mode de paiement</div>
    <?php
    if ( ! defined( 'WOOCOMMERCE_CHECKOUT' ) ) {
        define( 'WOOCOMMERCE_CHECKOUT', true );
    }
    
    $available_gateways = WC()->payment_gateways->get_available_payment_gateways();
    
    if ( ! empty( $available_gateways ) ) {
        $pay_url = $order->get_checkout_payment_url();
        echo '<form id="order_review" method="post" action="' . esc_url( $pay_url ) . '">';
        
        echo '<div id="payment" class="woocommerce-checkout-payment">';
        echo '<ul class="wc_payment_methods payment_methods methods">';
        
        $first = true;
        foreach ( $available_gateways as $gateway ) {
            $checked = $first ? ' checked="checked"' : '';
            echo '<li class="wc_payment_method payment_method_' . esc_attr( $gateway->id ) . '">';
            echo '<input id="payment_method_' . esc_attr( $gateway->id ) . '" type="radio" class="input-radio" name="payment_method" value="' . esc_attr( $gateway->id ) . '"' . $checked . ' />';
            echo '<label for="payment_method_' . esc_attr( $gateway->id ) . '">';
            echo esc_html( $gateway->get_title() );
            if ( $gateway->get_icon() ) {
                echo ' ' . $gateway->get_icon();
            }
            echo '</label>';
            if ( $gateway->has_fields() || $gateway->get_description() ) {
                echo '<div class="payment_box payment_method_' . esc_attr( $gateway->id ) . '"' . ( ! $first ? ' style="display:none;"' : '' ) . '>';
                $gateway->payment_fields();
                echo '</div>';
            }
            echo '</li>';
            $first = false;
        }
        
        echo '</ul>';
        
        // Terms checkbox
        $terms_page_id = wc_terms_and_conditions_page_id();
        if ( $terms_page_id > 0 && apply_filters( 'woocommerce_checkout_show_terms', true ) ) {
            echo '<div class="lamako-terms">';
            echo '<label>';
            echo '<input type="checkbox" name="terms" id="terms" value="1" />';
            echo ' J\'ai lu et j\'accepte les <a href="' . esc_url( get_permalink( $terms_page_id ) ) . '" target="_blank">conditions generales</a>';
            echo '</label>';
            echo '</div>';
        }
        
        echo '<div class="form-row place-order">';
        echo '<noscript>JavaScript est requis pour le paiement.</noscript>';
        wp_nonce_field( 'woocommerce-pay', 'woocommerce-pay-nonce' );
        echo '<input type="hidden" name="woocommerce_pay" value="1" />';
        echo '<button type="submit" class="button alt wp-element-button" id="place_order" value="Payer la commande">PAYER LA COMMANDE</button>';
        echo '</div>';
        
        echo '</div>';
        echo '</form>';
    } else {
        echo '<p>Aucune methode de paiement disponible.</p>';
    }
    ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Ensure place_order button is always visible
    var btn = document.getElementById('place_order');
    if (btn) {
        btn.removeAttribute('hidden');
        btn.style.display = 'block';
    }
    
    // Handle payment method selection
    var radios = document.querySelectorAll('input[name="payment_method"]');
    radios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.payment_box').forEach(function(box) {
                box.style.display = 'none';
            });
            var box = document.querySelector('.payment_method_' + this.value + ' .payment_box');
            if (box) box.style.display = 'block';
        });
    });
    
    // Make the whole payment method row clickable
    document.querySelectorAll('.wc_payment_method').forEach(function(li) {
        li.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                var radio = this.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    });
    
    // Notify app of successful payment
    function checkPaymentSuccess() {
        if (window.location.href.indexOf('order-received') !== -1 || 
            window.location.href.indexOf('thankyou') !== -1 ||
            document.querySelector('.woocommerce-order-received, .woocommerce-thankyou-order-received')) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'payment_success',
                url: window.location.href
            }));
        }
    }
    checkPaymentSuccess();
    
    var observer = new MutationObserver(function() {
        checkPaymentSuccess();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Also check on navigation
    window.addEventListener('load', checkPaymentSuccess);
    
    // Hide any WordPress elements that leak through
    var hideSelectors = '#wpadminbar, .qlwapp__container, [class*="qlwapp"], #fkcart-floating-toggler, [class*="fkcart"]';
    document.querySelectorAll(hideSelectors).forEach(function(el) {
        el.style.display = 'none';
    });
    setInterval(function() {
        document.querySelectorAll(hideSelectors).forEach(function(el) {
            el.style.display = 'none';
        });
    }, 2000);
});
</script>
<?php wp_footer(); ?>
</body>
</html>
    <?php
    exit;
}


// ============================================================
// 2. REST API ROUTES
// ============================================================

add_action( 'rest_api_init', function () {
    // Create a pending WC order from app cart items
    register_rest_route( 'lamako-mobile/v1', '/create-order', [
        'methods'  => 'POST',
        'callback' => 'lamako_mobile_create_order',
        'permission_callback' => 'lamako_mobile_check_wc_auth',
    ] );
    
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

// ============================================================
// 5. CREATE ORDER ENDPOINT (for app checkout)
// ============================================================

/**
 * Create a pending WC order from app cart items.
 * Returns a "pay for order" URL that works without session cookies.
 * 
 * POST /wp-json/lamako-mobile/v1/create-order
 * Body: {
 *   "items": [{ "product_id": 123, "quantity": 1 }],
 *   "billing": { "first_name": "...", "last_name": "...", "email": "...", "phone": "..." },
 *   "customer_id": 0  (optional, WC customer ID)
 * }
 * 
 * Returns: {
 *   "order_id": 456,
 *   "order_key": "wc_order_...",
 *   "checkout_url": "https://.../?pay_for_order=true&key=wc_order_...",
 *   "total": "150000"
 * }
 */
function lamako_mobile_create_order( $request ) {
    $body = $request->get_json_params();
    
    if ( empty( $body['items'] ) || ! is_array( $body['items'] ) ) {
        return new WP_Error( 'invalid_items', 'Items array is required', [ 'status' => 400 ] );
    }
    
    // Temporarily force all products to be purchasable during order creation
    // This is needed because Tickera ticket products may have restrictions
    $force_purchasable = function( $purchasable ) { return true; };
    $force_in_stock = function( $in_stock ) { return true; };
    add_filter( 'woocommerce_is_purchasable', $force_purchasable, 99999 );
    add_filter( 'woocommerce_product_is_in_stock', $force_in_stock, 99999 );
    
    // Create the order
    $order = wc_create_order();
    
    if ( is_wp_error( $order ) ) {
        return new WP_Error( 'order_creation_failed', $order->get_error_message(), [ 'status' => 500 ] );
    }
    
    // Set customer if provided
    $customer_id = isset( $body['customer_id'] ) ? (int) $body['customer_id'] : 0;
    if ( $customer_id > 0 ) {
        $order->set_customer_id( $customer_id );
    }
    
    // Set billing info
    if ( ! empty( $body['billing'] ) ) {
        $billing = $body['billing'];
        if ( ! empty( $billing['first_name'] ) ) $order->set_billing_first_name( sanitize_text_field( $billing['first_name'] ) );
        if ( ! empty( $billing['last_name'] ) )  $order->set_billing_last_name( sanitize_text_field( $billing['last_name'] ) );
        if ( ! empty( $billing['email'] ) )       $order->set_billing_email( sanitize_email( $billing['email'] ) );
        if ( ! empty( $billing['phone'] ) )       $order->set_billing_phone( sanitize_text_field( $billing['phone'] ) );
        if ( ! empty( $billing['address_1'] ) )   $order->set_billing_address_1( sanitize_text_field( $billing['address_1'] ) );
        if ( ! empty( $billing['city'] ) )        $order->set_billing_city( sanitize_text_field( $billing['city'] ) );
        if ( ! empty( $billing['country'] ) )     $order->set_billing_country( sanitize_text_field( $billing['country'] ) );
    }
    
    // Add items
    $errors = [];
    foreach ( $body['items'] as $item ) {
        $product_id = isset( $item['product_id'] ) ? (int) $item['product_id'] : 0;
        $quantity   = isset( $item['quantity'] ) ? (int) $item['quantity'] : 1;
        $variation_id = isset( $item['variation_id'] ) ? (int) $item['variation_id'] : 0;
        
        if ( $product_id <= 0 ) {
            $errors[] = 'Invalid product_id: ' . $product_id;
            continue;
        }
        
        $product = wc_get_product( $variation_id > 0 ? $variation_id : $product_id );
        if ( ! $product ) {
            $errors[] = 'Product not found: ' . $product_id;
            continue;
        }
        
        $result = $order->add_product( $product, $quantity );
        if ( is_wp_error( $result ) ) {
            $errors[] = 'Failed to add product ' . $product_id . ': ' . $result->get_error_message();
        }
    }
    
    if ( $order->get_item_count() === 0 ) {
        $order->delete( true );
        return new WP_Error( 'empty_order', 'No valid items could be added. Errors: ' . implode( '; ', $errors ), [ 'status' => 400 ] );
    }
    
    // Calculate totals and set status
    $order->calculate_totals();
    $order->set_status( 'pending' );
    
    // Add meta to identify this as a mobile app order
    $order->update_meta_data( '_lamako_mobile_order', 'yes' );
    $order->update_meta_data( '_lamako_order_source', 'mobile_app' );
    
    $order->save();
    
    // Remove temporary purchasability overrides
    remove_filter( 'woocommerce_is_purchasable', $force_purchasable, 99999 );
    remove_filter( 'woocommerce_product_is_in_stock', $force_in_stock, 99999 );
    
    // Build the "pay for order" URL
    // Always construct manually to avoid WP nonce issues in mobile WebView
    $order_id  = $order->get_id();
    $order_key = $order->get_order_key();
    // Use dedicated mobile checkout page (no WordPress theme)
    $pay_url   = home_url( '/?lamako_checkout=1&order_id=' . $order_id . '&order_key=' . $order_key );
    
    return [
        'order_id'     => $order_id,
        'order_key'    => $order_key,
        'checkout_url' => $pay_url,
        'total'        => $order->get_total(),
        'item_count'   => $order->get_item_count(),
        'errors'       => $errors,
    ];
}


// ============================================================
// 6. PUSH NOTIFICATIONS
// ============================================================

// Register the push token endpoint
add_action( 'rest_api_init', function () {
    register_rest_route( 'lamako-mobile/v1', '/register-push-token', [
        'methods'  => 'POST',
        'callback' => 'lamako_mobile_register_push_token',
        'permission_callback' => 'lamako_mobile_check_wc_auth',
    ] );
} );

/**
 * Register an Expo push token for push notifications.
 * 
 * POST /wp-json/lamako-mobile/v1/register-push-token
 * Body: { "token": "ExponentPushToken[...]", "user_id": 0, "platform": "ios" }
 */
function lamako_mobile_register_push_token( $request ) {
    $body = $request->get_json_params();
    $token = isset( $body['token'] ) ? sanitize_text_field( $body['token'] ) : '';
    $user_id = isset( $body['user_id'] ) ? (int) $body['user_id'] : 0;
    $platform = isset( $body['platform'] ) ? sanitize_text_field( $body['platform'] ) : 'unknown';
    
    if ( empty( $token ) ) {
        return new WP_Error( 'missing_token', 'Push token is required', [ 'status' => 400 ] );
    }
    
    // Store tokens in wp_options as a JSON array
    $tokens = get_option( 'lamako_push_tokens', [] );
    if ( ! is_array( $tokens ) ) $tokens = [];
    
    // Check if token already exists, update it
    $found = false;
    foreach ( $tokens as &$t ) {
        if ( $t['token'] === $token ) {
            $t['user_id'] = $user_id;
            $t['platform'] = $platform;
            $t['updated_at'] = current_time( 'mysql' );
            $found = true;
            break;
        }
    }
    unset( $t );
    
    if ( ! $found ) {
        $tokens[] = [
            'token'      => $token,
            'user_id'    => $user_id,
            'platform'   => $platform,
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        ];
    }
    
    update_option( 'lamako_push_tokens', $tokens );
    
    return [ 'success' => true, 'message' => 'Token registered', 'total_tokens' => count( $tokens ) ];
}

/**
 * Send push notification to all registered Expo push tokens.
 * Uses Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/
 */
function lamako_mobile_send_push_notification( $title, $body, $data = [], $channel_id = 'default' ) {
    $tokens = get_option( 'lamako_push_tokens', [] );
    if ( ! is_array( $tokens ) || empty( $tokens ) ) return 0;
    
    // Build messages for Expo Push API
    $messages = [];
    foreach ( $tokens as $t ) {
        if ( empty( $t['token'] ) || strpos( $t['token'], 'ExponentPushToken' ) === false ) continue;
        
        $messages[] = [
            'to'        => $t['token'],
            'title'     => $title,
            'body'      => $body,
            'data'      => $data,
            'sound'     => 'default',
            'channelId' => $channel_id,
            'priority'  => 'high',
        ];
    }
    
    if ( empty( $messages ) ) return 0;
    
    // Send in batches of 100 (Expo limit)
    $sent = 0;
    $batches = array_chunk( $messages, 100 );
    
    foreach ( $batches as $batch ) {
        $response = wp_remote_post( 'https://exp.host/--/api/v2/push/send', [
            'headers' => [
                'Accept'       => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'body'    => json_encode( $batch ),
            'timeout' => 30,
        ] );
        
        if ( ! is_wp_error( $response ) ) {
            $sent += count( $batch );
        }
    }
    
    return $sent;
}

/**
 * Hook: Send push notification when a new Tickera event is published.
 * Tickera events use the 'tc_events' custom post type.
 */
add_action( 'transition_post_status', 'lamako_mobile_notify_new_event', 10, 3 );

function lamako_mobile_notify_new_event( $new_status, $old_status, $post ) {
    // Only trigger when a tc_events post transitions to 'publish'
    if ( $new_status !== 'publish' || $old_status === 'publish' ) return;
    if ( $post->post_type !== 'tc_events' ) return;
    
    $event_name = $post->post_title;
    $event_id = $post->ID;
    
    // Get event date if available
    $event_date = get_post_meta( $event_id, 'event_date_time', true );
    $date_str = '';
    if ( $event_date ) {
        $date_str = ' le ' . date_i18n( 'j F Y', strtotime( $event_date ) );
    }
    
    $title = '🎉 Nouvel événement !';
    $body = $event_name . $date_str . ' - Réservez vos billets maintenant !';
    $data = [
        'type'     => 'new_event',
        'event_id' => $event_id,
        'url'      => '/event/' . $event_id,
    ];
    
    lamako_mobile_send_push_notification( $title, $body, $data, 'events' );
}

/**
 * Hook: Send push notification when a WooCommerce order status changes.
 * Useful for order confirmations, shipping updates, etc.
 */
add_action( 'woocommerce_order_status_changed', 'lamako_mobile_notify_order_status', 10, 4 );

function lamako_mobile_notify_order_status( $order_id, $old_status, $new_status, $order ) {
    // Safety check: ensure $order is a valid WC_Order object
    if ( ! $order || ! is_a( $order, 'WC_Order' ) ) return;
    
    // Only notify for mobile app orders
    try {
        if ( $order->get_meta( '_lamako_mobile_order' ) !== 'yes' ) return;
    } catch ( \Exception $e ) {
        return;
    }
    
    $customer_id = $order->get_customer_id();
    if ( $customer_id <= 0 ) return;
    
    // Find the customer's push token
    $tokens = get_option( 'lamako_push_tokens', [] );
    if ( ! is_array( $tokens ) ) return;
    
    $customer_tokens = array_filter( $tokens, function( $t ) use ( $customer_id ) {
        return isset( $t['user_id'] ) && (int) $t['user_id'] === $customer_id;
    } );
    
    if ( empty( $customer_tokens ) ) return;
    
    // Build notification based on status
    $status_messages = [
        'processing' => [ 'title' => 'Commande confirmée ✅', 'body' => 'Votre commande #' . $order_id . ' a été confirmée !' ],
        'completed'  => [ 'title' => 'Commande terminée 🎫', 'body' => 'Vos billets pour la commande #' . $order_id . ' sont prêts !' ],
        'cancelled'  => [ 'title' => 'Commande annulée ❌', 'body' => 'Votre commande #' . $order_id . ' a été annulée.' ],
        'refunded'   => [ 'title' => 'Remboursement 💰', 'body' => 'Votre commande #' . $order_id . ' a été remboursée.' ],
        'failed'     => [ 'title' => 'Paiement échoué ⚠️', 'body' => 'Le paiement pour la commande #' . $order_id . ' a échoué. Veuillez réessayer.' ],
    ];
    
    if ( ! isset( $status_messages[ $new_status ] ) ) return;
    
    $msg = $status_messages[ $new_status ];
    $data = [
        'type'     => 'order_update',
        'order_id' => $order_id,
        'status'   => $new_status,
        'url'      => '/orders',
    ];
    
    // Send only to this customer's tokens
    foreach ( $customer_tokens as $t ) {
        if ( empty( $t['token'] ) || strpos( $t['token'], 'ExponentPushToken' ) === false ) continue;
        
        wp_remote_post( 'https://exp.host/--/api/v2/push/send', [
            'headers' => [
                'Accept'       => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'body'    => json_encode( [[
                'to'        => $t['token'],
                'title'     => $msg['title'],
                'body'      => $msg['body'],
                'data'      => $data,
                'sound'     => 'default',
                'channelId' => 'orders',
                'priority'  => 'high',
            ]] ),
            'timeout' => 15,
        ] );
    }
}
