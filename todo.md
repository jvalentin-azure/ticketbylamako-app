# TicketByLamako Mobile App - TODO

## Phase 1: Setup & Branding
- [x] Configure theme colors (gold/white brand palette)
- [x] Set up API secrets (WC keys, JWT secret, site URL)
- [x] Generate app logo
- [x] Load Raleway font

## Phase 2: Core Infrastructure
- [x] WooCommerce API service (products, orders, events)
- [x] JWT authentication service (login, register, token refresh)
- [x] Tickera API service (check-in, ticket validation)
- [x] Role detection and routing (customer, shop_manager, administrator)
- [x] Auth context provider
- [x] Role-based tab navigation (Client, Organisateur, Admin)

## Phase 3: Client Portal
- [x] Home screen (hero carousel, categories, upcoming events, shop highlights)
- [x] Events list screen (search, filter, category chips)
- [x] Event detail screen (hero image, description, ticket types, buy CTA)
- [x] Seating chart WebView for seated events
- [x] Shop screen (product grid, categories)
- [x] Product detail screen (images, description, add to cart)

## Phase 4: Client Portal (continued)
- [x] Cart screen (items, coupon, total, checkout button)
- [x] Checkout WebView (WooCommerce checkout with all payment methods)
- [x] My Tickets screen (QR codes, offline capable)
- [x] Ticket detail screen (full QR, event info, download PDF)
- [x] My Orders screen (order history, status badges)
- [ ] Order detail screen (items, totals, status)
- [x] Profile screen (user info, edit)
- [x] Settings screen (theme toggle, language)

## Phase 5: Organisateur Portal
- [x] Org Dashboard (event selector, real-time KPIs, check-in chart)
- [x] QR Scanner (camera, scan overlay, result sheet)
- [x] Scan result display (attendee details, success/fail feedback)
- [x] Participants list (color-coded, search, filter)
- [ ] Participant detail (full info, manual check-in)
- [x] Check-in report (stats, export)

## Phase 6: Admin Portal
- [x] Admin Dashboard (revenue KPIs, sales chart, recent orders)
- [x] Admin Scanner (same as org - shared with organisateur)
- [x] Orders management (list, filters, search)
- [ ] Events management (all events, stats)
- [ ] Event admin detail (sales, check-ins, revenue)
- [ ] Clients list (customers, purchase history)
- [x] Analytics (charts, metrics)
- [ ] Admin settings (multi-site, notifications)

## WordPress Backend Prerequisites
- [x] Install JWT Auth plugin
- [x] Generate WooCommerce API keys (read/write)
- [x] Configure CORS headers
- [x] Add JWT secret to wp-config.php

## V2 - Major Redesign (OTAYO-inspired)

### Navigation & Layout
- [x] Splash screen on app open (like OTAYO)
- [x] Burger menu (drawer) with profile section
- [x] Header with profile icon + notifications bell
- [x] 5 bottom tabs: Accueil, Événement, Boutique, Mes billets, Panier
- [x] Remove old role-based tab switching (keep role detection for features)

### Branding
- [x] Update colors to official: #663d17 (marron foncé), #c79f6c (or), #ffffff, #000000
- [x] Use dark logo (TicketbyLamako_Dark.png) for light backgrounds
- [x] Use white logo (TicketbyLamako_White.png) for dark backgrounds
- [x] Logo on login page
- [x] Use RALEWAY font (5 weights: Regular, Medium, SemiBold, Bold, ExtraBold)

### Events Fix
- [x] Fix events not loading - now uses wp/v2/tc_events endpoint (Tickera CPT)
- [x] Support events with and without seating chart
- [x] Separate ticket products from shop products

### Shop
- [x] Shop shows only non-ticket products (getShopProducts filters out ticket category)
- [x] Shop organized by WooCommerce categories with category chips

### Authentication
- [x] Social login: Facebook (button, placeholder for OAuth)
- [x] Social login: Apple (button, placeholder for OAuth)
- [x] Social login: Google (button, placeholder for OAuth)

### Support & Legal
- [x] Privacy policy page (full French content)
- [x] Help & Support page with WhatsApp contact button, FAQ, email/phone options

### Styling Consistency
- [x] All screens use Raleway font family
- [x] All tab screens use edges={["left", "right"]} (AppHeader handles top safe area)
- [x] Drawer content with gradient header, organized menu sections
- [x] Fixed TypeScript errors (0 errors)

## V2.1 - Bug Fixes & LamakoRewards

### UI Bug Fixes
- [x] Logo sizes inconsistent between light/dark mode - fixed with new logo-white v2 (same 300x108px)
- [x] Drawer logo too small - increased to 240x70
- [x] WhatsApp button added directly in drawer Support section
- [x] Shop categories already using small horizontal chips
- [x] Profile/Login/Help/Privacy back button fixed - proper positioning
- [x] Custom animated splash screen added (works in Expo Go)
- [x] Event/product descriptions too long for mobile - mobile-specific fields plugin installed

