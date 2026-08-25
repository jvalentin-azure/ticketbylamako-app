# TicketByLamako Wallet signing

The mobile app never receives signing keys. It requests a fresh Wallet link
from the authenticated WordPress API. Apple downloads use a short-lived opaque
token; Google links contain a server-signed JWT.

## Apple Wallet

1. In Apple Developer, create a Pass Type ID, for example
   `pass.com.ticketbylamako.eventticket`.
2. Create a Pass Type ID certificate for that identifier and export its
   certificate and private key as PEM files.
3. Download the current Apple WWDR intermediate certificate and convert it to
   PEM if required.
4. Put the certificate, private key and WWDR certificate in a directory outside
   the WordPress web root, readable only by the PHP user.
5. Put PNG `icon.png` and optional `logo.png` assets on the server. The icon may
   be public, but the signing material must not be.

Example environment-specific `wp-config.php` declarations (paths only):

```php
define( 'LAMAKO_WALLET_APPLE_PASS_TYPE_ID', 'pass.com.ticketbylamako.eventticket' );
define( 'LAMAKO_WALLET_APPLE_TEAM_ID', 'YOUR_APPLE_TEAM_ID' );
define( 'LAMAKO_WALLET_APPLE_CERT_PATH', '/secure/path/apple-pass-cert.pem' );
define( 'LAMAKO_WALLET_APPLE_KEY_PATH', '/secure/path/apple-pass-key.pem' );
define( 'LAMAKO_WALLET_APPLE_KEY_PASSWORD', getenv( 'LAMAKO_WALLET_APPLE_KEY_PASSWORD' ) ?: '' );
define( 'LAMAKO_WALLET_APPLE_WWDR_PATH', '/secure/path/AppleWWDR.pem' );
define( 'LAMAKO_WALLET_ICON_PATH', '/safe/path/wallet-icon.png' );
define( 'LAMAKO_WALLET_ICON_2X_PATH', '/safe/path/wallet-icon@2x.png' );
define( 'LAMAKO_WALLET_ICON_3X_PATH', '/safe/path/wallet-icon@3x.png' );
define( 'LAMAKO_WALLET_LOGO_PATH', '/safe/path/wallet-logo.png' );
```

## Google Wallet

1. Complete Google Wallet API issuer onboarding.
2. Enable the Google Wallet API in a dedicated Google Cloud project.
3. Create a dedicated service account and authorize its email as a Developer in
   the Google Wallet console.
4. Create a JSON key and store it outside the WordPress web root with restrictive
   filesystem permissions.

```php
define( 'LAMAKO_WALLET_GOOGLE_ISSUER_ID', 'YOUR_NUMERIC_ISSUER_ID' );
define( 'LAMAKO_WALLET_GOOGLE_SERVICE_ACCOUNT_PATH', '/secure/path/google-wallet-service-account.json' );
```

The Google Play submission service account is not automatically authorized for
Google Wallet. Prefer a dedicated Wallet service account with minimal access.

### Staging configuration - 23 August 2026

- Google Pay & Wallet business ID: `BCR2DN7TTDKOZABR`
- Google Wallet issuer ID: `3388000000023176380`
- Google Cloud project: `ticketbylamako-wallet-stg`
- Dedicated signer:
  `tbl-wallet-staging-signer@ticketbylamako-wallet-stg.iam.gserviceaccount.com`
- Server credential path:
  `/home/master/.ticketbylamako-secrets/wallet/staging/google/service-account.json`
- Authorized demo tester: `lamako.mcar.asc@gmail.com`

The JSON credential is intentionally absent from Git and from the WordPress web
root. The PHP application user receives read-only filesystem access. The signer
is registered as a Developer in Google Pay & Wallet Console and is not granted a
broad Google Cloud project role.

The paid staging ticket `14115` from order `14114` successfully created class
`3388000000023176380.event_13839`, opened the Google "Add to Wallet" flow, and
was added to the authorized test account. The resulting pass displayed the
event name, start/end date, venue, holder, ticket number and QR code. Google
approved the issuer and its active event-ticket class. The Google Wallet API
was enabled in the dedicated Cloud project on 25 August 2026.

Before changing the Google constants, staging `wp-config.php` is backed up below
`/home/master/tbl-compliance-backups/wallet-google-<timestamp>/`. The latest
backup location is also recorded outside the web root in
`/home/master/.ticketbylamako-secrets/wallet/staging/google/last-wp-config-backup.txt`.

### Production activation - 25 August 2026

- Apple and Google signing assets are stored outside the WordPress web root in
  `/home/master/.ticketbylamako-secrets/wallet/production/`.
- WordPress reports both providers as available.
- Apple generated a signed, structurally valid `.pkpass` from an existing paid
  ticket without creating an order or changing ticket data.
- The Google service account authenticated successfully, read the approved
  event-ticket class through Google Wallet API, and generated a verifiable
  Save-to-Wallet JWT containing an event class and ticket object.
- Unauthenticated Apple and Google Wallet routes return HTTP 401.
- Production activation backup:
  `/home/master/tbl-compliance-backups/wallet-prod-20260825T202111Z/`.

The current Google signer belongs to the dedicated
`ticketbylamako-wallet-stg` Cloud project even though it now signs links served
by production. This is functionally valid because the issuer authorization is
shared, but a production-named signer should replace it during credential
rotation to make environment ownership explicit.

## Rollback

Remove or comment the provider constants from the environment configuration.
The API immediately reports that provider as unavailable and the app hides its
button. No ticket, order, QR code or payment data is changed.

For staging Google Wallet, restore the recorded `wp-config.php` backup and clear
the WordPress/application cache. If the signer credential is suspected to be
exposed, revoke key ID `35a7acc716b21f663353e2c5797fda2db1613c8d` in Google
Cloud before creating a replacement; never copy the old key into the repository.

For the 25 August production activation, restore
`wallet-prod-20260825T202111Z/wp-config.php.before-wallet-activation` to the
production WordPress root. This immediately points Wallet back to the previous
unavailable path, causing the API to report both providers as unavailable and
the mobile app to hide both buttons. The production signing directory may then
be archived after confirming rollback.

## Required QA

- owner can add a paid ticket;
- another account receives HTTP 403;
- pending, failed, cancelled and refunded orders cannot issue a pass;
- Apple opens a valid `.pkpass` on a physical iPhone;
- Google opens a test pass on a physical Android device;
- QR content matches the server ticket code exactly;
- scanned/used tickets are still rejected by the server scanner;
- expired Apple download links return HTTP 410;
- no key, JWT credential or private path is present in API responses or logs.
