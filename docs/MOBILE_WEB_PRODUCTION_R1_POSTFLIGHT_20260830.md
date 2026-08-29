# Mobile web production R1 postflight

Date: 2026-08-30 (Africa/Nairobi)

## Outcome

The mobile-browser application built from application commit
`e4f9d5ff5870ddbed10c4c8cede39ee437ec5f48` is active and qualified on
production at `https://www.ticketbylamako.com/mobile/`.

- Active bundle: 58 files, 4,721,429 bytes
- Canonical bytewise tree SHA-256:
  `239484fea93e53b985f96ebc407632833f557e55a09a460684556d77d12e8d74`
- Archive SHA-256:
  `ae47c0b53d5e4b72a134d86320dcd2c1e8a53d135deaa0046206cc18a67d1ce0`
- Index HTTP/disk SHA-256:
  `64123698150169ab3886c209017d33596a38e2f9141b9593b63ee3c0f6461ed2`
- JavaScript HTTP/disk SHA-256:
  `916c4affdc51fadcb5d0d761c67c94fccfcce4e66feafa66cbac74307b8c1850`
- Active ownership and modes: `bvprmuerhv:www-data`, directories `0755`,
  files `0644`

## Qualification

- Production GET/HEAD/OPTIONS smokes: 12/12 passed.
- All required JSON responses parsed successfully.
- Same-origin CORS preflights passed.
- WebKit iPhone 15 against the deployed production bundle passed with strict
  TLS verification.
- The contractual 27 June date rendered; the publication date did not.
- Deep refresh passed.
- Blocking network failures, HTTP errors, mutative attempts, BlurHash network
  requests, invalid API responses, console errors and page errors: zero.
- Horizontal overflow: absent.
- WebKit report SHA-256:
  `55489432acec5e414cc99fcc6b803c717bee809e52e273ab2ce2d06cae110701`
- Screenshot SHA-256:
  `8eba32394a85c0e58e83fa284dbacd5bdb1f8d057dfcbd8189bbc43e9c8dee3c`

## Rollback and manifest

The canonical rollback is the complete private snapshot at:

`/home/1525593.cloudwaysapps.com/bvprmuerhv/private_html/tbl-deploy/tbl-mobile-prod-20260829T225615Z-e4f9d5f-r1/snapshot-mobile-before/`

It contains 58 files and has tree SHA-256
`9199ef6fb3748bbb684e34038f97c5ca97d946b5ce5f7a0663030f65a13fdc50`.

The private release manifest is:

`/home/1525593.cloudwaysapps.com/bvprmuerhv/private_html/tbl-deploy/tbl-mobile-prod-20260829T225615Z-e4f9d5f-r1/`

- Pre-release postflight JSON SHA-256:
  `56318d1f5b06c37d8485d3da93da2df737278f910e0a27c663d519f986df0adb`
- Evidence inventory SHA-256:
  `f0233c3c3bc85c674f9b6a76da3b7fe0e3299a2e21131a68403aeeef8ed883b1`

## Accepted protected sibling

The historical production tree remains at
`/public_html/.tbl-mobile-prev-e4f9d5f-prod-r1/`. It contains 58 files, has
tree SHA-256 `9199ef6fb3748bbb684e34038f97c5ca97d946b5ce5f7a0663030f65a13fdc50`,
and retains ownership `master_nqpwygdfqp:www-data`.

Both its root and `index.html` return HTTP 403 with TLS verification result 0.
No file was partially deleted. Moving it across `public_html` and
`private_html`, then deleting its first file via the application SFTP account,
were both denied by ownership. The coordinator explicitly accepted this
protected residual sibling; no master write was used.

## Release boundary

The production mono-writer was removed only after exact owner verification.
Its absence was confirmed by master read-only validation and an independent
application SFTP connection. Staging, PHP, MU-plugins, the database, options,
cache, sessions, orders, payments, tickets and stock were not modified.