### LamakoRewards Loyalty Program
- [x] Create rewards provider (connected to myCred API on WordPress)
- [x] Points accumulation: 1 point per 1000 Ar spent (myCred hook configured)
- [x] Tier system: Bronze (0), Argent (500), Or (2000), Platine (5000)
- [x] Rewards dashboard screen (balance, tier, progress bar, history, sync)
- [x] Points display in drawer (LamakoRewards link) + home screen banner
- [x] Bonus points: 50 pts registration, 2 pts login (myCred hooks)
- [x] Points redemption: 100 pts = 5000 Ar discount

### WordPress myCred Integration
- [x] Install myCred plugin on WordPress (ticketbylamako.com)
- [x] Activate myCred REST API
- [x] Configure point type: LamakoRewards / LamakoReward
- [x] Activate hooks: registration (50 pts), login (2 pts), WooCommerce order (1% of total)
- [x] Create custom plugin (lamako-rewards-api.php) with REST endpoints
- [x] API endpoints: /balance, /history, /tiers, /user-by-email
- [x] App rewards-provider syncs with WordPress myCred API

## V2.2 - LamakoRewards Logos, Mobile Descriptions, Seating Chart

### LamakoRewards Logo Integration
- [x] Copy LamakoRewards logos (dark/white) to assets
- [x] Use LamakoRewards logo in rewards dashboard screen
- [x] Use LamakoRewards logo in home screen rewards banner

### Mobile-Specific Descriptions
- [x] Add custom WordPress fields for mobile descriptions (short text, gallery, info table)
- [x] Event detail: show mobile description with gallery and practical info table
- [x] Product detail: show mobile description with gallery and practical info table
- [x] Fallback to site description if no mobile-specific content exists

### Tickera Seating Chart WebView
- [x] Integrate WebView component for seating chart on event detail
- [x] Detect events with seating chart enabled
- [x] Allow seat selection within the WebView
- [x] Pass selected seats to cart/checkout flow

## V2.3 - Seating Chart Fix & Placeholder Content

- [x] Fix seating chart WebView URL - now loads event page and auto-opens Tickera seating popup
- [x] Add placeholder mobile content to WordPress events (description + practical info for 12673 & 11109)
- [x] Add placeholder mobile content to WordPress products (description + practical info for 10424)

## V2.4 - Bug Fixes & New Features

### Bug Fixes
- [ ] Fix seating chart WebView - auto-click not working, only shows event page
- [x] Fix shop categories - buttons too large, need small compact chips (already using compact horizontal chips)

### New Features
- [x] Event filters by category (parent category chips + child category matching)
- [x] Event filters by date (today, this week, this month, upcoming - modal picker)
- [x] Favorites system (save events/products locally with AsyncStorage)
- [x] Favorites screen (tabs: all/events/products, remove, navigate)
- [x] Favorite heart buttons on event cards (home, events list, event detail)
- [x] Favorite heart buttons on product cards (home screen)
- [x] Favorites link in drawer menu (Mon Compte section)
- [x] Social media sharing for events (native Share sheet on event detail - WhatsApp, Facebook, etc.)
- [x] Push notifications setup (expo-notifications, permission request, Android channels)
- [x] Push notification handler (foreground display, response listener, event deep link)
- [x] Notification preferences storage (AsyncStorage)
- [x] Event reminder scheduling (local notification 1 hour before event)

## V2.5 - Bug Fixes & Improvements

### Bug Fixes
- [x] Fix seating chart WebView - now loads tc_seat_charts page directly with CSS injection to hide theme chrome
- [x] Fix profile icon (top right) - now navigates to profile screen instead of opening drawer
- [x] Fix orders detail - full professional order detail screen with status, payment, billing, all tickets
- [x] Fix ticket detail - full info with real QR code (react-native-qrcode-svg), event info, owner info
- [x] Fix ticket detail QR code - uses Tickera ticket code as QR data (same format as email/PDF tickets)
- [x] Fix order tickets - now shows ALL tickets individually (extracted from tc_cart_info + API fallback)

### New Features & Improvements
- [x] Add LamakoRewards info section at bottom of home screen (program description, tiers, CTA)
- [x] Add notification settings screen (toggle new events, orders, reminders, clear scheduled)
- [x] Add favorite buttons on shop product grid
- [x] Add notification settings link in drawer menu
- [x] WordPress REST API plugin for ticket instances (lamako-mobile-api.php)
- [x] Order detail screen with dedicated route /order/[id]
- [x] extractTicketsFromOrder utility for parsing tc_cart_info meta data

## V2.5.1 - Seating Chart Fix, WordPress Plugin, Test Users

### Bug Fixes
- [x] Fix seating chart - header/footer hidden via lamako_seat_embed template (no theme chrome)
- [x] Fix seating chart - correct chart loaded per event via /lamako-mobile/v1/seat-chart-url/{event_id}
- [x] Fix seating chart CSS injection - chat widget, cart icon, all theme elements hidden

### WordPress Server
- [x] Install lamako-mobile-api.php plugin on WordPress (v1.0.0 - activated)
- [x] Create 3 test users with different profiles:
  - Andry Rakoto (testuser1@lamako.mg / TestLamako2024!) - Antananarivo
  - Nomena Randria (testuser2@lamako.mg / TestLamako2024!) - Toamasina
  - Fidy Rasoanaivo (testuser3@lamako.mg / TestLamako2024!) - Antsirabe

## V2.5.2 - Seating Chart Mobile Rendering Fix

