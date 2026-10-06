# P17 — End-to-End & Business Validation Architecture

## Status

P17-01 — VALIDATION ARCHITECTURE & RELEASE CANDIDATE BASELINE

ARCHITECTURE FROZEN / IMPLEMENTATION READY

This document defines the validation architecture for P17.

It does not authorize deployment, production activation, provider mutation, payment production
credentials, database mutation, destructive cleanup or movement of any previous checkpoint.

## Canonical baseline

Repository baseline:

`6e269e6db928b228babd8ffd44c3f55574cade4c`

Phase branch:

`phase/p17-end-to-end-business-validation`

Previous immutable checkpoint:

`checkpoint/p16-staging-deployment-complete`

Previous hosted technical release:

`22fad0f690618c27cabcfa58528a76ce0a580ad3`

P16 remains closed and its permanent checkpoint must not be moved by P17 work.

## Objective

P17 validates the complete system and business journey in staging.

Canonical journey:

Public Experience
→ Checkout
→ Order
→ Mercado Pago
→ Webhook
→ Payment
→ Entitlement
→ Delivery
→ Admin
→ Audit

P17 is primarily a validation phase.

Existing commerce, payment, entitlement, buyer-access and administrative authority must not be
silently redesigned merely to make an E2E scenario pass.

A discovered product defect must be classified and remediated explicitly before the affected gate can
continue.

## Validation layers

### Repository quality

Vitest remains authoritative for current unit, boundary and application/infrastructure tests.

Existing Vitest tests whose names include `browser` remain Node-based contract tests. They are not
real-browser E2E evidence.

### Database integration

Existing integration suites remain authoritative for bounded integration behavior.

P17 must not relabel database-integration tests as provider/browser E2E evidence.

### Real browser E2E

`@playwright/test` is the approved P17 real-browser runner.

It is not installed by P17-01-B1.

A separate controlled toolchain gate must add it, lock its version and validate the dependency graph.

### Real provider validation

Mercado Pago interactions remain TEST-only.

Production payment credentials and real-money activation are prohibited.

The browser is presentation authority only. Financial truth remains server/provider-side.

### Hosted application validation

The staging target remains:

`https://lessenc.com.br`

Hosted validation must distinguish application source identity, browser evidence, provider evidence,
persisted business state, administrative/audit projection and infrastructure readiness.

No single signal proves all layers.

## P17 execution identity

Each controlled P17 execution must have an evidence-package run identifier.

Conceptual name:

`P17_RUN_ID`

It is evidence metadata only.

It is not payment, authentication, authorization or business authority.

Secrets and protected provider material must never enter the evidence package.

## Evidence model

Every applicable scenario must record:

- scenario identifier;
- P17 run identifier;
- start and finish timestamps;
- target application release;
- browser engine and version;
- viewport;
- public route result;
- Order identity;
- Payment state;
- provider TEST result;
- webhook/reconciliation result;
- Entitlement result;
- buyer-access/delivery result;
- administrative projection;
- audit projection;
- sanitized failure classification;
- final outcome.

Allowed outcomes:

- PASS;
- FAIL;
- BLOCKED;
- PENDING_EXTERNAL;
- NOT_APPLICABLE.

Screenshots and traces support evidence but do not replace authoritative server/provider state.

## Data isolation

P17 test data must remain distinguishable from ordinary application activity through values already
supported by the application/provider contracts.

P17 must not introduce a schema change solely to tag test data unless independently authorized.

Destructive blanket cleanup is prohibited.

## Mercado Pago boundary

P17 uses Mercado Pago TEST only.

`P16_MERCADOPAGO_CREDENTIAL_SET=test` remains the staging attestation unless a later controlled
migration replaces the P16-named staging contract.

Credential shape does not independently prove TEST authority.

## Protected buyer delivery

P17 must validate:

