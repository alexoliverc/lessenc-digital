# P08 — Public Sales Experience

## Phase Execution Brief — R0.3

**Status:** APPROVED — IMPLEMENTATION AUTHORIZED
**Phase:** P08 — Public Sales Experience
**Project:** L’Essenc Digital
**Previous phase:** P07 — Core Domain & Application Layer — COMPLETE
**Canonical main baseline:** `2164e65dfd1d8060aafef3af0ee2c631b900b20c`
**P07 implementation checkpoint:** `4c96e7b8fd9aaeefbcc0848cb50ccb664c8b329a`
**P07 checkpoint tag:** `checkpoint/p07-core-domain-application-complete`
**P07 implementation merge:** `6a19edab329995af6e061d8685cd2b6c0ddaf3b5`
**P07 documentary closeout merge:** `2164e65dfd1d8060aafef3af0ee2c631b900b20c`

---

# 1. Objective

Implement the first public commercial experience of L’Essenc Digital for:

**Cronograma Capilar Inteligente**

Canonical commercial baseline:

- product: Cronograma Capilar Inteligente;
- launch price: R$ 29,90;
- internal monetary value: `2990` BRL minor units;
- quantity: 1;
- transaction model: one-time purchase;
- product type: digital;
- commercial authority: P07 Catalog/Application layer.

P08 presents the product and authoritative offer.

P08 does **not** execute a purchase.

---

# 2. Business Goal

P08 must allow a public visitor to:

1. recognize the L’Essenc brand;
2. understand the problem addressed by the product;
3. understand the concept of a structured hair-care schedule;
4. understand Hidratação, Nutrição and Reconstrução;
5. understand what the digital material contains;
6. understand who it is intended for;
7. see the current authoritative commercial offer;
8. reach the end of the sales experience prepared for P09.

The experience must resemble a premium beauty brand.

It must not resemble a generic PLR/high-pressure landing page.

---

# 3. Canonical Routes

P08 owns two public routes.

## `/`

Public L’Essenc entry point.

It must remain **static** during P08.

Responsibilities:

- introduce L’Essenc;
- identify Cronograma Capilar Inteligente as the current featured product;
- direct the visitor to the canonical product route.

The root route:

- must not query CatalogRepository;
- must not resolve the current Offer;
- must not display an authoritative price;
- must not duplicate commercial availability logic.

## `/cronograma-capilar-inteligente`

Canonical commercial presentation route.

It must resolve current commercial state on the server at request time.

P08 must not create `/checkout`.

---

# 4. Rendering Contract

The rendering architecture is:

    /
    └── static public entry
        ├── no catalog query
        └── no authoritative price

    /cronograma-capilar-inteligente
    └── server-rendered commercial route
        └── request-time commercial resolution
            ↓
        P08 application composition
            ↓
        P07 Catalog/Application capability
            ↓
        CatalogRepository
            ↓
        Prisma Infrastructure
            ↓
        MySQL

The product route must not resolve live commercial data during static build.

The implementation must use a mechanism supported by the installed Next.js baseline that guarantees request-time execution.

The chosen mechanism must be recorded in P08 implementation documentation.

---

# 5. Runtime Boundary

Commercial catalog access must occur in the approved server runtime compatible with Prisma/MySQL.

P08 must not move catalog access to:

- browser-side code;
- Client Components;
- direct browser persistence access;
- an incompatible Edge runtime.

---

# 6. Build Independence

`npm run build` must succeed without a live database connection.

P08 must not execute during build:

- Prisma queries;
- CatalogRepository;
- ResolvePurchasableOffer;
- MySQL connectivity.

If build begins requiring a live database:

**STOP.**

Hardcoding commercial data is not an acceptable workaround.

---

# 7. Commercial Cache Policy

P08 must not introduce cross-request caching of:

- price;
- Product status;
- Offer status;
- purchasability.

Canonical behavior:

    request
    ↓
    resolve current commercial state
    ↓
    build safe public view model
    ↓
    render response