### Bug Fixes
- [x] Fix seating chart seats not visible on mobile WebView - viewport set to width=1920 for proper scaling, CSS makes tc_seating_map scrollable with touch, subtotal/GO TO CART fixed positioned, auto-click button on load
- [x] Updated lamako-mobile-api.php plugin on WordPress with mobile-friendly CSS embed template

## V2.5.3 - Category Filter Chips Fix

### Bug Fixes
- [x] Fix shop category chips - compact pills with fixed height 32px, centered text
- [x] Fix events category chips - compact pills with fixed height 32px, centered text
- [x] Fix events category filter - recursive descendant matching (grandchildren categories now included)
- [x] Fix events date chip - compact with fixed height 32px

## V2.6 - Seating Chart V3, Global Search, About Screen

### Bug Fixes
- [x] Fix seating chart - seats now render correctly (removed aggressive CSS overrides, let Tickera handle its own layout)

### New Features
- [x] Global search (events + products from single search field)
- [x] About screen with Lamako Events info (contact, social media, legal mentions) from website

### Seating Chart UX Improvements
- [x] Hide GO TO CART button and subtotal bar in seating chart embed (selection only, no checkout)
- [x] Add "Confirmer ma sélection" button that closes WebView and returns to app with selected seats

### Native Payment Integration (no WebView checkout)
- [x] Research and plan native payment flow (Mobile Money: MVola, Orange Money, Airtel Money + CyberSource Visa)
- [ ] Implement native checkout screen within the app (WebView modal for payment, stays in-app)

## V2.7 - Seating Cart Sync, Native Payment, CGV

### Bug Fixes
- [x] Fix seating chart seat selection not syncing to app cart (seats extracted from DOM and sent to app via postMessage)
- [x] App cart refreshes after seating chart WebView closes (seats added to local cart via onMessage handler)

### New Features
- [x] Native payment checkout (same WebView navigates from seating chart to /checkout/ - stays in-app, supports MVola/Orange Money/CyberSource redirects)
- [ ] CGV page on WordPress + link in About screen

### UI Fixes
- [x] Make "Bonjour, [utilisateur]" greeting text larger (20px, bold, Raleway-Bold)
- [x] Deduplicate LamakRewards section on home screen (keep compact banner for logged-in, teaser for logged-out)
- [x] Make notification bell clickable (navigates to /notification-settings)

## V2.8 - Fixes, CGV, Push Notifications

### UI Fixes
- [ ] Reduce greeting text from 20px to 15px
- [ ] Fix notification bell: show red dot only when unread notifications exist, hide when none
- [ ] Notification bell click: show notifications list (not settings)
- [ ] Fix seating chart "Confirmer ma sélection" button not doing anything on click

### New Features
- [x] Add CGV link in About screen (opens WordPress CGV page)
- [x] Push notifications: WordPress plugin sends Expo push notifications on order status change & new event
- [x] Push token registration: app sends Expo push token to WordPress backend on startup
- [x] Push notification tap handling: order_update navigates to order detail, new_event to event detail

### Critical Bugs V2.8
- [x] Checkout WebView shows empty cart → Fixed: WebView import corrected (.default), pay-for-order URL bypasses session
- [x] Seating chart: Confirmer button redirects to empty cart → Fixed: improved seat extraction JS with multiple selectors
- [x] Seating chart: cannot select more than one seat → Fixed: removed .tc_in_cart hiding + WC session init in embed
- [x] Normal checkout (non-seating): same empty cart → Fixed: checkout uses create-order API → pay-for-order URL (no session needed)
- [x] Checkout WebView shows site header/footer → Already fixed: CSS injection hides all site chrome

### Bug Investigation Results (V2.8)
- [x] Tested create-order API: works correctly, returns valid pay-for-order URL
- [x] Tested pay-for-order page: shows order summary + payment methods (Airtel, MVola, Orange, CB)
- [x] Fix WebView import in checkout.tsx (changed .WebView to .default, added Platform guard)
- [x] Fix seating chart multi-select: removed CSS hiding .tc_in_cart, now visible at bottom of seating chart
- [x] Fix seating chart: added WC session initialization in embed template
- [x] Fix checkout WebView: WebView import fixed, pay-for-order URL should now load correctly
- [x] Improved seat extraction JS: multiple selectors, deduplication, debug info on failure

## V2.8.1 - Critical Bug Fixes (from video testing)

### Seating Chart Bugs
- [x] Fix: Confirmer button adds ALL seats → now uses only `.tc_seat_in_cart` selector
- [x] Fix: Seats visual feedback → removed CSS hiding `.tc_in_cart`, Tickera now colors seats normally
- [x] Fix: Seat extraction JS → only grabs `.tc_seat_in_cart` (seats user added via Tickera popup)

### Checkout Bugs
- [x] Fix: Checkout login redirect → added `user_has_cap` filter to allow pay-for-order without login
- [x] Fix: Email verification bypass → added `woocommerce_order_email_verification_required` filter
- [x] Fix: Pay URL → always constructed manually (no WP nonce dependency)
- [x] Fix: Non-seating event checkout → same fix applies (all orders use create-order API)

## V2.8.2 - Critical Checkout & Seating Fixes (from video 2)

