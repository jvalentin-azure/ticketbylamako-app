# TicketByLamako - Mobile App Interface Design

## App Concept
A unified mobile app with 3 role-based portals (Client, Organisateur, Admin) for event ticketing, merchandise shopping, QR check-in, and event management. Light mode default with dark mode toggle. Connected to ticketbylamako.com via WooCommerce REST API + Tickera Check-in API.

## Screen List

### Auth Screens
1. **Welcome Screen** - Logo, tagline, Login/Register buttons
2. **Login Screen** - Email/password form, SSO with website
3. **Register Screen** - Name, email, phone, password form
4. **Role Selector** - For multi-role users (auto-detected from WP role)

### Client Portal (Tab: Home, Events, Shop, Tickets, Profile)
5. **Home** - Hero carousel of featured events, quick categories, trending events, latest products
6. **Events List** - Filterable grid/list of events with search, category chips, date filter
7. **Event Detail** - Hero image, title, date/time, venue, description, ticket types with prices, "Buy" CTA
8. **Seating Chart** - WebView of Tickera seating chart for seated events
9. **Shop** - Product grid with categories, search
10. **Product Detail** - Images, description, price, add to cart
11. **Cart** - Items list, coupon input, total in Ariary, checkout button
12. **Checkout** - WebView of WooCommerce checkout (reuses all payment gateways)
13. **My Tickets** - List of purchased tickets with QR codes, offline-capable
14. **Ticket Detail** - Full QR code, event info, download PDF button
15. **My Orders** - Order history with status badges
16. **Order Detail** - Items, totals, status timeline
17. **Profile** - User info, edit profile, settings
18. **Settings** - Theme toggle, language, notifications

### Organisateur Portal (Tab: Dashboard, Scanner, Participants, Events, Profile)
19. **Org Dashboard** - Select event, real-time KPIs (total tickets, checked-in, rate %), check-in timeline chart
20. **QR Scanner** - Full-screen camera scanner, result overlay with attendee details, success/fail feedback
21. **Scan Result** - Name, ticket type, seat, check-in status, photo
22. **Participants List** - Color-coded list (green=checked, red=not), search, filter by ticket type
23. **Participant Detail** - Full info, check-in history, manual check-in button
24. **Org Events** - List of events the organizer manages
25. **Check-in Report** - Stats summary, export option

### Admin Portal (Tab: Dashboard, Scanner, Management, Analytics, Settings)
26. **Admin Dashboard** - Revenue KPIs, sales chart, recent orders, top events
27. **Admin Scanner** - Same as Org scanner
28. **Orders Management** - All orders list, filters, search
29. **Events Management** - All events, quick stats per event
30. **Event Admin Detail** - Sales, check-ins, revenue for specific event
31. **Clients List** - Customer list with purchase history
32. **Analytics** - Revenue charts, check-in rates, conversion metrics
33. **Admin Settings** - Multi-site toggle, push notifications, API config

## Primary Content and Functionality

### Home Screen
- **Hero Carousel**: 3-5 featured/upcoming events with large images, auto-scroll
- **Category Chips**: Horizontal scroll of event categories (Concert, Théâtre, Festival, Formation, etc.)
- **Upcoming Events**: Horizontal card scroll of next events
- **Shop Highlights**: 2-3 featured products
- **Quick Stats**: For logged-in users - upcoming tickets count

### Event Detail
- Full-bleed hero image with gradient overlay
- Event title, date badge, venue with map pin
- Description (HTML rendered)
- Ticket type cards: name, price in Ariary, availability status
- "Ajouter au panier" button per ticket type
- Share button (WhatsApp, Facebook, Copy link)

### QR Scanner (Organisateur/Admin)
- Full-screen camera viewfinder with scan frame overlay
- On successful scan: slide-up sheet with attendee info
- Color feedback: green flash (success), red flash (invalid), orange flash (already checked)
- Haptic feedback on scan
- Manual search fallback button
- Last 5 scans history at bottom

## Key User Flows

### Flow 1: Buy a Ticket
Home → Events → Event Detail → Select ticket type → Add to Cart → Cart → Checkout (WebView) → Order Confirmation → My Tickets (QR code)

### Flow 2: Buy with Seating
Home → Events → Event Detail → "Choisir un siège" → Seating Chart (WebView) → Select seat → Add to Cart → Cart → Checkout → My Tickets

### Flow 3: Check-in (Organisateur)
Org Dashboard → Select Event → Scanner → Scan QR → See attendee details → Auto check-in → Next scan

### Flow 4: Manual Check-in
Org Dashboard → Participants → Search by name → Tap participant → "Check-in" button → Confirmed

### Flow 5: Admin Review
Admin Dashboard → See KPIs → Tap event → Event detail with sales/check-in stats → Export report

## Color Choices

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| primary | #C8A951 | #D4B85C | Gold accent - buttons, highlights, brand color |
| background | #FFFFFF | #121212 | Screen backgrounds |
| surface | #F8F7F4 | #1E1E1E | Cards, elevated surfaces |
| foreground | #1A1A1A | #F5F5F5 | Primary text |
| muted | #6B7280 | #9CA3AF | Secondary text, labels |
| border | #E8E5DE | #2D2D2D | Dividers, card borders |
| success | #22C55E | #4ADE80 | Check-in success, valid status |
| warning | #F59E0B | #FBBF24 | Pending, already checked |
| error | #EF4444 | #F87171 | Invalid, failed, cancelled |
| accent | #8B7D3C | #A69550 | Secondary brand accent |

Font: **Raleway** (loaded via expo-font)

## Navigation Structure

### Client Tabs
- Home (house icon)
- Événements (calendar icon)
- Boutique (shopping-bag icon)
- Mes Billets (ticket icon)
- Profil (person icon)

### Organisateur Tabs
- Dashboard (chart-bar icon)
- Scanner (qr-code icon)
- Participants (people icon)
- Événements (calendar icon)
- Profil (person icon)

### Admin Tabs
- Dashboard (chart-bar icon)
- Scanner (qr-code icon)
- Gestion (clipboard icon)
- Analytics (trending-up icon)
- Paramètres (settings icon)
