# P13 — Analytics, Attribution & Growth Infrastructure

## Phase Execution Brief

**Architecture baseline:** P13-A Architecture Freeze R2
**P13-A:** COMPLETE
**P13-B:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED
**P13-C:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED
**P13-D through P13-H:** NOT STARTED
**Runtime implementation:** IN PROGRESS / P13-B COMPLETE / P13-C COMPLETE

## 1. Objective

P13 establishes the internal measurement, acquisition attribution and external measurement infrastructure required to understand how users arrive, interact, initiate checkout and complete purchases.

P13 must preserve the existing commercial and financial boundaries established by P08 through P12.

Analytics must observe and project commercial truth. Analytics must never create or redefine financial truth.

## 2. Canonical Architecture

Canonical internal measurement is provider-neutral.

Core conceptual entities:

- AcquisitionJourney
- AttributionTouch
- OrderAttribution
- AnalyticsEvent
- AnalyticsDispatch

Canonical initial AnalyticsEvent types:

- VIEW_CONTENT
- INITIATE_CHECKOUT
- PURCHASE

Canonical financial authority for PURCHASE:

- persisted Order.status = PAID
- persisted Payment.status = APPROVED

There may be at most one canonical PURCHASE per Order.

## 3. Attribution Model

P13 uses both First Touch and Last Touch.

Rules:

- First Touch is immutable within an AcquisitionJourney
- Last Touch represents the most recent eligible external attributable interaction
- direct or internal navigation does not erase a valid Last Touch
- attribution lookback is 30 days
- journey attribution lifetime is 30 days

Approved UTM allowlist:

- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term

Raw query strings are not canonical attribution data and must not be persisted.

## 4. Privacy and Consent

P13 separates:

- Essential Commerce
- Internal Transactional Measurement
- First-Party Acquisition Measurement
- External Advertising

Minimum internal consent states:

- UNKNOWN
- GRANTED
- DENIED

UNKNOWN must never be silently interpreted as GRANTED.

Commerce must continue when analytics or advertising consent is denied.

P13 MVP does not require persistent raw IP address, raw User-Agent, raw email, telephone or CPF inside the analytics core.

Advanced advertising matching based on customer PII remains outside the initial P13 MVP.

## 5. External Measurement Architecture

P13 is provider-neutral internally and multi-provider externally.

Approved client-side orchestration layer:

- Google Tag Manager

Approved initial external destinations:

- Google Analytics 4
- Google Ads
- Meta

Google Tag Manager is orchestration infrastructure only.

Google Analytics 4, Google Ads and Meta are external destinations and adapters only.

None of these providers may become canonical commercial, financial or entitlement authority.

## 6. P13-A — Architecture, Privacy & Measurement Contract

Status: COMPLETE

Deliverables:

- Architecture Freeze R2
- canonical measurement contract
- attribution model
- privacy and consent boundary
- Purchase authority
- reconciliation requirements
- Outbox constraints
- provider-neutral event model
- multi-provider measurement architecture
- Admin Analytics boundary
- stop conditions

Canonical document:

- docs/architecture/p13-analytics-attribution-growth-contract.md

## 7. P13-B — Attribution Persistence Foundation

Status: COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED

Objective:

Implement the persistence foundation required by the approved P13-A architecture.

Expected implementation areas:

- Prisma models
- migrations
- foreign keys
- indexes
- uniqueness constraints
- persistence repositories
- MySQL integration validation

Expected conceptual persistence:

- AcquisitionJourney
- AttributionTouch
- OrderAttribution
- AnalyticsEvent
- AnalyticsDispatch

Critical constraints:

- one canonical PURCHASE per Order
- one logical dispatch per AnalyticsEvent + provider + channel
- no weakening of existing P08-P12 schema authority

<!-- P13-B-IMPLEMENTATION-EVIDENCE -->
### P13-B implementation evidence

Branch:

`phase/p13-b-attribution-persistence`

Starting baseline:

`328de43bedfb400d2b5bb0cd5f2a1014375ac2d8`

Migration:

`20260917002445_p13_attribution_persistence_foundation`

SHA-256:

`FC996BFE634DACF41C98C9C989F482EC580420EAE0D74D2CE787D5C0384DB33B`

Delivered:

- physical persistence for AcquisitionJourney, AttributionTouch, OrderAttribution, AnalyticsEvent and AnalyticsDispatch;
- provider-neutral application repository ports;
- Prisma repository adapters;
- one-per-Order attribution snapshot foundation;
- PURCHASE deduplication foundation;
- dispatch uniqueness foundation;
- isolated MySQL validation;
- no P10/P11 Outbox redesign;
- no P13-C/D/E/F behavior.

Final evidence:

- 435/435 unit tests PASS;
- production build PASS;
- 6/6 targeted P13-B MySQL tests PASS;
- 155/155 full MySQL integration tests PASS;
- dev/test migrations CURRENT;
- Prisma validation PASS;
- typecheck PASS;
- lint PASS;
- git diff --check PASS;
- scoped P13-B Prettier PASS.

