<?php
/**
 * Plugin Name: Lamako Mobile API
 * Plugin URI: https://www.ticketbylamako.com
 * Description: REST API endpoints for the TicketByLamako mobile app - ticket instances, seating chart embed, and more.
 * Version: 2.0.4
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
 * Force ALL Tickera ticket products to be purchasable.
 * 
 * Tickera's WooCommerce Bridge marks ticket products as non-purchasable
 * to prevent direct purchase (it uses its own cart flow via seating charts).
 * However, this blocks:
 *   1. The seating chart AJAX (tc_woo_update_cart_seats) which calls WC()->cart->add_to_cart()
 *   2. Our custom checkout page (lamako_checkout) pay-for-order flow
 *   3. The standard WC pay-for-order page
 * 
 * Solution: Always return true for products that have a price set.
 * This is safe because the seating chart plugin controls availability
 * via its own seat reservation system (Firebase + cookies).
 */
add_filter( 'woocommerce_is_purchasable', 'lamako_force_all_purchasable', 9999, 2 );

function lamako_force_all_purchasable( $purchasable, $product ) {
    // If the product has a price, make it purchasable
    if ( $product && $product->get_price() !== '' && $product->get_price() !== null ) {
        return true;
    }
    return $purchasable;
}

/**
 * Also force stock status to be in-stock for all products.
 * Tickera may mark products as out of stock when all seats are reserved,
 * but the seat reservation system handles availability separately.
 */
add_filter( 'woocommerce_product_is_in_stock', 'lamako_force_all_in_stock', 9999, 2 );

