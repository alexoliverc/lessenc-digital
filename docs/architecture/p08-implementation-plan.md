# P08 — Physical Implementation Plan

**Status:** COMPLETE — CHATGPT TECHNICAL REVIEW PASS / FINAL QUALITY GATE PASS / MERGED
**Phase:** P08 — Public Sales Experience
**Brief:** P08 Phase Execution Brief R0.3
**Branch:** `phase/p08-public-sales-experience`
**Implementation Preflight:** PASS
**Stop Conditions:** NONE
**P09:** NOT STARTED

---

## 1. Objective

Implement the first production-quality public sales experience for L'Essenc Digital and the product Cronograma Capilar Inteligente without introducing checkout or transactional behavior.

---

## 2. Routes

### `/`

Static public entry point.

Responsibilities:

- introduce L'Essenc;
- introduce Cronograma Capilar Inteligente;
- link to `/cronograma-capilar-inteligente`.

It must not:

- access Prisma;
- access CatalogRepository;
- resolve commercial state;
- display authoritative price.

### `/cronograma-capilar-inteligente`

Canonical commercial presentation route.

Rendering contract:

- React Server Component;
- Node.js runtime;
- request-time rendering;
- `dynamic = "force-dynamic"`;
- no cross-request commercial cache;
- no Client Component unless browser interactivity becomes necessary.

---

## 3. Application Module

Create:

`src/modules/sales/application/public-sales-experience.ts`

Responsibilities:

- translate P07 purchasable-offer results into a safe public model;
- format authoritative BRL price;
- distinguish AVAILABLE, UNAVAILABLE and FAILED;
- expose no Prisma records or raw diagnostics;
- contain no persistence access;
- contain no checkout behavior.

Public states:

### AVAILABLE

Contains safe product and offer presentation data.

Offer data originates only from P07 `Money`.

### UNAVAILABLE

Used only for legitimate business non-purchasability:

- `PRODUCT_UNAVAILABLE`;
- `OFFER_UNAVAILABLE`.

No price or commercial action is exposed.

### FAILED

Used for operational, configuration, persistence or integrity failure, including:

- `PERSISTENCE_UNAVAILABLE`;
- `OFFER_PRODUCT_MISMATCH`;
- unsupported/corrupt commercial currency;
- unexpected runtime failure handled by the server composition boundary.

No raw technical information is exposed publicly.

---

## 4. Safe Public View Model

AVAILABLE may expose:

- product name;
- product description;
- amount in minor units;
- currency;
- formatted price;
- one-time purchase presentation label.

Persistence IDs are not required by React presentation.

UNAVAILABLE and FAILED contain no offer amount.

---

## 5. Server Composition Root

Create:

`src/app/cronograma-capilar-inteligente/public-sales.server.ts`

Responsibilities:

1. read `P08_PRODUCT_ID` and `P08_OFFER_ID`;
2. obtain the approved database client;
3. instantiate `PrismaCatalogRepository`;
4. instantiate P07 `ResolvePurchasableOffer`;
5. call the P08 application mapping;
6. catch unexpected/configuration failures;
7. return FAILED safely;
8. log only bounded server-side diagnostic metadata.

It must not expose:

- database URLs;
- credentials;
- Prisma errors;
- stack traces;
- provider/payment concepts.

---

## 6. Product Route

Create:

`src/app/cronograma-capilar-inteligente/page.tsx`

Exports:

- `runtime = "nodejs"`;
- `dynamic = "force-dynamic"`;
- route metadata.

The route must contain exactly one h1.

Information architecture:

1. Hero
2. Problem/context
3. Method
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
15. Final informational CTA
16. Footer

No transactional CTA is allowed.

---

## 7. Root Route

Modify:

- `src/app/page.tsx`;
- `src/app/page.module.css`.

Replace the P05 technical preview with the static public L'Essenc entry.

The root must stay independent of commercial runtime configuration and database availability.

---

## 8. P05 Reuse

Reuse without creating a parallel design system:

- Container;
- Section;
- Stack;
- Inline;
- Grid;
- Surface;
- LinkAction;
- StatePanel;
- globals.css;
- tokens.css.

Existing P05 semantic color, typography, spacing, radius, focus and motion rules remain authoritative.

---

