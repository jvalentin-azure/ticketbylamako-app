# TicketByLamako Mobile App - Handover Documentation

## Project Overview

**TicketByLamako** is a mobile e-commerce app for event ticketing and merchandise sales, built for the TicketByLamako.com platform (WordPress + WooCommerce + Tickera). The app supports event browsing, seated ticket selection via interactive seating charts, shopping, QR-code tickets, loyalty rewards, and multi-role access (Client, Organisateur, Admin).

---

## Git Repository

| Detail | Value |
|--------|-------|
| **Repository URL** | `https://github.com/jvalentin-azure/ticketbylamako-app.git` |
| **Branch** | `main` |
| **Latest Commit** | `7cbf76b` |
| **Commit Message** | V5.8: Fixed critical seating chart issues |

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | React Native (Expo) | Expo SDK 54 |
| **Language** | TypeScript | 5.9 |
| **React** | React | 19.1.0 |
| **React Native** | React Native | 0.81.5 |
| **Navigation** | Expo Router | 6.x |
| **Styling** | NativeWind (Tailwind CSS) | 4.x |
| **State Management** | React Context + AsyncStorage | - |
| **Server Queries** | TanStack React Query + tRPC | 5.x / 11.7 |
| **Backend** | Express + tRPC | 4.x / 11.7 |
| **Database** | MySQL (Drizzle ORM) | - |
| **Package Manager** | pnpm | 9.12.0 |
| **Node.js** | Node.js | 22.13.0 |

### Mobile Platforms

| Platform | Status |
|----------|--------|
| **iOS** | Supported (Expo Go + EAS Build) |
| **Android** | Supported (Expo Go + EAS Build) |
| **Web** | Supported (Metro bundler) |

---

## Project Structure

```
ticketbylamako-app/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (providers, drawer)
│   ├── (auth)/                   # Auth screens (login, register)
│   ├── (tabs)/                   # Main tab screens
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # Home (Accueil)
│   │   ├── events.tsx            # Events list
│   │   ├── shop.tsx              # Shop/Boutique
│   │   ├── tickets.tsx           # My Tickets (Mes billets)
│   │   ├── cart.tsx              # Cart (Panier)
│   │   └── profile.tsx           # Profile
│   ├── event/[id].tsx            # Event detail + seating chart WebView
│   ├── product/[id].tsx          # Product detail
│   ├── ticket/[id].tsx           # Ticket detail with QR code
│   ├── order/[id].tsx            # Order detail
│   ├── checkout.tsx              # Checkout WebView
│   ├── orders.tsx                # Order history
│   ├── favorites.tsx             # Favorites
│   ├── rewards.tsx               # LamakoRewards dashboard
│   ├── search.tsx                # Search
│   ├── notifications.tsx         # Notifications list
│   ├── notification-settings.tsx # Notification preferences
│   ├── edit-profile.tsx          # Edit profile
│   ├── help.tsx                  # Help & Support
│   ├── privacy.tsx               # Privacy policy
│   └── about.tsx                 # About
├── assets/
│   ├── fonts/                    # Raleway font family (5 weights)
│   └── images/                   # App icons, logos, onboarding images
├── components/                   # Reusable UI components
│   ├── app-header.tsx            # Global header (logo + notifications)
│   ├── drawer-content.tsx        # Drawer/burger menu content
│   ├── screen-container.tsx      # SafeArea wrapper
│   ├── splash-screen.tsx         # Animated splash
│   ├── onboarding-screen.tsx     # Onboarding flow
│   ├── skeleton-loader.tsx       # Loading skeletons
│   └── ui/                       # Base UI components
├── lib/
│   ├── api/
│   │   ├── woocommerce.ts        # WooCommerce + Tickera + Lamako API client
│   │   ├── auth.ts               # JWT authentication (WordPress)
│   │   ├── social-auth.ts        # Social login (Google, Facebook, Apple)
│   │   └── cache.ts              # API response caching
│   ├── auth-provider.tsx         # Auth context
│   ├── cart-provider.tsx         # Cart state management
│   ├── favorites-provider.tsx    # Favorites (AsyncStorage)
│   ├── rewards-provider.tsx      # LamakoRewards loyalty program
│   ├── notifications-provider.tsx # Push notifications
│   ├── theme-provider.tsx        # Dark/light theme
│   └── trpc.ts                   # tRPC client
├── hooks/                        # Custom React hooks
├── constants/                    # App constants, OAuth config
├── server/                       # Backend (Express + tRPC)
│   ├── _core/                    # Framework code (don't modify)
│   ├── db.ts                     # Database queries
│   ├── routers.ts                # tRPC routes
│   └── storage.ts                # S3 storage helpers
├── drizzle/                      # Database schema & migrations
├── shared/                       # Shared types between client/server
├── scripts/                      # WordPress plugins & utilities
│   ├── lamako-mobile-api.php     # Main WordPress plugin (v2.0.4)
│   ├── lamako-rewards-api/       # Rewards plugin (v3.0.0)
│   └── lr-homepage-sections/     # Homepage sections plugin
├── tests/                        # Vitest test files
├── docs/                         # Documentation & research
├── todo.md                       # Feature tracking (575 done, 38 pending)
├── design.md                     # UI/UX design document
├── theme.config.js               # Color palette (brand colors)
├── tailwind.config.js            # Tailwind configuration
├── app.config.ts                 # Expo app configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies & scripts
└── HANDOVER.md                   # This file
```

