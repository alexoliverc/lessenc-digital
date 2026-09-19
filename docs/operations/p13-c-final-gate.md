# P13-C — Acquisition Journey & Order Attribution — Final Gate

**Project:** L'Essenc Digital
**Phase:** P13-C — Acquisition Journey & Order Attribution
**Date:** 2026-09-17
**Git closeout:** 2026-09-19
**Status:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED
**Branch:** `phase/p13-c-acquisition-order-attribution`
**Starting baseline:** `8f501575078a589a6712a3685f92548e6e89def3`
**Deploy:** NOT PERFORMED

## 1. Canonical baseline

P13-C implements the acquisition and immutable Order-attribution behavior defined by P13-A Architecture Freeze R2 and uses the persistence foundation delivered by P13-B.

P13-B remains:

`COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED`

Its checkpoint remains:

`checkpoint/p13-b-attribution-persistence-complete`

P13-C does not alter or move that checkpoint.

No P13-C Git integration, checkpoint or deployment has been performed yet.

The sentence above is retained as historical evidence of the 2026-09-17 implementation gate. The current Git lifecycle state is recorded in section 12. Deployment remains NOT PERFORMED.

## 2. Acquisition Journey behavior delivered

P13-C implements first-party pseudonymous acquisition capture for the public sales experience.

Delivered behavior:

- random opaque first-party AcquisitionJourney identifier;
- no PII encoded in the Journey identifier;
- fixed 30-day Journey attribution lifetime;
- fixed 30-day attribution lookback;
- exact canonical UTM allowlist:
  - `utm_source`;
  - `utm_medium`;
  - `utm_campaign`;
  - `utm_content`;
  - `utm_term`;
- unknown query parameters are ignored;
- provider-specific advertising identifiers do not become canonical acquisition authority;
- landing data is reduced to sanitized internal path only;
- external referrer data is reduced to sanitized hostname;
- same-origin/internal referrer is not treated as an external acquisition source;
- First Touch is immutable;
- Last Touch advances only through eligible external attributable interaction;
- later direct/internal navigation does not erase valid external attribution;
- subsequent direct/internal page views do not create unnecessary AttributionTouch records.

The physical persistence layer serializes concurrent Journey observations with a database row lock before changing attribution pointers.

## 3. HTTP and first-party browser boundary

The public acquisition boundary is implemented for:

`/cronograma-capilar-inteligente`

The Next.js Proxy:

- creates or reuses the first-party Journey UUID;
- sets an HttpOnly cookie;
- uses `SameSite=Lax`;
- uses root path `/`;
- uses the approved 30-day lifetime;
- forwards only private internal request metadata required by the server acquisition adapter;
- does not access Prisma or the database;
- does not forward the raw query string as canonical persistence;
- remains provider-neutral.

Prefetch acquisition is explicitly excluded for:

- `Purpose: prefetch`;
- `Next-Router-Prefetch`;
- `Sec-Purpose` prefetch signals.

Real production-server HTTP validation proved all three prefetch paths returned HTTP 200 while issuing zero acquisition cookies and producing zero AttributionTouch persistence.

## 4. Runtime acquisition proof

Live HTTP + MySQL validation proved:

1. campaign acquisition:
   - HTTP 200;
   - first-party Journey cookie created;
   - CAMPAIGN touch persisted;
   - canonical UTM values persisted;
   - raw/unknown query data not persisted;
   - external referrer reduced to hostname;
   - First and Last Touch established;

2. subsequent direct/internal navigation:
   - same Journey reused;
   - cookie not unnecessarily refreshed;
   - no new direct page-view touch;
   - First/Last attribution pointers preserved;

3. external referral:
   - REFERRAL touch persisted;
   - sanitized external hostname persisted;
   - Last Touch advanced;
   - First Touch remained immutable;

4. prefetch:
   - HTTP response remained successful;
   - no acquisition cookie created;
   - no acquisition persistence created.

Runtime fixtures were removed after validation.

## 5. Immutable OrderAttribution

P13-C integrates immutable attribution snapshot creation into the authoritative P09 Order transaction.

For a newly created Order, the transaction is:

`Customer -> Order -> OrderItem -> OrderAttribution`

The snapshot:

- is one-per-Order;
- copies eligible First/Last attribution state at conversion time;
- uses the authoritative Order creation timestamp as `capturedAt`;
- supports active Journey context with no eligible external attribution;
- supports fully unattributed Orders;
- never fabricates synthetic `"unknown"` attribution values;
- remains immutable after Order creation.

For a new Order without an eligible Journey, one explicit OrderAttribution row is still created with nullable attribution fields.

Historical Orders that predate P13-C remain compatible with the optional physical relation established in P13-B.

## 6. Atomicity, rollback and idempotency

OrderAttribution is created inside the same authoritative database transaction that creates the Order.

Real isolated MySQL validation proved:

- successful attributed Order creation commits Order + OrderItem + OrderAttribution together;
- successful unattributed Order creation commits exactly one explicit unattributed snapshot;
- forced OrderAttribution persistence failure rolls back:
  - Customer;
  - Order;
  - OrderItem;
  - attempted OrderAttribution;