Future caching requires a separate architecture decision.

---

# 8. Product and Offer Identification

The route slug `cronograma-capilar-inteligente` is a presentation identifier.

It must not automatically become a persistence identifier.

Before implementing catalog lookup, P08 must inspect:

- ResolvePurchasableOffer;
- CatalogRepository;
- Product;
- Offer;
- PrismaCatalogRepository.

Forbidden without architecture approval:

- inventing a database ID;
- embedding an opaque production database ID into presentation code;
- assuming route slug is already a persistence key;
- adding a slug column;
- modifying Prisma schema;
- creating a migration.

If P07 cannot deterministically identify the correct Product/Offer:

**STOP CONDITION.**

---

# 9. User Journey

Canonical journey:

    Visitor
    ↓
    /
    ↓
    Cronograma Capilar Inteligente
    ↓
    /cronograma-capilar-inteligente
    ↓
    Hero
    ↓
    Problem
    ↓
    Method
    ↓
    Hidratação / Nutrição / Reconstrução
    ↓
    Practical benefits
    ↓
    What is included
    ↓
    How to use
    ↓
    Who it is for
    ↓
    Product presentation
    ↓
    Commercial offer
    ↓
    FAQ
    ↓
    Final informational CTA

No transactional entity is created in P08.

---

# 10. Information Architecture

The product page should contain:

1. Hero
2. Problem/context
3. Method introduction
4. Hidratação
5. Nutrição
6. Reconstrução
7. Practical benefits
8. What the customer receives
9. How the material is used
10. Audience qualification
11. Product visual presentation
12. Commercial offer
13. Purchase clarification
14. FAQ
15. Final CTA
16. Footer

---

# 11. Hero Direction

Primary positioning:

**Pare de cuidar do seu cabelo no improviso.**

The hero should communicate:

- product identity;
- central benefit;
- digital nature;
- product presentation;
- one-time purchase model;
- authoritative price when available;
- non-transactional CTA.

---

# 12. Copy Principles

Communication pillars:

- Organization
- Understanding
- Practical Application
- Clarity

The experience should explain:

- what to do;
- when to do it;
- why the stages differ.

Forbidden:

- medical claims;
- therapeutic claims;
- guaranteed outcomes;
- fabricated statistics;
- fabricated testimonials;
- fabricated endorsements;
- miracle claims.

---

# 13. CTA Contract

P08 CTAs are informational only.

Allowed examples:

- Conhecer o cronograma
- Entender o método
- Ver o conteúdo
- Ver a oferta
- Conhecer os detalhes

Permitted anchors include:

- `#metodo`
- `#conteudo`
- `#oferta`
- `#faq`

Forbidden in P08:

- Comprar agora
- Finalizar compra
- Ir para pagamento
- Pagar agora
- Garantir minha compra
- Checkout

P09 introduces the first transactional CTA.

---

# 14. Commercial Authority

Presentation code must not determine:

- product identity;
- current price;
- currency;
- Product commercial status;
- Offer commercial status;
- purchasability.

Canonical flow:

    Product route
    ↓
    P08 application composition
    ↓
    P07 purchasable-offer resolution
    ↓
    CatalogRepository
    ↓
    Prisma Infrastructure
    ↓
    safe P08 view model
    ↓
    React presentation

React must not implement commercial business rules.

---

# 15. Public Commercial State Contract

P08 must explicitly model three public outcomes.

## AVAILABLE

Valid Product and Offer are resolved and commercially eligible.

The UI may display:

- price;
- formatted amount;
- offer information;
- informational offer CTA.

## UNAVAILABLE

A legitimate business result indicates that no purchasable offer is currently available.

The UI must:

- show a controlled availability message;
- show no invented price;
- show no action suggesting current purchase availability.

## FAILED

An unexpected application/infrastructure/runtime failure prevented safe commercial resolution.

The UI must:

- expose no raw diagnostic;
- expose no Prisma error;
- expose no database information;
- expose no credentials;
- expose no commercial action.

Technical diagnostics remain server-side.

---

# 16. Failure Classification

UNAVAILABLE and FAILED are distinct.

Infrastructure/database failure must not be converted into business unavailability.

Only legitimate domain/application non-purchasability may become UNAVAILABLE.

---

# 17. Public Sales View Model

P08 should introduce a narrow presentation model containing only safe presentation data such as:

- state;
- product;
- offer;
- formatted price;
- currency;
- display data.

It must not expose:

- Prisma records;
- connection metadata;
- raw exceptions;
- persistence diagnostics;
- secrets;
- Mercado Pago concepts.

---

# 18. Money and Price Rules

Canonical amount:

`2990 BRL minor units`

Public representation:

`R$ 29,90`

The formatted amount must originate from authoritative P07 commercial data.

Forbidden presentation fallbacks include:

- hardcoded `2990`;
- hardcoded `"R$ 29,90"` when resolution fails;
- fallback commercial values.

---

# 19. P05 Design System Authority

P05 remains authoritative for:

- typography;
- colors;
- spacing;
- containers;
- buttons/links;
- radius;
- shadows;
- focus;
- responsive primitives;
- foundational components.

P08 must not create a parallel design system.

---

# 20. Visual Direction

Target:

- premium;
- editorial;
- sophisticated;
- restrained;
- contemporary;
- beauty-oriented;
- generous whitespace;
- highly legible;
- mobile-first.

Avoid:

- stereotypical PLR visuals;
- excessive badges;
- neon promotional styling;
- fake scarcity;
- countdowns;
- aggressive conversion manipulation;
- generic low-quality stock imagery.

---

# 21. Asset Provenance

Final imagery must be:

- created specifically for L’Essenc;
- owned by L’Essenc;
- explicitly approved;
- or properly licensed.

Temporary placeholders must not survive Final Quality Gate.

---

# 22. Responsive Requirements

Mandatory visual validation around:

- 360 px;
- 390–430 px;
- 768 px;
- 1280–1440 px;
- 1920 px.

Requirements include:

- no horizontal overflow;
- no text clipping;
- no overlapping sections;
- stable imagery;
- readable line lengths;
- usable touch targets;
- deliberate desktop/mobile composition.

---

# 23. Accessibility

P08 must provide:

- semantic landmarks;
- exactly one page h1;
- logical heading hierarchy;
- meaningful interactive labels;
- keyboard navigation;
- visible focus;
- adequate contrast;
- meaningful alt text;
- decorative-image handling;
- no color-only communication;
- appropriate touch targets;
- reduced-motion support when applicable.

---

# 24. Performance

Prefer Server Components.

Client Components require real browser interactivity.

Avoid:

- unnecessary hydration;
- large client bundles;
- third-party marketing scripts;
- unnecessary animation libraries;
- oversized assets;
- avoidable layout shift.

---

# 25. SEO Baseline

P08 should provide:

- semantic title;
- meta description;
- canonical route intent;
- Open Graph baseline;
- social metadata where supported;
- environment-appropriate robots behavior;
- semantic structure.

Canonical route:

`/cronograma-capilar-inteligente`

Do not invent a production hostname.

P08 does not implement analytics infrastructure.

---

# 26. Security and Privacy

P08 must not expose:

- secrets;
- database credentials;
- database URLs;
- raw Prisma errors;
- stack traces;
- Mercado Pago credentials;
- internal server configuration.

No direct browser database access.

No browser-side commercial authority.

No unsafe dynamic HTML injection.

---

# 27. Testing Strategy

Mandatory application-level coverage:

## AVAILABLE

- authoritative offer maps to AVAILABLE;
- amount is preserved;
- BRL formatting is correct;
- presentation data is safe.

## UNAVAILABLE

- legitimate non-purchasability maps to UNAVAILABLE;
- no price fallback exists;
- commercial action is suppressed.

## FAILED

