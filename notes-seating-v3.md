# POS Seating Chart Embed Approach

## How the POS plugin loads the seating chart:

1. The POS plugin has a `maybe_serve_embed()` method that intercepts `template_redirect`
2. When a `tc_seat_charts` post type page is loaded with `?lpos_embed=1`, it:
   - Outputs a minimal HTML document
   - Calls `wp_head()` / `wp_footer()` to load all Tickera scripts (Firebase, jQuery UI, etc.)
   - Hides all theme chrome via CSS
   - Renders `do_shortcode('[tc_seat_chart id="CHART_ID" show_legend="true"]')`
   - This renders the seating chart button and map container
   - User clicks the button → Tickera's jQuery handlers fire → seating map popup opens
   - Exit to prevent theme template from rendering

3. The POS gets the chart URL via AJAX:
   - `lamako_pos_get_seat_chart_url` action
   - Gets the `tc_seat_charts` post permalink
   - Adds `?lpos_embed=1` query param
   - Returns the URL

4. The POS loads this URL in an iframe

## For the mobile app:

The approach is the same:
1. We need to find the `tc_seat_charts` permalink for the event
2. Add `?lpos_embed=1` to get the clean embed version
3. Load it in a WebView

The key URL pattern is:
`https://www.ticketbylamako.com/tc_seat_charts/SLUG/?lpos_embed=1`

But we need to know the seat chart post slug/ID. The POS gets it via:
```php
get_posts([
  'post_type' => 'tc_seat_charts',
  'posts_per_page' => 1,
  'meta_query' => [
    ['key' => 'event_name', 'value' => $event_id, 'compare' => '=']
  ]
]);
```

For the mobile app, we can:
1. Use the WordPress REST API to query tc_seat_charts by event_name meta
2. Or use the event page URL but with better JS injection
3. Or add a custom REST endpoint to the lamako-mobile-fields plugin

Since the `?lpos_embed=1` hook is already on the live site (via the POS plugin), we just need to find the seat chart permalink.

## Testing:
- Seat chart ID for "test-seating-chart" event is 6946
- Try: https://www.ticketbylamako.com/?p=6946&lpos_embed=1
- Or find the tc_seat_charts permalink via REST API