- an existing snapshot used to provoke failure remains untouched;
- sequential retry with a newer Journey returns `EXISTING` without rewriting the original attribution;
- concurrent duplicate Order creation resolves as exactly:
  - one `CREATED`;
  - one `EXISTING`;
- concurrency leaves:
  - exactly one Order;
  - exactly one OrderItem;
  - exactly one winning Customer;
  - exactly one OrderAttribution belonging to the winning transaction.

The `EXISTING` recovery path is outside snapshot creation and therefore cannot reinterpret later visitor behavior.

## 7. Provider-neutral and privacy boundaries

P13-C does not make Google, Meta or any advertising provider a canonical business authority.

Provider-specific identifiers including:

- `gclid`;
- `gbraid`;
- `wbraid`;
- `fbclid`;
- `fbc`;
- `fbp`;

are not persisted as canonical acquisition authority by P13-C.

References to such identifiers inside P13-C tests exist only as negative assertions proving they are rejected or ignored.

P13-C persists no raw query string and does not persist sensitive full referrer URLs.

## 8. Schema and migration boundary

P13-C required no Prisma schema mutation and no migration.

The physical persistence required by this phase was already established by P13-B.

Final P13-C validation proved:

- `prisma/schema.prisma`: unchanged;
- `prisma/migrations`: unchanged;
- Prisma schema validation: PASS.

## 9. Technical evidence

Final full unit/application regression:

- 48 test files PASS;
- 498/498 tests PASS.

Final full isolated MySQL regression:

- 19 integration files PASS;
- 165/165 tests PASS.

P13-C-specific test surfaces contain:

- acquisition policy: 26 tests;
- acquisition Journey: 10 tests;
- acquisition HTTP boundary: 10 tests;
- Proxy: 6 tests;
- OrderAttribution policy: 8 tests;
- transactional OrderAttribution adapter: 3 tests;
- AcquisitionJourney MySQL integration: 5 tests;
- OrderAttribution MySQL atomicity/idempotency integration: 5 tests.

Total P13-C-focused evidence represented by those files:

- 63 unit/boundary tests;
- 10 MySQL integration tests.

Additional validation:

- Prisma validate: PASS;
- TypeScript: PASS;
- ESLint: PASS;
- `git diff --check`: PASS;
- production build: PASS;
- live production-server HTTP acquisition gate: PASS;
- prefetch runtime exclusion gate: PASS;
- MySQL concurrency gate: PASS;
- transaction rollback gate: PASS;
- retry immutability gate: PASS.

## 10. Frozen boundaries preserved

P13-C does not implement P13-D, P13-E, P13-F, P13-G or P13-H responsibilities.

Not implemented by P13-C:

- canonical VIEW_CONTENT production;
- canonical INITIATE_CHECKOUT production;
- runtime consent orchestration;
- canonical PURCHASE projection;
- financial reconciliation;
- GTM;
- GA4;
- Google Ads delivery;
- Meta Pixel;
- Meta Conversions API;
- provider dispatch workers;
- provider retry/backoff;
- Admin Analytics.

P10 financial authority remains unchanged.

P11 entitlement authority and its Outbox consumption remain unchanged.

P12 administrative identity and authorization remain unchanged.

Analytics/acquisition behavior does not become financial or entitlement authority.

## 11. Implementation surface

The complete P13-C implementation worktree contains 20 source/test surfaces.

A previous keyword-filtered documentary audit reported 18 because its discovery filter did not include two valid P13-C files whose filenames do not contain `attribution`:

- `src/app/cronograma-capilar-inteligente/acquisition.server.ts`;
- `src/infrastructure/database/prisma-checkout-order-repository.ts`.

The full worktree and final validation include both files.

## 12. Git state

At the 2026-09-17 implementation documentary closeout:

- branch: `phase/p13-c-acquisition-order-attribution`;
- starting HEAD remains `8f501575078a589a6712a3685f92548e6e89def3`;
- implementation commit: NOT YET PERFORMED;
- push: NOT PERFORMED;
- PR: NOT CREATED;
- merge: NOT PERFORMED;
- checkpoint/tag: NOT CREATED;
- deploy: NOT PERFORMED.

These operations remain owner-controlled.

The block above is preserved as historical pre-integration evidence.

Current canonical Git lifecycle:

- implementation commit: `e7b99cb18c655465845ef91f968dc588b78c0575`;
- push: COMPLETE;
- PR #24: MERGED;
- canonical implementation merge: `52ae12416abbdb1931f0b8798de3fb6866695d98`;
- checkpoint/tag: `checkpoint/p13-c-acquisition-order-attribution-complete`;
- checkpoint target: `52ae12416abbdb1931f0b8798de3fb6866695d98`;
- deploy: NOT PERFORMED.

The annotated checkpoint intentionally remains fixed at the implementation merge. Documentation-only closeout commits must not move, recreate or retarget it.

## 13. Final status

P13-C implementation, technical validation and documentation are complete.

Current state:

`P13-C = COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED`

P13-D through P13-H remain NOT STARTED.

Production deployment remains outside the current P13-C scope.
