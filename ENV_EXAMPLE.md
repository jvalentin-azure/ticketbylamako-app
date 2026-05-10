# Environment Variables Reference

Copy these variables to a `.env` file at the project root. Do not commit `.env`.

## Client-side Expo variables

Only values that are safe to ship inside the mobile app may use the `EXPO_PUBLIC_` prefix.

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_SITE_URL` | Public WordPress site URL | `https://www.ticketbylamako.com` |
| `EXPO_PUBLIC_ENABLE_MOBILE_V2_SEATING` | Temporary app switch for the v2 seating WebView flow. Set `false` only for rollback. | `true` |
| App deep link scheme | Configured in `app.config.ts` as `ticketbylamako://payment-return`; do not put secrets or order keys in deep links. | `ticketbylamako` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Public Google OAuth client ID | `xxxxx.apps.googleusercontent.com` |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Public Facebook App ID | `123456789012345` |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | Public OAuth portal URL, if still used | `https://portal.manus.space` |
| `EXPO_PUBLIC_OAUTH_SERVER_URL` | Public OAuth server URL, if still used | `https://oauth.manus.space` |
| `EXPO_PUBLIC_APP_ID` | Public Manus app ID, if still used | `(provided by platform)` |
| `EXPO_PUBLIC_OWNER_OPEN_ID` | Public owner open ID, if still used | `(provided by platform)` |
| `EXPO_PUBLIC_OWNER_NAME` | Public owner display name, if still used | `(provided by platform)` |
| `EXPO_PUBLIC_API_BASE_URL` | Optional development backend URL | `http://localhost:3000` |

## Deprecated client variables

These were used by the legacy implementation and must not be present in production mobile builds after the v2 migration.

Run `pnpm check:mobile-secrets` before local QA builds. EAS also runs this guard before installing dependencies through `eas-build-pre-install`.

| Variable | Why deprecated |
|----------|----------------|
| `EXPO_PUBLIC_WC_CONSUMER_KEY` | WooCommerce API credentials should not be shipped in a mobile binary. |
| `EXPO_PUBLIC_WC_CONSUMER_SECRET` | Critical secret exposure. Move all WooCommerce writes server-side. |
| `EXPO_PUBLIC_REWARDS_API_KEY` | Rewards writes should be authenticated by WordPress JWT and handled server-side. |
| `EXPO_PUBLIC_JWT_SECRET` | JWT signing secrets must never be included in client code. |
| `EXPO_PUBLIC_ENABLE_MOBILE_V2_COMMERCE` | Removed after the v2 checkout migration. Native checkout is v2-only. |

## WordPress/server-side configuration

Configure these only on the WordPress/server side, not in Expo public variables.

| Variable/setting | Description |
|------------------|-------------|
| `JWT_AUTH_SECRET_KEY` | JWT signing secret in WordPress configuration. |
| WooCommerce REST consumer key/secret | Server-side only, if a backend integration still needs REST credentials. |
| Lamako rewards internal API key | Server-side only while legacy rewards routes remain active. |
| Payment gateway return URLs | Must point to Lamako mobile return/verification pages once Phase 4 is implemented. |

## Local backend variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string for the optional local backend | `mysql://user:pass@host:3306/dbname` |
| `JWT_SECRET` | Local backend JWT signing secret, if used | `(secret)` |
| `OAUTH_SERVER_URL` | OAuth server URL | `https://oauth.manus.space` |
| `OWNER_OPEN_ID` | Owner open ID | `(provided by platform)` |
| `VITE_APP_ID` | App ID | `(provided by platform)` |
| `BUILT_IN_FORGE_API_URL` | Manus Forge AI API URL | `https://forge.manus.space/api` |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge AI API key | `(secret)` |

## Cloudways deployment reference

| Detail | Value |
|--------|-------|
| Host IP | `139.84.234.183` |
| SSH Username | `master_nqpwygdfqp` |
| Application Path | `/home/master/applications/bvprmuerhv/public_html/` |
| Plugin Path | `wp-content/plugins/lamako-mobile-api/` |
