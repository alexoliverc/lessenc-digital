# P13-E — Canonical Purchase & Financial Reconciliation — Final Gate

**Project:** L'Essenc Digital
**Phase:** P13-E — Canonical Purchase & Financial Reconciliation
**Date:** 2026-09-19
**Status:** COMPLETE / PASS / DOCUMENTED / AWAITING GIT INTEGRATION
**Branch:** `phase/p13-e-canonical-purchase-reconciliation`
**Starting baseline:** `90b49e755e0d3afe2fc8aa6f9ab816f7a3689766`
**Deploy:** NOT PERFORMED

## 1. Canonical authority

P13-E implements canonical `PURCHASE` strictly as a projection of persisted P10 financial truth.

Purchase eligibility requires all of the following under an Order row lock:

- persisted `Order.status = PAID`;
- non-null persisted `Order.paidAt`;
- exactly one persisted `Payment.status = APPROVED`;
- non-null persisted `Payment.approvedAt`;
- no financial review flag;
- Mercado Pago provider identity;
- non-null provider Order and Payment identities;
- canonical P10 operation fingerprint;
- active attempt ownership for the Order;
- submitted payment attempt;
- persisted `PaymentEvent.applicationResult = APPLIED` matching provider identities, amount and currency;
- exact Order/Payment amount and currency equality;
- BRL currency;
- exactly one internally coherent OrderItem snapshot.

Browser state, redirect, Thank You page, JavaScript, GTM, GA4, Google Ads, Meta and raw provider response are not Purchase authority.

## 2. Canonical Purchase event

An eligible Order produces one provider-neutral `AnalyticsEvent` with:

- type `PURCHASE`;
- `occurredAt` from persisted `Order.paidAt`;
- canonical Order identity;
- authoritative Product and Offer from the persisted OrderItem;
- authoritative Order amount and currency;
- immutable OrderAttribution Journey identity when available;
- `ATTRIBUTED` or `UNATTRIBUTED` from the immutable OrderAttribution snapshot;
- consent snapshot from the persisted first-party Journey when available;
- explicit `UNKNOWN/UNKNOWN` consent when no Journey exists;
- schema version `1`;
- `purchaseOrderKey = Order.id`.

No provider-specific destination becomes financial or commercial authority.

## 3. Uniqueness, replay and concurrency

The existing P13-B unique `purchaseOrderKey` enforces maximum one canonical Purchase per Order.

The projection additionally locks the Order row before checking for an existing Purchase. This serializes concurrent projection attempts and produces deterministic:

- one `CREATED` result;
- subsequent `EXISTING` results;
- exactly one persisted Purchase row.

Sequential replay, concurrent replay and webhook replay were validated against real MySQL.

## 4. Post-commit financial integration

`FinancialCoordinator` now supports an optional post-observation listener.

The sequence is:

`P10 applyObservation commit -> P13 observer -> Purchase projection`

The listener runs only after the financial repository call completes. Listener failure is caught and reduced to the bounded code:

`P13_CANONICAL_PURCHASE_PROJECTION_FAILED`

No Order, Payment, PaymentEvent or Outbox state is rolled back, downgraded or reinterpreted when Analytics fails.

The observer is active for:

- provider create response;
- webhook;
- provider reconciliation;
- approved-state polling recovery.

Rejected or review-required financial observations do not attempt Purchase projection.

## 5. Reconciliation

P13-E provides a bounded reconciliation service for persisted `PAID + APPROVED` Orders missing canonical Purchase.

The candidate query repeats the authoritative financial and commercial predicates and excludes Orders that already have `purchaseOrderKey` persistence.

Each candidate is fully revalidated under the Order lock before projection. A stale or concurrently changed candidate becomes `INELIGIBLE`; it is never forced into Analytics.

The reconciliation report separates:

- scanned;
- created;
- existing;
- ineligible;
- failed.

Individual candidate failure does not stop the bounded batch. Limits outside `1..500` are rejected.

The server-only composition entrypoint is intentionally not exposed as a public HTTP route. Production scheduling or an administrative trigger remains a separate operational authorization and deploy concern.

## 6. MySQL evidence

Real isolated MySQL validation proves:

- Purchase is absent before authoritative financial state;
- attributed Purchase maps Product, Offer, Order, revenue, Journey, attribution and consent correctly;
- unattributed Purchase does not invent source, Journey or consent;
- sequential replay leaves one Purchase;
- concurrent projection leaves one Purchase;
- reconciliation repairs an eligible missing Purchase;
- a second reconciliation finds no remaining candidate;
- multiple approved payments are rejected as ambiguous;
- an invalid P10 operation fingerprint is rejected;
- Analytics projection failure occurs after the financial commit and does not roll it back;
- create response plus webhook replay leaves one Purchase.

## 7. Technical evidence

Final unit/application regression:

- 54 test files PASS;
- 532/532 tests PASS.

P13-E application suite:

- 7/7 tests PASS.

Final isolated MySQL regression:

- 20 integration files PASS;
- 180/180 tests PASS.

P13-E focused MySQL:

- 10/10 tests PASS.

Additional validation:

- Prisma schema validation: PASS;
- isolated `lessenc_test` migration status: CURRENT, 8 migrations;
- TypeScript: PASS;
- ESLint: PASS;
- scoped Prettier: PASS;
- `git diff --check`: PASS;
- optimized production build: PASS;
- dependency audit at `high`: 0 vulnerabilities.

No dependency, Prisma schema or migration change was required.

## 8. Frozen boundaries preserved

P13-E does not:

- change the P10 financial transaction or authority rules;
- change the P10/P11 Outbox or add a second Outbox consumer;
- create Purchase from a redirect, page load or browser event;
- roll back successful Commerce when Analytics fails;
- implement GTM, GA4, Google Ads, Meta Pixel or Meta CAPI delivery;
- implement provider dispatch state/retry;
- add `/admin/analytics` or `analytics.read`;
- implement refund analytics semantics;
- ingest raw PII;
- deploy or schedule a production reconciler.

## 9. Git and progression state

At this implementation gate:

- implementation commit: NOT YET CREATED;
- push: NOT YET PERFORMED;
- PR: NOT YET CREATED;
- merge: NOT YET PERFORMED;
- checkpoint: NOT YET CREATED;
- deploy: NOT PERFORMED.

P13-E is technically complete and may proceed through its authorized Git lifecycle. P13-F remains the next execution block after P13-E integration and checkpointing.