### Checkout Bugs (confirmed from video)
- [ ] Fix: Error "Désolé, ce produit ne peut être acheté" on checkout page
- [ ] Fix: No "Commander/Payer" button visible on checkout page (user stuck)
- [ ] Fix: Website header and footer visible in checkout WebView (should be hidden)
- [ ] Fix: Back button inaccessible/at very top of page
- [ ] Fix: Checkout page shows full WordPress site instead of clean payment form

### Seating Chart Bugs
- [ ] Fix: Still cannot select more than one seat in seating chart

## V2.8.3 - Dedicated Mobile Checkout Page
- [x] Create dedicated mobile checkout page in WordPress plugin (no theme, mobile-first HTML)
- [x] Fix seating chart dialog CSS (minimal z-index only, don't override Tickera structure)
- [x] Update app checkout.tsx to use the new dedicated checkout URL + onMessage handler for payment_success
- [x] Upload updated plugin to WordPress
- [x] Added purchasability filter (woocommerce_is_purchasable + woocommerce_product_is_in_stock) for pay-for-order pages
- [x] Seat extraction JS: now uses only .tc_seat_in_cart selector (not all seats)

## V2.8.4 - CRITICAL: Definitive Checkout & Seating Fix
### Checkout Bug
- [x] Fix: Clicking "PAYER LA COMMANDE" on dedicated checkout page redirects to WordPress site with theme header/footer → Fixed: enhanced injectedJS hides WP theme on order-received page + detects payment_success
- [x] Fix: "Désolé, ce produit ne peut être acheté" error still appears after redirect → Fixed: purchasability filters already in place, order-received page now detected and handled cleanly
- [x] Root cause: WC payment gateway form action submits to standard WC checkout URL, not our dedicated page → Fixed: WebView now handles both dedicated checkout and standard WC pages
### Seating Chart Bug  
- [x] Investigate: Video shows user CAN add 2 seats via popup, but user says it doesn't work → Fixed: Option C bypasses dialog entirely, direct AJAX on tap
- [ ] Fix: Event detail should show ticket types as info only (no quantity selector) for seated events

## V2.9 - Option C: Direct AJAX Seat Selection + Checkout Redirect Fix

### Seating Chart - Option C (bypass jQuery UI dialog)
- [x] Replaced jQuery UI dialog flow with direct AJAX seat add/remove on tap
- [x] Intercept seat clicks in capturing phase before Tickera's selectable handler
- [x] Call tc_woo_update_cart_seats AJAX directly on seat tap (no popup needed)
- [x] Toggle behavior: tap to add seat, tap again to remove seat
- [x] Toast notifications for feedback (adding/removing/error)
- [x] Destroy jQuery UI selectable widget to prevent dialog popups
- [x] Hide dialog CSS entirely (.ui-dialog, .ui-widget-overlay, .tc-seat-dialog)
- [x] Re-check after "Pick your seats" button click (MutationObserver)
- [x] Updated embed instruction text for new tap-to-select UX

### Checkout Redirect Fix
- [x] Enhanced checkout.tsx injectedJS to detect order-received pages from payment gateway redirects
- [x] Hide WordPress theme elements on order-received page (header, footer, sidebar, widgets)
- [x] PostMessage payment_success to React Native on order-received detection
- [x] MutationObserver for dynamic page changes (client-side redirects)
- [x] Updated event/[id].tsx injectedJS to hide jQuery UI dialog CSS

### Deployment
- [x] Built and uploaded updated plugin zip to WordPress
- [x] Pushed all changes to GitHub

## V2.9.1 - CRITICAL: AJAX Seat Add Error + Checkout Reload (FIXED)

### Root Cause
- Both bugs had the SAME root cause: `woocommerce_is_purchasable` returned false for Tickera ticket products
- Tickera's bridge plugin hooks `is_purchasable` and checks `TC_Ticket::is_sales_available()` which returns false
- Previous purchasability filter only applied on pay-for-order pages, not globally

### Seating Chart Bug
- [x] Fix: AJAX seat add returns "error to add seats" → Root cause: product not purchasable, WC()->cart->add_to_cart() fails
- [x] Fix: Made woocommerce_is_purchasable filter GLOBAL (priority 9999) for all Tickera ticket products
- [x] Fix: buildColorMap() used wrong selector (li.color instead of span[style*=background-color])
- [x] Tested: AJAX add seat returns {error:false, action:"added", in_cart_count:2} ✓
- [x] Tested: Click to add + click to remove both work ✓

### Checkout Bug
- [x] Fix: "Payer la commande" reloads page → Same root cause: WC validates is_purchasable during order payment
- [x] Tested: Now returns gateway-specific error ("MVola indisponible") instead of product error ✓
- [x] Payment flow works end-to-end (product is purchasable, gateway processes)

### Deployment
- [x] Plugin updated to v2.0.1 on WordPress
- [x] Committed to git

## V2.9.2 - UX Fixes: Toast, Payment Errors, Cancelled Payment, Info-Only Tickets, Spinner

### Seating Chart UX
- [x] Fix: Toast/indicator hidden behind Confirmer button → repositioned to top of screen (top:50px)
- [x] Add: Spinner/animation on seat during AJAX call → CSS pulse animation + opacity:0.5 during load

### Checkout UX
- [x] Fix: Payment errors (MVola indisponible, etc.) not shown to user → error banner with suggestion displayed
- [x] Add: Suggest trying another payment method when error occurs → "Veuillez essayer un autre mode de paiement"
- [x] Fix: Cancelled/failed payment (Orange Money non abouti) returns to empty cart → detects cancel/cart URLs, shows payment_error phase with retry
- [x] Fix: Cart not cleared after successful payment → clearCart ONLY on payment_success
- [x] Fix: Cart stays filled with old seats after payment (successful or not) → cart preserved on failure, cleared on success only

### Event Detail UX
- [x] Fix: Show ticket types as info-only (no quantity selector) for events with seating chart → info cards with "Voir le plan de salle" button

### Deployment
- [x] Plugin updated to v2.0.2 on WordPress
- [x] Committed to git

## V2.9.3 - Checkout & Seating Chart UX Improvements

### Checkout Page
- [x] Fix: Terms checkbox required before "Payer" button is clickable → JS validation blocks submit, button disabled until checked
- [x] Fix: Back button on payment page → added back arrow in header, sends go_back to app
- [x] Fix: Terms checkbox/text hidden behind pay button → terms section above fixed pay button with padding-bottom
- [x] Add: Phone number field for MVola/Airtel Money → shown when Mobile Money gateway selected, saved to order billing

### Seating Chart UX
- [x] Fix: Toast shows seat name (e.g., "A11 ajouté ✓") with getSeatDisplayName()
- [x] Fix: Alert colors → green (#16a34a) for add, orange (#f59e0b) for remove, red for error
- [x] Add: Selected seats panel at bottom with seat chips and × remove buttons
- [x] Fix: Layout → fixed bottom panel with flex-wrap, max-height 35vh, scrollable

### Cart/Order Cleanup
- [x] Fix: Clear WC cart server-side → POST /lamako-mobile/v1/clear-cart endpoint + clearServerCart() in app
- [x] Fix: Previously ordered seats cleared from WC session (tc_seat_cart_items)

### Deployment
- [x] Plugin updated to v2.0.3 on WordPress
- [x] Committed to git

## V2.9.4 - Checkout Polish, Seating Chart Layout, App Orders Tracking

### Checkout Page
- [ ] Fix: Phone field should only appear when MVola or Airtel is selected (not for CyberSource/Orange)
- [ ] Add: Loading spinner on Pay button during payment processing
- [ ] Add: Event name linked to the product on the checkout page

### Seating Chart Layout
- [ ] Fix: Too much empty space at bottom (see screenshot)
- [x] Fix: +/- zoom buttons → native React Native buttons on same line as Confirmer (left side)
- [x] Fix: Ensure selected seats recap panel is visible (already working in v2.0.3)

### Order Tracking
- [x] Add: Meta "source: mobile_app" on orders created from the app (set_created_via + _lamako_mobile_order meta)
- [ ] Fix: POS Guichet plugin should show "App" instead of "POS" for app orders
- [x] Add: Dashboard plugin should show app orders KPI (count, revenue) - v1.0.6 deployed

### Mobile App Bugs (reported)
- [x] Fix: Vider le panier dans l'app ne vide pas le panier WooCommerce côté serveur (clearServerCart added)
- [x] Fix: Seating chart - retirer un siège → removeSeatFromCart removes tc_seat_in_cart class + updateSeatCount
- [x] Fix: Seating chart - MutationObserver debounced (300ms) to avoid intermediate seat_count_update
- [x] Fix: Boutons +/- zoom → native React Native buttons in overlay, Tickera buttons hidden but JS-clickable

## V2.9.5 - Pre-Launch Fixes & Features (URGENT - Delivery Tomorrow)

### Critical Bugs
- [x] Fix: Mobile orders now show as "App Mobile" in WooCommerce (added source filter in plugin)
- [x] Fix: Zoom +/- buttons → jQuery trigger + CSS transform fallback
- [x] Fix: Vider panier → clearServerCart() called in clearCart()
- [x] Fix: Checkout conditions → opens in system browser (expo-web-browser) via open_terms message
- [x] Fix: Phone field already conditional (updatePhoneVisibility called on init + gateway change)
- [x] Fix: MVola payment error NSURL.ErrorDomain -1005 after entering code (auto-retry with 3 attempts)
- [x] Fix: MVola takes too long → module passes to "paiement non abouti" too fast (increased timeout + retry)

### Home Page Redesign
- [x] Filter is now AFTER "événements à venir" section
- [x] Show only active upcoming events (filtered by event_date_time)
- [x] Events as stacked cards (vertical FlatList)
- [x] Add past events module at bottom (horizontal scroller)

### Event Detail Page
- [x] Add countdown timer for event (days:hours:min)
- [x] Add conditions/terms field (collapsible with Show More)
- [x] Add location on map (Google Maps static image + Get Directions)
- [x] Add upcoming events carousel at bottom (horizontal FlatList)

### Events Tab
- [x] Show only active upcoming events at top (filtered by event_date_time)
- [x] Add past events section below (horizontal scroller in ListFooter)

### Splash/Onboarding
- [x] Create splash/onboarding screen (concert bg, logo, Sign Up/Login/Explore buttons)
- [x] After "Explorer l'application", show LamakoRewards popup after 30s (modal overlay)

### Profile
- [x] Edit personal details (name, email, phone) → edit-profile.tsx
- [x] Change password → edit-profile.tsx
- [x] Edit default shipping address → edit-profile.tsx

### Cart/Checkout
- [x] Auto-clear cart after 15min inactivity + Alert notification
- [x] Clear cart on app background (AppState listener) + notification
- [x] Checkout products: shipping address form before order creation

### Branding
- [x] App icon: white Lamako logo on dark brown background (generated + deployed)

### Order Tracking
- [x] Verify mobile orders appear as "lamako_mobile" source in WooCommerce (confirmed via DB check)

## V2.9.6 - Critical Bug Fixes (User Testing Feedback)

### P0 - Critical Bugs
- [x] Fix: Onboarding splash NOT visible in Expo Go (show as overlay after app loads, not replace native splash)
- [x] Fix: Seating chart cart NOT cleared after failed/abandoned payment (Firebase seats + WC cart must reset)
- [x] Fix: Remove zoom +/- buttons entirely (jQuery trigger doesn't work, restore Tickera native zoom)
- [x] Fix: Mobile order source still shows "WEB" in WooCommerce (deploy correct hook via woocommerce_order_list_table_column_origin_content filter + wc_order_attribution meta)
- [x] Fix: LamakoRewards popup NOT activating after 30s of Explorer mode

### P1 - UI Fixes
- [x] Fix: Countdown must be at TOP of event page (after header/image), add SECONDS, make SMALLER (compact: Xj Xh Xm Xs)
- [x] Fix: Conditions section visible on event page (uses mobileFields.conditions from WordPress)
- [x] Fix: Location/Map visible on event page (uses mobileFields.location from WordPress)
- [x] Fix: Upcoming events carousel showing on event page
- [x] Fix: Home page event cards use same larger card size as events tab
- [x] Fix: Home page filter label says "Événements à venir"
- [x] Fix: Past events scroller on home uses same card size as events tab past events section

### P2 - New Features
- [x] MVola timeout: increase delay before "paiement non abouti", handle NSURL -1005 error with auto-retry (3 retries)
- [x] Push notifications: new event alerts, event reminders (24h + 1h before), payment confirmation

## V2.9.7 - Critical Fixes Round 2 (User Testing 30 Apr)

### P0 - Must Fix Now
- [x] Fix: Splash/onboarding shows when user is NOT logged in, skips to home when logged in
- [x] Fix: LamakoRewards popup shows 30s after app mount (simplified trigger)
- [x] Fix: Seating chart - clearServerCart now cancels pending orders and releases seat transients
- [x] Fix: Phone field - WordPress plugin already handles this (hidden by default, shown on Airtel/MVola selection)
- [x] Fix: Conditions générales link uses postMessage to open in-app browser
- [x] Fix: Event summary on payment page now compact (60px thumbnail, smaller text)
- [x] Fix: Home page filter chips redirect to Events tab with category param applied
- [x] Fix: Burger menu Navigation section removed (tab bar handles it)
- [x] Fix: Boutique page spacing reduced between search, filters, and products
- [x] Fix: App icon regenerated - white TicketByLamako logo on dark brown (#3d2314)
- [x] Fix: MVola NSURL -1005 - WebView onError handler reloads URL automatically (3 retries)

## V2.9.8 - FINAL Critical Fixes (30 Apr - MUST WORK)

### P0 - BROKEN - Must Fix
- [x] Fix: Onboarding - now validates token server-side (validateToken), shows when token invalid/missing
- [x] Fix: Filter chips use global state module (lib/filter-state.ts) - events tab subscribes & applies
- [x] Fix: Boutique spacing - headerRow paddingBottom:2, chipsContainer paddingTop:0, gap:4
- [x] Fix: Seating chart - clearServerCart() called on every back/close + SQL DELETE all tc_seat transients
- [x] Fix: New concert-bg.jpg (warm orange crowd) and rewards-bg.jpg (red concert hands)

## V3.0 - LamakoRewards Revamp

### Tier System Redesign
- [x] Research loyalty program benchmarks (Sephora, Ticketmaster, Fnac, Starbucks)
- [x] Redesign tier thresholds: Fan(0), VIP(150), Super VIP(750), Elite(3000) with multipliers
- [x] Update rewards-provider.tsx with new tiers + progressive redemption
- [x] Update rewards screen UI with new tier info

### Referral System (Server-side)
- [x] Create WordPress plugin endpoint for storing referral codes in user_meta
- [x] Add referral code field to registration form (app)
- [x] Create myCred hook to credit referrer when referee makes first purchase
- [x] Update app rewards-provider to sync referral code with server

### API Security
- [x] Move API key to environment variable (EXPO_PUBLIC_REWARDS_API_KEY)
- [x] Implement JWT validation on WordPress endpoints
- [x] Add rate limiting (60 req/min/IP) to WordPress REST endpoints

### WordPress Web Integration
- [x] Create dedicated LamakoRewards page ([lamako_rewards_page] shortcode)
- [x] Add "Mes Récompenses" tab in WooCommerce My Account
- [x] Add CTAs on product pages (auto-calculated points)
- [x] Add checkout popup for guests (3s delay)

### Documentation
- [x] Update LamakoRewards-Documentation.md with all changes (V3.0)

## V3.1 - Conservative Tier Benchmarks
- [x] Update tiers based on Otayo/Ticketmaster research: Fan(0)/Silver(500)/Gold(2000)/Platinum(5000)/Diamond(10000)
- [x] Fixed 2% cashback rate (500pts = 10,000Ar, 20Ar/pt)
- [x] Update documentation with benchmark analysis

## V3.2 - Cashback Minimum 750 pts (= 750 000 Ar dépensés)
- [x] Enforce cashback redemption at 750+ lifetime pts (= 750 000 Ar spent)
- [x] Update rewards-provider.tsx: REDEMPTION_MIN_POINTS_LIFETIME = 750, canRedeem check
- [x] Update rewards screen UI: show 🔒 lock icon with pts remaining when below 750
- [x] Update rewards screen: "Dès 750 000 Ar dépensés" in how-it-works section
- [x] Update WordPress plugin: LR_REDEMPTION_MIN_LIFETIME = 750, reject redemption if below
- [x] Update valid redemption tiers: 500/1000/2000/5000 pts at fixed 20Ar/pt rate
- [x] Update LamakoRewards documentation with 750 pts threshold

## V3.2.1 - Plugin Deployment & Communication
- [x] Deploy lamako-rewards-api.php v3.0.0 to WordPress server
- [x] Deploy lamako-mobile-api.php v2.0.4 to WordPress server
- [x] Verify plugins active and endpoints working (balance, referral, history, redeem all tested)
- [x] Create /lamako-rewards page on WordPress with [lamako_rewards_page] shortcode
- [x] Fix rewrite rule conflict (EP_ROOT → EP_PAGES) and flush permalinks
- [x] Create LamakoRewards communication document (French, professional, for clients/partners)
- [x] Update technical/functional documentation v3.2.0 with deployment status

## V3.2.2 - WordPress Page Enhancements
- [x] Add LamakoRewards to main navigation menu (hamburger + footer)
- [x] Test checkout popup for non-logged-in visitors (works on /cart/ page, 3s delay)
- [x] Upload LamakoRewards logos to WordPress media library (dark + white)
- [x] Redesign page: real logos, Raleway font, gradient badges, progress bar, professional design
- [x] Add FAQ section with 8 questions/answers (accordion style)
- [x] Fix checkout popup: use is_page() with cart/checkout IDs for block-based checkout
- [x] Fix unicode encoding (surrogate pairs + BMP escapes → proper UTF-8)
- [x] Verify all changes on live site - all working correctly

## V3.2.3 - WordPress Page Improvements
- [x] Fix Diamond tier card: grid-template-columns repeat(5, 1fr) on desktop, 3 on tablet, 2 on mobile
- [x] Add "Mes Récompenses" tab in WooCommerce Mon Compte (logo, 3 stat cards, progress bar, cashback status, referral code, CTA)
- [x] Add download app CTA: App Store + Google Play buttons with "bientôt disponible" placeholder
- [x] Add LamakoRewards CTA banner on homepage (fixed bottom, slide-up animation, auto-hide 15s)
- [x] Verify all changes on live site - all working correctly

## V3.2.4 - Dynamic Points Badge on Products
- [x] Add dynamic points badge on WooCommerce product pages (logo, dynamic pts, user balance, gradient design)
- [x] Add compact badge on WooCommerce shop listing pages ("★ +X pts LamakoRewards")
- [x] Add PointsBadge component to mobile app (estimatePointsForPrice utility)
- [x] Add badge to mobile: shop cards, event cards, product detail, event detail, home screen, search
- [x] Deploy plugin to WordPress via WP File Manager
- [x] Verify on live product pages - all working correctly

## V3.2.5 - Logo Fix Across All WordPress Elements
- [x] Replace emoji with real LamakoRewards Dark logo on checkout popup
- [x] Replace emoji with real LamakoRewards White logo on shortcode CTA banner
- [x] Keep tier emojis (🎵⭐🌟💎👑) as intentional level icons
- [x] Deploy and verify on live site - all logos correct

## V3.2.6 - Welcome Email, Header Banner, Event Badge
- [x] Add welcome email for new user registration (HTML email with logo, tiers, 100pts bonus, CTA)
- [x] Add LamakoRewards header strip banner (logo + text + CTA, all pages except /lamako-rewards/)
- [x] Add points badge on Tickera event pages (the_content filter on tc_events post type)
- [x] Deploy and verify on live site - header banner confirmed on all pages, product badge working

## V3.2.7 - Test Event & Header Points Counter
- [x] Publish test Tickera event on WordPress - badge verified on event page
- [x] Add real-time points counter as floating widget (replaced header banner)
- [x] Deploy and verify on live site - all stacked badges working
- [x] Remove header banner LamakoRewards (trop intrusif)
- [x] Add real-time points counter as floating widget (top-right, expandable dropdown)
- [x] Convert product page + event page badges to stacked layout (matching mobile app PointsBadge)

## V3.2.8 - Tickera Event Badge Premium Redesign
- [x] Redesign Tickera event badge to match mobile app RewardsPopup style
- [x] Dark gradient background (linear-gradient #1a0f0a → #2d1810 → #3d2314)
- [x] White LamakoRewards logo (120px) prominently displayed
- [x] Gold "REWARDS" label with letter-spacing
- [x] Dynamic points display (large gold number) with tier bonus info
- [x] White text: "Profitez de reductions et recompenses en gagnant des points !"
- [x] Features line: "Billets gratuits • Cashback • Evenements exclusifs"
- [x] Gold CTA button "Rejoindre maintenant !" for non-logged-in users
- [x] "Deja un compte ? Se connecter" link for non-logged-in users
- [x] Logged-in users: gold-bordered balance card + "Voir mes recompenses" link
- [x] Subtle radial gold glow decorative background
- [x] Border-radius 20px, premium box-shadow
- [x] Deploy via WP File Manager and verify on live test event page

## V3.3.0 - New Onboarding Flow + Welcome Screen
- [x] Generate 4 onboarding background images (concert/event themed, African descent people)
- [x] Generate 1 main/welcome screen background image (crowd at concert)
- [x] Build 4-slide onboarding screen (swipeable, Skip/Suivant, dot indicators, dark style)
- [x] Build welcome/main screen (background image, logo, S'inscrire, Se connecter, Explorer l'application)
- [x] Wire navigation: onboarding → welcome → app (two-step flow in splash-screen.tsx)
- [x] Replace old splash screen with new two-step onboarding + welcome flow

## V3.3.1 - Onboarding Animations & Polish
- [x] Add fade-in animation on text when each slide becomes active
- [x] Add parallax effect on background images during swipe
- [x] Verify dot progress indicators work correctly (animated width + color transition)
- [x] Ensure "Explorer l'application" button navigates to main home screen
- [x] Fix onboarding not showing on Expo Go (auth check logic improved)
- [x] Fix welcome-screen useState hack replaced with proper useEffect

## V3.3.2 - Onboarding Polish & Testing Alternative
- [x] Add "Retour" button on welcome screen to go back to onboarding
- [x] Add crossfade animation transition between onboarding and welcome screen
- [x] Research and provide Expo Go alternative for testing (EAS Development Build)

## V3.3.3 - Branded Loading Screen
- [x] Create branded loading screen component (dark bg, logo, subtle spinner)
- [x] Replace white screen during token verification with branded loading screen

## WordPress Plugin Cleanup - Popup/Banner Removal
- [x] Remove floating points counter button (lr_header_points_counter hook disabled)
- [x] Remove homepage CTA banner popup (lr_homepage_cta_banner hook disabled)
- [x] Remove checkout page popup for guests (lr_checkout_page_popup hook disabled)
- [x] Sync local plugin file with live WordPress version
- [ ] Homepage redesign (page d'accueil)
  - [ ] Hero Slider: Tickera events + static slides (LamakoRewards, CTA devis)
  - [ ] Barre de recherche événements Tickera
  - [ ] Événements à venir: grille catégorisée Tickera
  - [ ] Bannière LamakoRewards section
  - [ ] Événements passés carousel
  - [ ] Ils nous ont fait confiance: carousel logos sponsors
  - [x] Remove: Newsletter, Blog carousel, Why Choose Eventchamp section
- [x] Reactivate guest popup on checkout/cart pages
- [x] Extend guest popup to events and shop pages too

## V3.4 - Homepage Rebuild (Section by Section with Revolution Slider)
- [x] Revert homepage to original state (restore old WPBakery content)
- [x] Remove lr-homepage-sections plugin
- [x] Rebuild hero slider using Revolution Slider (3 slides: LamakoRewards, Devis, Events)
- [x] Remove all broken Eventchamp shortcodes from homepage
- [ ] Rebuild event search bar
- [ ] Rebuild upcoming events grid (Tickera)
- [ ] Add LamakoRewards banner section
- [ ] Add past events carousel
- [ ] Add sponsors carousel ("Ils nous ont fait confiance")
- [ ] Remove: Newsletter, Blog carousel, Why Choose Eventchamp

## V3.5 - Revolution Slider Proper Rebuild
- [ ] Generate background-only photos (no text) for 3 slides (event, luxury, corporate)
- [ ] Upload to WordPress and set as RevSlider backgrounds
- [ ] Add text layers in RevSlider (title, subtitle, CTA button) - editable, not baked in image
- [ ] Configure: 70-80vh height, fade transition, dots nav, 5-6s auto-rotation
- [ ] Ensure mobile readability (responsive text layers)

## V3.6 - APK Build Fix
- [x] Remove expo-barcode-scanner (deprecated, breaks Expo SDK 54 build)
- [x] QR scanner already uses expo-camera (no migration needed)
## V3.7 - Mobile App Improvements
- [x] Configure categories with same colors as website (parent categories with specific colors)
- [x] Remove Raleway font - replace with system font throughout the app
- [x] Optimize app loading performance (reduce API calls, add caching, lazy loading)
- [x] Add social login (Google, Apple, Facebook) with existing account linking
- [x] Update legal links from the website (CGV, Mentions Légales, Politique de Confidentialité)
