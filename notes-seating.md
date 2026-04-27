# Seating Chart Findings

The "Réservez vos billets maintenant" button on the event page opens a full-screen seating chart overlay/popup.
The popup shows:
- A visual map of tables/seats with color coding (green=available, red=reserved, yellow=in cart, blue=in other's cart)
- Bottom bar with "ACHETER" (buy) button and subtotal
- Zoom controls (-, +) at bottom left
- Legend at top left (Available, Reserved, In Cart, In Other's Cart)

The seating chart is triggered by clicking the button with class likely `tc_seating_map_button` or similar.
The popup appears as a full-screen overlay on the same page.

The current WebView approach loads the event page URL and tries to auto-click the button.
The issue is that the injected JS may not be finding the button properly, or the Tickera JS handlers aren't initialized when the auto-click fires.

## Better approach
Instead of trying to auto-click, load the event page in WebView and let the user click "Réservez vos billets maintenant" themselves. Hide the page chrome (header, footer, WhatsApp widget) so only the event content and the button are visible. When the seating chart opens, it will work naturally since the user triggered it.