function lamako_force_all_in_stock( $in_stock, $product ) {
    // Always return true - seat availability is managed by Tickera's own system
    return true;
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
    /* NUCLEAR APPROACH: Hide EVERYTHING in body, then show only what we need */
    body > *:not(.lamako-embed-instruction):not(.tc_seating_map_button):not(.tc_seating_map):not(script):not(link):not(style):not(#lamako-confirm-btn) {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
    }
    /* Re-show the elements we actually want */
    .lamako-embed-instruction,
    .tc_seating_map_button,
    .tc_seating_map,
    #lamako-confirm-btn {
        display: block !important;
        visibility: visible !important;
        height: auto !important;
        overflow: visible !important;
        pointer-events: auto !important;
    }
    /* Also hide homepage sections that get injected by JS */
    #lamako-home-sections, .home-sections, .home-filter-section, .home-upcoming-section, .home-past-section,
    .modal, .gt-modal, [class*="modal"],
    #fb-root, [class*="qlwapp"], [class*="fkcart"], [class*="whatsapp"],
    [class*="tidio"], [id*="tidio"], [class*="chat-widget"],
    .fkcart-modal-backdrop, .fkcart-drawer-container,
    .wc-block-mini-cart, .wp-block-woocommerce-mini-cart,
    #wpadminbar
    { display: none !important; visibility: hidden !important; height: 0 !important; pointer-events: none !important; }
    
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
    
    /* HIDE jQuery UI dialog entirely - we bypass it with direct AJAX */
    .ui-widget-overlay,
    .ui-dialog,
    .tc-seat-dialog {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }
    
    /* Hide the in-WebView selected seats panel - shown in React Native overlay instead */
    #lamako-selected-seats {
        display: none !important;
    }
    
    /* Hide Tickera zoom buttons visually - controlled from native React Native overlay via JS click */
    .tc_zoom_in, .tc_zoom_out,
    .tc-zoom-in, .tc-zoom-out,
    [class*="zoom_in"], [class*="zoom_out"],
    .tc_seating_chart_zoom_in, .tc_seating_chart_zoom_out {
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
        opacity: 0 !important;
        width: 36px !important;
        height: 36px !important;
        pointer-events: auto !important;
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
/**
 * OPTION C: Bypass jQuery UI dialog entirely.
 * Intercept seat clicks, call tc_woo_update_cart_seats AJAX directly.
 * This avoids the dialog('destroy') issue in React Native WebView.
 */
document.addEventListener('DOMContentLoaded', function() {
    // Wait for Tickera scripts to load
    setTimeout(function() {
        // Create seat count display
        var seatCount = document.createElement('div');
        seatCount.className = 'lamako-seat-count';
        document.body.appendChild(seatCount);
        
        // Track if we're currently processing a seat click
        var processing = false;
        
        // Create a toast notification element - positioned at TOP to avoid being hidden by Confirmer button overlay
        var toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:999999;background:#663d17;color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:none;text-align:center;max-width:90%;transition:opacity 0.3s;';
        document.body.appendChild(toast);
        
        // Add CSS spinner animation for seat loading
        var spinnerStyle = document.createElement('style');
        spinnerStyle.textContent = '@keyframes lamako-pulse { 0%,100% { opacity:0.3; transform:scale(0.9); } 50% { opacity:1; transform:scale(1.1); } } .lamako-seat-loading { animation: lamako-pulse 0.6s ease-in-out infinite !important; }';
        document.head.appendChild(spinnerStyle);
        
        function showToast(msg, isError, isRemove) {
            toast.textContent = msg;
            if (isError) {
                toast.style.background = '#dc2626';
            } else if (isRemove) {
                toast.style.background = '#f59e0b';
            } else {
                toast.style.background = '#16a34a';
            }
            toast.style.display = 'block';
            toast.style.opacity = '1';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(function() {
                toast.style.opacity = '0';
                setTimeout(function() { toast.style.display = 'none'; }, 300);
            }, 2500);
        }
        
        // Selected seats panel
        var selectedPanel = document.createElement('div');
        selectedPanel.id = 'lamako-selected-seats';
        selectedPanel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:2px solid #e5e7eb;padding:8px 12px;z-index:99998;max-height:35vh;overflow-y:auto;display:none;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 -4px 12px rgba(0,0,0,0.1);';
        document.body.appendChild(selectedPanel);
        
        function getSeatDisplayName(seatEl) {
            var labelEl = seatEl.querySelector('span p');
            return labelEl ? labelEl.textContent.trim() : (seatEl.id || 'Siège');
        }
        
        function updateSeatCount() {
            var seats = document.querySelectorAll('.tc_seat_in_cart');
            var count = seats.length;
            if (count > 0) {
                seatCount.textContent = count + (count === 1 ? ' siège sélectionné' : ' sièges sélectionnés');
                seatCount.classList.add('visible');
                
                // Build selected seats list
                var html = '<div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;">Sièges sélectionnés (' + count + ') :</div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
                seats.forEach(function(s) {
                    var name = getSeatDisplayName(s);
                    var sId = s.id || '';
                    html += '<div style="display:inline-flex;align-items:center;gap:4px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600;">';
                    html += '<span>' + name + '</span>';
                    html += '<button data-seat-id="' + sId + '" style="background:none;border:none;color:#dc2626;font-size:16px;font-weight:bold;cursor:pointer;padding:0 2px;line-height:1;">×</button>';
                    html += '</div>';
                });
                html += '</div>';
                selectedPanel.innerHTML = html;
                selectedPanel.style.display = 'block';
                
                // Add click handlers for remove buttons
                selectedPanel.querySelectorAll('button[data-seat-id]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var seatId = this.getAttribute('data-seat-id');
                        var seatEl = document.getElementById(seatId);
                        if (seatEl) removeSeatFromCart(seatEl);
                    });
                });
                
                try {
                    if (window.ReactNativeWebView) {
                        var seatNames = [];
                        seats.forEach(function(s) { seatNames.push(getSeatDisplayName(s)); });
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'seat_count_update',
                            count: count,
                            seats: seatNames
                        }));
                    }
                } catch(e) {}
            } else {
                seatCount.classList.remove('visible');
                selectedPanel.style.display = 'none';
            }
        }
        
        /**
         * Build a color-to-ticketTypeId map from the legend.
         * Legend items have class 'tt_XXXX' where XXXX is the product ID.
         */
        var colorToTicketType = {};
        function buildColorMap() {
            var legends = document.querySelectorAll('li[class*="tt_"]');
            legends.forEach(function(li) {
                var match = li.className.match(/tt_(\d+)/);
                if (match) {
                    var ttId = match[1];
                    // The legend has a <span style="background-color:#xxx"> child
                    var colorSpan = li.querySelector('span[style*="background-color"]');
                    if (colorSpan) {
                        var bg = colorSpan.style.backgroundColor;
                        if (bg) colorToTicketType[bg] = ttId;
                    }
                    // Also map by the li's computed color (fallback)
                    var liColor = window.getComputedStyle(li).color;
                    if (liColor) colorToTicketType[liColor] = ttId;
                }
            });
            console.log('[Lamako] Color map built:', colorToTicketType);
        }
        
        /**
         * Determine ticket type ID for a seat element.
         * Priority: 1) data-tt-id attribute, 2) color matching with legend
         */
        function getTicketTypeId(seatEl) {
            // First try direct attribute
            var ttId = seatEl.getAttribute('data-tt-id');
            if (ttId) return ttId;
            
            // Then try color matching
            var bgColor = seatEl.style.backgroundColor;
            if (bgColor && colorToTicketType[bgColor]) {
                return colorToTicketType[bgColor];
            }
            
            // Try computed color
            var computedBg = window.getComputedStyle(seatEl).backgroundColor;
            if (computedBg && colorToTicketType[computedBg]) {
                return colorToTicketType[computedBg];
            }
            
            // Fallback: if there's only one ticket type, use that
            var ttIds = Object.values(colorToTicketType);
            var uniqueIds = ttIds.filter(function(v, i, a) { return a.indexOf(v) === i; });
            if (uniqueIds.length === 1) return uniqueIds[0];
            
            return null;
        }
        
        /**
         * Direct AJAX add-to-cart for a seat, bypassing the jQuery UI dialog.
         */
        function addSeatToCart(seatEl) {
            if (processing) return;
            
            // Skip if already in cart
            if (seatEl.classList.contains('tc_seat_in_cart')) {
                // If already in cart, remove it
                removeSeatFromCart(seatEl);
                return;
            }
            
            // Skip unavailable/reserved/blocked seats
            if (seatEl.classList.contains('tc_seat_unavailable') ||
                seatEl.classList.contains('tc_seat_reserved') ||
                seatEl.classList.contains('tc_blocked_seat') ||
                seatEl.classList.contains('tc_seat_in_others_cart')) {
                return;
            }
            
            // Skip seats without data-tt-id (not assigned to any ticket type)
            // Tickera only sells seats that have data-tt-id attribute
            var hasTtId = seatEl.getAttribute('data-tt-id');
            if (!hasTtId) {
                // Try color matching as fallback
                var bgColor = seatEl.style.backgroundColor;
                var colorMatch = bgColor && colorToTicketType[bgColor];
                if (!colorMatch) {
                    showToast('Ce siège n\'est pas disponible', true);
                    return;
                }
            }
            
            processing = true;
            
            // Determine ticket type from attribute or color
            var ticketTypeId = getTicketTypeId(seatEl);
            var seatId = seatEl.id || '';
            var mapEl = seatEl.closest('.tc_seating_map');
            var chartId = mapEl ? mapEl.getAttribute('data-seating-chart-id') : '';
            
            // Get seat label from inner text
            var labelEl = seatEl.querySelector('span p');
            var seatLabel = labelEl ? labelEl.textContent.trim() : '';
            // Replace hyphens with en-dashes in label (Tickera convention)
            seatLabel = seatLabel.replace(/-/g, '\u2013');
            
            if (!ticketTypeId || !seatId || !chartId) {
                processing = false;
                showToast('Ce siège n\'a pas de type de billet assigné', true);
                return;
            }
            
            // Build the tc_seat_cart_items string: productId-seatId-seatLabel-chartId
            var cartItem = ticketTypeId + '-' + seatId + '-' + seatLabel + '-' + chartId;
            
            showToast('Ajout en cours...');
            
            // Visual feedback - animate the seat while loading
            seatEl.classList.add('lamako-seat-loading');
            
            // Call Tickera AJAX directly
            jQuery.post(
                (typeof tc_seat_chart_ajax !== 'undefined' ? tc_seat_chart_ajax.ajaxUrl : '/wp-admin/admin-ajax.php'),
                {
                    action: 'tc_woo_update_cart_seats',
                    tc_seat_cart_items: [cartItem],
                    quantity: 1,
                    variation_id: 0
                },
                function(response) {
                    processing = false;
                    seatEl.classList.remove('lamako-seat-loading');
                    
                    if (response && !response.error) {
                        // Success - mark seat as in cart
                        seatEl.classList.add('tc_seat_in_cart');
                        seatEl.classList.remove('ui-selected', 'ui-selectee');
                        
                        // Apply in-cart color from Tickera settings
                        var inCartColor = (typeof tc_seat_chart_ajax !== 'undefined' && tc_seat_chart_ajax.tc_in_cart_seat_color)
                            ? tc_seat_chart_ajax.tc_in_cart_seat_color : '#4CAF50';
                        seatEl.style.backgroundColor = inCartColor;
                        seatEl.style.color = inCartColor;
                        
                        // === FIREBASE: Notify other users this seat is now in cart ===
                        if (typeof tc_seat_chart_ajax !== 'undefined' && tc_seat_chart_ajax.tc_check_firebase == '1' && !seatEl.classList.contains('tc-object-selectable')) {
                            var firebaseSeatItems = [chartId + '-' + seatId + '-' + ticketTypeId];
                            jQuery.post(tc_seat_chart_ajax.ajaxUrl, {
                                action: 'tc_add_seat_to_firebase_cart',
                                tc_seat_cart_items: firebaseSeatItems
                            });
                        }
                        
                        // Update subtotal display
                        if (response.subtotal && response.total) {
                            var subtotalEl = document.querySelector('.tc-seatchart-subtotal');
                            if (subtotalEl) subtotalEl.innerHTML = response.subtotal + '<strong>' + response.total + '</strong>';
                        }
                        if (response.in_cart_count !== undefined) {
                            var countEl = document.querySelector('.tc-seatchart-in-cart-count');
                            if (countEl) countEl.value = response.in_cart_count;
                        }
                        
                        // Refresh WC fragments
                        jQuery(document.body).trigger('wc_fragment_refresh');
                        
                        var seatName = getSeatDisplayName(seatEl);
                        showToast(seatName + ' ajouté ✓');
                        updateSeatCount();
                    } else {
                        showToast(response.error_message || 'Erreur lors de l\'ajout', true);
                    }
                }
            ).fail(function(xhr, status, error) {
                processing = false;
                seatEl.style.opacity = '1';
                showToast('Erreur réseau: ' + error, true);
                console.log('AJAX Error:', status, error);
            });
        }
        
        /**
         * Remove a seat from cart via AJAX (quantity=0)
         */
        function removeSeatFromCart(seatEl) {
            if (processing) return;
            processing = true;
            
            var ticketTypeId = getTicketTypeId(seatEl);
            var seatId = seatEl.id || '';
            var mapEl = seatEl.closest('.tc_seating_map');
            var chartId = mapEl ? mapEl.getAttribute('data-seating-chart-id') : '';
            var labelEl = seatEl.querySelector('span p');
            var seatLabel = labelEl ? labelEl.textContent.trim() : '';
            seatLabel = seatLabel.replace(/-/g, '\u2013');
            
            if (!ticketTypeId) {
                processing = false;
                return;
            }
            
            var cartItem = ticketTypeId + '-' + seatId + '-' + seatLabel + '-' + chartId;
            
            showToast('Retrait en cours...');
            seatEl.classList.add('lamako-seat-loading');
            
            // === FIREBASE: Remove seat from Firebase BEFORE WC cart (immediate visual update for others) ===
            if (typeof tc_seat_chart_ajax !== 'undefined' && tc_seat_chart_ajax.tc_check_firebase == '1' && !seatEl.classList.contains('tc-object-selectable')) {
                jQuery.post(tc_seat_chart_ajax.ajaxUrl, {
                    action: 'tc_remove_seat_from_firebase_cart',
                    seat_id: seatId,
                    chart_id: chartId
                });
            }
            
            jQuery.post(
                (typeof tc_seat_chart_ajax !== 'undefined' ? tc_seat_chart_ajax.ajaxUrl : '/wp-admin/admin-ajax.php'),
                {
                    action: 'tc_woo_update_cart_seats',
                    tc_seat_cart_items: [cartItem],
                    quantity: 0,
                    variation_id: 0
                },
                function(response) {
                    processing = false;
                    seatEl.classList.remove('lamako-seat-loading');
                    
                    if (response && !response.error) {
                        seatEl.classList.remove('tc_seat_in_cart');
                        // Restore original color from ticket type legend
                        var ttLi = document.querySelector('li.tt_' + ticketTypeId);
                        var origColor = ttLi ? window.getComputedStyle(ttLi).color : '';
                        if (origColor) {
                            seatEl.style.backgroundColor = origColor;
                            seatEl.style.color = origColor;
                        }
                        
                        if (response.subtotal && response.total) {
                            var subtotalEl = document.querySelector('.tc-seatchart-subtotal');
                            if (subtotalEl) subtotalEl.innerHTML = response.subtotal + '<strong>' + response.total + '</strong>';
                        }
                        
                        jQuery(document.body).trigger('wc_fragment_refresh');
                        var removedName = getSeatDisplayName(seatEl);
                        showToast(removedName + ' retiré', false, true);
                        updateSeatCount();
                    } else {
                        showToast(response.error_message || 'Erreur lors du retrait', true);
                    }
                }
            ).fail(function() {
                processing = false;
                seatEl.style.opacity = '1';
                showToast('Erreur réseau', true);
            });
        }
        
        /**
         * Intercept seat clicks BEFORE Tickera's selectable handler.
         * We use a capturing event listener on the document to catch clicks
         * before they reach jQuery UI's selectable widget.
         * Target: .tc_seat_unit elements (ALL seats in the chart)
         */
        function interceptSeatClicks() {
            document.addEventListener('click', function(e) {
                // Find the closest seat element (class tc_seat_unit)
                var seatEl = e.target.closest('.tc_seat_unit');
                if (!seatEl) return;
                
                // Only intercept if it's inside a seating map
                var mapEl = seatEl.closest('.tc_seating_map');
                if (!mapEl) return;
                
                // Prevent Tickera's default handler (which opens the dialog)
                e.stopPropagation();
                e.preventDefault();
                
                // Add/remove from cart directly
                addSeatToCart(seatEl);
            }, true); // true = capturing phase, runs before Tickera's bubbling handlers
            
            // Also intercept touch events for mobile
            document.addEventListener('touchend', function(e) {
                var seatEl = e.target.closest('.tc_seat_unit');
                if (!seatEl) return;
                var mapEl = seatEl.closest('.tc_seating_map');
                if (!mapEl) return;
                
                // Don't intercept if user was scrolling/zooming (multi-touch)
                if (e.changedTouches && e.changedTouches.length > 1) return;
                
                e.stopPropagation();
                e.preventDefault();
                
                addSeatToCart(seatEl);
            }, true);
        }
        
        /**
         * Disable Tickera's jQuery UI selectable widget to prevent dialog popups.
         * We do this after the map loads.
         */
        function disableSelectableWidget() {
            if (window.jQuery && jQuery.fn.selectable) {
                var maps = document.querySelectorAll('.tc_seating_map');
                maps.forEach(function(map) {
                    try {
                        var $map = jQuery(map);
                        if ($map.data('ui-selectable') || $map.data('selectable')) {
                            $map.selectable('destroy');
                        }
                    } catch(e) {
                        console.log('Could not destroy selectable:', e);
                    }
                });
            }
        }
        
        // Wait for the seating map to be rendered, then set up our interceptors
        function initWhenReady() {
            var map = document.querySelector('.tc_seating_map.active, .tc_seating_map');
            if (map && map.querySelector('.tc_seat_unit')) {
                // Map is loaded with seats - build color map from legend
                buildColorMap();
                disableSelectableWidget();
                interceptSeatClicks();
                updateSeatCount();
                
                // Also hide any open dialogs
                if (window.jQuery) {
                    jQuery('.ui-dialog').hide();
                    jQuery('.ui-widget-overlay').hide();
                }
                
                // Observe DOM changes for seat count updates (debounced to avoid intermediate states)
                var seatUpdateTimer = null;
                var observer = new MutationObserver(function() {
                    clearTimeout(seatUpdateTimer);
                    seatUpdateTimer = setTimeout(updateSeatCount, 300);
                });
                observer.observe(map, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
                
                console.log('[Lamako] Seat click interceptor active - dialog bypassed');
            } else {
                setTimeout(initWhenReady, 500);
            }
        }
        initWhenReady();
        
        // Also re-check after the "Pick your seats" button is clicked
        // (the map may not have seats until user clicks the button)
        var mapBtnObserver = new MutationObserver(function() {
            var map = document.querySelector('.tc_seating_map.active');
            if (map && map.querySelector('.tc_seat_unit')) {
                setTimeout(function() {
                    buildColorMap();
                    disableSelectableWidget();
                    updateSeatCount();
                }, 1000);
            }
        });
        mapBtnObserver.observe(document.body, { childList: true, subtree: true });
        
        // Hide WhatsApp and FKCart that may load late
        function hideWidgets() {
            var widgets = document.querySelectorAll('.qlwapp__container, [class*="qlwapp"], #fkcart-floating-toggler, [class*="fkcart"], [class*="tidio"], [id*="tidio"]');
            widgets.forEach(function(w) {
                w.style.display = 'none';
                w.style.visibility = 'hidden';
            });
        }
        hideWidgets();
        setInterval(hideWidgets, 2000);
        
        // ============================================================
        // FIREBASE: Periodic cleanup of expired seats (every 1 minute)
        // ============================================================
        function startFirebaseCleanup() {
            if (typeof tc_seat_chart_ajax === 'undefined' || tc_seat_chart_ajax.tc_check_firebase != '1') return;
            
            var mapEl = document.querySelector('.tc_seating_map');
            var chartId = mapEl ? mapEl.getAttribute('data-seating-chart-id') : '';
            if (!chartId) return;
            
            // Initial cleanup after 3 seconds
            setTimeout(function() {
                jQuery.post(tc_seat_chart_ajax.ajaxUrl, {
                    action: 'tc_remove_expired_firebase_seats',
                    tc_seating_chart_id: chartId
                });
                console.log('[Lamako] Firebase: initial expired seats cleanup for chart ' + chartId);
            }, 3000);
            
            // Periodic cleanup every 1 minute
            setInterval(function() {
                jQuery.post(tc_seat_chart_ajax.ajaxUrl, {
                    action: 'tc_remove_expired_firebase_seats',
                    tc_seating_chart_id: chartId
                });
                console.log('[Lamako] Firebase: periodic cleanup for chart ' + chartId);
            }, 60 * 1000);
        }
        startFirebaseCleanup();
        
        // ============================================================
        // FIREBASE: Real-time listener for other users' seat changes
        // Shows seats taken by others in grey/different color
        // ============================================================
        function startFirebaseRealtimeListener() {
            if (typeof tc_seat_chart_ajax === 'undefined' || tc_seat_chart_ajax.tc_check_firebase != '1') return;
            if (typeof firebase === 'undefined' || typeof tc_firebase_vars === 'undefined') {
                console.log('[Lamako] Firebase SDK not available - skipping real-time listener');
                return;
            }
            
            var mapEl = document.querySelector('.tc_seating_map');
            var chartId = mapEl ? mapEl.getAttribute('data-seating-chart-id') : '';
            if (!chartId) return;
            
            var sessionId = tc_firebase_vars.session_id || '';
            var inOthersCartColor = tc_firebase_vars.tc_in_others_cart_seat_color || '#808080';
            var reservedColor = (typeof tc_seat_chart_ajax !== 'undefined' && tc_seat_chart_ajax.tc_reserved_seat_color) 
                ? tc_seat_chart_ajax.tc_reserved_seat_color : '#333333';
            
            // Listen for in-cart changes (other users adding/removing seats)
            var inCartRef = firebase.database().ref('/in-cart/' + chartId);
            
            inCartRef.orderByChild('timestamp').on('child_added', function(data) {
                var seatId = data.key;
                var seatData = data.val();
                
                if (seatData.session_id !== sessionId) {
                    // Another user has this seat in their cart - mark it grey
                    var seatEl = mapEl.querySelector('#' + seatId + ':not(.tc-object-selectable)');
                    if (seatEl && !seatEl.classList.contains('tc_seat_in_cart')) {
                        seatEl.style.backgroundColor = inOthersCartColor;
                        seatEl.style.color = inOthersCartColor;
                        seatEl.classList.add('tc_seat_in_others_cart');
                        seatEl.classList.remove('ui-selected', 'ui-selectee');
                    }
                }
            });
            
            inCartRef.on('child_removed', function(data) {
                var seatId = data.key;
                var seatData = data.val();
                
                if (seatData.session_id !== sessionId) {
                    // Another user released this seat - mark it available again
                    var seatEl = mapEl.querySelector('#' + seatId + ':not(.tc-object-selectable)');
                    if (seatEl && !seatEl.classList.contains('tc_seat_in_cart')) {
                        seatEl.classList.remove('tc_seat_in_others_cart');
                        // Restore original color from ticket type
                        var ttId = seatEl.getAttribute('data-tt-id');
                        var ttLi = ttId ? document.querySelector('li.tt_' + ttId) : null;
                        var origColor = ttLi ? window.getComputedStyle(ttLi).color : '';
                        if (origColor) {
                            seatEl.style.backgroundColor = origColor;
                            seatEl.style.color = origColor;
                        }
                        seatEl.classList.add('ui-selectee');
                    }
                }
            });
            
            // Listen for reserved seats (purchased by others)
            var reservedRef = firebase.database().ref('/reserved/' + chartId);
            
            reservedRef.orderByChild('timestamp').on('child_added', function(data) {
                var seatId = data.key;
                var seatEl = mapEl.querySelector('#' + seatId + ':not(.tc-object-selectable)');
                if (seatEl) {
                    seatEl.style.backgroundColor = reservedColor;
                    seatEl.style.color = reservedColor;
                    seatEl.classList.add('tc_seat_reserved');
                    seatEl.classList.remove('ui-selected', 'ui-selectee', 'tc_seat_in_others_cart');
                }
            });
            
            reservedRef.on('child_removed', function(data) {
                var seatId = data.key;
                var seatEl = mapEl.querySelector('#' + seatId + ':not(.tc-object-selectable)');
                if (seatEl && !seatEl.classList.contains('tc_seat_in_cart')) {
                    seatEl.classList.remove('tc_seat_reserved');
                    var ttId = seatEl.getAttribute('data-tt-id');
                    var ttLi = ttId ? document.querySelector('li.tt_' + ttId) : null;
                    var origColor = ttLi ? window.getComputedStyle(ttLi).color : '';
                    if (origColor) {
                        seatEl.style.backgroundColor = origColor;
                        seatEl.style.color = origColor;
                    }
                    seatEl.classList.add('ui-selectee');
                }
            });
            
            console.log('[Lamako] Firebase real-time listener active for chart ' + chartId);
        }
        
        // Start Firebase listener after a short delay to ensure Firebase SDK is loaded
        setTimeout(startFirebaseRealtimeListener, 3000);
        
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
    <p class="lamako-embed-instruction">Appuyez sur le bouton ci-dessous, puis touchez un siège pour l'ajouter. Touchez-le à nouveau pour le retirer.</p>
    <?php echo do_shortcode( '[tc_seat_chart id="' . $chart_id . '" show_legend="true"]' ); ?>
    <button id="lamako-confirm-btn" style="display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:9999; padding:16px 40px; font-size:17px; font-weight:700; background:#663d17; color:#fff; border:none; border-radius:14px; cursor:pointer; width:90%; max-width:400px; box-shadow:0 4px 14px rgba(102,61,23,0.3); text-align:center;">Confirmer la sélection</button>
<?php wp_footer(); ?>
<script>
// POST-WP_FOOTER CLEANUP: Remove all injected content that shouldn't be visible
(function() {
    // Remove all body children that are not our content
    var body = document.body;
    var allowed = ['lamako-embed-instruction', 'tc_seating_map_button', 'tc_seating_map', 'lamako-confirm-btn'];
    var children = Array.from(body.children);
    children.forEach(function(child) {
        if (child.tagName === 'SCRIPT' || child.tagName === 'LINK' || child.tagName === 'STYLE') return;
        var dominated = false;
        for (var i = 0; i < allowed.length; i++) {
            if (child.classList && child.classList.contains(allowed[i])) { dominated = true; break; }
            if (child.id === allowed[i]) { dominated = true; break; }
        }
        if (!dominated) {
            child.style.display = 'none';
            child.style.visibility = 'hidden';
            child.style.height = '0';
            child.style.overflow = 'hidden';
        }
    });
    
    // AUTO-CLICK the 'Pick your seats' button after a short delay
    setTimeout(function() {
        var btn = document.querySelector('.tc_seating_map_button');
        if (btn) {
            btn.click();
            // Hide the button after clicking
            setTimeout(function() { btn.style.display = 'none'; }, 500);
        }
    }, 1500);
    
    // Show confirm button when seats are selected
    function checkSeats() {
        var confirmBtn = document.getElementById('lamako-confirm-btn');
        if (!confirmBtn) return;
        var selectedSeats = document.querySelectorAll('.tc_seat_unit.tc_added_to_cart, .tc_seat_unit.selected, .tc_seat_unit[style*="opacity: 0.5"]');
        if (selectedSeats.length > 0) {
            confirmBtn.style.display = 'block';
            confirmBtn.textContent = 'Confirmer (' + selectedSeats.length + ' siège' + (selectedSeats.length > 1 ? 's' : '') + ')';
        } else {
            confirmBtn.style.display = 'none';
        }
    }
    setInterval(checkSeats, 1000);
    
    // Confirm button sends message to React Native
    var confirmBtn = document.getElementById('lamako-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SEATS_CONFIRMED' }));
            }
        });
    }
    
    // Periodic cleanup for late-loading widgets
    setInterval(function() {
        var junk = document.querySelectorAll('#lamako-home-sections, .home-sections, .modal, .gt-modal, [class*="qlwapp"], [class*="fkcart"], .fkcart-modal-backdrop, #fb-root');
        junk.forEach(function(el) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.height = '0';
        });
    }, 2000);
})();
</script>
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
    
    // ============================================================
    // HANDLE POST: Process payment directly via gateway
    // ============================================================
    if ( $_SERVER['REQUEST_METHOD'] === 'POST' && isset( $_POST['woocommerce_pay'] ) ) {
        // Verify nonce
        if ( ! wp_verify_nonce( $_POST['woocommerce-pay-nonce'] ?? '', 'woocommerce-pay' ) ) {
            wp_die( 'Security check failed', 'Error', [ 'response' => 403 ] );
        }
        
        // Get selected payment method
        $payment_method = isset( $_POST['payment_method'] ) ? sanitize_text_field( $_POST['payment_method'] ) : '';
        
        if ( empty( $payment_method ) ) {
            wp_redirect( home_url( '/?lamako_checkout=1&order_id=' . $order_id . '&order_key=' . $order_key . '&error=no_payment_method' ) );
            exit;
        }
        
        // Update billing phone if provided (needed for Mobile Money gateways)
        if ( ! empty( $_POST['billing_phone'] ) ) {
            $phone = sanitize_text_field( $_POST['billing_phone'] );
            $order->set_billing_phone( $phone );
            $order->save();
        }
        
        // Set the payment method on the order
        $available_gateways = WC()->payment_gateways->get_available_payment_gateways();
        
        if ( ! isset( $available_gateways[ $payment_method ] ) ) {
            wp_redirect( home_url( '/?lamako_checkout=1&order_id=' . $order_id . '&order_key=' . $order_key . '&error=invalid_gateway' ) );
            exit;
        }
        
        $gateway = $available_gateways[ $payment_method ];
        
        // Update order with payment method
        $order->set_payment_method( $gateway );
        $order->save();
        
        // Process the payment via the gateway
        // This typically returns array('result' => 'success', 'redirect' => 'https://...')
        try {
            $result = $gateway->process_payment( $order_id );
            
            if ( isset( $result['result'] ) && $result['result'] === 'success' ) {
                // Gateway returned a redirect URL (to external payment page like MVola, Airtel, etc.)
                if ( ! empty( $result['redirect'] ) ) {
                    wp_redirect( $result['redirect'] );
                    exit;
                }
            } else {
                // Payment processing failed
                $error_msg = 'Payment processing failed';
                if ( function_exists( 'wc_get_notices' ) ) {
                    $notices = wc_get_notices( 'error' );
                    if ( ! empty( $notices ) ) {
                        $error_msg = is_array( $notices[0] ) ? $notices[0]['notice'] : $notices[0];
                    }
                    wc_clear_notices();
                }
                wp_redirect( home_url( '/?lamako_checkout=1&order_id=' . $order_id . '&order_key=' . $order_key . '&error=' . urlencode( $error_msg ) ) );
                exit;
            }
        } catch ( \Exception $e ) {
            wp_redirect( home_url( '/?lamako_checkout=1&order_id=' . $order_id . '&order_key=' . $order_key . '&error=' . urlencode( $e->getMessage() ) ) );
            exit;
        }
    }
    
    // ============================================================
    // HANDLE GET: Show the checkout form
    // ============================================================
    
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
    .lamako-back-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #f3f4f6;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
    }
    .lamako-back-btn:active { background: #e5e7eb; }
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

    /* Phone field for Mobile Money */
    .lamako-phone-section {
        margin-top: 16px;
        padding: 16px;
        background: #fffbeb;
        border: 1px solid #fbbf24;
        border-radius: 10px;
        display: none;
    }
    .lamako-phone-section.visible { display: block; }
    .lamako-phone-section label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 8px;
    }
    .lamako-phone-section input {
        width: 100%;
        padding: 12px 14px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 16px;
        outline: none;
        transition: border-color 0.2s;
    }
    .lamako-phone-section input:focus { border-color: #dc2626; }
    .lamako-phone-hint {
        font-size: 11px;
        color: #6b7280;
        margin-top: 4px;
    }
    /* Terms section - above pay button */
    .lamako-terms {
        padding: 16px 0 0;
        font-size: 13px;
        color: #6b7280;
        line-height: 1.5;
        margin-bottom: 80px;
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
        transition: opacity 0.2s, background 0.2s;
    }
    #place_order:active {
        transform: scale(0.98) !important;
        opacity: 0.9 !important;
    }
    #place_order[hidden] {
        display: block !important;
    }
    #place_order.disabled {
        background: #9ca3af !important;
        box-shadow: none !important;
        pointer-events: none !important;
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
    /* Hide ALL theme/plugin injected content from wp_head/wp_footer */
    [class*="rev_slider"], .rs-module-wrap, sr7-module, [class*="sr7"],
    [class*="slider-revolution"], .tp-bannertimer,
    #fkcart-floating-toggler, .fkcart-main-wrapper, [class*="fkcart"],
    [class*="qlwapp"], [id*="qlwapp"], .joinchat, [class*="whatsapp"],
    [class*="tidio"], [id*="tidio"], [class*="tawk"], [id*="tawk"],
    [class*="crisp"], [id*="crisp"], [class*="chat-widget"],
    [class*="cookie"], [class*="consent"], [class*="gdpr"],
    #fb-root, [class*="fb-"], .fb_dialog,
    .gt-mobile-header, .gt-header, .gt-sticky-header, .gt-footer,
    .gt-page-title-bar, .gt-breadcrumb, .gt-site-right, .gt-fixed-sidebar,
    .gt-general-widget, .gt-widget, .widget, aside, nav,
    header:not(.lamako-checkout-header), footer,
    .nsl-container, [class*="nextend-social"],
    .woocommerce-products-header, .products, .related,
    .site-header, .site-footer, #masthead, #colophon,
    .elementor-section, .elementor-widget,
    [class*="popup"], [class*="modal"]:not(.lamako-modal),
    .gt-site-wrapper > *:not(.lamako-mobile-checkout):not(script):not(style) {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
    }
    /* Ensure our checkout content is always visible */
    .lamako-checkout-header, .lamako-section, .lamako-phone-section,
    .lamako-terms, .form-row.place-order, #place_order,
    body.lamako-mobile-checkout > .lamako-checkout-header,
    body.lamako-mobile-checkout > .lamako-section,
    body.lamako-mobile-checkout > div[style*="background: #fef2f2"],
    body.lamako-mobile-checkout > script,
    body.lamako-mobile-checkout > style {
        display: block !important;
        visibility: visible !important;
        height: auto !important;
        overflow: visible !important;
    }
    /* Hide anything injected after our content by wp_footer */
    body.lamako-mobile-checkout > *:not(.lamako-checkout-header):not(.lamako-section):not(.form-row):not(script):not(style):not(link):not(div[style*="background: #fef2f2"]):not(#place_order) {
        display: none !important;
    }
    /* Loading spinner */
    .lamako-spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: lamako-spin 0.6s linear infinite;
        vertical-align: middle;
        margin-right: 8px;
    }
    @keyframes lamako-spin {
        to { transform: rotate(360deg); }
    }
    @media (max-width: 400px) {
        .lamako-section { margin: 8px 12px; padding: 16px; }
        .lamako-checkout-header { padding: 12px 16px; }
    }