P13-B Git lifecycle is COMPLETE: implementation commit `78d20ad0c4afec4cb3a9f9c8ea11e7b880ef0663`, PR #22 MERGED, canonical implementation merge `d5e829fbff763431bcb434fc5f694054247926d1`, and checkpoint `checkpoint/p13-b-attribution-persistence-complete`.

<!-- P13-B-GIT-INTEGRATION-CLOSEOUT -->
### P13-B Git Integration Closeout

Canonical implementation lifecycle:

- implementation commit: `78d20ad0c4afec4cb3a9f9c8ea11e7b880ef0663`;
- PR #22: MERGED;
- implementation merge: `d5e829fbff763431bcb434fc5f694054247926d1`;
- checkpoint: `checkpoint/p13-b-attribution-persistence-complete`;
- checkpoint target: `d5e829fbff763431bcb434fc5f694054247926d1`;
- implementation branch: removed locally and remotely;
- deploy: NOT PERFORMED.

P13-B is now:

**COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED**

P13-C is COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED.

## 8. P13-C — Acquisition Journey & Order Attribution

Status: COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED

Objective:

Implement acquisition capture and immutable Order attribution.

Expected behavior:

- create or recover first-party AcquisitionJourney
- capture eligible UTM acquisition context
- sanitize landing path
- sanitize external referrer host
- establish First Touch
- update eligible Last Touch
- preserve direct traffic without erasing valid external attribution
- create immutable OrderAttribution snapshot when the Order boundary is reached
- explicitly support unattributed Orders

Provider-specific identifiers such as gclid, gbraid, wbraid, fbclid, fbc and fbp must not become canonical commercial authority.


<!-- P13-C-IMPLEMENTATION-EVIDENCE -->
### P13-C implementation evidence

Branch:

`phase/p13-c-acquisition-order-attribution`

Starting baseline:

`8f501575078a589a6712a3685f92548e6e89def3`

Delivered:

- first-party pseudonymous AcquisitionJourney runtime;
- canonical five-key UTM allowlist and bounded sanitation;
- sanitized landing path and external referrer hostname;
- immutable First Touch and eligible Last Touch;
- direct/internal preservation behavior;
- first-party HttpOnly SameSite=Lax Journey cookie;
- prefetch exclusion;
- live HTTP + MySQL acquisition validation;
- immutable OrderAttribution snapshot;
- explicit unattributed Order snapshots;
- OrderAttribution creation inside the authoritative Order transaction;
- rollback safety;
- sequential retry immutability;
- concurrent CREATED + EXISTING idempotency;
- provider-neutral canonical attribution;
- no Prisma schema or migration change;
- no P13-D/E/F/G/H behavior.

Final evidence:

- 48 unit/application files / 498 tests PASS;
- 19 MySQL integration files / 165 tests PASS;
- P13-C focused unit/boundary evidence: 63 tests;
- P13-C focused MySQL evidence: 10 tests;
- Prisma validate PASS;
- typecheck PASS;
- lint PASS;
- production build PASS;
- live HTTP runtime PASS;
- three prefetch exclusion signals PASS;
- concurrency PASS;
- rollback PASS;
- `git diff --check` PASS.

Canonical final review:

- `docs/operations/p13-c-final-gate.md`

Git lifecycle remains owner-controlled and has not yet been performed.

The sentence above is retained as historical implementation-closeout evidence.

<!-- P13-C-GIT-LIFECYCLE-CLOSEOUT -->
### P13-C Git lifecycle closeout

- implementation commit: `e7b99cb18c655465845ef91f968dc588b78c0575`;
- PR #24: MERGED;
- canonical implementation merge: `52ae12416abbdb1931f0b8798de3fb6866695d98`;
- checkpoint: `checkpoint/p13-c-acquisition-order-attribution-complete`;
- checkpoint target: `52ae12416abbdb1931f0b8798de3fb6866695d98`;
- deployment: NOT PERFORMED.

The checkpoint remains fixed at the implementation merge. This lifecycle closeout does not reopen P13-A Architecture Freeze R2.

P13-D through P13-H remain NOT STARTED.

## 9. P13-D — Internal Measurement Producers & Consent Boundary

Status: NOT STARTED

Objective:

Implement canonical internal production of VIEW_CONTENT and INITIATE_CHECKOUT and establish the runtime consent boundary.

VIEW_CONTENT must represent a valid commercial Product and Offer exposure.

INITIATE_CHECKOUT must represent a valid server-side checkout initiation and must not be defined by a simple CTA click.

Expected implementation areas:

- internal event producers
- schemaVersion handling
- canonical timestamps
- journey association
- attribution state
- consent snapshot
- technical duplicate protection
- browser-safe event projection
- sanitized dataLayer integration boundary

## 10. P13-E — Canonical Purchase & Financial Reconciliation

Status: NOT STARTED

Objective:

Implement PURCHASE as a projection of persisted P10 financial truth.

PURCHASE may exist only when:

- Order.status = PAID
- Payment.status = APPROVED

PURCHASE must never be created from:

- browser state
- JavaScript
- redirect
- Thank You page
- GTM
- GA4
- Google Ads
- Meta
- provider response

