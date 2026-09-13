# P09 — Checkout & Order Creation — Physical Implementation Plan

**Phase:** P09 — Checkout & Order Creation
**Status:** APPROVED — IMPLEMENTATION READY
**Branch:** `phase/p09-checkout-order-creation`
**Base:** `c6271aa8017a3924fdadf8cb8b36f3a078b2e6d3`
**Execution Brief:** [p09-phase-execution-brief.md](p09-phase-execution-brief.md)
**P10:** NOT AUTHORIZED

---

## 1. Objective

Translate the approved P09 Phase Execution Brief into the physical implementation sequence.

P09 delivers a backend-authoritative checkout that creates exactly one persistent:

Customer
+ Order.PENDING
+ OrderItem

for one logical checkout submission.

P09 stops before Payment creation, payment-provider integration, entitlement or delivery.

---

## 2. Runtime flow

The approved runtime flow is:

`GET /checkout`
→ resolve current Product/Offer
→ create signed submission token
→ render checkout

Submission flow:

checkout form
→ Server Action
→ validate signed submission token
→ validate and normalize buyer email
→ load server-only Product/Offer identity
→ P07 ResolvePurchasableOffer
→ P07 PrepareOrder
→ P09 CheckoutOrderRepository
→ PrismaCheckoutOrderRepository
→ single MySQL transaction
→ Customer + Order.PENDING + OrderItem
→ safe public result

The browser never supplies authoritative:

- Product ID;
- Offer ID;
- price;
- currency;
- quantity;
- total;
- status;
- Customer ID;
- OrderItem ID.

---

## 3. Signed checkout submission token

A raw client-controlled UUID is not accepted as trusted Order identity.

P09 introduces a server-authenticated opaque token containing:

- token version;
- submission/order UUID;
- issued-at instant.

Integrity mechanism:

- HMAC-SHA-256;
- Node.js built-in `crypto`;
- server-only signing secret;
- constant-time signature comparison where applicable.

Configuration:

`P09_SUBMISSION_SECRET`

Rules:

- server-only;
- never `NEXT_PUBLIC_`;
- actual value never committed;
- `.env.example` contains only an empty placeholder;
- parsed lazily at runtime;
- production build must not require it;
- deterministic fixture secrets are allowed only in tests.

The token is an idempotency/continuation artifact.

It is not:

- authentication;
- payment authorization;
- proof of ownership;
- entitlement.

No expiration is introduced in P09.

---

## 4. Buyer email

Physical module:

`src/modules/customers/domain/checkout-email.ts`

Rules:

1. input must be a string;
2. trim surrounding whitespace;
3. maximum persisted length: 320 characters;
4. reject ASCII controls;
5. reject internal whitespace;
6. require exactly one `@`;
7. non-empty local part;
8. local part maximum 64 characters;
9. structurally valid domain labels;
10. normalize domain to lowercase;
11. preserve local-part case.

Email is operational buyer/contact data.

It is not global account identity.

`Customer.email` remains non-unique.

Raw buyer email must not appear in ordinary operational logs.

---

## 5. Customer scope

P09 introduces no:

- account;
- password;
- login;
- ownership model;
- customer merge;
- global email uniqueness;
- identity resolution.

A Customer record is created for the checkout transaction.

Duplicate prevention is based on submission/order identity, never email identity.

---

## 6. Application use case

Expected application file:

`src/modules/commerce/application/create-checkout-order.ts`

Primary types:

- `CheckoutOrderRepository`;
- `CreateCheckoutOrder`.

Internal use-case input may contain:

- submission/order ID;
- normalized email;
- generated Customer ID;
- generated OrderItem ID;
- canonical Product ID;
- canonical Offer ID.

The use case must not accept browser-originating:

- price;
- currency;
- total;
- quantity;
- order status;
- payment state.

Quantity is fixed internally to `1`.

---

## 7. P07 authority

P09 reuses:

`PrepareOrder`

which already composes:

`ResolvePurchasableOffer`

Canonical business path:

`ResolvePurchasableOffer`
→ Product/Offer eligibility
→ authoritative Money
→ `PrepareOrder`
→ OrderItem snapshot
→ Order.PENDING

P09 must not reproduce or redefine:

- Product ACTIVE rules;
- Offer active rules;
- Product/Offer relationship;
- Money semantics;
- unit-price calculations;
- total calculations;
- Order invariants.

---

## 8. Persistence contract

P09 repository operation returns one of:

`CREATED`

or:

`EXISTING`

or:

`CONFLICT`

`CONFLICT` means the intended Order ID already exists but does not represent the same immutable logical checkout submission. It remains an internal safe persistence outcome and is not exposed as a public checkout action state.

The repository receives:

- normalized buyer email;
- fully prepared P07 Order.

`CREATED` means a new Customer + Order + OrderItem transaction committed.

`EXISTING` means the same logical submission already exists and immutable data was verified.

---

## 9. Prisma infrastructure adapter

Expected file:

`src/infrastructure/database/prisma-checkout-order-repository.ts`

Tests:

`src/infrastructure/database/prisma-checkout-order-repository.test.ts`

Real MySQL integration:

`src/infrastructure/database/checkout-order.integration.ts`

Prisma remains Infrastructure-only.

Domain and Application must not import Prisma.

Presentation must not import Prisma.

---

## 10. Atomic transaction

Initial persistence uses a single MySQL transaction.

Sequence:

1. create Customer;
2. create Order;
3. create OrderItem;
4. commit.

If any operation fails:

rollback everything.

No partially created checkout is acceptable.

Order fields map from the prepared domain Order.

OrderItem snapshot maps from the prepared P07 OrderItem.

P09 must not insert:

- Payment;
- Entitlement;
- OutboxEvent.

---

## 11. Idempotency

`Order.id` is the serialization point.

The submission UUID encoded inside the server-signed token becomes the intended Order ID.

First request:

- validate token;
- validate email;
- prepare authoritative order;
- attempt atomic persistence.

Same-token retry:

- uses the same intended Order ID.

If Order creation encounters the expected unique conflict:

1. transaction rolls back;
2. repository reloads the existing Order, Customer and OrderItem;
3. immutable logical submission data is compared;
4. compatible data returns `EXISTING`;
5. incompatible data returns a typed safe conflict.

No second Order is created.

---

## 12. Duplicate compatibility

Compatibility must include at least:

- Order ID;
- normalized Customer email;
- Product ID;
- Offer ID;
- quantity;
- unit price;
- currency;
- total;
- product-name snapshot;
- product-description snapshot.

Candidate Customer ID is not compared because a retry creates a new candidate ID whose losing transaction rolls back.

Candidate OrderItem ID is not the idempotency key.

Existing order status is not used to create a new Order.

P09 creates only PENDING, but a later retry may eventually encounter an Order transitioned by a future phase.

---

## 13. Prisma error classification

Only the expected unique conflict attributable to `Order.id` may enter duplicate-resolution logic.

Do not translate every Prisma error into idempotent retry.

Other:

- known Prisma errors;
- unknown Prisma errors;
- database failures;
- programming defects

must preserve safe error boundaries.

Raw Prisma/SQL diagnostics must never reach the public response.

---

## 14. Server configuration

P09 continues using lazy commercial configuration:

- `P08_PRODUCT_ID`;
- `P08_OFFER_ID`.

P09 adds:

- `P09_SUBMISSION_SECRET`.

Potentially modified files:

- `.env.example`;
- `src/lib/config/env-schema.ts`;
- `src/lib/config/env.ts`;
- `src/lib/config/env.test.ts`.

No physical Product/Offer UUID is hardcoded.

No actual submission secret is committed.

---

## 15. Submission-token contract and implementation

Application contract:

`src/modules/commerce/application/checkout-submission-token.ts`

Infrastructure implementation:

`src/infrastructure/security/hmac-checkout-submission-token.ts`

Infrastructure tests:

`src/infrastructure/security/hmac-checkout-submission-token.test.ts`

The Application layer defines only provider-independent token input, result and service contracts.

The Infrastructure layer owns:

- HMAC-SHA-256;
- Node.js `crypto`;
- signature generation;
- constant-time signature verification;
- strict base64url handling.

The implementation must:

- issue signed token;
- verify token;
- reject malformed token;
- reject unsupported version;
- reject invalid UUID;
- reject malformed issued-at instant;
- reject modified payload;
- reject modified signature.

No token expiration policy is implemented.

`node:crypto` must not be imported by Domain or Application.

---

## 16. Checkout server composition

Expected file:

`src/app/checkout/checkout.server.ts`

Responsibilities:

- load lazy commercial and submission-token configuration;
- access database composition;
- instantiate PrismaCatalogRepository;
- instantiate ResolvePurchasableOffer;
- resolve the current Product/Offer for GET `/checkout`;
- generate the server submission/order UUID;
- issue the signed checkout submission token;
- return safe AVAILABLE, UNAVAILABLE or FAILED page state;
- emit only fixed non-sensitive operational diagnostics.