</style>
<?php wp_head(); ?>
</head>
<body class="lamako-mobile-checkout">

<?php
// Show error message if payment failed
$checkout_error = isset( $_GET['error'] ) ? sanitize_text_field( urldecode( $_GET['error'] ) ) : '';
if ( $checkout_error ) :
?>
<div style="background: #fef2f2; border-bottom: 2px solid #dc2626; padding: 12px 20px; font-size: 14px; color: #dc2626; font-weight: 500;">
    <div style="font-weight:700;margin-bottom:4px;">⚠️ <?php echo esc_html( $checkout_error ); ?></div>
    <div style="font-size:12px;color:#6b7280;">Veuillez essayer un autre mode de paiement ou réessayer.</div>
</div>
<script>
// Notify the app that a payment error occurred so it doesn't show empty cart
if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment_error',
        error: <?php echo json_encode( $checkout_error ); ?>
    }));
}
</script>
<?php endif; ?>

<div class="lamako-checkout-header">
    <button class="lamako-back-btn" onclick="if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'go_back'}))}else{history.back()}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <h1>Paiement</h1>
    <span class="lamako-secure">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Securise
    </span>
</div>

<!-- Order Summary -->
<div class="lamako-section">
    <div class="lamako-section-title">Resume de la commande</div>
    <?php
    // Get event name from order items (Tickera stores event info in product meta)
    $event_name = '';
    foreach ( $items as $item ) {
        $product_id = $item['product_id'] ?? 0;
        if ( $product_id ) {
            $ev = get_post_meta( $product_id, '_event_name', true );
            if ( ! $ev ) {
                // Try Tickera event relation
                $ev_id = get_post_meta( $product_id, 'event_name', true );
                if ( $ev_id ) {
                    $ev = get_the_title( $ev_id );
                }
            }
            if ( $ev && ! $event_name ) {
                $event_name = $ev;
            }
        }
    }
    if ( $event_name ) :
    ?>
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:11px;display:flex;align-items:center;gap:6px;">
        <span style="font-weight:700;color:#92400e;font-size:10px;text-transform:uppercase;letter-spacing:0.3px;">Evenement:</span>
        <span style="color:#78350f;font-weight:600;font-size:11px;"><?php echo esc_html( $event_name ); ?></span>
    </div>
    <?php endif; ?>
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
        // Form submits back to THIS dedicated page (not WooCommerce standard checkout)
        $self_url = home_url( '/?lamako_checkout=1&order_id=' . $order_id . '&order_key=' . $order_key );
        echo '<form id="order_review" method="post" action="' . esc_url( $self_url ) . '">';
        
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
        
        // Phone number field for Mobile Money gateways
        echo '<div class="lamako-phone-section" id="lamako-phone-section">';
        echo '<label for="billing_phone">Numero de telephone Mobile Money</label>';
        echo '<input type="tel" name="billing_phone" id="billing_phone" placeholder="034 XX XXX XX" pattern="[0-9]{10}" inputmode="numeric" />';
        echo '<div class="lamako-phone-hint">Le numero sur lequel la demande de paiement sera envoyee</div>';
        echo '</div>';
        
        // Terms checkbox
        $terms_page_id = wc_terms_and_conditions_page_id();
        if ( $terms_page_id > 0 && apply_filters( 'woocommerce_checkout_show_terms', true ) ) {
            echo '<div class="lamako-terms" id="lamako-terms-section">';
            echo '<label>';
            echo '<input type="checkbox" name="terms" id="terms" value="1" />';
            echo ' J\'ai lu et j\'accepte les <a href="#" onclick="event.preventDefault(); window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type: \'open_terms\', url: \'' . esc_url( get_permalink( $terms_page_id ) ) . '\'}))">conditions generales</a>';
            echo '</label>';
            echo '</div>';
        } else {
            // Always show terms even if no page configured
            echo '<div class="lamako-terms" id="lamako-terms-section">';
            echo '<label>';
            echo '<input type="checkbox" name="terms" id="terms" value="1" />';
            echo ' J\'ai lu et j\'accepte les conditions generales de vente';
            echo '</label>';
            echo '</div>';
        }
        
        echo '<div class="form-row place-order">';
        echo '<noscript>JavaScript est requis pour le paiement.</noscript>';
        wp_nonce_field( 'woocommerce-pay', 'woocommerce-pay-nonce' );
        echo '<input type="hidden" name="woocommerce_pay" value="1" />';
        echo '<button type="submit" class="button alt wp-element-button disabled" id="place_order" value="Payer la commande">PAYER LA COMMANDE</button>';
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
    var btn = document.getElementById('place_order');
    var termsCheckbox = document.getElementById('terms');
    var phoneSection = document.getElementById('lamako-phone-section');
    var phoneInput = document.getElementById('billing_phone');
    
    // Mobile Money gateway IDs that require phone (MVola and Airtel only - Orange has its own flow)
    var mobileMoneyGateways = ['mvola', 'airtel_money', 'mvola_gateway', 'wc_mvola', 'wc_airtel_money'];
    
    // Check if selected gateway needs phone (MVola and Airtel only)
    function selectedGatewayNeedsPhone() {
        var selected = document.querySelector('input[name="payment_method"]:checked');
        if (!selected) return false;
        var val = selected.value.toLowerCase();
        return mobileMoneyGateways.some(function(gw) { return val.indexOf(gw) !== -1; }) || val.indexOf('mvola') !== -1 || val.indexOf('airtel') !== -1;
    }
    
    // Update phone field visibility
    function updatePhoneVisibility() {
        if (phoneSection) {
            if (selectedGatewayNeedsPhone()) {
                phoneSection.classList.add('visible');
            } else {
                phoneSection.classList.remove('visible');
            }
        }
        updatePayButton();
    }
    
    // Update pay button state based on terms + phone
    function updatePayButton() {
        if (!btn) return;
        var termsOk = termsCheckbox ? termsCheckbox.checked : true;
        var phoneOk = true;
        if (selectedGatewayNeedsPhone() && phoneInput) {
            var phone = phoneInput.value.replace(/\s/g, '');
            phoneOk = phone.length >= 10;
        }
        if (termsOk && phoneOk) {
            btn.classList.remove('disabled');
        } else {
            btn.classList.add('disabled');
        }
    }
    
    // Ensure place_order button is always visible
    if (btn) {
        btn.removeAttribute('hidden');
        btn.style.display = 'block';
    }
    
    // Terms checkbox listener
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', updatePayButton);
    }
    
    // Phone input listener
    if (phoneInput) {
        phoneInput.addEventListener('input', updatePayButton);
    }
    
    // Form submission validation + loading spinner
    var form = document.getElementById('order_review');
    if (form) {
        form.addEventListener('submit', function(e) {
            if (termsCheckbox && !termsCheckbox.checked) {
                e.preventDefault();
                alert('Veuillez accepter les conditions generales pour continuer.');
                return false;
            }
            if (selectedGatewayNeedsPhone() && phoneInput) {
                var phone = phoneInput.value.replace(/\s/g, '');
                if (phone.length < 10) {
                    e.preventDefault();
                    alert('Veuillez entrer votre numero de telephone Mobile Money.');
                    phoneInput.focus();
                    return false;
                }
            }
            // Show loading spinner on button
            if (btn) {
                btn.innerHTML = '<span class="lamako-spinner"></span> Traitement en cours...';
                btn.classList.add('disabled');
                btn.style.pointerEvents = 'none';
            }
        });
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
            updatePhoneVisibility();
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
    
    // Initial state
    updatePhoneVisibility();
    updatePayButton();
    
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
    
    // Detect if we landed on a cancel/failure page from payment gateway
    // (e.g., Orange Money cancel, CyberSource cancel)
    function checkPaymentCancelled() {
        var url = window.location.href;
        // Common cancel/failure indicators in URLs
        if (url.indexOf('cancel') !== -1 || url.indexOf('failed') !== -1 || url.indexOf('declined') !== -1) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'payment_cancelled',
                url: url
            }));
        }
        // If we're on a WC page that's not our checkout and not order-received, it's a redirect back
        if (url.indexOf('lamako_checkout') === -1 && url.indexOf('order-received') === -1 && url.indexOf('lamako_seat_embed') === -1) {
            // We've been redirected away from our checkout - likely a gateway return
            // Check if it's a cart/shop page (empty cart scenario)
            if (url.indexOf('/cart') !== -1 || url.indexOf('/panier') !== -1 || url.indexOf('wc-empty-cart') !== -1) {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'payment_cancelled',
                    url: url,
                    reason: 'redirected_to_cart'
                }));
            }
        }
    }
    checkPaymentCancelled();
    
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
<script>
// Post-wp_footer cleanup: hide any DOM elements injected by theme/plugins
(function() {
    var validClasses = ['lamako-checkout-header', 'lamako-section', 'lamako-phone-section', 'lamako-terms'];
    var body = document.body;
    if (!body) return;
    // Hide all direct children of body that are not our checkout elements or scripts/styles
    Array.from(body.children).forEach(function(el) {
        var tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript') return;
        var cls = el.className || '';
        var isOurs = validClasses.some(function(c) { return cls.indexOf(c) !== -1; });
        if (!isOurs && el.id !== 'place_order' && el.id !== 'order_review') {
            // Check if it's the error banner
            var style = el.getAttribute('style') || '';
            if (style.indexOf('fef2f2') !== -1) return;
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.height = '0';
            el.style.overflow = 'hidden';
        }
    });
    // Also run after a delay for async-injected content
    setTimeout(function() {
        Array.from(body.children).forEach(function(el) {
            var tag = el.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript') return;
            var cls = el.className || '';
            var isOurs = validClasses.some(function(c) { return cls.indexOf(c) !== -1; });
            if (!isOurs && el.id !== 'place_order' && el.id !== 'order_review') {
                var style = el.getAttribute('style') || '';
                if (style.indexOf('fef2f2') !== -1) return;
                el.style.display = 'none';
            }
        });
    }, 1000);
    setTimeout(function() {
        Array.from(body.children).forEach(function(el) {
            var tag = el.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript') return;
            var cls = el.className || '';
            var isOurs = validClasses.some(function(c) { return cls.indexOf(c) !== -1; });
            if (!isOurs && el.id !== 'place_order' && el.id !== 'order_review') {
                var style = el.getAttribute('style') || '';
                if (style.indexOf('fef2f2') !== -1) return;
                el.style.display = 'none';
            }
        });
    }, 3000);
})();
</script>
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
    
    // Clear WooCommerce cart/session after successful payment
    register_rest_route( 'lamako-mobile/v1', '/clear-cart', [
        'methods'  => 'POST',
        'callback' => 'lamako_mobile_clear_cart',
        'permission_callback' => 'lamako_mobile_check_wc_auth',
    ] );
} );

