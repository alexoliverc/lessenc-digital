# P13 — Analytics, Attribution & Growth Infrastructure

## Architecture, Privacy & Measurement Contract

**Block:** P13-A — Architecture, Privacy & Measurement Contract
**Status:** OWNER APPROVED / ARCHITECTURE FROZEN R2 / DOCUMENTATION COMPLETE
**Runtime implementation:** IN PROGRESS / P13-B COMPLETE / P13-C COMPLETE / P13-D COMPLETE / PASS / DOCUMENTED / AWAITING GIT INTEGRATION / P13-E–P13-H NOT STARTED

## 1. Core Principle

Analytics never creates, replaces or alters financial truth.

Financial authority remains with Commerce and Payments.

Canonical measurement truth will belong to internal AnalyticsEvent.

Meta and future analytics providers are adapters only and never commercial authority.

## 2. Dependencies

P13 depends on the integrated boundaries of P08, P09, P10, P11 and P12.

P13 must not weaken or reinterpret those phases.

## 3. Attribution Model

P13 uses First Touch + Last Touch.

### AcquisitionJourney

Represents a first-party pseudonymous acquisition journey.

Its identifier must be random, opaque and must not encode PII.

### AttributionTouch

Represents an eligible acquisition touch, not every page view.

### First Touch

First eligible external attributable touch in the current Journey.

First Touch is immutable during that Journey.

### Last Touch

Most recent eligible external attributable touch before conversion.

Direct or internal traffic does not overwrite a valid external Last Touch.

### Attribution Window

Approved attribution lookback: 30 days.

Approved Journey attribution lifetime: 30 days.

## 4. UTM Contract

Approved UTM allowlist:

- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term

Raw query strings must not be persisted.

Unknown query parameters are ignored by the attribution core.

UTM values must be normalized deterministically and stored with bounded lengths.

## 5. Landing and Referrer

Allowed:

- sanitized internal landing path without query parameters
- sanitized external referrer host or origin

Not stored by default:

- full external referrer URL
- raw query string
- URLs containing tokens or PII

## 6. Retention

Initial approved retention:

- AcquisitionJourney and AttributionTouch detailed pseudonymous data: 90 days
- detailed AnalyticsEvent data: 180 days
- genuinely anonymous aggregates may be retained longer
- OrderAttribution follows the future commercial-record retention policy

## 7. OrderAttribution

OrderAttribution is an immutable attribution snapshot created for an Order.

Later visitor behavior must never rewrite attribution for an existing Order.

An Order without eligible attribution remains valid and is classified as unattributed.

Conceptual fields:

- orderId
- journeyId
- firstTouchId
- lastTouchId
- firstSource
- firstMedium
- firstCampaign
- lastSource
- lastMedium
- lastCampaign
- capturedAt

## 8. AnalyticsEvent

AnalyticsEvent is the canonical internal measurement record.

AnalyticsEvent is measurement truth only and never financial truth.

Initial conceptual fields:

- id
- type
- occurredAt
- journeyId
- productId
- offerId
- orderId
- amount
- currency
- attributionState
- consentSnapshot
- schemaVersion
- createdAt

Initial schemaVersion: 1.

## 9. MVP Events

The initial canonical P13 event types are:

- VIEW_CONTENT
- INITIATE_CHECKOUT
- PURCHASE

No additional event type is required to complete the initial P13 MVP.

## 10. VIEW_CONTENT

VIEW_CONTENT represents a valid commercial exposure whose Product and Offer were resolved through the authoritative server-side commercial path.

It is not defined merely by browser JavaScript, hydration or Meta Pixel execution.

VIEW_CONTENT may include journeyId, productId and offerId when available.

Technical deduplication must prevent accidental duplicate emission for the same technical occurrence.

## 11. INITIATE_CHECKOUT

INITIATE_CHECKOUT represents the start of a valid server-side checkout journey for an authoritative Product and Offer.

A simple CTA click is not sufficient authority.

The exact producer will be implemented at the approved P09 server-side checkout boundary.