Required capabilities:

- canonical Purchase projection
- database uniqueness
- concurrency safety
- webhook replay safety
- idempotency
- reconciliation of PAID + APPROVED Orders missing PURCHASE

Analytics failure must never roll back a successful commercial transaction.

## 11. P13-F — Measurement & Advertising Adapters

Status: NOT STARTED

The former Meta-only P13-F scope is superseded.

Approved scope:

### P13-F1 — Google Tag Manager Foundation

- controlled GTM installation
- dataLayer contract
- consent-aware tag orchestration
- no canonical business logic inside GTM
- no server secrets inside GTM

### P13-F2 — Google Analytics 4

- Google tag configuration
- GA4 measurement destination
- ecommerce mapping
- VIEW_CONTENT -> view_item
- INITIATE_CHECKOUT -> begin_checkout
- PURCHASE -> purchase
- trusted transaction_id
- trusted value
- trusted currency

GA4 remains an external analytics destination and is not the canonical analytics database.

### P13-F3 — Google Ads

- Google Ads conversion measurement
- approved GTM-managed conversion tags
- provider-specific click identifiers where approved
- gclid
- gbraid
- wbraid
- server-side or API integration only after provider contract validation

Google Enhanced Conversions remain outside the initial P13 MVP.

### P13-F4 — Meta Pixel

- browser-side Meta Pixel
- GTM orchestration where approved
- canonical event projection

### P13-F5 — Meta Conversions API

- server-side Meta adapter
- canonical provider event identity
- provider retry isolation

### P13-F6 — Provider Deduplication, Consent & Failure Isolation

- provider dispatch state
- retry
- backoff
- idempotency
- consent suppression
- provider failure isolation
- Pixel/CAPI deduplication
- provider-specific observability compatibility

## 12. Google Consent Mode

Google Consent Mode is part of the approved client-side measurement architecture.

Relevant provider signals include:

- analytics_storage
- ad_storage
- ad_user_data
- ad_personalization

These signals are projections of the canonical L'Essenc privacy preference state.

Google Consent Mode is not the canonical consent store.

## 13. P13-G — Admin Analytics

Status: NOT STARTED

Expected route:

- /admin/analytics

Expected permission:

- analytics.read

Admin Analytics is read-only over commercial and financial truth.

Expected initial metrics:

- VIEW_CONTENT
- INITIATE_CHECKOUT
- PURCHASE
- unique journeys
- View to Checkout conversion
- Checkout to Purchase conversion
- View to Purchase conversion
- source
- medium
- campaign
- First Touch
- Last Touch
- total revenue
- attributed revenue
- unattributed revenue

Event count and unique journey count must remain separate metrics.

ROAS is not supported until an authoritative advertising-spend data source exists.

## 14. P13-H — Technical Gate

Status: NOT STARTED

Objective:

Validate P13 end-to-end without regression of P08 through P12.

Required validation areas include:

- attribution persistence
- First Touch
- Last Touch
- direct traffic behavior
- UTM sanitation
- OrderAttribution immutability
- VIEW_CONTENT production
- INITIATE_CHECKOUT production
- PURCHASE financial authority
- Purchase uniqueness
- reconciliation
- concurrency
- webhook replay
- provider dispatch
- GTM boundary
- GA4 mapping
- Google Ads mapping
- Meta Pixel
- Meta CAPI
- consent behavior
- provider failure isolation
- Admin Analytics RBAC
- unattributed revenue
- regression P08-P12

Technical gates should include as applicable:

- Prisma validation
- migration validation
- MySQL integration tests
- unit tests
- integration tests
- typecheck
- lint
- production build
- dependency/security checks
- end-to-end validation

## 15. Explicit Non-Goals for Initial P13 MVP

Initial P13 does not require:

- Google Enhanced Conversions
- Meta Advanced Matching
- raw PII-based advertising matching
- authoritative advertising spend ingestion
- ROAS
- refund analytics event semantics
- redesign of the existing P10/P11 Outbox into multi-consumer infrastructure
- implementation of the future Service Health / Observability platform

## 16. Future Compatibility

P13 must remain compatible with future:

- business intelligence
- recommendation systems
- AI and predictive analytics
- customer segmentation
- growth optimization
- LTV modeling
- campaign optimization
- personalization
- Service Health / Observability / Incident Management

Potential future operational signals include:

- provider dispatch success rate
- provider dispatch failure rate
- retry volume
- reconciliation lag
- projection lag
- provider latency
- provider error rate

These operational capabilities are not implemented by P13 unless explicitly brought into scope.

## 17. Current Canonical State

- P00-P12: COMPLETE
- P13-A: COMPLETE
- P13-A Architecture Freeze R2: CURRENT CANONICAL BASELINE
- P13-B: COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED
- P13-C: COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED
- P13-D: NOT STARTED
- P13-E: NOT STARTED
- P13-F: NOT STARTED
- P13-G: NOT STARTED
- P13-H: NOT STARTED
- P13 runtime implementation: IN PROGRESS / P13-B COMPLETE / P13-C COMPLETE