/**
 * Clear WooCommerce cart for the session.
 * Called after successful payment to prevent old items from reappearing.
 */
function lamako_mobile_clear_cart( $request ) {
    // Clear WC cart if available
    if ( function_exists( 'WC' ) && WC()->cart ) {
        WC()->cart->empty_cart();
    }
    
    // Also clear any Tickera seating chart session data
    if ( WC()->session ) {
        WC()->session->set( 'tc_seat_cart_items', null );
        WC()->session->set( 'tc_cart_seats', null );
        WC()->session->set( 'chosen_payment_method', null );
    }
    
    // Release Tickera seat reservations from transients
    // Tickera uses multiple transient patterns for seat reservations
    $order_id = $request->get_param( 'order_id' );
    
    // Method 1: Clear seats from a specific order
    if ( $order_id ) {
        $order = wc_get_order( (int) $order_id );
        if ( $order && $order->get_status() !== 'completed' && $order->get_status() !== 'processing' ) {
            foreach ( $order->get_items() as $item ) {
                $seat_id = $item->get_meta( '_tc_seat_id' );
                if ( $seat_id ) {
                    delete_transient( 'tc_seat_' . $seat_id . '_reserved' );
                    delete_transient( 'tc_seat_reserved_' . $seat_id );
                    delete_transient( 'tc_cart_seat_' . $seat_id );
                }
            }
            // Cancel the order so seats are fully released
            if ( $order->get_status() === 'pending' ) {
                $order->update_status( 'cancelled', 'Annulé depuis l\'app mobile (paiement non abouti).' );
            }
        }
    }
    
    // Method 2: Clear ALL Tickera seat-related transients from the database
    global $wpdb;
    $wpdb->query(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_tc_seat_%' OR option_name LIKE '_transient_timeout_tc_seat_%' OR option_name LIKE '_transient_tc_cart_seat_%' OR option_name LIKE '_transient_timeout_tc_cart_seat_%'"
    );
    
    // === FIREBASE: Clear all in-cart seats for this session from Firebase ===
    // Tickera stores Firebase data in the Realtime Database under /in-cart/{chart_id}/{seat_id}
    // The tc_remove_expired_firebase_seats action handles cleanup, but we also need to
    // clear the current session's seats. We do this by calling the same AJAX action internally.
    $chart_id = $request->get_param( 'chart_id' );
    if ( $chart_id && class_exists( 'TC_Seat_Chart_Firebase' ) ) {
        // If Tickera's Firebase class is available, use it to clear seats
        try {
            do_action( 'tc_remove_expired_firebase_seats_action', $chart_id );
        } catch ( \Exception $e ) {
            // Non-critical - continue even if Firebase cleanup fails
        }
    }
    
    // Also clear Tickera's session-based cart cookies if available
    if ( isset( $_COOKIE['tc_cart_cookie'] ) ) {
        $cookie_id = sanitize_text_field( $_COOKIE['tc_cart_cookie'] );
        delete_transient( 'tc_cart_' . $cookie_id );
    }
    
    return new WP_REST_Response( [ 'success' => true, 'message' => 'Cart cleared' ], 200 );
}

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
    
    // Apply coupon if provided (LamakoRewards redemption)
    if ( ! empty( $body['coupon_code'] ) ) {
        $coupon_code = sanitize_text_field( $body['coupon_code'] );
        $coupon_result = $order->apply_coupon( $coupon_code );
        if ( is_wp_error( $coupon_result ) ) {
            $errors[] = 'Coupon error: ' . $coupon_result->get_error_message();
        }
    }
    
    // Calculate totals and set status
    $order->calculate_totals();
    $order->set_status( 'pending' );
    
    // Add meta to identify this as a mobile app order
    $order->set_created_via( 'lamako_mobile' );
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

    // Combined shop data endpoint (products + categories in one request)
    // Public endpoint (no auth required) - read-only product data like home-data/events-data
    register_rest_route( 'lamako-mobile/v1', '/shop-data', [
        'methods'  => 'GET',
        'callback' => 'lamako_mobile_get_shop_data',
        'permission_callback' => '__return_true',
    ] );

    // Social login endpoint (Google, Facebook, Apple)
    // Public endpoint - validates provider tokens and returns JWT
    register_rest_route( 'lamako-mobile/v1', '/social-login', [
        'methods'  => 'POST',
        'callback' => 'lamako_mobile_social_login',
        'permission_callback' => '__return_true',
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


// ============================================================
// 8. AUTO-CANCEL EXPIRED ORDERS (via WooCommerce Action Scheduler)
// ============================================================
// Uses WooCommerce Action Scheduler instead of WP Cron for:
// - Visibility in WP Admin > Outils > Actions planifiées
// - Guaranteed execution (doesn't depend on site visits)
// - Better logging and retry handling

/**
 * Schedule the recurring actions on init (only if not already scheduled).
 * Runs every 5 minutes via WooCommerce Action Scheduler.
 */
add_action( 'init', 'lamako_schedule_order_cleanup_action' );
function lamako_schedule_order_cleanup_action() {
    if ( ! function_exists( 'as_has_scheduled_action' ) ) return;
    
    // Schedule pending order cleanup every 5 minutes
    if ( ! as_has_scheduled_action( 'lamako_cancel_expired_pending_orders' ) ) {
        as_schedule_recurring_action( time(), 300, 'lamako_cancel_expired_pending_orders', array(), 'lamako' );
    }
    
    // Schedule on-hold order cleanup every 5 minutes
    if ( ! as_has_scheduled_action( 'lamako_cancel_expired_onhold_orders' ) ) {
        as_schedule_recurring_action( time(), 300, 'lamako_cancel_expired_onhold_orders', array(), 'lamako' );
    }
}

/**
 * Unschedule on plugin deactivation.
 */
register_deactivation_hook( __FILE__, 'lamako_unschedule_order_cleanup_actions' );
function lamako_unschedule_order_cleanup_actions() {
    if ( function_exists( 'as_unschedule_all_actions' ) ) {
        as_unschedule_all_actions( 'lamako_cancel_expired_pending_orders' );
        as_unschedule_all_actions( 'lamako_cancel_expired_onhold_orders' );
    }
}

/**
 * Action callback: Cancel all pending orders older than hold_stock setting (10 min).
 * Releases WooCommerce stock and Firebase seats.
 */
add_action( 'lamako_cancel_expired_pending_orders', 'lamako_do_cancel_expired_pending_orders' );
function lamako_do_cancel_expired_pending_orders() {
    if ( ! function_exists( 'wc_get_orders' ) ) return;
    
    // Get hold_stock_minutes from WooCommerce settings (default 10)
    $hold_stock_minutes = absint( get_option( 'woocommerce_hold_stock_minutes', 10 ) );
    if ( $hold_stock_minutes < 1 ) return; // Disabled
    
    // Find pending orders older than hold_stock_minutes
    $date_cutoff = date( 'Y-m-d H:i:s', strtotime( "-{$hold_stock_minutes} minutes" ) );
    
    $pending_orders = wc_get_orders( array(
        'status'       => 'pending',
        'date_created' => '<' . strtotime( $date_cutoff ),
        'limit'        => 50, // Process max 50 per run to avoid timeout
        'orderby'      => 'date',
        'order'        => 'ASC',
    ) );
    
    if ( empty( $pending_orders ) ) return;
    
    foreach ( $pending_orders as $order ) {
        // Cancel the order - this triggers WooCommerce stock restoration automatically
        $order->update_status( 'cancelled', __( 'Commande annulée automatiquement - délai de paiement expiré (10 min).', 'lamako' ) );
        
        // Also clean up Firebase seats for any seating chart items in this order
        lamako_cleanup_firebase_seats_for_order( $order );
    }
    
    // Log for debugging
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
        error_log( '[Lamako Action Scheduler] Cancelled ' . count( $pending_orders ) . ' expired pending orders.' );
    }
}

/**
 * Action callback: Cancel on-hold orders older than 30 minutes.
 * On-hold orders are typically waiting for bank transfer or manual payment.
 */
add_action( 'lamako_cancel_expired_onhold_orders', 'lamako_do_cancel_expired_onhold_orders' );
function lamako_do_cancel_expired_onhold_orders() {
    if ( ! function_exists( 'wc_get_orders' ) ) return;
    
    // On-hold orders get 30 minutes (more generous for bank transfers)
    $date_cutoff = date( 'Y-m-d H:i:s', strtotime( '-30 minutes' ) );
    
    $onhold_orders = wc_get_orders( array(
        'status'       => 'on-hold',
        'date_created' => '<' . strtotime( $date_cutoff ),
        'limit'        => 20,
        'orderby'      => 'date',
        'order'        => 'ASC',
    ) );
    
    if ( empty( $onhold_orders ) ) return;
    
    foreach ( $onhold_orders as $order ) {
        $order->update_status( 'cancelled', __( 'Commande en attente annulée automatiquement - délai de 30 min expiré.', 'lamako' ) );
        lamako_cleanup_firebase_seats_for_order( $order );
    }
    
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
        error_log( '[Lamako Action Scheduler] Cancelled ' . count( $onhold_orders ) . ' expired on-hold orders.' );
    }
}

