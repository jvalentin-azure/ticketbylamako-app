# Mobile web staging R3b postflight

Date: 2026-08-30 UTC

## Outcome

The immutable mobile web candidate built from application commit
`e4f9d5ff5870ddbed10c4c8cede39ee437ec5f48` is active and qualified on
staging at `/mobile/`.

- Active bundle: 58 files
- Canonical bytewise tree SHA-256: `1e5fdbb552d25b95a52328f0e6e34fddf4620d7f5cfe300c6daf1062a9ebefcc`
- Archive SHA-256: `cb6a35c4d730b65135b9e30de3c58048210dec11aab961ef0471b998fbbbdbbd`
- Final staging manifest SHA-256: `a5f7e432cf14fdb97d81d3f3373ea88c3eaefcdb41361294845ca853201cadce`
- Remote private manifest: `private_html/tbl-deploy/tbl-mobile-bundle-r3b-20260829T220747Z-e4f9d5f/`
- Rollback: the previous `b0f60a6340ef655c3debef16ebae126fe56505da9f2d95bf74557b54fdcfac95`
  tree is sealed twice in the private manifest.

## Qualification evidence

- GET-only smoke tests: 12/12 passed.
- WebKit iPhone 15 stabilized run: passed.
- Contract date: 27 June rendered; publication date 3 May absent.
- Deep refresh: passed.
- Network failures, HTTP errors, mutations, BlurHash requests, invalid API JSON,
  console errors and page errors: all zero.
- Horizontal overflow: absent.
- WebKit report SHA-256: `d2fb846fc96cb6b7e36dd62390542751ec4632490a4be689f3e5d79a5a2447a3`.

The release lock was removed after exact owner verification and a second
independent connection confirmed that it was absent. PHP, MU-plugins, the
database, options, cache, sessions and transactional objects were excluded.
Production was not modified.

## Release boundary

This postflight qualifies staging only. Production requires a separately built
artifact using `https://www.ticketbylamako.com`, a production-origin GET-only
WebKit run, a zero-staging-reference scan, and explicit promotion authorization.
