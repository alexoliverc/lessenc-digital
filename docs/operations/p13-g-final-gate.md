# P13-G — Admin Analytics — Final Gate

**Status:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED
**Implementation branch:** `phase/p13-g-admin-analytics`
**Starting baseline:** `93c035e3bf11dea7d4f32d20f20e6f411ca9f2f6`
**Implementation commit:** `9be89c8cc87c52e815d565239c7efe5e046a4579`
**Implementation PR:** #32 — MERGED
**Implementation merge:** `7da548d922046f1c90ee71e13012f3374527146b`
**Checkpoint:** `checkpoint/p13-g-admin-analytics-complete`
**Checkpoint target:** `7da548d922046f1c90ee71e13012f3374527146b`
**Deploy:** NOT PERFORMED

## Scope and boundaries

P13-G adds `/admin/analytics` as a dynamic, server-protected, aggregate-only and read-only administrative surface. `analytics.read` is granted to OWNER and ADMIN and denied to SUPPORT. Menu visibility is UX only; the route calls the existing server-side P12 authorization boundary.

The reporting window is UTC `[from, to)`, defaults to the last 30 calendar days and is limited to 90 days. It reports canonical `VIEW_CONTENT`, `INITIATE_CHECKOUT`, `PURCHASE`, unique journeys, journey-based conversion rates, canonical BRL revenue, and First/Last Touch source, medium and campaign dimensions.

Revenue is exclusively the P13-E canonical Purchase projection. It is never sourced from GA4, Google Ads, Meta, Order plus Payment double counting, or browser input. Unattributed Purchases remain included in total and unattributed revenue.

Pre-Purchase events reconstruct First Touch from the journey and Last Touch from the latest touch at or before the event time. Purchase dimensions use the immutable `OrderAttribution` snapshot and never the mutable journey state.

## Explicit exclusions

- no Prisma schema or migration change;
- no package dependency change;
- no Server Action or analytics mutation;
- no modification of Order, Payment, PaymentEvent, Entitlement, consent, provider dispatch or canonical Purchase;
- no individual customer, journey, consent, provider identifier, raw IP, User-Agent or query-string presentation;
- no ROAS, advertising-spend ingestion, Enhanced Conversions, Advanced Matching or live Meta CAPI transport.

## Validation

- focused RBAC/navigation/report tests: 4 files / 13 tests PASS;
- full unit/application regression: 74 files / 659 tests PASS;
- focused isolated P06 MySQL aggregation: 1 file / 1 test PASS;
- typecheck PASS;
- lint PASS;
- Prisma validate PASS;
- production build PASS, including dynamic `/admin/analytics` route;
- scoped Prettier PASS;
- `git diff --check` PASS;
- schema and migration diff: empty.

The global Prettier check continues to report 36 pre-existing files outside P13-G; no unrelated formatting rewrite was made.

## Final state

P13-G is complete. Its implementation checkpoint is permanently fixed at the implementation merge. Documentation-only commits must not retarget it. P13-H is the next block; deployment remains outside scope.
