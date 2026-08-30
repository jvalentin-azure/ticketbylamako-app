# Mobile router R2 local root-cause analysis

## Scope

This analysis is local and read-only for staging and production. R2 ended as
`ROLLED_BACK_NO_GO`; the remote lock is absent and all staging baselines were
restored. The sealed R2 report SHA-256 is
`3697f99443dd100b2e5c608f19d68657df7157443d960711318235a46765dcbb`.

## Proven cause

R2 did not fail because event `13459` returned bad data. The event request was
never started.

The R2 report records:

- the application document, CSS and JavaScript loading successfully;
- repeated requests for `onboarding-1` and `onboarding-2`;
- zero requests to `/wp-json/` or `/lamako-catalog/`;
- zero HTTP errors, console errors, page errors or invalid JSON;
- a 90-second timeout waiting for the event title and contractual date.

The exact staged bundle entry
`entry-02ccbf769aa73c595e807ed041f86fbb.js`, SHA-256
`407c89164c0a544220fc2fb51effbffa2d2379a9242b0d2e8c6c87fa84e07bdb`,
contains the same first-use contract as `app/_layout.tsx`:

- storage key `@ticketbylamako/onboarding-version`;
- expected version `2`;
- absent state renders `CustomSplash` instead of the Expo route tree.

R2 created a fresh WebKit context and did not complete or seed onboarding.
`CustomSplash` therefore remained mounted over `/mobile/event/13459`; the
event component never mounted, so `getTCEvent(13459)` and `getEventsData()`
could not execute.

This also explains why the earlier exact-bundle WebKit R3 passed: its harness
explicitly seeded the onboarding version before navigation. That run reached
the event API, rendered 27 June, rejected 3 May and passed deep refresh.

## Application and API attribution

No application correction is justified by this evidence:

- `handleOnboardingFinish()` only clears the onboarding shell and does not
  replace the current route;
- the `Passer` action invokes that handler, so the deep-link URL is preserved;
- once mounted, the event screen starts catalogue and detail requests in
  parallel;
- the date renderer uses the contractual mobile event date;
- the prior exact-bundle run proves event `13459` and its API contract.

The R2 failure is a scenario-precondition defect in the QA harness, not an API,
date-normalization or client-router regression.

## Cancellation evidence

Three R2 document requests emitted `Load request cancelled` after an HTTP 200
had already been observed. They remain blocking under the published contract,
which permits only read-only cancellations with a null status in an explicit
navigation window. This RCA does not reclassify or waive them.

Future evidence must preserve response status and request-failure timing as
separate immutable fields so this WebKit sequence remains auditable.

## Corrected QA contract

Two scenarios are required and must not be conflated:

1. **First-use scenario:** fresh storage, verify both onboarding slides, finish
   through the visible `Passer`/`Découvrir` control and prove that the original
   deep-link path is preserved.
2. **Content scenario:** seed
   `@ticketbylamako/onboarding-version=2` before the first document, then run
   event `13459`, semantic title/date wait, network idle and deep refresh.

The strict network gates are unchanged. Mutations, HTTP errors, non-null-status
cancellations, TLS/CORS/DNS/JSON/console/page failures, BlurHash requests and
overflow remain blocking.