Buyer Session
→ rate limit
→ entitlement/resource authorization
→ server-only storage key
→ PrivateResourceStorage
→ private R2 object
→ backend stream
→ protected HTTP response
→ delivery audit

The browser must receive neither R2 credentials nor a direct private-storage URL.

### Hosted byte-range transport reconciliation

P17 hosted validation established that the hosting transport may honor an HTTP `Range` request after the application has already completed its protected backend flow.

Byte-range is transport behavior, not buyer authentication or resource-authorization authority.

The required invariant is:

`Buyer Session -> rate limit -> entitlement/resource authorization -> private storage -> protected backend response -> optional hosted 206 transport -> delivery audit`

P17 must prove adversarially that:

- missing Buyer Session plus Range remains denied;
- invalid Buyer Session plus Range remains denied;
- a valid Buyer Session cannot use Range to obtain an unauthorized resource;
- an authorized resource may be materialized as HTTP 200 or HTTP 206 by the hosted transport;
- no R2 credential, storage key or direct private-storage URL is exposed.

The application does not depend on `Accept-Ranges: none` and does not treat the incoming Range header as an authorization control.

### Hosted G5-D proof — 06/10/2026

The hosted adversarial matrix was executed against release:

`9e2ef25f4667b19f727c6ba1e277a79f55e3086f`

Observed results:

- missing Buyer Session plus Range -> `401 SESSION_INVALID`;
- invalid Buyer Session plus Range -> `401 SESSION_INVALID`;
- valid Buyer Session plus unauthorized resource plus Range -> `404 RESOURCE_NOT_AVAILABLE`;
- the unauthorized case created no delivery audit event;
- valid Buyer Session plus authorized resource plus Range -> `206 Partial Content`;
- the authorized case produced exactly one new `DigitalDeliveryEvent / SUCCEEDED`;
- no direct R2 URL or storage key was exposed;
- protected response controls remained `private, no-store`, `no-referrer` and `nosniff`;
- Payment, Order, Outbox and Entitlement remained unchanged.

Result:

`G5-D = COMPLETE / PASS / HOSTED PROVEN`

`G5 = COMPLETE / PASS / HOSTED PROVEN`

This evidence closes the hosted Buyer Access / Protected Delivery validation scope. It does not independently make Gate D ready.

## Administrative validation

P17 must validate:

- login;
- MFA;
- session enforcement;
- RBAC;
- Orders;
- Payments;
- Entitlements;
- Deliveries;
- Audit.

Administrative browser validation must not bypass authentication merely to inspect data.

### Hosted administrative proof — 06/10/2026

The administrative browser matrix was executed against hosted technical release:

`9e2ef25f4667b19f727c6ba1e277a79f55e3086f`

The existing OWNER identity completed real primary authentication, MFA and authenticated session establishment before protected administrative resources were inspected.

Observed hosted results:

- `P17-A01` Login -> `PASS / HOSTED PROVEN`;
- `P17-A02` MFA -> `PASS / HOSTED PROVEN`;
- `P17-A03` Session -> `PASS / HOSTED PROVEN`;
- `P17-A04` OWNER RBAC -> `PASS / HOSTED PROVEN`;
- `P17-A05` Order projection -> F3 Order `PAID`;
- `P17-A06` Payment projection -> F3 Payment `APPROVED`, Mercado Pago `processed / accredited`, `CREATE_RESPONSE / APPLIED`;
- `P17-A07` Entitlement projection -> F3 Entitlement `ACTIVE` with active protected resource grant;
- `P17-A08` Delivery projection -> four F3 delivery events, all `SUCCEEDED`;
- `P17-A09` Audit projection -> OWNER-authorized administrative audit surface with legitimate empty state.

The administrative audit model remains a separate authority boundary: `AdminAuditEvent` is not a substitute for provider/payment events, outbox processing, entitlement state or delivery audit events.