INITIATE_CHECKOUT may occur before persistent Order creation.

## 12. PURCHASE

PURCHASE is a projection of already-persisted financial truth.

PURCHASE must never be created from:

- Thank You page
- redirect
- browser state
- JavaScript
- CTA click
- Meta Pixel
- Meta provider response

Canonical Purchase authority requires:

- Order.status = PAID
- Payment.status = APPROVED

Both facts must already be persisted through the authoritative P10 financial path.

Purchase value and currency must come from trusted persisted commercial and financial data.

## 13. Purchase Uniqueness

There may be at most one canonical PURCHASE per Order.

Conceptual identity:

- purchase:{orderId}

Physical persistence must enforce uniqueness so retries, webhook replays, reconciliation and concurrent workers cannot create duplicate canonical Purchase events.

## 14. Purchase Reconciliation

P13 must be able to detect:

- Order.status = PAID
- Payment.status = APPROVED
- canonical PURCHASE missing

and create the missing PURCHASE idempotently.

The Purchase reconciler may read authoritative financial state and create analytics projections only.

It must never:

- change Order status
- change Payment status
- approve Payment
- create or initiate refund
- create Entitlement
- revoke Entitlement
- alter delivery authority

## 15. Refund

A later refund does not erase the historical fact that a Purchase occurred.

Canonical PURCHASE must not be deleted or rewritten merely because the Order is later refunded.

Refund analytics semantics are outside the mandatory initial P13 MVP event set.

## 16. Existing P10/P11 Outbox Constraint

The physical P13-A audit confirmed that the current PAYMENT_APPROVED OutboxEvent is consumed by P11 using a global event status.

P11 locks the OutboxEvent, processes the financial entitlement effect and changes the same event row to PROCESSED.

The current Outbox does not provide independent per-consumer processing state.

Therefore P13 must not silently reuse the same PAYMENT_APPROVED OutboxEvent row as a second independent analytics subscriber.

P13 will use an independent idempotent Purchase projection and reconciliation boundary.

Any future multi-subscriber Outbox redesign requires separate architectural approval.

## 17. AnalyticsDispatch

AnalyticsDispatch represents delivery of a canonical AnalyticsEvent to an external provider.

AnalyticsEvent persistence and provider delivery are separate concerns.

Conceptual dispatch states:

- PENDING
- PROCESSING
- RETRYABLE
- SUCCEEDED
- FAILED
- SUPPRESSED

Retry behavior must be bounded, idempotent and use backoff.

A retry must never create a new canonical AnalyticsEvent.

Each logical combination of analytics event, provider and channel must be unique.

## 18. Meta Boundary (R1 Historical / Superseded)

This section records the original R1 Meta-specific boundary.

Its provider scope is superseded by Sections 27 through 40, which define the canonical multi-provider architecture for Google Tag Manager, Google Analytics 4, Google Ads and Meta.

The financial-authority and failure-isolation principles documented here remain valid.

Initial provider:

- META

Initial channels:

- PIXEL
- CAPI

Meta is an adapter only and never a source of commercial or financial truth.

Meta failure must never change Order, Payment, Purchase, Entitlement or delivery truth.

For the same canonical event, Pixel and CAPI should use the same canonical event identity.

Recommended provider event identity:

- event_id = AnalyticsEvent.id

## 19. Consent

Minimum consent states:

- UNKNOWN
- GRANTED
- DENIED

Analytics and advertising consent are separate concerns.

Advertising behavior:

- UNKNOWN -> Meta OFF
- DENIED -> Meta OFF
- GRANTED -> Meta eligible

Advertising consent must never become a Commerce gate.

## 20. Privacy and PII Minimization

P13 MVP core analytics does not persist by default:

- raw IP address
- raw User-Agent
- raw email
- hashed email for advertising
- telephone
- CPF

Advanced Matching is outside the initial P13 MVP.

fbclid, fbc and fbp are provider-specific context and are not core P13 authority.

Any future use of additional advertising identifiers requires separate privacy and provider review.

## 21. Analytics Failure Isolation

