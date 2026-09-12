# P07 — Core Domain & Application Layer — Phase Execution Brief

**Status:** APPROVED — IMPLEMENTATION AUTHORIZED
**Phase:** P07 — Core Domain & Application Layer
**Date:** 2026-09-12
**Branch:** `phase/p07-core-domain-application-layer`
**Base commit:** `e04438c1e09950d34a48051df6cc3219c580aad7`
**Previous phase:** P06 — Data & Persistence Foundation — CLOSED / PASS
**Implementation checkpoint from P06:** `f4bfdfe`
**P06 closeout merge in main:** `e04438c`

---

## 1. Objective

Implement the reusable business core and application layer of L'Essenc Digital independently of external providers and presentation interfaces.

P07 must transform the approved P01/P02/P03 rules and the physical persistence foundation delivered by P06 into executable, typed and tested business behavior.

The completed core must be consumable by P08–P12 without requiring domain rules to be rewritten inside HTTP handlers, UI components, Prisma models or Mercado Pago integration code.

---

## 2. Context

The repository currently contains:

- completed product/commercial baseline;
- completed module and architecture specifications;
- completed P05 design-system foundation;
- completed P06 MySQL/Prisma persistence foundation;
- physical models for Product, Offer, Customer, Order, OrderItem, Payment, Entitlement and OutboxEvent;
- real MySQL integration-test infrastructure;
- no substantive implementation yet for the business modules required by P07.

P07 starts from clean `main` at `e04438c`.

No implementation from P08 or later is authorized by this brief.

---

## 3. Canonical precedence

Implementation must obey the repository precedence defined in `AGENTS.md`.

Current canonical baseline wins over historical or superseded documents.

Historical documents such as `LES-ARCH-DIG-R01.md`, `LES-DATA-DIG-R01.md`, `LES-FLOW-DIG-R01.md`, `LES-INT-MP-R01.md` and similar files marked `HISTORICAL / SUPERSEDED` may be consulted only for historical context. They must not introduce states, entities, rules or workflows that conflict with the current canonical baseline.

If current canonical documents conflict with each other in a way that changes architecture or business behavior, stop the dependent implementation and return the issue to ChatGPT/owner review.

---

## 4. Required canonical sources

Before implementing P07, read at minimum:

`AGENTS.md`

`MEMORY.md`

`ROADMAP.md`

`docs/README.md`

`docs/product/first-product-definition.md`

`docs/product/offer-commercial-rules.md`

`docs/product/customer-journey-business-rules.md`

`docs/product/requirements-matrix.md`

`docs/architecture/domain-model.md`

`docs/architecture/module-boundaries.md`

`docs/architecture/shared-application-primitives.md`

`docs/architecture/order-state-machine.md`

`docs/architecture/payment-state-machine.md`

`docs/architecture/entitlement-fulfillment-state-machines.md`

`docs/architecture/refund-notification-outbox-models.md`

`docs/architecture/relational-model-constraints.md`

`docs/architecture/integrations-architecture.md`

`docs/architecture/system-architecture.md`

`docs/decisions/ADR-0001-modular-monolith.md`

`docs/decisions/ADR-0003-mysql-prisma.md`

`docs/decisions/ADR-0005-transactional-outbox.md`

`docs/persistence/data-model.md`

`docs/persistence/local-mysql-and-testing.md`

`docs/persistence/p06-exit-review.md`

`prisma/schema.prisma`

Existing migrations under `prisma/migrations/`.

Do not assume filenames that do not exist. If a referenced canonical document cannot be found, inspect `docs/README.md` for the canonical replacement before proceeding.

---

## 5. Approved business baseline

Initial product:

`Cronograma Capilar Inteligente`

Initial price:

`2990 BRL` in minor units.

Commercial baseline:

- Brazil;
- BRL;
- single purchase;
- no subscription;
- initial quantity 1;
- product and offer must be eligible for purchase on the server;
- browser never determines authoritative price, total or payment confirmation;
- historical order-item name, description, price, total and currency must be preserved;
- changing the current offer must not rewrite historical orders;
- customer account before checkout is not required;
- customer email is not globally unique in the MVP.

Only current canonical states are valid.

Product:

`DRAFT | ACTIVE | INACTIVE | ARCHIVED`

Order:

`PENDING | PAID | FAILED | CANCELED | REFUNDED`

Payment:

`PENDING | APPROVED | REJECTED | CANCELED | REFUNDED | UNKNOWN`

Entitlement:

`PENDING | ACTIVE | REVOKED | EXPIRED`

Do not reintroduce historical states such as `CREATED`, `PAYMENT_PENDING`, Order `EXPIRED`, Payment `PROCESSING`, `CHARGEBACK` or any other state absent from the current canonical baseline.

---

## 6. Architectural target

Maintain the approved modular-monolith architecture.

Core business behavior must be organized according to the existing module boundaries:

- Catalog;
- Customers;
- Commerce;
- Payments;
- Entitlements;
- Fulfillment where behavior is already canonically specified.

Domain and Application code must not directly depend on:

- React;
- Next.js route handlers;
- browser APIs;
- Mercado Pago SDK/API;
- HTTP request/response objects;
- analytics;
- UI state.

Prisma is infrastructure.

Business rules must not be encoded primarily inside Prisma queries or database-generated types.

External-provider vocabulary must not leak into generic domain models.

---

## 7. Shared primitives

Implement only approved reusable primitives required by P07:

### Money

Represents:

- integer minor units;
- explicit currency.

Requirements:

- reject invalid/non-integer monetary input;
- never use float as source of truth;
- equality must include amount and currency;
- arithmetic must prevent operations across incompatible currencies;
- monetary arithmetic used by order totals must be deterministic.

### Currency

Support the currency necessary for the current commercial baseline.

Current commercial currency is `BRL`.

Do not build speculative multi-currency business flows merely because the primitive may support explicit currency.

### Clock

Application/domain behavior requiring current time must depend on a clock abstraction.

Production implementation uses UTC system time.

Tests must be able to use a deterministic fake/fixed clock.

### Result / typed errors

Use explicit typed outcomes where they improve application boundary clarity.

Do not convert programming defects into generic business results.

### ApplicationError

Errors crossing application boundaries must expose:

- stable code;
- safe context;
- no secrets;
- no raw database/provider internals.

### Exhaustiveness

Use exhaustive handling for approved enum/state-machine behavior.

Unexpected states must fail explicitly rather than silently defaulting.

---

## 8. Domain invariants

### Catalog / Offer

A new purchase may only use a currently eligible product and offer.

At minimum:

- Product must be `ACTIVE`;
- Offer must be active;
- offer belongs to the product;
- amount is authoritative on the server;
- currency must match;
- initial commercial quantity is 1.

Changes to catalog data never mutate an already-created historical order snapshot.

### OrderItem snapshot

For new eligible items, application code must preserve:

- product ID;
- offer ID;
- product name snapshot;
- product description snapshot when present;
- unit price;
- quantity;
- total;
- currency.

P06 explicitly requires P07 to populate the description snapshot for new eligible OrderItems.

### Money/totals

For every newly constructed order:

`OrderItem.totalMinor = OrderItem.unitPriceMinor × quantity`

and:

`Order.totalMinor = sum(OrderItem.totalMinor)`

All monetary values participating in one order must use compatible currency.

Invalid totals must be rejected before persistence.

### Order state machine

Allowed transitions:

`PENDING → PAID`

`PENDING → FAILED`

`PENDING → CANCELED`

`PAID → REFUNDED`

Authority conditions from the canonical state-machine document must be preserved.

Explicitly forbidden include:

`PAID → FAILED`

`PAID → CANCELED`

`REFUNDED → PAID`

Repeated application of the same confirmed business fact must be handled idempotently where the canonical rule requires it.

### Payment state machine

Allowed transitions:

`PENDING → APPROVED`

`PENDING → REJECTED`

`PENDING → CANCELED`

`PENDING → UNKNOWN`

`UNKNOWN → APPROVED`

`UNKNOWN → REJECTED`

`APPROVED → REFUNDED`

`UNKNOWN` is not equivalent to rejection.

A confirmed approved payment must not be downgraded by stale or delayed information.

P07 implements the provider-independent state behavior only. It does not call Mercado Pago.

### Entitlement

