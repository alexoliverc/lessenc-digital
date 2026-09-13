# ROADMAP — L'Essenc Digital

**Status:** Current Canonical Roadmap
**Scope:** MVP P00 → P20
**Governance:** AGENTS.md
**Current execution:** None. P08 — Public Sales Experience is COMPLETE. P09 — Checkout & Order Creation is the next candidate and has not started.
**P04 physical reconciliation:** COMPLETE — validated on 12/09/2026

---

# 1. Purpose

This roadmap defines the official delivery path of L'Essenc Digital from project governance through production launch and post-launch stabilization.

The roadmap is not merely a documentation sequence.

Each future phase is a delivery macro-phase that may include:

Specification
→ Review
→ Owner Authorization
→ Implementation
→ Validation
→ ChatGPT Technical Review
→ Corrections
→ Final Quality Gate
→ Checkpoint

The roadmap itself does not grant authorization for protected operations.

Approval gates defined in `AGENTS.md` remain authoritative.

---

# 2. Source-of-truth rule

The source-of-truth precedence defined in `AGENTS.md` applies.

If historical or superseded material conflicts with the current canonical baseline:

**CURRENT CANONICAL BASELINE WINS**

Historical, superseded or incomplete documents are context only and must not be used as normative implementation sources.

---

# 3. Program status

## P00 — Governance & Project Foundation

**Status:** CONCLUÍDA

### Objective

Establish project governance, repository structure and operating rules.

### Scope

- repository;
- Git workflow;
- AGENTS.md;
- MEMORY.md;
- operational memory;
- ChatGPT → Codex → ChatGPT review workflow;
- approval gates;
- documentation governance;
- branch and checkpoint discipline.

### Main deliverables

- governed repository;
- operating rules;
- source-of-truth precedence;
- memory model;
- technical review workflow.

### Dependencies

None.

### Approval gates

Governance changes must preserve owner authority over protected operations.

### Exit criteria

Project can progress through controlled phases with auditable decisions.

---

## P01 — Product, Offer & Commercial Baseline

**Status:** DOCUMENTAÇÃO CONCLUÍDA

### Objective

Define the current product, offer, pricing and commercial rules.

### Current canonical product

**Cronograma Capilar Inteligente**

### Launch price

**R$ 29,90**

### Internal amount

**2990 BRL**

### Scope

- product definition;
- positioning;
- offer;
- pricing;
- commercial rules;
- customer proposition.

### Main deliverables

Canonical P01 product and commercial documentation.

### Dependencies

P00.

### Approval gates

Commercial changes that alter the canonical product or offer require explicit owner decision.

### Exit criteria

Current offer is unambiguous and authoritative.

---

## P02 — Journey, Functional Domain & Business Rules

**Status:** DOCUMENTAÇÃO CONCLUÍDA

### Objective

Define the functional journey, business flows, states and rules.

### Scope

- public journey;
- order lifecycle;
- payment lifecycle;
- entitlement lifecycle;
- delivery lifecycle;
- business state transitions;
- functional boundaries.

### Main deliverables

Canonical functional flows and domain rules.

### Dependencies

P01.

### Approval gates

Material business-rule changes require owner review.

### Exit criteria

Implementation can derive behavior from canonical rules without relying on historical documents.

---

## P03 — Architecture, Security & Integration Baseline

**Status:** DOCUMENTAÇÃO CONCLUÍDA

### Objective

Define the technical architecture and foundational security/integration boundaries.

### Scope

- application architecture;
- module boundaries;
- backend authority;
- security baseline;
- Mercado Pago boundary;
- observability principles;
- deployment principles;
- administrative architecture.

### Main deliverables

Canonical architecture and security baseline.

### Dependencies

P01 and P02.

### Approval gates

Architecture, payments, authentication, security boundaries and infrastructure changes remain protected by AGENTS.md.

### Exit criteria

Architecture is sufficiently defined to guide implementation.

---

## P04 — Runtime, Toolchain & Physical Baseline

**Status:** COMPLETE

### Objective

Reconcile the physical project runtime and toolchain with the approved target baseline.

### Pre-P04 physical scaffold

The checkpoint `71488f1` preserves factual evidence of the scaffold before this execution. The working tree must be inspected for current physical state.

Pre-P04 package-manager state:

- pnpm;
- `pnpm-lock.yaml`;
- existing installed scaffold.

### Approved target P04 baseline

