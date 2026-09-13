# P09 — Checkout & Order Creation — Phase Execution Brief

**Phase:** P09 — Checkout & Order Creation
**Status:** APPROVED — OWNER AUTHORIZATION RECORDED / IMPLEMENTATION AUTHORIZED WITH STOP CONDITIONS
**Branch:** `phase/p09-checkout-order-creation`
**Base:** `c6271aa8017a3924fdadf8cb8b36f3a078b2e6d3`
**Previous phase:** P08 — Public Sales Experience COMPLETE
**Next phase:** P10 — Mercado Pago Integration — NOT AUTHORIZED

---

## 1. Objective

Implement the first backend-authoritative checkout and persistent order-creation flow for L'Essenc Digital.

P09 must allow a visitor coming from the approved P08 commercial experience to provide the minimum buyer data and create a valid persistent `Order.PENDING` without relying on the browser for product eligibility, price, totals, payment state or financial authority.

P09 ends after persistent Customer, Order and OrderItem creation.

P09 does not create or confirm payment.

---

## 2. Canonical customer journey boundary

The P09 flow is:

Public Product Experience
→ Checkout
→ buyer email
→ server-side validation
→ canonical Product/Offer identity
→ P07 ResolvePurchasableOffer
→ P07 PrepareOrder
→ transactional persistence
→ Customer
→ Order.PENDING
→ OrderItem snapshot
→ safe order-created response

The browser is input only.

It is never authoritative for:

- product status;
- offer status;
- price;
- currency;
- quantity policy;
- order total;
- order state;
- payment state;
- entitlement;
- fulfillment.

---

## 3. Canonical product and offer

The commercial identity continues to come from server-only P08/P09 configuration:

- `P08_PRODUCT_ID`;
- `P08_OFFER_ID`.

P09 must not hardcode the physical UUID values.

P09 must resolve the current Product and Offer again at order creation time.

The public product page is not a reservation of:

- price;
- availability;
- product state;
- offer state.

The current initial commercial value is `2990 BRL`, but presentation or HTTP input must never become the authority for that amount.

---

## 4. Checkout buyer data

The only buyer datum physically supported and required by the current approved persistence baseline is:

`email`

P09 must not invent required fields such as:

- CPF;
- full name;
- telephone;
- address;
- password;
- account;
- date of birth.

Email requirements:

- required;
- string;
- trim surrounding whitespace;
- normalize domain/casing using the approved application rule;
- reject malformed or excessive input;
- maximum persistence capacity: 320 characters;
- never log the raw buyer email in ordinary application logs.

The exact email validator must be deterministic and covered by tests.

---

## 5. Customer identity rule

`Customer.email` is indexed but deliberately not globally UNIQUE.

P09 must not reinterpret email as a unique account or durable identity.

For the initial checkout flow:

- Customer is an operational buyer record;
- account creation is not required;
- email lookup must not grant ownership or authorization;
- P09 may create a Customer record for the order being created;
- duplicate prevention is based on submission/order identity, not Customer.email;
- customer identity consolidation remains OPEN for a later authorized design.

No authentication system is introduced in P09.

---

## 6. Order domain authority

P09 must reuse P07 without duplicating its business rules.

Required P07 path:

`ResolvePurchasableOffer`
→ `PrepareOrder`

`PrepareOrder` remains responsible for producing the candidate domain Order and OrderItem snapshot.

The resulting new order must be:

`PENDING`

P09 must not introduce:

- CREATED;
- PAYMENT_PENDING;
- EXPIRED;
- PROCESSING;
- any other Order status.

P09 persistence must preserve the P07 domain representation without recomputing business totals independently in Presentation.

---

## 7. Transactional persistence

Customer, Order and OrderItem creation must be atomic.

The persistence operation must use a single Prisma/MySQL transaction.

Successful commit means all required records exist.

Failure means no partially created checkout state may remain.

At minimum the transaction persists:

Customer
+ Order
+ OrderItem

P09 does not persist:

Payment
Entitlement
OutboxEvent

for initial order creation.

Financial/outbox coordination belongs to the later financial flow.