Analytics failure must never invalidate Commerce.

Failure in any of the following must not roll back or block the commercial flow:

- AcquisitionJourney
- AttributionTouch
- VIEW_CONTENT
- INITIATE_CHECKOUT
- PURCHASE projection
- AnalyticsDispatch
- provider retry
- reconciliation

Commerce must remain valid for:

- product experience
- checkout
- Order creation
- Payment processing
- Order.PAID
- Entitlement
- protected digital delivery

## 22. Admin Analytics

Future route:

- /admin/analytics

Future permission:

- analytics.read

Admin Analytics must remain read-only over financial truth.

It must never:

- mark an Order as PAID
- approve a Payment
- create PURCHASE manually
- modify canonical revenue
- create or revoke Entitlement
- rewrite historical attribution

## 23. Revenue and Metrics

Analytics revenue must derive from authoritative internal commercial and financial state.

External provider-reported revenue is not canonical.

P13 must distinguish:

- attributed revenue
- unattributed revenue

Event count and unique journey count are different metrics and must not be treated as equivalent.

Initial reporting may include:

- VIEW_CONTENT count
- INITIATE_CHECKOUT count
- PURCHASE count
- unique journeys
- View to Checkout conversion
- Checkout to Purchase conversion
- View to Purchase conversion
- First Touch
- Last Touch
- source
- medium
- campaign

## 24. ROAS

ROAS is not supported in the initial P13 MVP until a reliable advertising-spend authority exists.

Revenue alone is not ROAS.

## 25. Stop Conditions

Dependent implementation must stop if:

1. financial authority would need to change
2. P10 or P11 contracts would need to be weakened
3. PURCHASE could exist without persisted PAID and APPROVED proof
4. analytics failure could block Commerce
5. the existing Outbox would need to be silently converted into multi-consumer infrastructure
6. canonical Purchase uniqueness cannot be guaranteed
7. additional PII is required without explicit approval
8. raw query strings could reach persistence or logs
9. provider secrets could reach the browser or logs
10. Admin Analytics could bypass server-side RBAC
11. ROAS would be reported without authoritative ad-spend data
12. P08 through P12 would regress
13. a protected schema, dependency or external-provider operation lacks explicit authorization

## 26. Current P13-A State

- P13-A Architecture Freeze R1: SUPERSEDED BY CONTROLLED AMENDMENT
- P13-A Architecture Freeze R2: FROZEN / COMPLETE
- P13-A Documentation: COMPLETE
- P13 Runtime Implementation: IN PROGRESS / P13-B COMPLETE / P13-C IMPLEMENTATION COMPLETE
- P13-B: COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED

## 27. Controlled Architecture Amendment

P13-A Architecture Freeze R1 was reopened for a controlled architectural amendment before final documentary closure.

The amendment expands P13 from a Meta-only external measurement boundary to a multi-provider measurement architecture.

Approved initial external destinations:

- Google Analytics 4
- Google Ads
- Meta

Google Tag Manager is the approved client-side tag orchestration layer.

Google Tag Manager is not canonical measurement truth and is not commercial or financial authority.

Internal AnalyticsEvent remains the canonical L'Essenc measurement record.

External providers remain adapters and destinations only.

The controlled amendment was documented, technically reviewed and incorporated into Architecture Freeze R2.

## 28. Multi-Provider Measurement Architecture

The approved P13 external measurement architecture is multi-provider.

Client-side orchestration:

- Google Tag Manager

Initial external destinations:

- Google Analytics 4
- Google Ads
- Meta

Provider responsibilities:

- Google Analytics 4: external behavioral and ecommerce analytics destination
- Google Ads: advertising conversion and attribution destination
- Meta: advertising conversion and attribution destination

Google Tag Manager may orchestrate approved browser-side tags and event delivery.

Google Tag Manager must not become the canonical event store.

Google Analytics 4 must not become canonical commercial or financial truth.

Google Ads must not become canonical commercial or financial truth.

Meta must not become canonical commercial or financial truth.

## 29. Provider Adapters