Order-creation composition is intentionally performed by the Server Action because it is request-submission specific. That composition includes PrepareOrder, PrismaCheckoutOrderRepository and CreateCheckoutOrder.

---

## 17. Server Action

Expected file:

`src/app/checkout/actions.ts`

Responsibilities:

- receive FormData;
- read only approved form fields;
- create a server-generated request correlation ID;
- verify submission token;
- validate/normalize email;
- load server-only Product/Offer identity;
- access database composition;
- instantiate PrismaCatalogRepository;
- instantiate ResolvePurchasableOffer;
- instantiate PrepareOrder;
- instantiate PrismaCheckoutOrderRepository;
- instantiate CreateCheckoutOrder;
- generate Customer ID;
- generate OrderItem ID;
- use verified token UUID as Order ID;
- execute CreateCheckoutOrder;
- map CREATED, EXISTING, CONFLICT and business errors to public-safe state;
- emit only fixed non-sensitive operational diagnostics.

No accepted form field exists for:

- price;
- total;
- Product ID;
- Offer ID;
- quantity;
- Order status;
- payment status.

---

## 18. Public action state

Allowed public states:

- `IDLE`;
- `VALIDATION_ERROR`;
- `CREATED`;
- `EXISTING`;
- `UNAVAILABLE`;
- `FAILED`.

`CREATED` and `EXISTING` indicate only that the checkout Order exists.

They do not mean:

- paid;
- payment approved;
- access granted;
- entitlement active;
- product delivered.

---

## 19. Public continuation

The signed submission token may remain the opaque continuation reference after successful Order creation.

Raw persistent identifiers are not required in the public contract.

Do not expose:

- Customer ID;
- raw Order ID;
- OrderItem ID;
- Product persistence UUID;
- Offer persistence UUID.

P10 may later define how the continuation token is consumed.

P09 does not create a Payment from it.

---

## 20. Checkout route

Expected files:

`src/app/checkout/page.tsx`

`src/app/checkout/page.module.css`

Optional only if React interaction requires it:

`src/app/checkout/checkout-form.tsx`

Route properties:

`runtime = "nodejs"`

`dynamic = "force-dynamic"`

`GET /checkout` resolves the current canonical Product/Offer at request time.

No cross-request commercial cache is introduced.

---

## 21. Checkout display states

AVAILABLE:

- Product name;
- current authoritative formatted price;
- email field;
- continuation action.

UNAVAILABLE:

- no stale price action;
- no order-creation path;
- safe unavailable message.

FAILED:

- generic safe failure;
- no internal diagnostics.

The checkout must never claim payment success.

---

## 22. P08 integration

P09 may modify:

`src/app/cronograma-capilar-inteligente/page.tsx`

The commercial CTA may now navigate to:

`/checkout`

Approved semantic direction:

`Continuar para o checkout`

No Product UUID, Offer UUID, price or total is appended to the URL as business authority.

---

## 23. Correlation diagnostics

Checkout requests use a request-scoped server-generated correlation UUID.

Allowed diagnostic context:

- fixed event name;
- correlation ID;
- coarse operation name.

Forbidden diagnostic content:

- email;
- submission token;
- secret;
- SQL;
- database URL;
- Prisma raw message;
- stack trace in public response.

No correlation schema column is introduced.

---

## 24. Unit tests — email

Required cases:

- valid address;
- surrounding trim;
- lowercase domain;
- local-part case preservation;
- empty input;
- malformed `@`;
- internal whitespace;
- control characters;
- local-part >64;
- total >320;
- invalid domain labels.

---

## 25. Unit tests — token

Required cases:

- valid issue/verify;
- modified signature;
- modified payload;
- malformed encoding;
- unsupported version;
- invalid UUID;
- invalid timestamp representation;
- deterministic fixture;
- no sensitive diagnostics.

---

## 26. Unit tests — application

Required cases:

- P07 PrepareOrder reuse;
- quantity internally fixed to `1`;
- authoritative price only;
- CREATED;
- EXISTING;
- unavailable offer;
- repository failure;
- no payment behavior.

---

## 27. Unit tests — Prisma adapter

Required cases:

- Order mapping;
- OrderItem snapshot mapping;
- transaction call shape;
- Customer insert;
- expected Order unique conflict;
- compatible duplicate;
- incompatible duplicate;
- unexpected Prisma errors not misclassified;
- no raw diagnostic leakage.

---

## 28. MySQL integration