- npm 11.19.1;
- `package-lock.json`;
- `npm ci`.

### Important rule

The P04 reconciliation replaced the pnpm lockfile with a valid npm lockfile. Node.js/npm host versions were reconciled to 24.21.0/11.19.1, `npm ci` and local quality gates passed, and ChatGPT technical review returned PASS. The result was integrated into `main` at `da59530`.

Before this P04 physical reconciliation was explicitly authorized, Codex or terminal work could not:

- migrate package manager automatically;
- run `npm install` merely because npm is the target;
- generate `package-lock.json` alongside the pnpm lockfile;
- remove `pnpm-lock.yaml`;
- upgrade framework dependencies merely to match documentation.

After an authorized package-manager migration, exactly one authoritative lockfile must remain.

### Scope

- runtime reconciliation;
- package-manager reconciliation;
- dependency baseline;
- scripts;
- runtime environments;
- physical project conventions.

### Main deliverables

A reproducible physical runtime matching the approved target.

### Dependencies

P03.

### Approval gates

Dependency changes and package-manager migration require explicit owner authorization.

### Exit criteria

Physical repository state and approved P04 runtime baseline are reconciled and validated.

---

## P05 — Design System & UX Foundation

**Status:** COMPLETE

### Objective

Create the reusable visual and interaction foundation for the product.

### Scope

- design tokens;
- color system;
- typography;
- spacing;
- grids;
- responsive behavior;
- accessibility patterns;
- buttons;
- forms;
- fields;
- alerts;
- status components;
- loading states;
- error states;
- navigation primitives;
- public-area patterns;
- checkout patterns;
- delivery patterns;
- authentication patterns;
- admin patterns.

### Main deliverables

Canonical design system and reusable UX foundation.

### Dependencies

P04 baseline sufficiently defined.

### Approval gates

P05 implementation requires a Phase Execution Brief and owner authorization where protected operations are involved.

The owner's 12/09/2026 brief authorizes only the reusable design-system and UX foundation on the P05 branch. Complete checkout, delivery, authentication and admin surfaces remain in their later phases.

### Exit criteria

The product has a coherent reusable design foundation.

---

# GATE A — FOUNDATION READY

**GATE A: PASS — 12/09/2026**

**Position:** after P05.

### Question

Are architecture, runtime and UX foundations sufficiently stable for product implementation?

### Required result

PASS before continuing through the main product construction path.

---

## P06 — Data & Persistence Foundation

**Status:** COMPLETE / CHATGPT TECHNICAL REVIEW PASS

### Objective

Establish the persistent data layer.

### Scope

- database;
- ORM;
- schema;
- migrations;
- constraints;
- identifiers;
- timestamps;
- repositories;
- transactions;
- data environments;
- persistence tests.

### Main deliverables

Versioned and reproducible persistence foundation.

### Dependencies

P04 and applicable architectural baselines.

### Approval gates

Explicit authorization required before:

- database implementation;
- ORM installation;
- schema changes;
- migrations.

### Exit criteria

Persistence can be recreated and validated from versioned migrations.

---

## P07 — Core Domain & Application Layer

**Status:** COMPLETE — CHATGPT TECHNICAL RE-REVIEW PASS / FINAL QUALITY GATE PASS / MERGED.

### Objective

Implement core business behavior independently of external providers and interfaces.

### Main domains

- Product;
- Order;
- Payment;
- Entitlement;
- Delivery.

### Scope

- domain models;
- invariants;
- state machines;
- application services;
- use cases;
- repository interfaces;
- domain errors;
- unit tests.

### Main deliverables

Tested business core.

### Dependencies

P02, P03 and P06.

### Approval gates

Architectural changes discovered during implementation must return to ChatGPT review.

### Exit criteria

Core business rules operate without direct dependency on UI or Mercado Pago.

---

## P08 — Public Sales Experience

**Status:** COMPLETE — CHATGPT TECHNICAL REVIEW PASS / FINAL QUALITY GATE PASS / MERGED.

### Objective

Build the public commercial experience.

### Scope

- sales page;
- offer presentation;
- product information;
- CTAs;
- responsive behavior;
- accessibility;
- SEO foundation;
- performance;
- required public/legal surfaces.

### Main deliverables

Production-quality public sales interface.

### Dependencies

P05 and relevant P07 use cases.

### Approval gates

Commercial rules must remain consistent with P01.

### Exit criteria

A visitor can understand the offer and proceed safely toward checkout.

---

