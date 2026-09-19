# P13-F — Measurement & Advertising Adapters — Final Gate

**Project:** L'Essenc Digital\
**Phase:** P13-F — Measurement & Advertising Adapters\
**Date:** 2026-09-19\
**Git closeout:** 2026-09-19\
**Status:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED\
**Implementation branch:** `phase/p13-f-measurement-adapters`\
**Starting baseline:** `c6693335afc4e631174aa5e633e12e5ecfc7b1d7`\
**Implementation commit:** `297b3a9d360a0dbc1c0d0c972d40fe63438801d6`\
**Implementation PR:** #30 — MERGED\
**Canonical implementation merge:** `e1ba280b49186607b2d171fca7ff458f30b0d28d`\
**Checkpoint:** `checkpoint/p13-f-measurement-adapters-complete`\
**Checkpoint target:** `e1ba280b49186607b2d171fca7ff458f30b0d28d`\
**Deploy:** NOT PERFORMED

## 1. Canonical scope

P13-F implements the external measurement and advertising adapter layer defined by P13-A Architecture Freeze R2.

The internal measurement model remains provider-neutral.

External providers observe or receive projections of canonical L'Essenc measurement. They do not become commercial, financial, entitlement or Purchase authority.

P13-F comprises:

- P13-F1 — Google Tag Manager Foundation;
- P13-F2 — Google Analytics 4;
- P13-F3 — Google Ads;
- P13-F4 — Meta Pixel;
- P13-F5 — Meta Conversions API;
- P13-F6 — Provider Deduplication, Consent & Failure Isolation.

## 2. P13-F1 — Google Tag Manager + Consent Mode

The implemented browser orchestration preserves L'Essenc as the canonical consent authority.

Validated behavior includes:

- controlled GTM loading;
- Google Consent Mode projection;
- `analytics_storage`;
- `ad_storage`;
- `ad_user_data`;
- `ad_personalization`;
- UNKNOWN is never silently interpreted as GRANTED;
- fully denied consent does not load Google measurement resources;
- eligible consent can activate the GTM runtime without redefining internal consent truth;
- no unconditional GTM noscript iframe was introduced.

Google Consent Mode is an external projection only and is not the canonical consent store.

## 3. P13-F2 — Google Analytics 4

The canonical projection includes:

- `VIEW_CONTENT` → `view_item`;
- `INITIATE_CHECKOUT` → `begin_checkout`;
- `PURCHASE` → `purchase`.

Canonical Purchase projection preserves:

- `transaction_id` = authoritative Order ID;
- authoritative value derived from `amountMinor / 100`;
- authoritative currency;
- canonical Product and Offer identity;
- provider-neutral AnalyticsEvent authority upstream.

GA4 remains an external destination and is not the canonical analytics database.

## 4. P13-F3 — Google Ads

Google Ads conversion projection is integrated without making application code own account-specific conversion destination configuration.

Validated boundaries include:

- canonical Order ID transaction identity;
- application-owned `AW-*` identifiers are absent;
- application-owned `send_to` configuration is absent;
- browser advertising conversion requires the approved current consent boundary;
- Enhanced Conversions remain outside the initial P13 MVP;
- no customer PII matching was added.

Account-specific Google Ads conversion configuration remains a GTM/provider concern.

## 5. P13-F4 — Meta Pixel

Meta Pixel Purchase projection preserves canonical identity parity:

- `lessenc_event_id` = canonical AnalyticsEvent ID;
- `event_id` = canonical AnalyticsEvent ID;
- `transaction_id` = authoritative Order ID;
- authoritative value and BRL currency;
- canonical Product and Offer identity;
- `content_type = product`.

Current browser delivery is controlled by current advertising consent.

The implementation does not make Meta state canonical commercial or financial truth.

## 6. P13-F5 — Meta Conversions API

P13-F establishes the canonical server-event core and the CAPI transport boundary without authorizing live transport.

Current approved state is:

`TECHNICALLY COMPLETE / POLICY-BLOCKED`

The explicit policy block is:

- error code: `MATCHING_DATA_POLICY_NOT_AUTHORIZED`;
- error class: `PRIVACY_POLICY`;
- terminal dispatch state: `SUPPRESSED`;
- retry: none.

No live Meta Graph transmission is implemented.

The P13-F implementation does not add:

- `user_data`;
- raw IP address;
- raw User-Agent;
- raw email;
- raw telephone;
- CPF;
- `_fbp`;
- `_fbc`;
- Meta Advanced Matching;
- executable Meta HTTP transport.

Provider credentials are not inspected when the privacy-policy suppression applies.