- infrastructure/application failure does not map to UNAVAILABLE;
- technical details do not enter the public model;
- commercial action is suppressed.

## Integrity

- presentation does not invent `2990`;
- P08 does not duplicate P07 eligibility rules.

New testing dependency requires:

**STOP → technical review → explicit approval.**

---

# 28. Manual Visual Validation

Final visual review must include:

- small mobile;
- regular mobile;
- tablet;
- desktop;
- large desktop.

Review:

- hierarchy;
- alignment;
- whitespace;
- typography;
- visual rhythm;
- CTA clarity;
- product imagery;
- responsive behavior;
- keyboard focus;
- overflow;
- premium-brand quality.

---

# 29. Validation Commands

Final Quality Gate includes:

- `npm ci`
- `npm audit`
- `npm run db:validate`
- `npm run db:generate`
- `npm run check`
- `npm run test:integration`
- `npm run build`
- `git diff --check`

The guarded P06 integration environment remains mandatory.

Build must also pass without live database connection variables.

Secret scan must cover all new/changed P08 files.

---

# 30. Protected Files

P08 must not modify without stopping for review:

- `package.json`;
- `package-lock.json`;
- `prisma/schema.prisma`;
- existing Prisma migrations;
- P07 state machines;
- P07 Money semantics;
- P07 Offer eligibility;
- P07 Order rules;
- P07 Payment rules;
- P07 Entitlement rules.

---

# 31. Explicit Non-Scope

P08 does not implement:

- checkout;
- public Order creation;
- Customer creation;
- PIX;
- card payment;
- Mercado Pago;
- provider SDKs;
- payment webhooks;
- Payment persistence coordination;
- Outbox processing;
- Entitlement fulfillment;
- ebook delivery;
- secure download tokens;
- authentication;
- admin;
- customer account;
- analytics infrastructure;
- GTM;
- Meta Pixel;
- transactional email;
- production deployment;
- P09+ functionality.

---

# 32. Stop Conditions

Implementation must stop if:

1. Prisma schema change is required;
2. migration is required;
3. new runtime dependency is required;
4. new testing dependency is required;
5. P07 cannot deterministically resolve Product/Offer;
6. presentation requires a hardcoded persistence identifier;
7. database access occurs during build;
8. build requires a live database;
9. cross-request commercial cache becomes necessary;
10. React would duplicate business rules;
11. checkout behavior becomes necessary;
12. payment/provider concepts enter P08;
13. secrets or raw infrastructure diagnostics risk reaching browser;
14. P05 requires a material foundation redesign;
15. canonical documentation materially conflicts with this brief.

---

# 33. Implementation Preflight

Before substantive implementation, inspect:

- P05 design-system files;
- P07 Catalog domain;
- P07 Catalog application;
- ResolvePurchasableOffer;
- CatalogRepository;
- Prisma Catalog adapter;
- current `/`;
- current Next.js route/rendering conventions;
- environment parsing;
- existing test stack.

The preflight must answer:

1. What stable Product/Offer identifier already exists?
2. How will the product route resolve the correct offer?
3. Which exact mechanism guarantees request-time rendering?
4. Which P05 primitives will be reused?
5. Which existing test capabilities can validate P08?
6. Does any requirement trigger a Stop Condition?

---

# 34. Phase Branch

Implementation branch:

`phase/p08-public-sales-experience`

created from:

`main @ 2164e65dfd1d8060aafef3af0ee2c631b900b20c`

---

# 35. Documentation Deliverables

P08 must produce/update:

- this Phase Execution Brief;
- P08 implementation documentation;
- P08 Validation Report;
- MEMORY.md;
- session memory;
- ROADMAP.md;
- docs/README.md;
- directly affected canonical architecture documentation.

---

# 36. Definition of Done

P08 is complete only when:

- `/` remains coherent and static;
- `/cronograma-capilar-inteligente` exists;
- product route is request-time/server rendered;
- build requires no live DB;
- P07 authoritative offer resolution is reused;
- no commercial rule is duplicated in React;
- no price fallback exists;
- AVAILABLE is handled;
- UNAVAILABLE is handled;
- FAILED is distinct;
- P05 visual foundation is reused;
- information architecture is complete;
- final assets are approved;
- responsiveness passes;
- accessibility passes;
- SEO baseline is implemented;
- no P09+ behavior exists;
- protected files remain unchanged unless reviewed;
- lint passes;
- typecheck passes;
- tests pass;
- integration tests pass where applicable;
- formatting passes;
- production build passes;
- audit has no unacceptable regression;
- secret scan passes;
- visual review passes;
- Validation Report exists;
- ChatGPT Technical Review returns PASS;
- Final Quality Gate returns PASS;
- checkpoint/tag exists;
- approved implementation reaches main;
- post-merge documentation is reconciled.

---

# 37. Git Lifecycle

Planning
→ Specification
→ Brief Technical Review
→ Owner Authorization
→ phase branch
→ P08 preflight
→ implementation
→ Validation Report
→ ChatGPT Technical Review
→ corrections if required
→ Final Quality Gate
→ checkpoint commit/tag
→ push
→ PR
→ merge
→ post-merge documentary closeout
→ P08 COMPLETE

Proposed checkpoint tag:

`checkpoint/p08-public-sales-experience-complete`

P09 does not begin automatically.

---

# 38. Authorization Boundary

P08 authorization does not authorize:

- P09;
- P10;
- P11;
- schema changes;
- migrations;
- dependency additions;
- architecture changes covered by Stop Conditions.

---

# 39. Expected Final Result

At the end of P08, L’Essenc will have its first production-quality public commercial presentation.

The visitor will understand:

- L’Essenc;
- Cronograma Capilar Inteligente;
- the problem addressed;
- Hidratação;
- Nutrição;
- Reconstrução;
- what is included;
- how the product is used;
- who it is for;
- the current authoritative offer;
- common questions.

The visitor will **not** yet complete a purchase.

That begins in P09.

---

## Final State

**P08 Brief:** R0.3
**Technical Review:** PASS
**Owner Authorization:** GRANTED
**Implementation:** AUTHORIZED
**Current step:** IMPLEMENTATION PREFLIGHT
**P09:** NOT STARTED
---

# 40. Architecture Amendment R0.3 — Canonical Product/Offer Identity

The P08 implementation preflight confirmed that P07 already exposes stable UUID identifiers for Product and Offer, but no public slug-to-persistence mapping, seed or canonical runtime identifier source exists.

P08 therefore adopts server-only runtime configuration:

- `P08_PRODUCT_ID`;
- `P08_OFFER_ID`.

These values:

- are persistent identifiers, not presentation slugs;
- must be valid UUIDs;
- are validated only when the P08 commercial experience requires them;
- must never use the `NEXT_PUBLIC_` prefix;
- must never be exposed as commercial authority in browser code;
- are passed to the existing P07 `ResolvePurchasableOffer`;
- do not modify P07 eligibility semantics;
- do not require Prisma schema changes;
- do not require migrations.

The public route `/cronograma-capilar-inteligente` remains a presentation route and is not a persistence identifier.

Missing or invalid P08 identifier configuration is an operational/configuration failure and therefore maps to the P08 FAILED path, never UNAVAILABLE.

The global application environment must remain build-safe. P08 identifier validation must not execute merely because the environment module is imported.

With this amendment, Stop Condition #5 from the implementation preflight is resolved at the architecture level.

Actual Product and Offer records must still exist in the target database before AVAILABLE can be rendered.

---

## R0.3 Preflight Resolution

**Product persistence identity:** UUID
**Offer persistence identity:** UUID
**Public route identity:** presentation-only slug
**Canonical runtime mapping:** server-only environment configuration
**Schema change required:** NO
**Migration required:** NO
**New dependency required:** NO
**Preflight Stop Condition #5:** RESOLVED