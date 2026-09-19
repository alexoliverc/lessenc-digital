# P13-D — Internal Measurement Producers & Consent Boundary — Final Gate

**Project:** L'Essenc Digital
**Phase:** P13-D — Internal Measurement Producers & Consent Boundary
**Date:** 2026-09-19
**Status:** COMPLETE / PASS / DOCUMENTED / AWAITING GIT INTEGRATION
**Branch:** `phase/p13-d-internal-measurement-consent`
**Starting baseline:** `ff07153ad4494c54e0984e38b7a4a26bae8b3bad`
**Deploy:** NOT PERFORMED

## 1. Canonical baseline

P13-D implements the provider-neutral internal measurement and runtime consent responsibilities frozen by P13-A R2. It builds on the integrated P13-B persistence foundation and the integrated P13-C AcquisitionJourney and immutable OrderAttribution behavior.

P13-A, P13-B and P13-C remain frozen and are not reinterpreted by this implementation.

P13-D does not implement canonical PURCHASE, provider delivery, Admin Analytics or the final P13 technical gate. Those responsibilities remain in P13-E through P13-H.

## 2. Canonical internal measurement

The application now produces provider-neutral `AnalyticsEvent` records for:

- `VIEW_CONTENT`;
- `INITIATE_CHECKOUT`.

Both producers use:

- canonical UUID event identity;
- canonical occurrence timestamp;
- schema version `1`;
- authoritative Product and Offer context resolved through the existing P08 catalog boundary;
- optional active Journey association;
- explicit `ATTRIBUTED` or `UNATTRIBUTED` state;
- a consent snapshot containing analytics, advertising and policy version;
- database-backed idempotent creation.

The P13-D producer rejects `PURCHASE`. It never invents Order identity or payment authority.

## 3. Idempotency and persistence behavior

`AnalyticsEventRepository.createIdempotent` now distinguishes:

- a compatible replay of the same event ID, returned as `EXISTING`;
- a newly created event, returned as `CREATED`;
- a collision on a different unique key, which remains an error and is not misclassified as an event-ID replay.

Real MySQL validation proves that a conflicting canonical Purchase key is not swallowed by the technical event-ID idempotency path.

No Prisma schema or migration change was required by P13-D. The physical models delivered by P13-B remain sufficient.

## 4. VIEW_CONTENT boundary

`VIEW_CONTENT` is produced only for a successfully resolved commercial Product and Offer exposure.

The public sales Proxy:

- generates the private event UUID;
- forwards it to the server through a private request header;
- preserves the P13-C acquisition headers;
- excludes navigation prefetch;
- does not access Prisma;
- does not expose canonical Journey identity to browser code.

The server producer persists the event after the response lifecycle. Measurement failure is caught, emits only a bounded technical failure code and never makes the public commercial response unavailable.

## 5. INITIATE_CHECKOUT boundary and temporal identity

`INITIATE_CHECKOUT` is produced when the server successfully resolves a valid checkout experience and issues the checkout submission token. A CTA click alone is not canonical initiation authority.

One server timestamp is used for:

- checkout token `issuedAt`;
- the `INITIATE_CHECKOUT` measurement context;
- persisted `AnalyticsEvent.occurredAt`.

The token submission UUID and analytics event UUID are distinct. No Order ID is fabricated before authoritative Order creation.

The real HTTP + MySQL gate compared token time to persisted event time through textual SQL `DATE_FORMAT` normalization and proved exact equality. No tolerance window was added and `src/infrastructure/database/client.ts` remains unchanged.

## 6. Runtime consent boundary

The canonical first-party consent state remains persisted on the active AcquisitionJourney.

Supported explicit selections are:

- analytics granted / advertising denied;
- analytics granted / advertising granted;
- analytics denied / advertising denied.

Advertising granted with analytics denied is rejected. `UNKNOWN` cannot be submitted as consent and is never treated as granted.

The same-origin consent HTTP boundary:

- accepts only a strict, bounded JSON body;
- requires an exact same-origin `Origin` for mutation;
- derives Journey identity exclusively from the HttpOnly first-party cookie;
- never returns Journey identity;
- updates only a non-expired Journey;
- supports later withdrawal;
- returns no-store responses;
- fails closed without blocking Commerce.

The repository serializes consent mutation with a row lock, does not regress `lastSeenAt` and rejects mutation at or after Journey expiry.

## 7. Browser-safe projection

The browser receives only a sanitized provider-neutral projection containing:

- measurement event name and UUID;
- canonical measurement type;
- Product and Offer IDs;
- amount and currency when applicable;
- schema version;
- consent booleans and policy version.

The projection excludes:

- Journey ID;
- IP address;
- user-agent;
- email;
- phone;
- CPF;
- token or signing secret;
- payment-provider credentials.

The browser pushes measurement only when analytics consent is `GRANTED`. `UNKNOWN` and `DENIED` remain ineligible. A provider-neutral `lessenc_consent_update` projection supports later GTM/provider orchestration without making the browser the canonical consent store.

## 8. Live HTTP + MySQL evidence

The optimized production server was exercised against the isolated P06 MySQL database at `127.0.0.1:3307/lessenc_test` with temporary, identified fixtures.

Observed results:

- public product HTTP: `200`;
- checkout HTTP: `200`;
- first-party Journey cookie issued;
- initial consent: `UNKNOWN/UNKNOWN`;
- explicit consent update: `GRANTED/GRANTED`;
- exactly one `VIEW_CONTENT` persisted;
- exactly one `INITIATE_CHECKOUT` persisted;
- `VIEW_CONTENT` consent snapshot: `UNKNOWN/UNKNOWN`;
- `INITIATE_CHECKOUT` consent snapshot: `GRANTED/GRANTED`;
- checkout token `issuedAt` format: canonical UTC instant;
- exact `issuedAt == occurredAt`: PASS.

All runtime fixtures were removed. A final database query confirmed zero residual Product and Offer fixture rows.

## 9. Technical evidence

Final unit/application regression:

- 53 test files PASS;
- 525/525 tests PASS.

P13-D focused boundary suite:

- 6 test files PASS;
- 33/33 tests PASS.

Final isolated MySQL regression:

- 19 integration files PASS;
- 170/170 tests PASS.

Focused analytics persistence integration:

- 11/11 tests PASS.

Additional validation:

- Prisma schema validation: PASS;
- isolated `lessenc_test` migration status: CURRENT, 8 migrations;
- TypeScript: PASS;
- ESLint: PASS;
- scoped Prettier: PASS;
- `git diff --check`: PASS;
- optimized production build: PASS;
- dependency audit at `high`: 0 vulnerabilities;
- live HTTP + MySQL measurement gate: PASS;
- consent grant and withdrawal persistence: PASS;
- expired Journey mutation rejection: PASS;
- temporal equality without tolerance: PASS.

The first build invocation exposed that the shell session did not define the already-required P12 admin-auth secret. The final build used a fictitious validation-only value and passed. No real credential was introduced or persisted.

## 10. Frozen boundaries preserved

P13-D does not:

- create canonical PURCHASE;
- infer payment from redirect, browser state or provider response;
- alter Order or Payment status;
- dispatch to GTM, GA4, Google Ads, Meta Pixel or Meta CAPI;
- implement provider retry/backoff;
- add `analytics.read` or `/admin/analytics`;
- alter the P10/P11 Outbox;
- add Enhanced Conversions or Advanced Matching;
- ingest raw PII;
- deploy to any environment.

P10 remains financial authority. P11 remains entitlement and secure-delivery authority. P12 administrative identity and authorization remain unchanged.

## 11. Git and progression state

At this implementation gate:

- implementation commit: NOT YET CREATED;
- push: NOT YET PERFORMED;
- PR: NOT YET CREATED;
- merge: NOT YET PERFORMED;
- checkpoint: NOT YET CREATED;
- deploy: NOT PERFORMED.

P13-D is technically complete and may proceed through its authorized Git lifecycle. P13-E remains the next execution block after P13-D integration and checkpointing.