Any future authorization of additional Meta matching data or live CAPI transmission requires a separate privacy/provider review.

## 7. P13-F6 — Provider-neutral dispatch

The provider dispatch lifecycle supports:

- one logical dispatch per canonical AnalyticsEvent + provider + channel;
- idempotent creation;
- consent suppression;
- provider-policy suppression;
- PROCESSING claim semantics;
- successful terminal delivery;
- retryable failure;
- bounded exponential backoff;
- permanent failure;
- stale PROCESSING recovery;
- provider-specific isolation.

The provider policy gate executes before `adapter.send`.

Provider failure must not mutate canonical Order, Payment, Entitlement or Purchase truth.

## 8. Consent boundaries

Canonical consent remains internal to L'Essenc.

Approved distinctions include:

- analytics consent;
- advertising consent;
- UNKNOWN;
- GRANTED;
- DENIED.

Commerce continues independently from analytics or advertising consent.

Browser/provider delivery rules do not rewrite the persisted canonical consent snapshot or canonical financial state.

## 9. Financial authority preserved

P13-F does not create financial truth.

Canonical Purchase continues to require the P13-E authority boundary:

- persisted `Order.status = PAID`;
- persisted `Payment.status = APPROVED`;
- P10 financial coherence;
- canonical Product and Offer;
- authoritative amount and currency;
- maximum one canonical Purchase per Order.

External measurement failure cannot roll back or reinterpret Commerce.

## 10. Privacy boundary

The initial P13 MVP continues to exclude persistent raw PII from the analytics core.

P13-F did not authorize:

- Google Enhanced Conversions;
- Meta Advanced Matching;
- raw PII-based advertising matching;
- raw IP persistence;
- raw User-Agent persistence.

The Meta CAPI transport remains deliberately policy-blocked rather than silently transmitting additional matching data.

## 11. Schema and migration boundary

P13-F required no Prisma schema change and no migration.

Final validation proved:

- `prisma/schema.prisma`: unchanged;
- `prisma/migrations`: unchanged.

The physical AnalyticsEvent and AnalyticsDispatch persistence delivered by earlier P13 blocks remains sufficient.

## 12. Validation evidence

Final targeted P13-F regression:

- 16 test files PASS;
- 108/108 tests PASS.

Full unit/application regression:

- 73 test files PASS;
- 655/655 tests PASS.

Full isolated MySQL regression:

- 20 integration files PASS;
- 188/188 tests PASS.

Additional validation:

- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- Prisma schema/migrations unchanged;
- `git diff --check`: PASS;
- secret-shape review: PASS;
- exact implementation scope: 52 files;
- implementation diff: 7697 insertions / 32 deletions.

A prior isolated 15-second P12 integration timeout did not reproduce. The affected P12 suite subsequently passed in isolation and the unchanged full MySQL regression passed 188/188 without increasing the timeout or changing P12 code.

## 13. Browser/runtime evidence

P13-F browser/runtime gates validated the approved consent and provider projection boundaries in real browser execution.

Validated behavior includes:

- GTM consent-controlled loading;
- GA4 event projection;
- Google Ads browser conversion boundary;
- Meta Pixel browser delivery boundary;
- replay/deduplication behavior;
- canonical event and Order identity preservation;
- no production provider network dependency required for the technical gate.

Live provider receipt confirmation remains outside this local technical closeout.

Meta CAPI live transmission is explicitly not performed because its matching-data policy remains unauthorized.

## 14. Git lifecycle

Canonical implementation lifecycle:

- starting main: `c6693335afc4e631174aa5e633e12e5ecfc7b1d7`;
- implementation commit: `297b3a9d360a0dbc1c0d0c972d40fe63438801d6`;
- implementation PR: #30 — MERGED;
- canonical implementation merge: `e1ba280b49186607b2d171fca7ff458f30b0d28d`;
- checkpoint: `checkpoint/p13-f-measurement-adapters-complete`;
- checkpoint target: `e1ba280b49186607b2d171fca7ff458f30b0d28d`;
- implementation branch local: DELETED;
- implementation branch remote: DELETED;
- deployment: NOT PERFORMED.

The annotated checkpoint is intentionally frozen at the implementation merge.

Documentation-only closeout work must not move, recreate or retarget the checkpoint.

## 15. Final status

P13-F implementation, technical validation, Git integration and checkpointing are complete.

Current state:

`P13-F = COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED`

P13-G — Admin Analytics is the next execution block.

P13-H — Technical Gate remains NOT STARTED.

Production deployment remains outside the current P13-F scope.
