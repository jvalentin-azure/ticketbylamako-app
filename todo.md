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
- [ ] Seating chart WebView for seated events
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