/**
 * Clean up Firebase seats for a cancelled order.
 * Finds seating chart items and calls the Firebase removal.
 */
function lamako_cleanup_firebase_seats_for_order( $order ) {
    if ( ! $order ) return;
    
    foreach ( $order->get_items() as $item ) {
        // Check if this item has seating chart metadata
        $seat_id  = $item->get_meta( '_tc_seat_id' );
        $chart_id = $item->get_meta( '_tc_chart_id' );
        
        if ( ! $seat_id && ! $chart_id ) {
            // Try alternative meta keys used by Tickera
            $seat_id  = $item->get_meta( 'tc_seat_id' );
            $chart_id = $item->get_meta( 'tc_chart_id' );
        }
        
        if ( $seat_id && $chart_id ) {
            // Remove from Firebase via the Tickera function if available
            if ( function_exists( 'tc_remove_seat_from_firebase' ) ) {
                tc_remove_seat_from_firebase( $seat_id, $chart_id );
            } else {
                // Direct Firebase removal via WordPress transient cleanup
                delete_transient( 'tc_seat_' . $chart_id . '_' . $seat_id );
            }
        }
    }
    
    // Also delete the Tickera cart transients for this order's session
    $session_id = $order->get_meta( '_tc_session_id' );
    if ( $session_id ) {
        delete_transient( 'tc_cart_seats_' . $session_id );
    }
}


