# Gate B — Commerce Core Ready

Status: **PASS / COMMERCE CORE READY**

Date: 2026-09-13

## Canonical question

Can a customer create an order, pay and receive access safely, reliably and auditably?

**Answer: PASS.**

## Scope validated

Gate B validates the commerce core across:

- P09 — checkout/order creation;
- P10 — payment persistence and authoritative financial state;
- P11 — entitlement, Buyer Access, authorization and protected digital delivery.

P12 is outside Gate B.

## Canonical positive scenario

The dedicated integration proof is:

`src/infrastructure/database/commerce-core-gate.integration.ts`

The controlled MySQL-backed path proves:

1. valid checkout creates one Customer, Order and OrderItem;
2. Order starts PENDING;
3. logical checkout retry returns EXISTING;
4. retry loser persists no duplicate Customer or OrderItem;
5. P10 reserves one payment attempt;
6. authoritative ProviderSnapshot approval is applied;
7. Payment becomes APPROVED;
8. Order becomes PAID;
9. exactly one PAYMENT_APPROVED v1 outbox event exists;
10. P11 processes the event;
11. replay returns NOOP;
12. Entitlement becomes ACTIVE;
13. immutable EntitlementDigitalResource grant exists;
14. one opaque Buyer Access credential is issued;
15. raw credential material is not persisted;
16. credential exchange creates a signed Buyer Session;
17. Buyer Session is revalidated against current persisted state;
18. the purchased resource authorizes;
19. private storage supplies the exact protected fixture;
20. protected HTTP download returns 200;
21. one SUCCEEDED DigitalDeliveryEvent records the delivery.

No real Mercado Pago network request participates in the canonical scenario.

## Canonical adversarial scenario

The P11 C7 Final Gate proves:

1. authoritative full refund;
2. REFUND_COMPLETED v1;
3. Entitlement ACTIVE -> REVOKED;
4. immutable resource grant remains;
5. Buyer Access credential is not implicitly revoked;
6. resource authorization is denied;
7. protected-download HTTP returns generic 404;
8. protected delivery does not start;
9. zero protected resource bytes are released;
10. refund replay returns NOOP;
11. revokedAt remains stable.

## Final regression evidence

- Gate B commerce core: 1/1 PASS;
- P09 checkout: 7/7 PASS;
- P10 payment: 19/19 PASS;
- P11 entitlement: 23/23 PASS;
- P11 Buyer Access: 31/31 PASS;
- P11 resource authorization: 17/17 PASS;
- P11 delivery audit: 4/4 PASS;
- P11 storage recovery: 2/2 PASS;
- C7 refund/revocation: 1/1 PASS;
- protected-download boundary: 10/10 PASS;
- P10 fail-closed atomicity: 1/1 PASS;
- full MySQL: 12 files / 126 tests PASS;
- full unit: 37 files / 417 tests PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- Gate B acceptance matrix: 20/20 PASS.

## Financial authority boundary

The browser does not determine authoritative financial state.

Authoritative payment transitions use authenticated provider observations through the existing P10 ProviderSnapshot contract.

The Gate B canonical proof performs no real Mercado Pago network request.

## Result

`GATE B = PASS / COMMERCE CORE READY / DOCUMENTED / FROZEN`

## Next candidate

`P12 — Identity / Authentication / Administrative Access`

P12 is the next candidate only.

Gate B does **not** authorize P12 implementation.

## Git publication boundary

This closeout does not authorize or perform:

- commit;
- push;
- tag;
- pull request;
- merge;
- deploy.
