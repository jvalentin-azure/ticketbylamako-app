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
