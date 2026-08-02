# iOS and Android social-auth QA

## Store identity preserved

- Expo project: `96eeaaef-a035-4bc7-99d8-72b0d36677ef`
- Client package and bundle ID: `com.ticketbylamako.app`
- Deep-link scheme: `ticketbylamako`
- App version remains `1.0.0`; build numbers remain managed remotely by EAS.

These values match the parallel Store-validation task `019ea291-2cd0-7d10-81b8-35139cfa44cf`. Do not create a replacement Expo project or change the identifiers during this rollout.

## Existing Store state

The parallel task records client iOS build `1.0.0 (10)` as submitted for review and records TestFlight builds for the Client, Admin, Organizer, POS and Check-in apps. This change must not replace the submitted client build blindly.

Store identifiers and observed TestFlight builds to preserve:

| Experience | Bundle/package ID | Observed build state |
| --- | --- | --- |
| Client | `com.ticketbylamako.app` | iOS `1.0.0 (10)` submitted/review; client TestFlight available |
| Admin | `mg.ticketbylamako.admin` | TestFlight build `3` |
| Organizer | `mg.ticketbylamako.organizer` | TestFlight build `4` |
| POS | `mg.ticketbylamako.pos` | TestFlight build `2` |
| Check-in | `mg.ticketbylamako.checkin` | TestFlight build `4` |

The parallel validation task did not record a successful physical iPhone installation for every experience. TestFlight availability is not equivalent to device-flow validation.

`expo-apple-authentication` adds a native iOS capability. The Apple login correction therefore requires a new signed binary; it is not an OTA-only change. Expo also recommends validation on a real iPhone because simulator behavior is incomplete.

## Required staging matrix

1. Android physical device: Google success/cancel/expired state, Facebook success/cancel/missing email, email login and password reset.
2. iPhone physical device: official Apple button, first authorization, repeat authorization where name/email may be null, cancellation and revoked credential.
3. Both platforms: expired JWT, social account already linked, verified email matching an existing customer, 429 rate limit and server unavailable.
4. Payment WebViews: first-party checkout, each enabled gateway redirect, success/cancel/failure return, and rejection of an unknown HTTPS host.
5. Seating WebView: first-party pages only; no JWT in URL, logs or screenshots.
6. Apple capabilities: Sign in with Apple, push notifications and associated domains match the App Store identifier before signing.
7. Google Play: preserve the existing application identity and Rewards declaration while the organization-account transition is completed.

## Release gate

- Validate the WordPress changes on staging first.
- Validate a preview/internal Android build and a TestFlight build on physical devices.
- Keep `LAMAKO_ALLOW_LEGACY_GOOGLE_ACCESS_TOKEN` enabled only during compatibility testing.
- After adoption, disable legacy Google access tokens and require social nonces.
- Do not submit a new Store build until login, payment callbacks and deep links pass the device matrix.

References:

- Expo Apple Authentication SDK 54: https://docs.expo.dev/versions/v54.0.0/sdk/apple-authentication/
- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
