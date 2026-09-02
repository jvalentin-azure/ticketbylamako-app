# Agent Handoff — TicketByLamako

## Active incident: Sign in with Apple on iOS

The active work is on branch `fix/apple-social-json-response-20260902`, based on `origin/feat/client-mobile-web-20260827` at commit `d9520c7a01f233ad0d4ff70c131b410da3de25da`. The official review and continuation point is draft pull request [#8](https://github.com/jvalentin-azure/ticketbylamako-app/pull/8). The code fix is commit `06ac889` and the initial handoff documentation is commit `852a03d`. Do not restart this incident from `main`: the public App Store build matches the feature branch, while `main` does not contain the same Apple login UI and configuration.

Read [`docs/apple-sign-in-incident-2026-09-02.md`](docs/apple-sign-in-incident-2026-09-02.md) before changing authentication code. It contains the screenshot finding, complete investigation timeline, safe production probes, source comparison, implemented patch, validation results, and unresolved production-log requirement. Then read [`docs/apple-sign-in-production-deployment-2026-09-02.md`](docs/apple-sign-in-production-deployment-2026-09-02.md) for the exact Cloudways target, hashes, private backup, atomic deployment, postflight, rollback, and iPhone test matrix.

| Area | Current state |
|---|---|
| iOS symptom | `JSON Parse error: Unexpected character: <` after Apple authentication |
| Confirmed client defect | `socialLogin()` parsed a successful non-JSON response directly with `res.json()` |
| Probable server boundary | HTML or an unhandled error is produced after a real Apple token passes verification |
| Client fix | `lib/api/social-auth.ts` reads the body once and reports empty, HTML, or invalid JSON safely |
| WordPress fix | `scripts/lamako-mobile-api.php` buffers unexpected output and converts unhandled exceptions to REST JSON |
| Tests | TypeScript passed; PHP lint passed; 353 tests passed and 4 were skipped |
| Production state | WordPress guard deployed on 2026-09-02; active SHA-256 `e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98`; iPhone test pending |
| Production backup | `/home/master/applications/bvprmuerhv/private_html/tbl-apple-social-json-20260902T181506Z-06ac889` |

The next action is to test Sign in with Apple on a real iPhone using the current App Store build, record the approximate UTC time, and inspect only log lines prefixed with `[Lamako Social Auth]`. Do not redeploy the WordPress guard unless its active hash differs from the recorded value. Do not store or print Apple identity tokens, WordPress JWTs, full relay emails, passwords, or raw HTML bodies. If additional tracing is required, record only stage names, HTTP status, provider, byte counts, exception classes/codes, and hashes.

Before committing additional changes, run:

```bash
pnpm check
pnpm test
php -l scripts/lamako-mobile-api.php
php -l scripts/lamako-mobile-api/includes/social-auth-security.php
git diff --check
```

Keep the detailed incident document updated whenever a new test, deployment, observation, rollback, or unresolved limitation is added.