---

## Setup & Installation

### Prerequisites

- **Node.js** >= 22.x
- **pnpm** >= 9.12.0
- **Expo CLI** (installed via npx)
- **Expo Go** app on your phone (for testing)

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/jvalentin-azure/ticketbylamako-app.git
cd ticketbylamako-app

# 2. Install dependencies
pnpm install

# 3. Create .env file (see ENV_EXAMPLE.md for all variables)
cp ENV_EXAMPLE.md .env  # Then edit with real values

# 4. Start development server
pnpm dev
```

### Running the App

```bash
# Full dev (backend + metro bundler)
pnpm dev

# Metro only (frontend)
pnpm dev:metro

# Backend server only
pnpm dev:server

# iOS simulator
pnpm ios

# Android emulator
pnpm android

# Type checking
pnpm check

# Run tests
pnpm test

# Lint
pnpm lint

# Generate QR code for Expo Go
pnpm qr
```

### Build Commands

```bash
# Build server for production
pnpm build

# Start production server
pnpm start

# Database migrations
pnpm db:push

# EAS Build (requires EAS CLI)
npx eas-cli build --platform android
npx eas-cli build --platform ios
```

---

## Environment Variables

See **`ENV_EXAMPLE.md`** in the project root for the complete list with descriptions.

### Critical Client Variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SITE_URL` | WordPress site URL |

### Deprecated Client Variables

These were used by the legacy v1 implementation and must not be shipped in production mobile builds after the v2 migration:

| Variable | Risk |
|----------|------|
| `EXPO_PUBLIC_WC_CONSUMER_KEY` | WooCommerce credentials should move server-side. |
| `EXPO_PUBLIC_WC_CONSUMER_SECRET` | Critical secret exposure in the mobile binary. |

### Where to Configure

- **Local development**: `.env` file at project root
- **EAS Build**: `eas.json` or EAS Secrets dashboard
- **Production server**: Environment variables on hosting platform

---

## API Endpoints Used

### WordPress REST API (ticketbylamako.com)

| Endpoint | Purpose |
|----------|---------|
| `/wp-json/wc/v3/products` | WooCommerce products |
| `/wp-json/wc/v3/orders` | WooCommerce orders |
| `/wp-json/wp/v2/tc_events` | Tickera events (CPT) |
| `/wp-json/wp/v2/product_cat` | Product categories |
| `/wp-json/jwt-auth/v1/token` | JWT authentication |
| `/wp-json/jwt-auth/v1/token/validate` | Token validation |
| `/wp-json/lamako-mobile/v1/events-data` | Events with ticket data |
| `/wp-json/lamako-mobile/v1/ticket-instances/{order_id}` | Ticket instances |
| `/wp-json/lamako-mobile/v1/seat-chart-url/{event_id}` | Seating chart URL |
| `/wp-json/lamako-mobile/v1/social-login` | Social login |
| `/wp-json/lamako-mobile/v1/auto-login` | Auto-login for WebView |
| `/wp-json/lamako-rewards/v1/balance` | Rewards balance |
| `/wp-json/lamako-rewards/v1/history` | Rewards history |
| `/wp-json/lamako-rewards/v1/tiers` | Tier information |
| `/wp-json/lamako-rewards/v1/redeem` | Points redemption |
| `/wp-json/lamako-rewards/v1/referral/*` | Referral system |