## 9. Visual Asset Strategy

P08 initial visual presentation will use first-party coded editorial artwork built with semantic HTML and CSS.

No external stock photography or temporary placeholder asset is required.

Any later photographic asset must be owned, explicitly approved or properly licensed.

---

## 10. Accessibility

Requirements:

- semantic header/main/footer;
- exactly one h1 per page;
- logical heading order;
- skip link;
- keyboard-safe navigation;
- visible focus;
- no color-only information;
- accessible commercial state messages;
- reduced-motion compatibility;
- adequate touch targets;
- no horizontal overflow.

---

## 11. SEO

Root metadata remains brand-oriented.

Product route metadata includes:

- title;
- description;
- canonical path;
- Open Graph baseline.

`metadataBase` continues to come from the existing server environment.

No production hostname is hardcoded.

---

## 12. Testing

Create:

`src/modules/sales/application/public-sales-experience.test.ts`

Mandatory cases:

### AVAILABLE

- preserves authoritative product;
- preserves authoritative amount;
- preserves BRL;
- formats 2990 as Brazilian currency;
- emits safe presentation data.

### UNAVAILABLE

- PRODUCT_UNAVAILABLE maps to UNAVAILABLE;
- OFFER_UNAVAILABLE maps to UNAVAILABLE;
- no price fallback exists.

### FAILED

- PERSISTENCE_UNAVAILABLE maps to FAILED;
- OFFER_PRODUCT_MISMATCH maps to FAILED;
- technical diagnostics do not enter the public model;
- no commercial action is exposed.

No new testing dependency is allowed.

---

## 13. Build Contract

`npm run build` must pass without:

- `DB_RUNTIME_URL`;
- `DB_TLS_CA_FILE`;
- `P08_PRODUCT_ID`;
- `P08_OFFER_ID`;
- live MySQL.

Commercial resolution must not execute during build.

---

## 14. Performance

- Server Components by default;
- no unnecessary Client Components;
- no analytics;
- no external marketing scripts;
- no animation dependency;
- no commercial cross-request cache.

---

## 15. Explicit Non-Scope

P08 does not implement:

- checkout;
- Order creation;
- Customer creation;
- Mercado Pago;
- PIX;
- card payment;
- webhooks;
- payment state;
- entitlement fulfillment;
- digital delivery;
- authentication;
- admin;
- GTM;
- Meta Pixel;
- transactional email.

---

## 16. Protected Baseline

Must remain unchanged unless a Stop Condition is reopened:

- `package.json`;
- `package-lock.json`;
- `prisma/schema.prisma`;
- existing migrations;
- P07 domain rules;
- P07 Money semantics;
- P07 catalog eligibility.

---

## 17. Implementation Order

1. create P08 application model and mapping;
2. create unit tests;
3. validate application layer;
4. create server composition root;
5. implement static `/`;
6. implement dynamic product route;
7. implement P08 CSS;
8. validate build without live DB;
9. validate real AVAILABLE state;
10. validate UNAVAILABLE and FAILED states;
11. responsive and accessibility review;
12. full quality gate;
13. Validation Report;
14. ChatGPT Technical Review;
15. Final Quality Gate.

---

## 18. Definition of Implementation Ready

Implementation may begin because:

- P08 Brief R0.3 is approved;
- Product/Offer identity is resolved;
- server-only configuration is validated;
- P07 integration has been proven;
- Prisma/MySQL resolution has been proven;
- P05 primitives are sufficient;
- existing Vitest stack is sufficient;
- no schema change is required;
- no migration is required;
- no new dependency is required;
- no Stop Condition remains active.

---

## Final State

**Physical Implementation Plan:** APPROVED
**Implementation Preflight:** PASS
**Implementation:** READY
**Stop Conditions:** NONE
**P09:** NOT STARTED

## Post-merge closeout

- Implementation checkpoint: `f73400af5a0570d379bb700f752e8cb73639899b`.
- Checkpoint tag: `checkpoint/p08-public-sales-experience-complete`.
- Pull Request: #8.
- Merge commit: `2686e39776cb9601dbbb643a87855923f6421d3e`.
- ChatGPT Technical Review: PASS.
- Final Quality Gate: PASS.
- P08 status: COMPLETE.
- P09 remains NOT STARTED.