Real integration tests must cover:

- Customer + Order + OrderItem atomic creation;
- authoritative snapshot;
- `2990 BRL` from test catalog authority;
- sequential same-token retry;
- concurrent same-token race;
- exactly one persisted Order;
- losing Customer rolled back;
- incompatible token/order reuse rejected;
- forced rollback;
- zero Payment records created;
- zero Entitlement records created;
- zero OutboxEvent records created by initial checkout.

Use only the approved P06 test target.

Existing database target guards remain mandatory.

---

## 29. Build independence

Production build must succeed without:

- live MySQL;
- `P08_PRODUCT_ID`;
- `P08_OFFER_ID`;
- `P09_SUBMISSION_SECRET`.

Runtime checkout requests may require those resources.

Build-time execution must not perform database access or issue submission tokens.

---

## 30. Visual validation

Required viewport validation:

- 360 px;
- 430 px;
- 768 px;
- 1440 px;
- 1920 px.

Validate:

- no horizontal overflow;
- email usability;
- focus visibility;
- price hierarchy;
- loading state;
- validation state;
- created/existing state;
- unavailable state;
- failure state.

Reuse P05 design system.

No parallel visual system is allowed.

---

## 31. Expected new files

Planning:

- `docs/architecture/p09-phase-execution-brief.md`;
- `docs/architecture/p09-implementation-plan.md`.

Implementation candidates:

- `src/modules/customers/domain/checkout-email.ts`;
- `src/modules/customers/domain/checkout-email.test.ts`;
- `src/modules/commerce/application/checkout-submission-token.ts`;
- `src/infrastructure/security/hmac-checkout-submission-token.ts`;
- `src/infrastructure/security/hmac-checkout-submission-token.test.ts`;
- `src/modules/commerce/application/create-checkout-order.ts`;
- `src/modules/commerce/application/create-checkout-order.test.ts`;
- `src/infrastructure/database/prisma-checkout-order-repository.ts`;
- `src/infrastructure/database/prisma-checkout-order-repository.test.ts`;
- `src/infrastructure/database/checkout-order.integration.ts`;
- `src/app/checkout/checkout.server.ts`;
- `src/app/checkout/actions.ts`;
- `src/app/checkout/page.tsx`;
- `src/app/checkout/page.module.css`.

Possible:

- `src/app/checkout/checkout-form.tsx`.

---

## 32. Expected modified files

Potential modifications:

- `.env.example`;
- `src/lib/config/env-schema.ts`;
- `src/lib/config/env.ts`;
- `src/lib/config/env.test.ts`;
- `src/app/cronograma-capilar-inteligente/page.tsx`.

Any additional implementation file must be reviewed against this plan.

---

## 33. Protected baseline

Without Stop Condition escalation, P09 must not change:

- `package.json`;
- `package-lock.json`;
- `prisma/schema.prisma`;
- `prisma/migrations/**`;
- P07 Order state machine;
- P07 Payment state machine;
- P07 Entitlement state machine;
- P07 Money semantics;
- P07 Catalog eligibility semantics;
- P06 database safety guard.

No new dependency is approved.

---

## 34. Stop Conditions

Immediately STOP if implementation requires:

- Prisma schema change;
- migration;
- dependency addition;
- idempotency table/column/constraint;
- Customer.email uniqueness;
- account identity semantics;
- expiration field/state/duration;
- raw unsigned UUID as trusted submission identity;
- browser-authoritative price or total;
- P07 state-machine change;
- Money semantic change;
- Payment creation;
- Mercado Pago integration;
- Entitlement creation;
- P06 database guard weakening;
- production secret provisioning.

---

## 35. Physical execution sequence

P09.4 — email validation + signed submission-token foundation

P09.5 — CreateCheckoutOrder orchestration

P09.6 — Prisma transactional repository + unit validation

P09.7 — real MySQL atomicity/idempotency integration

P09.8 — checkout server composition + public UI + P08 CTA

P09.9 — runtime state / responsive / accessibility validation

P09.10 — Validation Report

P09.11 — ChatGPT Technical Review

P09.12 — Final Quality Gate

P09.13 — checkpoint / PR / merge / post-merge closeout

P10 remains unauthorized.

---

## 36. Implementation-ready definition

Implementation may start at P09.4 only after:

- this plan exists;
- formatting passes;
- protected baseline remains intact;
- only the two approved planning documents are currently changed;
- no Stop Condition has been triggered.

P09 remains incomplete until the entire validation and integration lifecycle is finished.