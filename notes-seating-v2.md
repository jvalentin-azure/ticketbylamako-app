# Seating Chart Architecture Analysis

## Key Finding
The seating chart is a **separate WordPress plugin** (`seating-charts`) that uses:
1. **Firebase Realtime Database** for real-time seat availability
2. **jQuery UI** for the interactive seat map
3. **AJAX** calls to `admin-ajax.php` for cart operations

## Shortcode
`[tc_seat_chart id="6946" button_title="..." show_legend="true" cart_title="..."]`

This renders:
- A `<button class="tc_seating_map_button" data-seating-map-id="6946">` button
- A `<div class="tc_seating_map tc_seating_map_6946" data-seating-chart-id="6946">` container
- The seating map is loaded dynamically via JS when the button is clicked

## JS Dependencies
- Firebase app + database (for real-time seat status)
- jQuery + jQuery UI (for the interactive map)
- Custom JS: `front.js`, `controls.js`, `front-woo.js`, `common.js`
- Cart JS: `tc-seat-charts-cart-front.js`

## Firebase Config
```json
{
  "apiKey": "AIzaSyB2a2utvhIxTp_ZIljkeJ94St1zmFH0b90",
  "authDomain": "seatingchartticket.firebaseapp.com",
  "databaseURL": "https://seatingchartticket-default-rtdb.firebaseio.com"
}
```

## AJAX Config
- URL: `https://www.ticketbylamako.com/wp-admin/admin-ajax.php`
- Firebase integration: enabled
- Colors: reserved=#93570d, in_cart=#663d17, others_cart=#0000c4

## Approach for Mobile App
The best approach is to load the event page in WebView and let the native Tickera/Seating Charts JS handle everything.

The issue was that `injectedJavaScript` runs AFTER page load, but the seating chart button click requires jQuery which binds events during page load.

**Solution**: Instead of trying to auto-click the button, we should:
1. Load the event page in WebView
2. Hide all page chrome (header, footer, etc.)
3. Show only the seating chart section
4. Let the user click the button themselves
5. The seating chart popup will open natively in the WebView

This is more reliable than trying to programmatically trigger jQuery events.