Initial browser-side adapters may include:

- GA4 through Google Tag Manager
- Google Ads conversion tags through Google Tag Manager
- Meta Pixel through Google Tag Manager

Initial server-side adapters may include:

- Meta Conversions API
- Google Ads server-side or API integration when approved and applicable

Every provider integration must consume canonical or sanitized L'Essenc measurement data.

Provider-specific failures must remain isolated from Commerce.

## 30. GTM Data Layer Boundary

L'Essenc may expose sanitized client-side event projections to Google Tag Manager through dataLayer.

The dataLayer is an integration boundary, not canonical persistence and not commercial authority.

Only approved non-sensitive measurement fields may be exposed.

Sensitive financial payloads, credentials, PII and provider secrets must never be placed in dataLayer.

## 31. Event Mapping

Canonical L'Essenc events remain provider-neutral.

Initial mapping:

- VIEW_CONTENT -> GA4 view_item -> Meta ViewContent
- INITIATE_CHECKOUT -> GA4 begin_checkout -> Meta InitiateCheckout
- PURCHASE -> GA4 purchase -> Meta Purchase

Provider naming must never replace the canonical internal event type.

PURCHASE values exposed to providers must originate from trusted persisted commercial and financial state.

## 32. Google Advertising Identifiers

Google-specific advertising context may include:

- gclid
- gbraid
- wbraid

These identifiers are provider-specific attribution context and are not commercial authority.

They must never be required to create Order, Payment, PURCHASE, Entitlement or canonical revenue.

Storage, retention and forwarding of provider identifiers must remain subject to privacy, consent and provider-specific review.

## 33. Google Consent Mode Boundary

Google Consent Mode is part of the approved P13 client-side measurement architecture.

The Google-specific consent signals considered by the integration are:

- analytics_storage
- ad_storage
- ad_user_data
- ad_personalization

These provider-specific signals must be derived from the L'Essenc privacy preference model.

L'Essenc remains the authority for the user's internal consent state.

Google Consent Mode is a provider integration mechanism and must not become the canonical consent store.

Conceptual mapping:

- analytics GRANTED -> analytics_storage eligible for granted
- analytics DENIED -> analytics_storage denied
- advertising DENIED -> ad_storage denied
- advertising DENIED -> ad_user_data denied
- advertising DENIED -> ad_personalization denied

UNKNOWN must never be silently converted into GRANTED.

The exact mapping for every consent combination must be validated during implementation against the approved privacy policy and provider requirements.

Consent Mode configuration must never become a Commerce dependency.

Order creation, Payment processing, Entitlement and protected delivery must continue even when analytics or advertising consent is denied.

## 34. Google Tag Manager Governance

Google Tag Manager is the approved client-side orchestration layer for measurement and advertising tags.

Initial GTM responsibilities may include:

- Google tag configuration
- GA4 event delivery
- Google Ads conversion tags
- Conversion Linker when required
- Meta Pixel
- consent-aware tag orchestration
- approved future measurement tags

GTM must not contain canonical business logic.

GTM must not determine whether an Order is paid.

GTM must not determine whether a Payment is approved.

GTM must not create canonical PURCHASE authority.

GTM must not create Entitlement authority.

GTM must not receive provider secrets or server credentials.

Published GTM configuration must be treated as production configuration and subject to controlled change management.

## 35. Google Analytics 4 Boundary

Google Analytics 4 is an external analytics destination.

GA4 is not the canonical analytics database for L'Essenc.

Loss, delay, filtering or provider-side transformation of GA4 data must not alter internal AnalyticsEvent history.

Initial ecommerce mapping:

- VIEW_CONTENT -> view_item
- INITIATE_CHECKOUT -> begin_checkout
- PURCHASE -> purchase

For PURCHASE, provider-facing transaction data must originate from trusted persisted L'Essenc state.

Conceptual GA4 purchase parameters may include:

- transaction_id derived from canonical Order identity
- value derived from authoritative commercial or financial data
- currency derived from authoritative commercial or financial data
- approved item data derived from authoritative catalog and Order state

