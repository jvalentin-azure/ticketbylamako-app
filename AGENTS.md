# Agent Handoff — TicketByLamako

## Active incident: Sign in with Apple on iOS

The active work is on branch `fix/apple-social-json-response-20260902`, based on `origin/feat/client-mobile-web-20260827` at commit `d9520c7a01f233ad0d4ff70c131b410da3de25da`. The official review and continuation point is draft pull request [#8](https://github.com/jvalentin-azure/ticketbylamako-app/pull/8). The code fix is commit `06ac889` and the initial handoff documentation is commit `852a03d`. Do not restart this incident from `main`: the public App Store build matches the feature branch, while `main` does not contain the same Apple login UI and configuration.

Read [`docs/apple-sign-in-incident-2026-09-02.md`](docs/apple-sign-in-incident-2026-09-02.md) before changing authentication code. It contains the Apple screenshot finding, investigation timeline, safe probes, implemented patch, and validation results. Then read [`docs/apple-sign-in-production-deployment-2026-09-02.md`](docs/apple-sign-in-production-deployment-2026-09-02.md) for the Cloudways target, hashes, backup, deployment, postflight, rollback, and successful real-iPhone test. Facebook's one-time visual message is documented separately in [`docs/facebook-ios-transient-message-2026-09-02.md`](docs/facebook-ios-transient-message-2026-09-02.md).

| Area | Current state |
|---|---|
| iOS symptom | `JSON Parse error: Unexpected character: <` after Apple authentication |
| Confirmed client defect | `socialLogin()` parsed a successful non-JSON response directly with `res.json()` |
| Probable server boundary | HTML or an unhandled error is produced after a real Apple token passes verification |
| Client fix | `lib/api/social-auth.ts` reads the body once and reports empty, HTML, or invalid JSON safely |
| WordPress fix | `scripts/lamako-mobile-api.php` buffers unexpected output and converts unhandled exceptions to REST JSON |
| Tests | TypeScript passed; PHP lint passed; 353 tests passed and 4 were skipped |
| Production state | WordPress guard deployed on 2026-09-02; real Apple login succeeded and the account was visible; active SHA-256 `e75bc568ed9d7972d0609e0e11a53acc4b276488b2f3a3853ffed0192d746b98` |
| Production backup | `/home/master/applications/bvprmuerhv/private_html/tbl-apple-social-json-20260902T181506Z-06ac889` |
| Google on iOS | User-reported success; account visible; recorded without personal data |
| Facebook on iOS | Login and account display succeeded; callback HTTP 200; one visual `Something went wrong` message could not be reproduced |
| Facebook decision | No code or Meta configuration change; preserve the functioning flow and monitor only |

The real-iPhone checks are complete for Apple, Google, and Facebook. Do not redeploy or remove the WordPress guard unless a verified incident requires rollback. Do not add the direct `ticketbylamako://` callback to Meta, enable Universal Links, or migrate to a native Facebook SDK without a separate approved plan and a new App Store QA cycle. The remaining functional check is direct email login on iPhone, followed by a decision on whether to merge and publish the defensive React Native parser. Do not store or print identity-provider tokens, WordPress JWTs, full relay emails, passwords, or raw HTML bodies.

Before committing additional changes, run:

```bash
pnpm check
pnpm test
php -l scripts/lamako-mobile-api.php
php -l scripts/lamako-mobile-api/includes/social-auth-security.php
git diff --check
```

Keep the detailed incident document updated whenever a new test, deployment, observation, rollback, or unresolved limitation is added.