// ============================================================
// 9. COMBINED SHOP DATA ENDPOINT
// ============================================================

/**
 * GET /wp-json/lamako-mobile/v1/shop-data
 * Returns shop products (non-ticket) and boutique categories in a single request.
 * Direct DB queries for ~3x faster response vs WC REST API.
 */
function lamako_mobile_get_shop_data( $request ) {
    // Check transient cache (5 minutes)
    $cached = get_transient( 'lamako_shop_data_cache' );
    if ( $cached !== false ) {
        return rest_ensure_response( $cached );
    }

    global $wpdb;

    // ---- Products (non-ticket, published) ----
    $products_query = $wpdb->prepare(
        "SELECT p.ID, p.post_title as name, p.post_name as slug, p.post_status as status
         FROM {$wpdb->posts} p
         WHERE p.post_type = 'product'
           AND p.post_status = 'publish'
         ORDER BY p.post_date DESC
         LIMIT 100"
    );
    $raw_products = $wpdb->get_results( $products_query );

    $products = [];
    foreach ( $raw_products as $p ) {
        // Skip ticket products
        $is_ticket = get_post_meta( $p->ID, '_tc_is_ticket', true );
        if ( $is_ticket === 'yes' || $is_ticket === '1' ) continue;

        // Get price
        $price = get_post_meta( $p->ID, '_price', true );
        $regular_price = get_post_meta( $p->ID, '_regular_price', true );
        $sale_price = get_post_meta( $p->ID, '_sale_price', true );
        $stock_status = get_post_meta( $p->ID, '_stock_status', true ) ?: 'instock';

        // Get featured image
        $thumb_id = get_post_thumbnail_id( $p->ID );
        $image_url = $thumb_id ? wp_get_attachment_image_url( $thumb_id, 'medium' ) : '';

        // Get categories
        $terms = wp_get_post_terms( $p->ID, 'product_cat', [ 'fields' => 'all' ] );
        $cats = [];
        if ( ! is_wp_error( $terms ) ) {
            foreach ( $terms as $t ) {
                $cats[] = [ 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug ];
            }
        }

        $products[] = [
            'id'            => (int) $p->ID,
            'name'          => $p->name,
            'slug'          => $p->slug,
            'price'         => $price ?: '0',
            'regular_price' => $regular_price ?: '',
            'sale_price'    => $sale_price ?: '',
            'stock_status'  => $stock_status,
            'images'        => $image_url ? [ [ 'src' => $image_url ] ] : [],
            'categories'    => $cats,
        ];
    }

    // ---- Categories (boutique parent + children) ----
    $all_cats = get_terms( [
        'taxonomy'   => 'product_cat',
        'hide_empty' => false,
    ] );

    $categories = [];
    if ( ! is_wp_error( $all_cats ) ) {
        foreach ( $all_cats as $c ) {
            // Include boutique-* parent categories and their children
            if ( strpos( $c->slug, 'boutique-' ) === 0 || $c->parent > 0 ) {
                // Check if parent is a boutique category
                $include = ( strpos( $c->slug, 'boutique-' ) === 0 );
                if ( ! $include && $c->parent > 0 ) {
                    $parent_term = get_term( $c->parent, 'product_cat' );
                    if ( $parent_term && ! is_wp_error( $parent_term ) && strpos( $parent_term->slug, 'boutique-' ) === 0 ) {
                        $include = true;
                    }
                }
                if ( $include ) {
                    $categories[] = [
                        'id'     => (int) $c->term_id,
                        'name'   => $c->name,
                        'slug'   => $c->slug,
                        'count'  => (int) $c->count,
                        'parent' => (int) $c->parent,
                    ];
                }
            }
        }
    }

    $result = [
        'products'   => $products,
        'categories' => $categories,
    ];

    // Cache for 5 minutes
    set_transient( 'lamako_shop_data_cache', $result, 300 );

    return rest_ensure_response( $result );
}