Browser-supplied price or revenue must never override canonical server-side values.

GA4 event names are provider vocabulary only and must not replace the internal AnalyticsEvent type.

## 36. Google Ads Boundary

Google Ads is an external advertising conversion and attribution destination.

Google Ads is not financial authority.

Google Ads is not canonical revenue authority.

Google Ads conversion reporting must be derived from approved L'Essenc measurement projections.

Google-specific identifiers such as gclid, gbraid and wbraid remain provider context only.

They may improve provider attribution but must never be required for a valid commercial transaction.

Google Ads conversion delivery may initially use approved GTM-managed browser tags.

Server-side or API-based Google Ads conversion delivery may be added when its exact provider contract is approved during P13-F implementation.

Google Enhanced Conversions are outside the initial P13 MVP.

Use of hashed email, telephone or other customer-provided advertising identifiers requires a separate privacy and provider review.

## 37. Meta Boundary Under Multi-Provider Architecture

Meta remains an approved advertising destination.

Initial Meta channels remain:

- Pixel
- Conversions API

Meta Pixel may be orchestrated through Google Tag Manager.

Meta Conversions API remains a server-side adapter.

For a canonical event delivered through both Pixel and CAPI, the same canonical event identity should be used for provider deduplication.

Meta provider state must never become Order, Payment, PURCHASE or Entitlement authority.

Meta Advanced Matching remains outside the initial P13 MVP.

## 38. Multi-Provider Failure Isolation

A provider failure must be isolated to that provider dispatch.

Examples:

- GA4 failure must not block Google Ads
- Google Ads failure must not block Meta
- Meta failure must not block GA4
- GTM client-side failure must not invalidate internal AnalyticsEvent
- any external measurement failure must not invalidate Commerce

Canonical internal measurement must remain recoverable independently from provider delivery.

## 39. P13-F Revised Scope

The previous Meta-only P13-F scope is superseded.

Approved revised name:

P13-F — Measurement & Advertising Adapters

Planned implementation sequence:

- P13-F1 — Google Tag Manager Foundation
- P13-F2 — Google Analytics 4
- P13-F3 — Google Ads
- P13-F4 — Meta Pixel
- P13-F5 — Meta Conversions API
- P13-F6 — Provider Deduplication, Consent and Failure Isolation

This structure may be physically implemented in fewer modules where appropriate, but the architectural responsibilities must remain separated.

## 40. Controlled Amendment Result

The P13-A architecture is no longer Meta-only.

The approved target architecture is provider-neutral internally and multi-provider externally.

Approved initial client-side orchestration:

- Google Tag Manager

Approved initial external measurement destinations:

- Google Analytics 4
- Google Ads
- Meta

Canonical L'Essenc measurement truth remains AnalyticsEvent.

Canonical financial truth remains outside Analytics and continues to belong to the authoritative Commerce and Payments boundaries.

Architecture Freeze R2 is the current canonical P13-A architecture baseline.

<!-- P13-B-IMPLEMENTATION-STATUS -->
## 41. Implementation Status — P13-A Lifecycle and P13-B

This section records implementation and Git lifecycle state only. It does not amend or reopen Architecture Freeze R2.

P13-A lifecycle:

- documentary commit: `86fb0d1d6b09c5375ac386f45baf47f61a63111b`;
- PR #21: MERGED;
- canonical merge: `328de43bedfb400d2b5bb0cd5f2a1014375ac2d8`;
- checkpoint: `checkpoint/p13-a-architecture-freeze-r2`.

P13-B — Attribution Persistence Foundation:

**COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED**

The physical/provider-neutral persistence foundation now exists for AcquisitionJourney, AttributionTouch, immutable OrderAttribution, AnalyticsEvent and AnalyticsDispatch.

This status update does not change any frozen P13-A architecture decision.

Historical P13-B closeout state: P13-C through P13-H were NOT STARTED at that checkpoint.

<!-- P13-B-GIT-CLOSEOUT-STATUS -->
### P13-B Git Lifecycle Closeout

