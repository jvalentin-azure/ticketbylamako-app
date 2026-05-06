# Environment Variables Reference

Copy these variables to a `.env` file at the project root. **Do NOT commit `.env` to version control.**

## Client-side (EXPO_PUBLIC_ prefix)

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_SITE_URL` | WordPress site URL | `https://www.ticketbylamako.com` |
| `EXPO_PUBLIC_WC_CONSUMER_KEY` | WooCommerce REST API consumer key | `ck_xxxxxxxxxxxx` |
| `EXPO_PUBLIC_WC_CONSUMER_SECRET` | WooCommerce REST API consumer secret | `cs_xxxxxxxxxxxx` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (social login) | `xxxxx.apps.googleusercontent.com` |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Facebook App ID (social login) | `123456789012345` |
| `EXPO_PUBLIC_REWARDS_API_KEY` | LamakoRewards API key | `LR_2024_SECURE_KEY_TBL` |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | Manus OAuth portal URL | `https://portal.manus.space` |
| `EXPO_PUBLIC_OAUTH_SERVER_URL` | Manus OAuth server URL | `https://oauth.manus.space` |
| `EXPO_PUBLIC_APP_ID` | Manus App ID | (provided by Manus platform) |
| `EXPO_PUBLIC_OWNER_OPEN_ID` | Manus owner open ID | (provided by Manus platform) |
| `EXPO_PUBLIC_OWNER_NAME` | Manus owner name | (provided by Manus platform) |
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL | `http://localhost:3000` |
| `EXPO_PUBLIC_JWT_SECRET` | JWT secret for WordPress auth | (your secret) |

## Server-side (Backend)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/dbname` |
| `JWT_SECRET` | JWT signing secret | (your secret) |
| `OAUTH_SERVER_URL` | OAuth server URL | `https://oauth.manus.space` |
| `OWNER_OPEN_ID` | Owner open ID | (same as EXPO_PUBLIC_OWNER_OPEN_ID) |
| `VITE_APP_ID` | App ID | (same as EXPO_PUBLIC_APP_ID) |
| `BUILT_IN_FORGE_API_URL` | Manus Forge AI API URL | `https://forge.manus.space/api` |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge AI API key | (provided by Manus platform) |

## Cloudways Server (SSH Deployment)

| Detail | Value |
|--------|-------|
| Host IP | `139.84.234.183` |
| SSH Username | `master_nqpwygdfqp` |
| Application Path | `/home/master/applications/bvprmuerhv/public_html/` |
| Plugin Path | `wp-content/plugins/lamako-mobile-api/` |