---

## 8. Server-generated identifiers

The server controls all persistent identifiers.

Required identifiers:

- submission/order ID;
- customer ID;
- order-item ID.

UUIDs must satisfy the physical `CHAR(36)` persistence format.

Browser input must never be allowed to choose arbitrary Customer or OrderItem IDs.

A checkout submission token may be returned to the browser only for safe retry/idempotency purposes.

---

## 9. Duplicate prevention and idempotency

The current schema has no dedicated checkout idempotency column.

P09 must not silently add one.

The initial P09 duplicate-prevention design uses the existing unique `Order.id` primary key.

A server-generated checkout `submissionId` becomes the intended Order ID for that submission.

The same submission retry must reuse the same submission ID.

First execution:

- validate submission token;
- validate buyer input;
- resolve current Product/Offer;
- prepare candidate Order;
- attempt atomic persistence.

If a concurrent or repeated request encounters an existing Order with that same ID:

- do not create a second Order;
- load the existing Order and OrderItem;
- compare immutable business identity relevant to the submission;
- return the existing order only when it represents the same logical submission;
- otherwise return a safe conflict/failure.

Customer creation belonging to a transaction that loses the duplicate race must roll back.

P09 must include real MySQL integration tests for sequential and concurrent duplicate submissions.

If this design cannot be implemented safely with the existing PK and transaction model, STOP.

Do not add a schema constraint or migration without returning for architectural review and explicit protected-operation authorization.

---

## 10. Expiration

The roadmap mentions expiration, but the current canonical Order state machine explicitly does not contain `EXPIRED`.

The current schema also contains no approved `expiresAt` field and no approved expiration duration exists.

Therefore P09 must not invent:

- `Order.EXPIRED`;
- an expiration timeout;
- `expiresAt`;
- background expiration;
- automatic FAILED/CANCELED transitions based only on elapsed time.

Initial P09 orders remain `PENDING` until a later authorized business event changes them.

Any requirement to implement actual order expiration is a Stop Condition requiring a canonical policy decision and, if needed, separate schema/migration authorization.

---

## 11. Correlation ID

P09 introduces request-scoped correlation for checkout/order-creation diagnostics.

Correlation ID:

- is generated or validated server-side;
- is not business authority;
- is not a payment idempotency key;
- must not contain buyer data;
- may be logged with fixed operational event names;
- must not expose stack traces, database URLs or raw Prisma diagnostics.

No arbitrary error payload is added to `ApplicationError`.

Persistence of correlation ID is not required by the current schema and must not be invented.

---

## 12. Public checkout surface

P09 may introduce:

`/checkout`

The route must be part of the normal L'Essenc P05 design system.

Minimum experience:

- checkout heading;
- current product context;
- current server-authoritative price display;
- email field;
- order-creation submission;
- loading/pending behavior where applicable;
- accessible validation feedback;
- unavailable state;
- safe failure state;
- safe duplicate/retry behavior.

The checkout must not claim that payment has occurred.

---

## 13. P08 integration

P09 may update the approved product-page commercial CTA so it can navigate to `/checkout`.

This change is now permitted because P09 is authorized.

The CTA must not imply completed purchase or payment.

The product page must not send:

- price;
- total;
- payment status;
- persistence Product UUID;
- persistence Offer UUID

as business authority to the checkout.

Commercial identity remains server-side.

---

## 14. Application architecture

Required boundary:

Presentation
→ P09 checkout application use case
→ P07 domain/application contracts
→ P09 repository/transaction interface
→ Prisma infrastructure
→ MySQL

Presentation must not import Prisma.

Domain/Application must not depend directly on Next.js, React, browser APIs or Mercado Pago.

Prisma remains Infrastructure only.

---

## 15. Expected implementation areas

Expected areas may include:

- `src/app/checkout/`;
- P09 checkout presentation/server composition;
- customer input validation;
- checkout/order-creation application service;
- repository contract for atomic order creation;
- Prisma persistence adapter;
- unit tests;
- MySQL integration tests;
- P09 implementation documentation;
- P09 Validation Report.