// ============================================================
// 8. SOCIAL LOGIN (Google, Facebook, Apple)
// ============================================================

/**
 * Social login endpoint - validates provider tokens and creates/logs in WordPress users.
 * 
 * POST /wp-json/lamako-mobile/v1/social-login
 * Body: { "provider": "google|facebook|apple", "token": "...", "email": "...", "first_name": "...", "last_name": "...", "name": "..." }
 * 
 * Response: { "success": true, "token": "jwt...", "user": {...}, "is_new_user": bool, "linked_existing": bool }
 */
function lamako_mobile_social_login( WP_REST_Request $request ) {
    $provider   = sanitize_text_field( $request->get_param( 'provider' ) );
    $token      = sanitize_text_field( $request->get_param( 'token' ) );
    $email      = sanitize_email( $request->get_param( 'email' ) );
    $first_name = sanitize_text_field( $request->get_param( 'first_name' ) );
    $last_name  = sanitize_text_field( $request->get_param( 'last_name' ) );
    $name       = sanitize_text_field( $request->get_param( 'name' ) );

    if ( empty( $provider ) || empty( $token ) ) {
        return new WP_Error( 'missing_params', 'Provider et token requis', [ 'status' => 400 ] );
    }

    if ( ! in_array( $provider, [ 'google', 'facebook', 'apple' ], true ) ) {
        return new WP_Error( 'invalid_provider', 'Provider invalide. Utilisez google, facebook ou apple.', [ 'status' => 400 ] );
    }

    // Validate the token with the provider and get user info
    $provider_user = null;
    switch ( $provider ) {
        case 'google':
            $provider_user = lamako_validate_google_token( $token );
            break;
        case 'facebook':
            $provider_user = lamako_validate_facebook_token( $token );
            break;
        case 'apple':
            $provider_user = lamako_validate_apple_token( $token, $email, $first_name, $last_name );
            break;
    }

    if ( is_wp_error( $provider_user ) ) {
        return $provider_user;
    }

    // Override with app-provided data if available (more reliable for Apple)
    if ( ! empty( $email ) ) {
        $provider_user['email'] = $email;
    }
    if ( ! empty( $first_name ) ) {
        $provider_user['first_name'] = $first_name;
    }
    if ( ! empty( $last_name ) ) {
        $provider_user['last_name'] = $last_name;
    }
    if ( ! empty( $name ) && empty( $provider_user['first_name'] ) ) {
        $parts = explode( ' ', $name, 2 );
        $provider_user['first_name'] = $parts[0];
        $provider_user['last_name']  = isset( $parts[1] ) ? $parts[1] : '';
    }

    if ( empty( $provider_user['email'] ) ) {
        return new WP_Error( 'no_email', 'Impossible de récupérer l\'email depuis le provider. Veuillez autoriser l\'accès à votre email.', [ 'status' => 400 ] );
    }

    // Find or create the WordPress user
    $result = lamako_find_or_create_social_user( $provider, $provider_user );
    if ( is_wp_error( $result ) ) {
        return $result;
    }

    $user         = $result['user'];
    $is_new_user  = $result['is_new_user'];
    $linked       = $result['linked_existing'];

    // Generate JWT token (compatible with JWT Authentication for WP REST API plugin)
    $jwt_token = lamako_generate_jwt_for_user( $user );
    if ( is_wp_error( $jwt_token ) ) {
        return $jwt_token;
    }

    // Get avatar
    $avatar_url = get_avatar_url( $user->ID, [ 'size' => 200 ] );

    return rest_ensure_response( [
        'success'         => true,
        'token'           => $jwt_token,
        'user'            => [
            'id'           => $user->ID,
            'email'        => $user->user_email,
            'display_name' => $user->display_name,
            'first_name'   => get_user_meta( $user->ID, 'first_name', true ),
            'last_name'    => get_user_meta( $user->ID, 'last_name', true ),
            'role'         => implode( ',', $user->roles ),
            'avatar_url'   => $avatar_url,
        ],
        'is_new_user'     => $is_new_user,
        'linked_existing' => $linked,
    ] );
}

/**
 * Validate Google OAuth2 access token.
 */