### Backend Server (tRPC)

| Route | Purpose |
|-------|---------|
| `http://localhost:3000` | Local dev server |
| `/api/trpc/*` | tRPC procedures |
| `/api/oauth/callback` | OAuth callback (web) |

---

## WordPress Backend

### Server Details

| Detail | Value |
|--------|-------|
| **Hosting** | Cloudways |
| **Server IP** | `139.84.234.183` |
| **SSH User** | `master_nqpwygdfqp` |
| **App Path** | `/home/master/applications/bvprmuerhv/public_html/` |
| **WordPress URL** | `https://www.ticketbylamako.com` |

### WordPress Plugins (Custom)

| Plugin | Version | Location | Purpose |
|--------|---------|----------|---------|
| **Lamako Mobile API** | 2.0.4 | `scripts/lamako-mobile-api.php` | REST API, seating chart embed, auto-login, admin suppression |
| **Lamako Rewards API** | 3.0.0 | `scripts/lamako-rewards-api/` | Loyalty program (myCred integration) |
| **LR Homepage Sections** | 1.0 | `scripts/lr-homepage-sections/` | Homepage custom sections |

### WordPress Plugins (Third-party Required)

- **Tickera** - Event ticketing
- **Tickera Seating Charts** - Interactive seat maps
- **WooCommerce** - E-commerce
- **Bridge for WooCommerce** - Tickera-WooCommerce bridge
- **JWT Authentication for WP REST API** - JWT auth
- **myCred** - Points/loyalty system
- **Nextend Social Login** - Social OAuth
- **WP WhatsApp Chat (qlwapp)** - WhatsApp widget

### Deploying WordPress Plugins

```bash
# SSH into server
ssh master_nqpwygdfqp@139.84.234.183

# Plugin location
/home/master/applications/bvprmuerhv/public_html/wp-content/plugins/lamako-mobile-api/

# Upload via SCP (from local)
scp scripts/lamako-mobile-api.php master_nqpwygdfqp@139.84.234.183:~/lamako-mobile-api.php
ssh master_nqpwygdfqp@139.84.234.183 "rm /home/master/applications/bvprmuerhv/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api.php && cp ~/lamako-mobile-api.php /home/master/applications/bvprmuerhv/public_html/wp-content/plugins/lamako-mobile-api/lamako-mobile-api.php"
```

---

## Authentication

### WordPress JWT Auth (Primary - for client login)

Users authenticate via WordPress JWT plugin. The app stores tokens in `expo-secure-store` (native) or cookies (web).

### Manus OAuth (Built-in server auth)

The tRPC backend uses Manus OAuth for its own user management. This is separate from WordPress auth.

### Social Login

Google, Facebook, and Apple sign-in buttons are implemented. They call the `/lamako-mobile/v1/social-login` endpoint which creates/links WordPress accounts.

---

## Brand Assets

| Asset | Location | Usage |
|-------|----------|-------|
| App Icon | `assets/images/icon.png` | App launcher icon |
| Logo (Dark) | `assets/images/logo-dark.png` | Light backgrounds |
| Logo (White) | `assets/images/logo-white.png` | Dark backgrounds |
| Splash Icon | `assets/images/splash-icon.png` | Splash screen |
| Rewards Logo (Dark) | `assets/images/lamako-rewards-dark.png` | Rewards section |
| Rewards Logo (White) | `assets/images/lamako-rewards-white.png` | Rewards section |
| Raleway Font | `assets/fonts/Raleway-*.ttf` | App typography (5 weights) |

### Brand Colors