Implement only entitlement behavior already specified by the current canonical baseline.

An Entitlement cannot become financially valid merely because a UI, redirect or caller requests it.

Activation must require an authorized business origin.

Duplicate entitlement for the same OrderItem must be prevented both at the domain/application level where practical and by the existing physical uniqueness constraint.

Detailed secure asset delivery remains owned by P11.

### Fulfillment / Delivery

Only provider-independent domain/application contracts and already-approved state behavior may be implemented during P07.

Do not implement download URLs, object storage, signed links, ebook delivery endpoints or other secure-delivery infrastructure.

Those belong to P11.

---

## 9. Application layer responsibilities

Application services/use cases must coordinate domain behavior without embedding presentation or provider-specific concerns.

P07 may implement provider-independent use cases required to prove the core, including:

### Resolve purchasable offer

Input identifies the intended product/offer.

Application validates authoritative catalog state and returns the server-authoritative commercial snapshot or a typed rejection.

### Build/prepare order snapshot

Builds a valid Order and OrderItem representation from authoritative catalog information.

It must calculate totals internally.

It must not accept browser-provided total as truth.

This is core behavior only; the public checkout endpoint and complete P09 order-creation flow remain out of scope.

### Apply Order transition

Executes only canonical Order state transitions and rejects invalid transitions deterministically.

### Apply Payment transition

Executes only canonical Payment state transitions.

Provider normalization remains outside this phase.

### Coordinate approved financial effect

If implemented in P07, this operation must remain provider-neutral and use application contracts.

A confirmed financial fact may coordinate compatible internal state changes and transactional outbox behavior only where fully specified by the current canonical documents.

If implementing this requires decisions owned by P10 or P11 that are still OPEN, stop and return the blocker rather than inventing the missing policy.

### Entitlement state behavior

Implement provider-independent entitlement invariants and transitions that are already fully specified.

Secure fulfillment/delivery is not part of this phase.

---

## 10. Repository interfaces

Repository contracts belong to the domain/application side of the architectural boundary.

Infrastructure implementations may use Prisma.

Repository contracts must express business needs rather than expose Prisma's generic CRUD API.

Do not export Prisma-generated model types as public domain/application contracts.

Expected repositories include only those needed by the implemented P07 use cases, potentially covering:

- Product/Offer lookup;
- Customer persistence where needed;
- Order/OrderItem persistence;
- Payment persistence;
- Entitlement persistence;
- Outbox persistence when required by an approved transaction.

Do not create speculative repositories for future modules with no P07 use case.

---

## 11. Persistence adapters and mapping

P07 may implement Prisma adapters required for its approved use cases.

Rules:

- domain/application layers must not import Prisma directly;
- map persistence enums to approved internal states explicitly;
- map money values without float conversion;
- preserve UUIDs as opaque identifiers;
- preserve UTC timestamp semantics;
- preserve nullable `productDescriptionSnapshot`;
- preserve `Customer.email` non-global-unique policy;
- do not bypass physical constraints;
- never use cascading deletion as business behavior.

Existing P06 migrations are immutable.

Do not edit or squash applied P06 migrations.

A new schema migration is outside the normal P07 path.

If implementation discovers that the approved P06 physical model cannot support a required P07 invariant, stop and return an architectural blocker to ChatGPT before changing `prisma/schema.prisma` or creating a migration.

---

## 12. Transaction policy

Cross-module operations that must succeed atomically must use an explicit application transaction boundary.

The transaction mechanism must remain infrastructure-aware without leaking Prisma into domain objects.

When an approved business action requires an OutboxEvent, business state and outbox state must be committed in the same local MySQL transaction.

Do not claim concurrency safety based only on unit-test doubles.

Use existing database constraints as the final line of defense where applicable.

---

## 13. Domain/application errors

Define stable errors for business failures actually needed by P07.

Examples of error categories may include:

- inactive/unavailable product;
- inactive/unavailable offer;
- currency mismatch;
- invalid monetary value;
- invalid quantity;
- inconsistent total;
- invalid Order transition;
- invalid Payment transition;
- invalid Entitlement transition;
- duplicate business effect;
- entity not found where that absence is meaningful to the use case.

Error codes must be deterministic.