## P09 — Checkout & Order Creation

**Status:** PENDENTE

### Objective

Implement backend-authoritative checkout and order creation.

### Scope

- buyer information;
- validation;
- product selection;
- backend-authoritative price;
- order creation;
- expiration;
- duplicate prevention;
- correlation IDs;
- safe error handling.

### Main deliverables

Secure order-creation flow.

### Dependencies

P06, P07 and P08.

### Approval gates

Financial and sensitive-flow changes remain protected.

### Exit criteria

A valid order can be created independently of payment confirmation.

---

## P10 — Mercado Pago Integration

**Status:** PENDENTE

### Objective

Integrate Mercado Pago through an isolated provider adapter.

### Scope

- payment creation;
- provider adapter;
- idempotency;
- signed webhooks;
- server-side verification;
- reconciliation;
- retries;
- timeout handling;
- unknown states;
- integration tests.

### Mandatory rule

The thank-you page is never proof of payment.

Payment authority remains server-side.

### Main deliverables

Reliable payment processing boundary.

### Dependencies

P06, P07 and P09.

### Approval gates

Payment and webhook implementation require explicit authorization.

### Exit criteria

Payment status can be trusted and reconciled server-side.

---

## P11 — Entitlement & Secure Digital Delivery

**Status:** PENDENTE

### Objective

Convert confirmed payment into controlled access to the digital product.

### Scope

- entitlement creation;
- private storage;
- authorization;
- controlled delivery;
- expiration;
- re-delivery;
- delivery history;
- auditability;
- direct-public-access prevention.

### Main deliverables

Secure digital fulfillment.

### Dependencies

P07 and P10.

### Approval gates

Storage/security decisions must follow canonical architecture.

### Exit criteria

An approved payment reliably produces authorized access.

---

# GATE B — COMMERCE CORE READY

**Position:** after P11.

### Question

Can a customer create an order, pay and receive access safely, reliably and auditably?

### Required result

PASS before commerce is considered technically viable.

---

## P12 — Identity, Authentication & Admin

**Status:** PENDENTE

### Objective

Create the administrative identity and operational backoffice.

### Scope

- administrator authentication;
- secure sessions;
- MFA;
- server-side authorization;
- RBAC;
- OWNER;
- ADMIN;
- SUPPORT;
- dashboard;
- products;
- orders;
- payments;
- customers;
- entitlements;
- deliveries;
- audit records.

### Main deliverables

Operational administration environment.

### Dependencies

P06 and P07.

### Approval gates

Authentication and authorization implementation require explicit owner approval.

### Exit criteria

The business can be operated without direct database manipulation.

---

## P13 — Analytics, Attribution & Growth Infrastructure

**Status:** PENDENTE

### Objective

Create measurement infrastructure for acquisition and conversion.

### Scope

- internal events;
- Meta Pixel;
- Meta CAPI;
- UTM capture;
- attribution;
- event deduplication;
- ViewContent;
- InitiateCheckout;
- Purchase;
- campaign source.

### Main deliverables

Reliable marketing measurement layer.

### Dependencies

P08, P09, P10 and relevant privacy rules.

### Approval gates

External analytics integrations follow security and privacy requirements.

### Exit criteria

A completed sale can be attributed to its acquisition journey when data is available.

---

## P14 — Security Hardening

**Status:** PENDENTE

### Objective

Consolidate security testing and hardening before release.

### Important principle

Security does not begin in P14.

Security is transversal from P00 onward.

P14 is the consolidated attack, review and hardening phase.

### Reference

OWASP ASVS Level 2.

### Scope

- authentication review;
- authorization review;
- IDOR/BOLA;
- CSRF;
- XSS;
- SSRF;
- injection;
- rate limiting;
- abuse resistance;
- headers;
- cookies;
- sessions;
- secrets;
- dependency/supply-chain review;
- payment boundaries;
- webhooks;
- secure downloads.

### Main deliverables

Security findings and mitigations.

### Dependencies

Implemented application flows.

### Approval gates

No critical or high-risk unresolved finding may silently pass into production.

### Exit criteria

Security acceptance criteria are satisfied.

---

## P15 — Observability & Operational Readiness

**Status:** PENDENTE

### Objective

Prepare the system to be operated, diagnosed and recovered.

### Important principle

Observability and auditability are transversal concerns.

P15 consolidates operational readiness.

### Scope