| Color | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| Primary | `#663d17` | `#c79f6c` | Main brand color (marron foncé/or) |
| Accent | `#c79f6c` | `#663d17` | Secondary accent |
| Background | `#FFFFFF` | `#0D0D0D` | Screen background |
| Surface | `#F7F5F2` | `#1A1A1A` | Cards/elevated surfaces |
| Foreground | `#1A1A1A` | `#F5F5F5` | Primary text |

---

## Features Completed (575 items)

### Core Features
- Event browsing with category filters and date filters
- Event detail with featured image, description, practical info
- Interactive seating chart (WebView with Tickera integration)
- Shop with product categories
- Product detail with gallery
- Cart management
- Checkout via WebView (WooCommerce)
- QR code tickets (react-native-qrcode-svg)
- Order history and detail
- User authentication (JWT + social login)
- Push notifications (expo-notifications)
- Favorites system (AsyncStorage)
- LamakoRewards loyalty program (myCred)
- Dark/light theme
- Onboarding flow
- Animated splash screen
- Drawer navigation with profile
- Search functionality
- Help & Support with WhatsApp
- Privacy policy

### Organisateur Features
- QR Scanner for check-in
- Participants list
- Check-in reports/stats
- Event selector dashboard

### Admin Features
- Revenue dashboard with KPIs
- Sales charts
- Orders management
- Analytics

---

## Known Issues / Pending Features (38 items)

### Critical Bugs
- Seating chart "Confirmer ma sélection" button not functional
- Cannot select more than one seat
- Checkout page shows WordPress header/footer
- "Désolé, ce produit ne peut être acheté" error on checkout
- No "Commander/Payer" button visible on checkout

### Pending Features
- Homepage redesign
- Native checkout (in-app payment form)
- Order detail screen improvements
- Participant detail (manual check-in)
- Events management (admin)
- Clients list (admin)
- Admin settings
- CGV page

---

## Deployment

### Mobile App (APK/IPA)

The app is built via **EAS Build** (Expo Application Services):

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
npx eas-cli login

# Build Android APK
npx eas-cli build --platform android --profile preview

# Build iOS (requires Apple Developer account)
npx eas-cli build --platform ios
```

### Bundle Identifiers

| Platform | Bundle ID |
|----------|-----------|
| iOS | `space.manus.ticketbylamako.app.t20260426232153` |
| Android | `space.manus.ticketbylamako.app.t20260426232153` |

### Important Notes for Building

- `newArchEnabled` is set to `false` for stability
- Android `minSdkVersion` is 24
- Android build architectures: `armeabi-v7a`, `arm64-v8a`
- ProGuard and shrink resources are disabled
- Large heap is enabled for Android

---

## Test Accounts

| Name | Email | Password | City |
|------|-------|----------|------|
| Andry Rakoto | testuser1@lamako.mg | TestLamako2024! | Antananarivo |
| Nomena Randria | testuser2@lamako.mg | TestLamako2024! | Toamasina |
| Fidy Rasoanaivo | testuser3@lamako.mg | TestLamako2024! | Antsirabe |

---

## Important Notes for Continuing Development

1. **Seating Chart**: The seating chart uses a WebView that loads the WordPress event page with injected CSS/JS. The PHP plugin (`lamako-mobile-api.php`) handles admin suppression, auto-login, and mobile-friendly rendering. Any changes to the seating chart flow require updating BOTH the app code AND the WordPress plugin.

2. **WordPress Plugin Deployment**: The plugin must be manually deployed via SSH/SCP to the Cloudways server. There is no CI/CD pipeline for this.

3. **Manus Platform Dependencies**: The built-in server uses Manus OAuth and Manus Forge (AI). If migrating away from Manus, you'll need to replace these with your own OAuth provider and AI service.

4. **WooCommerce API Keys**: The app uses WooCommerce REST API with consumer key/secret authentication. These keys have read/write access.

5. **Font**: The app uses Raleway (5 weights) loaded via `@expo-google-fonts/raleway`. The TTF files are also bundled in `assets/fonts/`.

6. **NativeWind**: Styling uses NativeWind v4 (Tailwind CSS for React Native). The color tokens are defined in `theme.config.js` and shared between Tailwind and runtime.

7. **No `.env` in Git**: Environment variables are managed via the Manus platform secrets system. You must create your own `.env` file locally using `ENV_EXAMPLE.md` as reference.