Do not leak:

- SQL;
- Prisma stack/internal codes as public application errors;
- database credentials;
- provider secrets;
- sensitive raw payloads.

Infrastructure-specific errors may be translated at the adapter/application boundary while preserving diagnostics through safe internal logging.

---

## 14. Physical module expectations

Prefer the existing `src/modules/` architecture.

Expected logical areas are:

`src/modules/catalog/`

`src/modules/customers/`

`src/modules/commerce/`

`src/modules/payments/`

`src/modules/entitlements/`

`src/modules/fulfillment/` only where approved P07 behavior requires it.

Approved generic primitives may live in an existing or newly introduced shared/core location only if they remain domain-neutral.

Do not move or refactor P05 UI files merely to satisfy P07 aesthetics.

Do not hand-edit generated Prisma client files under `src/generated/prisma/`.

Physical filenames and subdivisions may be adjusted by the implementation if they preserve these boundaries and the canonical architecture.

---

## 15. Explicitly out of scope

P07 must not implement:

- public sales-page behavior;
- public checkout UI;
- checkout HTTP/API endpoint;
- full P09 order-creation journey;
- Mercado Pago SDK;
- Mercado Pago API calls;
- webhook endpoints;
- webhook signature validation;
- provider status mapping;
- payment reconciliation job;
- real PIX/card processing;
- secure ebook download;
- signed download URL;
- object-storage integration;
- final fulfillment infrastructure;
- customer authentication;
- admin authentication;
- admin UI;
- analytics/attribution;
- production deployment;
- production database configuration;
- email notification delivery;
- refund policy not already approved;
- partial refunds;
- chargeback policy;
- legal/consumer-policy decisions still marked OPEN.

Do not implement a future phase simply because an interface would be convenient.

---

## 16. Dependency restrictions

Use the current package baseline.

Do not change versions or add packages unless strictly necessary and explicitly justified.

Current important baseline includes:

- Node.js 24.21.0 LTS;
- npm 11.19.1;
- Next.js 16.3.4;
- React 19.3.0;
- TypeScript 6.0.3;
- Vitest 5.0.0;
- Zod 4.6.2;
- Prisma 7.10.0;
- `@prisma/client` 7.10.0;
- `@prisma/adapter-mariadb` 7.10.0.

Security overrides from P06 must remain intact:

- `mariadb` 3.5.4;
- `mysql2` 3.24.4;
- `deepmerge-ts` 8.0.2.

Do not run blind `npm audit fix`.

Any dependency modification must trigger lockfile review, `npm audit`, full validation and explicit reporting.

---

## 17. Required tests

P07 requires unit tests for all implemented business invariants.

Minimum expected coverage:

- Money validity and arithmetic;
- currency incompatibility;
- catalog purchase eligibility;
- authoritative price behavior;
- OrderItem snapshot construction;
- order total calculation;
- invalid/mismatched totals;
- Order allowed transitions;
- Order forbidden transitions;
- Payment allowed transitions;
- Payment forbidden transitions;
- `UNKNOWN` semantics;
- no downgrade after confirmed approval;
- Entitlement invariants implemented in P07;
- typed application errors;
- deterministic Clock behavior where time matters;
- application-use-case orchestration using doubles/fakes;
- exhaustive enum/state handling.

If Prisma adapters are implemented, add integration tests against the isolated P06 test database for the adapter behavior actually introduced.

Integration tests must continue using the P06 guard.

Never point automated P07 tests at `lessenc_dev`, Smith Sterling resources, port 3306 or any non-test database.

Do not treat in-memory doubles as evidence that physical MySQL integrity works.

---

## 18. Regression gates

Before final P07 review, run at minimum:

`npm ci`

`npm audit`

`npm run db:validate`

`npm run db:generate`

`npm run check`

`npm run test:integration` when P07 changes or introduces persistence adapters/transaction behavior requiring DB validation.

`npm run build`

`git diff --check`

Review the final diff.

Perform a secret scan appropriate to the changed files.

Verify that P05 public UI still builds without requiring a live database.

Verify that no existing P06 migration was modified.

---

## 19. Documentation deliverables

P07 implementation must leave documentation sufficient to explain:

- domain/application structure implemented;
- repository contracts;
- mapping to P06 persistence;
- transaction boundaries;
- implemented invariants;
- tests/evidence;
- intentionally deferred behavior;
- discovered architectural decisions or blockers.

Update the current canonical documentation only when implementation changes the factual current state.

Do not rewrite historical documents to make them look current.

Update `MEMORY.md` and the current session diary according to `AGENTS.md`.

---

## 20. Acceptance criteria

P07 can receive Technical Review PASS only when:

- business core is implemented without direct UI dependency;
- business core is implemented without direct Mercado Pago dependency;
- canonical state machines are executable and tested;
- money uses integer minor units and explicit currency;
- order totals are application-validated;
- historical item snapshots are correctly produced;
- domain/application code is not coupled to Prisma types;
- repository interfaces express business needs;
- required Prisma adapters, if introduced, respect those interfaces;
- invalid business transitions fail deterministically;
- no historical/superseded state is reintroduced;
- no future-phase provider/UI behavior is implemented;
- unit tests cover implemented invariants;
- required integration tests pass;
- existing P06 tests remain green;
- production build remains green;
- dependency audit remains acceptable;
- diff has been reviewed;
- no secret has been introduced;
- canonical docs and memory accurately describe the resulting state.

---

## 21. Validation Report format

At the end of execution, provide a Validation Report containing:

### Runtime environment

- repository;
- branch;
- HEAD;
- Node/npm versions;
- relevant dependency versions.

### Scope delivered

- modules/files added;
- primitives implemented;
- domain models/invariants implemented;
- application use cases implemented;
- repository contracts/adapters implemented;
- transaction behavior implemented.

### Business-rule evidence

For every implemented invariant, identify:

- rule;
- source canonical document;
- implementation location;
- test location;
- result.

### Test evidence

Report exact results for:

- lint;
- typecheck;
- unit tests;
- integration tests;
- Prisma validation/generation;
- production build;
- formatting;
- diff check;
- dependency audit.

### Persistence evidence

If persistence adapters were changed/added:

- database target used;
- test guard result;
- transaction behavior;
- relevant constraints exercised;
- fixture cleanup.

### Security/scope evidence

Confirm:

- no real credentials;
- no generated Prisma edits;
- no applied P06 migration changed;
- no Mercado Pago implementation;
- no checkout/public-sales implementation;
- no P08+ scope creep.

### Git evidence

Report:

- branch;
- base;
- current HEAD;
- working-tree state;
- changed-file summary;
- whether commit/tag/push/merge were performed.

### Open issues

List blockers, deferred decisions and any architecture question requiring owner/ChatGPT decision.

---

## 22. Approval gates

Already authorized:

- creation of P07 branch;
- planning and preparation of this Phase Execution Brief.
- P07 implementation, explicitly authorized by the owner's execution instruction of 2026-09-12; this supersedes the earlier preparation-only gate.

Not yet authorized by this brief:

- dependency additions/upgrades;
- schema changes or new migrations;
- commit;
- checkpoint tag;
- push;
- pull request;
- merge;
- P08 progression.

Architectural changes discovered during P07 implementation must return to ChatGPT review before dependent work continues.

---

## 23. Stopping conditions

Stop implementation and return to ChatGPT/owner if:

- canonical documents materially conflict;
- a missing business policy must be invented;
- P07 requires a schema change not already authorized;
- implementation requires a new dependency with architectural/security impact;
- implementation would require Mercado Pago behavior;
- implementation would require checkout/public UI behavior;
- implementation would require secure-delivery behavior owned by P11;
- an existing P06 migration appears to require modification;
- a required test cannot be executed safely against the isolated environment;
- a security or data-integrity issue is discovered.

Do not silently widen scope.

---

## 24. Completion rule

Implementation existing in the branch does not make P07 complete.

Required lifecycle remains:

Planning
→ Specification / approved Phase Execution Brief
→ implementation
→ Validation Report
→ ChatGPT Technical Review
→ corrections if required
→ Final Quality Gate
→ checkpoint commit/tag
→ push only with explicit owner authorization
→ merge only with explicit owner authorization
→ memory update
→ progression decision.

P08 must not begin automatically after P07 implementation.
