# P11 Final Gate

Status: P11 = COMPLETE / PASS / DOCUMENTED / FROZEN.

Date: 2026-09-13

## Scope

P11 — Entitlement & Secure Digital Delivery is complete.

The completed scope includes:

- C1 schema and migration foundation;
- C2 entitlement integration;
- C3 Buyer Access;
- C4 resource authorization;
- C5 protected delivery;
- C6 security and recovery;
- C7 regression and final gate.

## Canonical C7 proof

The final gate uses one controlled MySQL-backed scenario that reuses the real P10 payment/refund persistence path.

It proves:

1. an approved purchase owns an ACTIVE entitlement;
2. the immutable resource grant exists before refund;
3. a Buyer Access credential is ACTIVE;
4. an authoritative full refund creates REFUND_COMPLETED v1;
5. the refund consumer returns PROCESSED;
6. the entitlement transitions ACTIVE -> REVOKED;
7. the historical EntitlementDigitalResource grant remains;
8. the Buyer Access credential remains ACTIVE and is not implicitly revoked;
9. resource authorization fails with RESOURCE_NOT_AVAILABLE;
10. protected-download HTTP returns generic 404;
11. protected resource delivery does not start;
12. no protected resource bytes are released;
13. no DigitalDeliveryEvent is created for the denied request;
14. replaying the same refund returns NOOP;
15. revokedAt remains stable after replay;
16. no direct Mercado Pago re-query occurs in the P11 final-gate path.

## Final regression evidence

- canonical C7 scenario: 1/1 PASS;
- entitlement-grant integration: 23/23 PASS;
- protected-download HTTP boundary: 10/10 PASS;
- full MySQL regression: 11 files / 125 tests PASS;
- full unit regression: 37 files / 417 tests PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- migration count: 5;
- P11 migration checksums: preserved;
- production code unchanged during C7-C;
- schema unchanged;
- no new migration.

## Frozen security boundaries

- refund authority comes from authoritative persisted financial state and REFUND_COMPLETED;
- P11 does not re-query Mercado Pago to reinterpret refund state;
- refund revokes the commercial entitlement, not the Buyer Access credential;
- authorization checks current persisted entitlement/order/credential state on each request;
- immutable entitlement-resource grants remain historical purchase evidence;
- protected storage is private and authorization precedes delivery;
- denied authorization does not release protected resource bytes;
- storage, rate-limit, observability, backup, and credential-recovery failures do not mutate commercial rights;
- no public credential recovery endpoint exists;
- `/api/health` remains liveness-only;
- no external observability provider is selected;
- no fake process-local five-minute aggregator exists.

## Open production decisions

The following remain explicitly outside the completed P11 implementation scope:

- RPO;
- RTO;
- backup retention;
- production backup scheduling;
- backup encryption;
- off-site replication;
- backup provider;
- production restore executor;
- production rate-limit cleanup scheduler;
- external observability provider;
- persistent recurrence aggregation;
- trusted proxy/IP boundary;
- future trusted public recovery flow.

These open decisions do not invalidate the frozen P11 application contract.

## Git publication boundary

P11 closeout does not authorize:

- commit;
- push;
- tag;
- pull request;
- merge;
- deployment.

Those actions require a separate explicit authorization.

## Final result

`P11 = COMPLETE / PASS / DOCUMENTED / FROZEN`

The next macro-checkpoint remains Gate B.