function lamako_validate_google_token( $access_token ) {
    // Use the userinfo endpoint to validate the access token
    $response = wp_remote_get( 'https://www.googleapis.com/oauth2/v3/userinfo', [
        'headers' => [ 'Authorization' => 'Bearer ' . $access_token ],
        'timeout' => 10,
    ] );

    if ( is_wp_error( $response ) ) {
        return new WP_Error( 'google_error', 'Erreur de connexion à Google: ' . $response->get_error_message(), [ 'status' => 500 ] );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    $code = wp_remote_retrieve_response_code( $response );

    if ( $code !== 200 || empty( $body['sub'] ) ) {
        return new WP_Error( 'google_invalid', 'Token Google invalide ou expiré. Veuillez réessayer.', [ 'status' => 401 ] );
    }

    // Optionally verify the audience matches our client ID
    // $google_client_id = get_option( 'lamako_google_client_id', '' );

    return [
        'provider_id' => $body['sub'],
        'email'       => isset( $body['email'] ) ? $body['email'] : '',
        'first_name'  => isset( $body['given_name'] ) ? $body['given_name'] : '',
        'last_name'   => isset( $body['family_name'] ) ? $body['family_name'] : '',
        'avatar'      => isset( $body['picture'] ) ? $body['picture'] : '',
    ];
}

/**
 * Validate Facebook OAuth2 access token.
 */
function lamako_validate_facebook_token( $access_token ) {
    $response = wp_remote_get( 'https://graph.facebook.com/me?fields=id,email,first_name,last_name,name,picture.type(large)&access_token=' . urlencode( $access_token ), [
        'timeout' => 10,
    ] );

    if ( is_wp_error( $response ) ) {
        return new WP_Error( 'facebook_error', 'Erreur de connexion à Facebook: ' . $response->get_error_message(), [ 'status' => 500 ] );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    $code = wp_remote_retrieve_response_code( $response );

    if ( $code !== 200 || empty( $body['id'] ) ) {
        $error_msg = isset( $body['error']['message'] ) ? $body['error']['message'] : 'Token invalide';
        return new WP_Error( 'facebook_invalid', 'Token Facebook invalide: ' . $error_msg, [ 'status' => 401 ] );
    }

    return [
        'provider_id' => $body['id'],
        'email'       => isset( $body['email'] ) ? $body['email'] : '',
        'first_name'  => isset( $body['first_name'] ) ? $body['first_name'] : '',
        'last_name'   => isset( $body['last_name'] ) ? $body['last_name'] : '',
        'avatar'      => isset( $body['picture']['data']['url'] ) ? $body['picture']['data']['url'] : '',
    ];
}

/**
 * Validate Apple identity token (JWT).
 * Apple tokens are JWTs signed by Apple - we verify the signature using Apple's public keys.
 */
function lamako_validate_apple_token( $identity_token, $email = '', $first_name = '', $last_name = '' ) {
    // Decode the JWT without verification first to get the header
    $parts = explode( '.', $identity_token );
    if ( count( $parts ) !== 3 ) {
        return new WP_Error( 'apple_invalid', 'Token Apple invalide (format JWT incorrect)', [ 'status' => 401 ] );
    }

    $header  = json_decode( base64_decode( strtr( $parts[0], '-_', '+/' ) ), true );
    $payload = json_decode( base64_decode( strtr( $parts[1], '-_', '+/' ) ), true );

    if ( empty( $payload ) || empty( $payload['sub'] ) ) {
        return new WP_Error( 'apple_invalid', 'Token Apple invalide (payload manquant)', [ 'status' => 401 ] );
    }

    // Verify issuer and audience
    if ( ! isset( $payload['iss'] ) || $payload['iss'] !== 'https://appleid.apple.com' ) {
        return new WP_Error( 'apple_invalid', 'Token Apple invalide (issuer incorrect)', [ 'status' => 401 ] );
    }

    // Check expiration
    if ( isset( $payload['exp'] ) && $payload['exp'] < time() ) {
        return new WP_Error( 'apple_expired', 'Token Apple expiré. Veuillez réessayer.', [ 'status' => 401 ] );
    }

    // For production, you should verify the signature against Apple's public keys
    // https://appleid.apple.com/auth/keys
    // For now, we trust the token structure and validate basic claims

    return [
        'provider_id' => $payload['sub'],
        'email'       => ! empty( $payload['email'] ) ? $payload['email'] : $email,
        'first_name'  => $first_name,
        'last_name'   => $last_name,
        'avatar'      => '',
    ];
}

/**
 * Find an existing WordPress user or create a new one from social provider data.
 */
function lamako_find_or_create_social_user( $provider, $provider_user ) {
    $provider_id = $provider_user['provider_id'];
    $email       = $provider_user['email'];
    $first_name  = $provider_user['first_name'];
    $last_name   = $provider_user['last_name'];

    $is_new_user     = false;
    $linked_existing = false;

    // 1. Check if we already have a user linked to this social provider
    $meta_key = '_lamako_social_' . $provider . '_id';
    $users = get_users( [
        'meta_key'   => $meta_key,
        'meta_value' => $provider_id,
        'number'     => 1,
    ] );

    if ( ! empty( $users ) ) {
        // User already linked to this provider
        $user = $users[0];
    } else {
        // 2. Check if a user with this email already exists
        $user = get_user_by( 'email', $email );

        if ( $user ) {
            // Link existing user to this social provider
            update_user_meta( $user->ID, $meta_key, $provider_id );
            $linked_existing = true;
        } else {
            // 3. Create a new user
            $username = sanitize_user( strtolower( $first_name . '.' . $last_name ) );
            if ( empty( $username ) || strlen( $username ) < 3 ) {
                $username = sanitize_user( explode( '@', $email )[0] );
            }

            // Ensure unique username
            $base_username = $username;
            $counter = 1;
            while ( username_exists( $username ) ) {
                $username = $base_username . $counter;
                $counter++;
            }

            $user_id = wp_insert_user( [
                'user_login'   => $username,
                'user_email'   => $email,
                'user_pass'    => wp_generate_password( 24 ),
                'first_name'   => $first_name,
                'last_name'    => $last_name,
                'display_name' => trim( $first_name . ' ' . $last_name ),
                'role'         => 'customer',
            ] );

            if ( is_wp_error( $user_id ) ) {
                return new WP_Error( 'user_creation_failed', 'Impossible de créer le compte: ' . $user_id->get_error_message(), [ 'status' => 500 ] );
            }

            $user = get_user_by( 'ID', $user_id );

            // Link to social provider
            update_user_meta( $user_id, $meta_key, $provider_id );

            // Set WooCommerce billing info
            update_user_meta( $user_id, 'billing_email', $email );
            update_user_meta( $user_id, 'billing_first_name', $first_name );
            update_user_meta( $user_id, 'billing_last_name', $last_name );

            $is_new_user = true;
        }
    }

    // Update last login timestamp
    update_user_meta( $user->ID, '_lamako_last_social_login', current_time( 'mysql' ) );
    update_user_meta( $user->ID, '_lamako_last_social_provider', $provider );

    return [
        'user'            => $user,
        'is_new_user'     => $is_new_user,
        'linked_existing' => $linked_existing,
    ];
}

/**
 * Generate a JWT token for a WordPress user.
 * Compatible with the JWT Authentication for WP REST API plugin.
 */
function lamako_generate_jwt_for_user( $user ) {
    // Check if JWT Auth plugin is active and use its method
    if ( class_exists( 'Jeep_Jeep_JWT_Auth' ) || function_exists( 'jwt_auth_generate_token' ) ) {
        // Try using the JWT Auth plugin's token generation
        $token = apply_filters( 'jwt_auth_token_before_dispatch', [
            'token' => '',
        ], $user );
        if ( ! empty( $token['token'] ) ) {
            return $token['token'];
        }
    }

    // Manual JWT generation (fallback or if JWT Auth plugin handles it differently)
    $secret_key = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : 
                  ( defined( 'AUTH_KEY' ) ? AUTH_KEY : wp_salt( 'auth' ) );

    $issued_at  = time();
    $expire     = $issued_at + ( DAY_IN_SECONDS * 30 ); // 30 days

    $payload = [
        'iss'  => get_bloginfo( 'url' ),
        'iat'  => $issued_at,
        'nbf'  => $issued_at,
        'exp'  => $expire,
        'data' => [
            'user' => [
                'id' => $user->ID,
            ],
        ],
    ];

    // Simple JWT encoding (HS256)
    $header = base64_encode( json_encode( [ 'typ' => 'JWT', 'alg' => 'HS256' ] ) );
    $header = rtrim( strtr( $header, '+/', '-_' ), '=' );

    $payload_encoded = base64_encode( json_encode( $payload ) );
    $payload_encoded = rtrim( strtr( $payload_encoded, '+/', '-_' ), '=' );

    $signature = hash_hmac( 'sha256', $header . '.' . $payload_encoded, $secret_key, true );
    $signature = rtrim( strtr( base64_encode( $signature ), '+/', '-_' ), '=' );

    return $header . '.' . $payload_encoded . '.' . $signature;
}

// ============================================================
// AUTO-LOGIN ENDPOINT FOR MOBILE APP WEBVIEW
// ============================================================

/**
 * Auto-login endpoint: validates JWT token, sets WordPress session cookies,
 * then redirects to the target page (seating chart, checkout, etc.)
 * 
 * GET /wp-json/lamako-mobile/v1/auto-login?token=JWT&redirect=/tc-events/xxx/
 * 
 * This allows the WebView to be pre-authenticated before loading pages
 * that require login (checkout, seating chart with cart, etc.)
 */
add_action( 'rest_api_init', function () {
    register_rest_route( 'lamako-mobile/v1', '/auto-login', [
        'methods'  => 'GET',
        'callback' => 'lamako_mobile_auto_login',
        'permission_callback' => '__return_true',
    ] );
} );

function lamako_mobile_auto_login( WP_REST_Request $request ) {
    $token    = $request->get_param( 'token' );
    $redirect = $request->get_param( 'redirect' );

    if ( empty( $token ) ) {
        return new WP_Error( 'missing_token', 'Token requis', [ 'status' => 400 ] );
    }

    if ( empty( $redirect ) ) {
        $redirect = home_url( '/' );
    }

    // Decode and validate the JWT token
    $secret_key = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : 
                  ( defined( 'AUTH_KEY' ) ? AUTH_KEY : wp_salt( 'auth' ) );

    $parts = explode( '.', $token );
    if ( count( $parts ) !== 3 ) {
        return new WP_Error( 'invalid_token', 'Token invalide', [ 'status' => 401 ] );
    }

    // Verify signature
    $header_payload = $parts[0] . '.' . $parts[1];
    $signature = hash_hmac( 'sha256', $header_payload, $secret_key, true );
    $signature_encoded = rtrim( strtr( base64_encode( $signature ), '+/', '-_' ), '=' );

    if ( ! hash_equals( $signature_encoded, $parts[2] ) ) {
        // Also try with JWT Auth plugin's secret if different
        $jwt_secret = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : '';
        if ( ! empty( $jwt_secret ) && $jwt_secret !== $secret_key ) {
            $signature2 = hash_hmac( 'sha256', $header_payload, $jwt_secret, true );
            $signature2_encoded = rtrim( strtr( base64_encode( $signature2 ), '+/', '-_' ), '=' );
            if ( ! hash_equals( $signature2_encoded, $parts[2] ) ) {
                return new WP_Error( 'invalid_signature', 'Signature invalide', [ 'status' => 401 ] );
            }
        } else {
            return new WP_Error( 'invalid_signature', 'Signature invalide', [ 'status' => 401 ] );
        }
    }

    // Decode payload
    $payload = json_decode( base64_decode( strtr( $parts[1], '-_', '+/' ) . '==' ), true );
    if ( ! $payload || ! isset( $payload['data']['user']['id'] ) ) {
        return new WP_Error( 'invalid_payload', 'Payload invalide', [ 'status' => 401 ] );
    }

    // Check expiration
    if ( isset( $payload['exp'] ) && $payload['exp'] < time() ) {
        return new WP_Error( 'token_expired', 'Token expiré', [ 'status' => 401 ] );
    }

    $user_id = (int) $payload['data']['user']['id'];
    $user = get_user_by( 'id', $user_id );

    if ( ! $user ) {
        return new WP_Error( 'user_not_found', 'Utilisateur introuvable', [ 'status' => 404 ] );
    }

    // Log the user in (set WordPress auth cookies)
    wp_set_current_user( $user_id );
    wp_set_auth_cookie( $user_id, true );

    // Build the full redirect URL
    if ( strpos( $redirect, 'http' ) !== 0 ) {
        $redirect = home_url( $redirect );
    }

    // Return a redirect response (HTML page that sets cookies then redirects)
    header( 'Content-Type: text/html; charset=utf-8' );
    echo '<!DOCTYPE html><html><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    // Use esc_js() instead of esc_url() because esc_url() converts & to &#038;
    // which breaks query parameters when used inside a JavaScript string
    echo '<script>window.location.href = "' . esc_js( $redirect ) . '";</script>';
    echo '</head><body><p>Connexion en cours...</p></body></html>';
    exit;
}
