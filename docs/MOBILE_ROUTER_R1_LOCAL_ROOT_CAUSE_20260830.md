# Mobile router R1 local root-cause analysis

## Scope and evidence

This analysis is local and read-only with respect to staging and production.
The R1 remote window is closed and its active state was rolled back. Evidence
comes from the sealed manifest
`tbl-mobile-router-staging-20260830T104647Z-8d1cb2b-r1`, whose
`manifest.sha256` is
`108a7bd18ed4c09530c1f473cf830a3cc7bc34086b17bfb2ebd03be20ab31479`,
and from the earlier exact-bundle R3 report for tree
`1e5fdbb552d25b95a52328f0e6e34fddf4620d7f5cfe300c6daf1062a9ebefcc`.

## Attribution

### Twelve HTTP 403 responses

The 403 responses belong to the WordPress control surfaces, not the mobile
bundle or router. They are repeated requests for the
`cafe-events-carousel` CSS and JavaScript while rendering classic and desktop
WordPress pages. The same steps proved that the mobile-router marker was
absent. These responses remain an observable WordPress asset-policy debt, but
they are not caused by the candidate router.

Owner: **WordPress asset policy / control surface**.

### Five intercepted mutation attempts

All five requests were POST attempts to the staging root and were aborted by
the browser route guard before transmission. They were observed while the
checkout, desktop and service-worker/control steps were active. The R1
harness used one global `currentStep` for several pages, so late activity from
a WordPress page could be attributed to the next step. The sealed report did
not preserve a per-request page identity or initiator, therefore no plugin can
be named safely from this evidence alone.

Owner: **WordPress control activity plus harness attribution gap**. The
candidate-owned mutation count is not provable from R1; transmitted mutations
are proven to be zero.

### Thirty-five blocking request failures

The report contains read-only resource cancellations that occurred when the
harness immediately navigated away from the previous page. R1 only treated
cancellations during `initial-navigation` and `deep-refresh` as expected. It
did not open an explicit transition window before each `goto`, and its global
step variable allowed late requests from one page to inherit another page's
step. The absence of CORS, TLS and invalid-JSON errors, together with the
successful route and exclusion checks, does not support a router transport
regression.

Owner: **QA harness lifecycle attribution**. Real DNS, TLS, CORS, HTTP and
connection failures outside an explicit read-only transition must remain
blocking.

### Missing 27 June date and failed event deep refresh

R1 navigated to `/mobile/event/13771`, waited a fixed 1.8 seconds and checked
only the body date. The exact same application bundle had already passed the
stabilized R3 WebKit scenario with event `13459`, title
`Lamako Acoustique #2 – Olombelo Ricky`, the contractual 27 June date and a
90-second semantic wait followed by network idle. That report recorded 40
requests, zero blocking failures and a successful deep refresh.

The application continues to render `formatEventDate(event)`, and the event
date unit tests prove that the v2 contractual date wins over WordPress's
publication date. No application change is justified by R1.

Owner: **wrong QA fixture plus insufficient stabilization**.

## Local tooling correction

The release-gate tooling now:

- pins the proven event fixture `13459` with its exact title;
- validates title, 27 June and absence of 3 May together;
- recognizes only read-only, null-status cancellations inside an explicit
  `navigation-transition` as expected;
- attributes errors and mutation attempts to either `mobile-app` or
  `wordpress-control` without weakening the existing strict scenario gate;
- keeps WordPress control debt visible instead of blaming the mobile
  candidate.

## Required R2 protocol changes

No R2 remote attempt is authorized by this document. A future harness must:

1. start from a fresh WebKit iPhone context with the anti-mutation route guard
   installed before the first URL;
2. capture page identity, scenario surface, started step, failure step,
   initiator, status and redacted URL per request using request-scoped state;
3. use event `13459`, wait for the exact title and contractual date, then wait
   for network idle before and after deep refresh;
4. open an explicit `navigation-transition` only around deliberate GET/HEAD/
   OPTIONS navigations;
5. require zero candidate-owned mutations, transport failures, HTTP errors,
   invalid JSON, console errors, page errors, BlurHash requests and overflow;
6. report WordPress control-page POST attempts and 403 assets separately, with
   all mutation transmission still blocked;
7. persist the complete report before evaluating either the strict environment
   gate or the candidate-ownership gate.