This subsection records implementation lifecycle state only. It does not amend, supersede, or reopen Architecture Freeze R2.

P13-B implementation lifecycle:

- implementation commit: `78d20ad0c4afec4cb3a9f9c8ea11e7b880ef0663`;
- PR #22: MERGED;
- implementation merge: `d5e829fbff763431bcb434fc5f694054247926d1`;
- checkpoint: `checkpoint/p13-b-attribution-persistence-complete`;
- checkpoint target: `d5e829fbff763431bcb434fc5f694054247926d1`;
- implementation branch cleanup: COMPLETE;
- deploy: NOT PERFORMED.

P13-B = **COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED**.

Historical P13-B closeout state: P13-C through P13-H were NOT STARTED at that checkpoint.

<!-- P13-C-IMPLEMENTATION-STATUS -->
## 42. Implementation Status — P13-C

This section records implementation state only. It does not amend, supersede or reopen Architecture Freeze R2.

P13-C — Acquisition Journey & Order Attribution:

**COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED**

Implemented behavior now includes:

- first-party pseudonymous AcquisitionJourney creation/recovery;
- eligible CAMPAIGN and REFERRAL acquisition capture;
- immutable First Touch;
- eligible Last Touch;
- direct/internal preservation;
- exact canonical UTM allowlist;
- sanitized landing path and external referrer hostname;
- 30-day Journey lifetime;
- 30-day attribution lookback;
- first-party browser cookie boundary;
- prefetch exclusion;
- immutable OrderAttribution at authoritative Order creation;
- explicit unattributed Order snapshots;
- atomic Order + OrderAttribution persistence;
- retry immutability;
- concurrency-safe CREATED + EXISTING behavior.

P13-C does not change frozen financial, entitlement, consent, Purchase or external-provider authority.

Canonical validation record:

- `docs/operations/p13-c-final-gate.md`

Git integration, checkpointing and deployment have not yet been performed.

The sentence above is retained as historical P13-C implementation-closeout evidence.

<!-- P13-C-GIT-CLOSEOUT-STATUS -->
### P13-C Git Lifecycle Closeout

This subsection records lifecycle state only. It does not amend, supersede or reopen Architecture Freeze R2.

P13-C implementation lifecycle:

- implementation commit: `e7b99cb18c655465845ef91f968dc588b78c0575`;
- PR #24: MERGED;
- implementation merge: `52ae12416abbdb1931f0b8798de3fb6866695d98`;
- checkpoint: `checkpoint/p13-c-acquisition-order-attribution-complete`;
- checkpoint target: `52ae12416abbdb1931f0b8798de3fb6866695d98`;
- deployment: NOT PERFORMED.

P13-C = **COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED**.

The checkpoint remains fixed at the implementation merge and must not be moved by later documentation-only work.

At the P13-C checkpoint, P13-D through P13-H remained NOT STARTED.

<!-- P13-D-IMPLEMENTATION-STATUS -->
## 43. Implementation Status — P13-D

This section records implementation state only. It does not amend, supersede or reopen Architecture Freeze R2.

P13-D — Internal Measurement Producers & Consent Boundary:

**COMPLETE / PASS / DOCUMENTED / AWAITING GIT INTEGRATION**

Implemented behavior now includes:

- provider-neutral `VIEW_CONTENT` and `INITIATE_CHECKOUT` production;
- authoritative Product and Offer context;
- canonical schema version, timestamp and event identity;
- Journey association, attribution state and consent snapshot;
- idempotent event persistence without masking other unique-key conflicts;
- Proxy prefetch exclusion;
- post-response failure isolation from public sales and checkout;
- explicit persisted analytics and advertising consent;
- same-origin consent mutation and withdrawal;
- browser-safe provider-neutral dataLayer projection;
- exact checkout token `issuedAt` and analytics `occurredAt` equality.

Canonical validation record:

- `docs/operations/p13-d-final-gate.md`

Git integration, checkpointing and deployment have not yet been performed.

P13-E through P13-H remain NOT STARTED.