- structured logs;
- metrics;
- traces where appropriate;
- correlation IDs;
- health;
- readiness;
- liveness;
- alerts;
- backups;
- restore tests;
- incident response;
- runbooks;
- rollback;
- retention.

### Main deliverables

Operational readiness package.

### Dependencies

Major application flows implemented.

### Approval gates

Infrastructure-changing actions remain protected.

### Exit criteria

The team can monitor, diagnose and recover the platform.

---

# GATE C — OPERATIONS READY

**Position:** after P15.

### Question

Can L'Essenc operate, administer, monitor, diagnose and recover the platform safely?

### Required result

PASS before release-environment validation.

---

## P16 — Staging Deployment

**Status:** PENDENTE

### Objective

Deploy the application into a hosted environment representative of production.

### Canonical application environments

- local;
- test;
- staging;
- production.

Application environment:

`APP_ENV`

Runtime environment:

`NODE_ENV`

These concepts remain separate.

### Scope

- staging deployment;
- secrets;
- HTTPS;
- staging database;
- private storage;
- Mercado Pago TEST;
- observability;
- backups;
- rollback.

### Main deliverables

Reproducible staging environment.

### Dependencies

P15 and applicable implementation phases.

### Approval gates

Deployment, infrastructure, DNS and external-effect operations require authorization.

### Exit criteria

Staging represents the intended production architecture sufficiently for release validation.

---

## P17 — End-to-End & Business Validation

**Status:** PENDENTE

### Objective

Validate the complete system and business journey.

### Minimum journey

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

### Scope

- happy path;
- declined payment;
- timeout;
- duplicated webhook;
- out-of-order webhook;
- retries;
- expired orders;
- duplicate attempts;
- invalid authorization;
- storage failures;
- recovery;
- browser validation;
- responsive validation;
- performance validation.

### Main deliverables

Release Candidate evidence package.

### Dependencies

P16.

### Approval gates

Critical failures block progression.

### Exit criteria

Release Candidate passes complete staging validation.

---

# GATE D — RELEASE CANDIDATE

**Position:** after P17.

### Question

Does the complete customer and operational journey function correctly in staging?

### Required result

PASS before formal production readiness review.

---

## P18 — Production Readiness Review

**Status:** PENDENTE

### Objective

Perform the formal production go/no-go review.

### Scope

Review:

- architecture;
- security;
- database;
- migrations;
- payments;
- backup;
- restore;
- observability;
- secrets;
- domain/DNS;
- HTTPS;
- private storage;
- analytics;
- support;
- rollback;
- operational documentation.

### Possible results

- GO;
- GO WITH CONDITIONS;
- NO-GO.

### Main deliverables

Formal Production Readiness decision.

### Dependencies

P17.

### Approval gates

Production remains an owner-controlled decision.

### Exit criteria

Explicit authorized outcome permitting or blocking production.

---

# GATE E — PRODUCTION GO / NO-GO

**Position:** P18.

### Question

Is the platform technically ready and explicitly authorized to process real transactions?

Only an authorized GO outcome may lead to P19.

---

## P19 — Production Launch

**Status:** PENDENTE

### Objective

Launch L'Essenc Digital into real production.

### Production definition

Production is not considered complete merely because the site is online.

Production Launch requires, when applicable:

- official domain;
- HTTPS;
- production application;
- production database;
- private storage;
- Mercado Pago PROD;
- real webhook;
- backup;
- observability;
- analytics;
- production smoke tests;
- first controlled real purchase;
- payment reconciliation;
- entitlement generation;
- digital delivery;
- administrative record;
- audit record.

### Main deliverables

Operational production release.

### Dependencies

Authorized P18 GO.

### Approval gates

Production deployment and real-payment activation require explicit owner authorization.

### Exit criteria

First real purchase is validated end-to-end.

---

## P20 — Post-Launch Stabilization

**Status:** PENDENTE

### Objective

Stabilize the initial MVP after launch.

### Scope

Monitor and correct:

- errors;
- checkout failures;
- payment failures;
- webhook behavior;
- conversion;
- entitlement;
- downloads;
- customer support issues;
- performance;
- availability;
- costs;
- incidents.

### Main deliverables

Stable initial production operation.

### Dependencies

P19.

### Approval gates

Stability takes precedence over expansion during this phase.

### Exit criteria

The initial MVP is operating reliably enough to transition into continuous growth and optimization.

---

# 4. Cross-cutting concerns

The following concerns apply throughout the program:

- security;
- observability;
- auditability;
- privacy;
- financial integrity;
- data minimization;
- traceability.

P14 and P15 are consolidation/readiness phases.

They are not the first phases where these concerns apply.

---

# 5. Mandatory phase lifecycle

Each future phase must follow the applicable lifecycle:

1. Phase Planning
2. Specification
3. ChatGPT Review
4. Owner Authorization when applicable
5. Phase Branch
6. Codex or controlled terminal execution
7. Validation Report
8. ChatGPT Technical Review
9. PASS / PASS WITH FIXES / FAIL
10. Corrections when necessary
11. Final Quality Gate
12. Checkpoint Commit
13. Push only with explicit authorization
14. Merge only with explicit authorization
15. Memory Update
16. Progression decision

A phase is not complete merely because implementation exists.

---

# 6. Phase Execution Brief

No future phase should begin from an open-ended instruction such as:

`continue o projeto`

Each phase must receive a Phase Execution Brief containing at least:

- Phase ID;
- objective;
- context;
- previous state;
- scope;
- out of scope;
- dependencies;
- relevant canonical documents;
- expected files/components;
- restrictions;
- approval gates;
- required tests;
- acceptance criteria;
- Validation Report format;
- stopping condition.

---

# 7. Critical path

Current conceptual critical path:

P04
→ P05
→ P06
→ P07
→ P08
→ P09
→ P10
→ P11
→ P12
→ P13
→ P14
→ P15
→ P16
→ P17
→ P18
→ P19
→ P20

This representation does not authorize skipping intermediate phases or gates.

---

# 8. Parallel work

Some future work may be executed in parallel only if:

- dependencies are satisfied;
- architectural boundaries allow it;
- explicit authorization exists;
- integration gates remain preserved.

Parallel work must never be inferred automatically from this roadmap.

---

# 9. Program gates

## GATE A — FOUNDATION READY

**GATE A: PASS — 12/09/2026**

After P05.

Architecture, runtime and UX foundation are ready for product construction.

## GATE B — COMMERCE CORE READY

After P11.

Order → Payment → Entitlement → Delivery works safely and reliably.

## GATE C — OPERATIONS READY

After P15.

The platform can be operated, monitored, diagnosed and recovered.

## GATE D — RELEASE CANDIDATE

After P17.

The complete staging journey has passed end-to-end validation.

## GATE E — PRODUCTION GO / NO-GO

P18.

The system receives formal authorization or denial for real production transactions.

---

# 10. Current next candidate

The current next candidate is:

**P09 — Checkout & Order Creation**

Current status:

**P04 RECONCILIATION: COMPLETE / FINAL VALIDATION PASSED**

**P05: COMPLETE / CHATGPT TECHNICAL REVIEW PASS**

**P06: COMPLETE / CHATGPT TECHNICAL REVIEW PASS**

**P07: COMPLETE / CHATGPT TECHNICAL RE-REVIEW PASS / FINAL QUALITY GATE PASS**

**P08: COMPLETE / CHATGPT TECHNICAL REVIEW PASS / FINAL QUALITY GATE PASS / MERGED**

P06 checkpoint `f4bfdfe`, merge `694a085` and documentary closeout `e04438c` are preserved.

P07 was checkpointed at `4c96e7b` with tag `checkpoint/p07-core-domain-application-complete` and merged via PR #6 as `6a19eda`.

P08 was checkpointed at `f73400a` with tag `checkpoint/p08-public-sales-experience-complete` and merged through PR #8 as `2686e39`.

P09 — Checkout & Order Creation has **not started** and requires explicit owner authorization before planning or execution begins.

---
# 11. Post-MVP horizon

The following are intentionally outside the P00–P20 MVP construction program:

- Growth & Optimization;
- CRO;
- paid-media optimization;
- expansion of digital products;
- editorial/SEO expansion;
- community or membership initiatives;
- broader L'Essenc ecosystem;
- future integration with physical cosmetics.

These initiatives must receive separate planning after the initial MVP is stabilized.

---

# 12. Program completion definition

P20 closes the construction and stabilization program of the initial L'Essenc Digital MVP.

The program is not considered successfully completed solely because the application is deployed.

Successful completion requires:

Architecture
+ Secure Commerce
+ Controlled Delivery
+ Operations
+ Staging Validation
+ Production Readiness
+ Real Production Transaction
+ Post-Launch Stabilization

Only after this state should the project transition primarily into growth and optimization.