`AdminAuditEvent.totalCount = 0` was preserved. No synthetic administrative mutation was created merely to populate the audit UI. Therefore the hosted A09 result proves surface access, RBAC, empty-state behavior and absence of exposed sensitive authentication material; it does not prove the administrative audit write path.

No new AdminUser, role change, MFA reset, second payment, commercial-state mutation, manual outbox processing, entitlement mutation, R2 mutation or Buyer Access/G5 change occurred.

Real Mercado Pago TEST webhook delivery remains `NOT PROVEN`.

Administrative hosted result:

`P17-HV-P9 = COMPLETE / PASS / HOSTED PROVEN`

This closes the hosted administrative browser-validation scope only. It does not independently make Gate D ready.

## Browser and provider security validation

Required validation includes:

- Mercado Pago Payment Brick;
- provider challenge/3DS when TEST produces it;
- route-specific CSP compatibility;
- no production dependency on `unsafe-eval`;
- browser/provider network behavior;
- GTM when configured;
- Meta only when active.

Disabled providers are recorded as NOT_APPLICABLE with proof of disabled state.

## Responsive validation

P17 E2E must cover deterministic:

- mobile;
- tablet;
- desktop.

Responsive PASS requires functional usability, not merely absence of exceptions.

## Performance validation

The roadmap requires performance validation.

No authoritative numeric P17 performance budget currently exists.

P17 therefore requires:

1. deterministic timing evidence;
2. explicit measured stages;
3. no fabricated PASS threshold;
4. approved numeric acceptance budget before Gate D performance PASS.

## Failure scenarios

P17 must validate:

- declined payment;
- timeout;
- duplicate webhook;
- out-of-order webhook;
- retries;
- expired order;
- duplicate attempt;
- invalid authorization;
- storage failure;
- recovery.

Fault injection must be controlled and bounded.

## Release binding

The current P16 infrastructure uses `P16_RELEASE_COMMIT` as a fail-closed exact-HEAD binding.

While the hosted technical release remains:

`22fad0f690618c27cabcfa58528a76ce0a580ad3`

the hosted P16 binding remains unchanged.

P17-01 does not modify the Hostinger value.

Before any new P17 technical release may be deployed, the release identity architecture must be
reconciled.

The P17 worktree implements the phase-neutral `STAGING_RELEASE_COMMIT` identity for staging
preflight and migration guarding. The frozen `P16_RELEASE_COMMIT` remains a compatibility alias so
the already validated P16 release is not invalidated. If both variables are present they must be
identical; conflict, malformed value, HEAD mismatch or unverifiable HEAD fails closed.

This repository implementation is locally validated. It does not change either variable in
Hostinger and does not deploy a P17 release.

Until the owner-controlled hosted environment supplies the exact P17 release identity and the
resulting source/runtime binding is revalidated:

P17 APPLICATION DEPLOYMENT = PENDING_EXTERNAL

## Production boundary

P17 does not authorize production.

Production deployment, production payment credentials, real-money activation and production data
mutation remain future owner-controlled decisions.

## Gate D authority

Gate D asks whether the complete customer and operational journey functions correctly in staging.

PASS requires all critical mandatory scenarios to be resolved as PASS.

Critical FAIL or unresolved mandatory BLOCKED prevents progression.

## P17-01 architecture decision

DISCOVERY: COMPLETE
VALIDATION ARCHITECTURE: FROZEN
PLAYWRIGHT: APPROVED / NOT INSTALLED
REAL BROWSER E2E: REQUIRED
MERCADO PAGO: TEST ONLY
P16 CHECKPOINT: IMMUTABLE
P16_RELEASE_COMMIT: UNCHANGED FOR CURRENT HOSTED P16 RELEASE
STAGING_RELEASE_COMMIT: LOCALLY IMPLEMENTED / HOSTED VALUE NOT MUTATED
P17 DEPLOYMENT: PENDING_EXTERNAL OWNER-CONTROLLED CERTIFICATION
PRODUCTION: NOT AUTHORIZED