Existing P07 business primitives must be reused where applicable.

Do not create speculative P10/P11 modules.

---

## 16. Protected baseline

Unless a Stop Condition is raised and separately authorized, the following must remain unchanged:

- `package.json`;
- `package-lock.json`;
- `prisma/schema.prisma`;
- all existing Prisma migrations;
- P07 Order state machine;
- P07 Payment state machine;
- P07 Entitlement state machine;
- P07 Money semantics;
- P07 Product/Offer eligibility rules.

No new dependency is approved by this brief.

---

## 17. Out of scope

P09 does not implement:

- Mercado Pago SDK or API;
- PIX;
- card processing;
- PaymentProvider;
- Payment creation;
- payment approval;
- webhook;
- reconciliation;
- Payment.UNKNOWN handling against a provider;
- Order.PAID transition;
- Entitlement activation;
- digital delivery;
- signed download URLs;
- email sending;
- authentication;
- customer account;
- admin;
- analytics providers;
- production deployment.

P10+ remains unauthorized.

---

## 18. Error and privacy behavior

Public checkout errors must be safe and generic where appropriate.

Never expose:

- Prisma error text;
- SQL;
- database URL;
- environment secrets;
- stack traces;
- internal persistent IDs not required by the public contract;
- raw buyer email in logs.

Expected user-fixable validation errors may identify the field without exposing infrastructure details.

Unexpected infrastructure errors must be translated at the boundary into safe failure behavior.

---

## 19. Testing requirements

P09 validation must include:

- email validation unit tests;
- normalization tests;
- authoritative Product/Offer resolution;
- inactive/unavailable offer rejection;
- quantity remains 1;
- price cannot be supplied/overridden by the browser;
- Order starts PENDING;
- persisted total matches authoritative P07 Money;
- product/description/price snapshots persist correctly;
- atomic Customer + Order + OrderItem persistence;
- rollback on persistence failure;
- duplicate sequential submission;
- concurrent duplicate submission;
- mismatched reuse of submission ID rejected safely;
- no Payment created;
- no Entitlement created;
- no OutboxEvent created by initial order creation;
- database target guard;
- lint;
- typecheck;
- formatting;
- full unit suite;
- integration suite;
- production build;
- `npm audit`;
- `git diff --check`;
- secret/data-exposure scan.

---

## 20. Build rule

Production build must not require:

- a live MySQL connection;
- successful order creation;
- live Product/Offer lookup;
- payment infrastructure.

Checkout runtime may require server configuration and database access only when handling runtime requests that need those resources.

---

## 21. Stop Conditions

STOP and return to ChatGPT before implementation continues if any of the following becomes necessary:

- Prisma schema change;
- new migration;
- new dependency;
- dedicated idempotency table/column/constraint;
- Order expiration field/state/policy;
- Customer identity or global email uniqueness decision;
- browser-authoritative price/total;
- direct Prisma access from Presentation;
- changes to P07 state machines;
- changes to Money semantics;
- creation of Payment in P09;
- PaymentProvider or Mercado Pago integration;
- entitlement creation;
- transactional outbox for payment effects;
- production/external-service credentials;
- weakening of P06 database guard;
- conflict with canonical P01–P08 documentation.

---

## 22. Acceptance criteria

P09 may receive PASS only when:

A user can reach `/checkout`, submit the minimum approved buyer data, and the backend independently resolves the current canonical Product/Offer and creates exactly one valid persistent `Order.PENDING` with its Customer and OrderItem snapshot.

Retries of the same logical checkout submission must not create duplicate orders.

No payment, entitlement or financial success is implied.

The implementation must preserve all P06/P07 constraints and P10+ boundaries.

---

## 23. Phase completion lifecycle

Required lifecycle:

Planning
→ Specification
→ approved brief
→ physical implementation plan
→ implementation
→ validation
→ ChatGPT Technical Review
→ corrections if required
→ Final Quality Gate
→ checkpoint
→ push
→ PR/merge
→ post-merge documentation closeout.

P09 is not COMPLETE merely because `/checkout` works.

P10 must not begin automatically.