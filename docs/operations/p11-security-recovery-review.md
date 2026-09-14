# P11 C6 Final Security and Recovery Review

Status: P11-C6 = COMPLETE / PASS / DOCUMENTED / FROZEN.

Date: 2026-09-13

## Scope

This document closes P11-C6 Security & Recovery after the final C6.7 adversarial review.

It covers:

- C6.1 full-refund entitlement revocation;
- C6.2 Buyer Access credential recovery;
- C6.3 rate limiting and abuse controls;
- C6.4 private-storage failure recovery;
- C6.5 backup and restore validation;
- C6.6 observability and operational health;
- C6.7 final adversarial review.

## Frozen security principles

The following boundaries are final for P11-C6:

- full authoritative refund may transition Entitlement ACTIVE -> REVOKED;
- credential compromise or recovery does not revoke the commercial entitlement;
- storage failure does not revoke the commercial entitlement;
- rate limiting does not revoke the commercial entitlement;
- observability failure does not mutate commercial rights;
- backup failure does not mutate commercial rights;
- P11 recovery logic does not re-query Mercado Pago;
- no public credential recovery/reissue endpoint exists;
- client IP/proxy headers are not trusted before a future explicit proxy boundary;
- raw Buyer Access credentials are not persisted or routinely logged;
- `/api/health` remains liveness-only;
- deep operational health remains explicit and read-only;
- no external observability provider is selected;
- no fake process-local five-minute aggregation exists.

## Adversarial evidence

C6.7-B proved:

- adversarial unit files: 13/13 PASS;
- adversarial unit tests: 100/100 PASS;
- adversarial MySQL files: 4/4 PASS;
- adversarial MySQL tests: 43/43 PASS;
- backup verification failure signal: PASS;
- restore validation failure signal: PASS;
- absolute backup/restore bundle path exposure: none;
- operational health: 5/5 OK;
- rate-limit cleanup: dry-run PASS;
- frozen rate-limit retention: 86400 seconds;
- full unit regression: 417/417 PASS;
- full MySQL regression: 125/125 PASS;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- source/schema/migrations unchanged.

## Backup and restore boundary

`restore-validate` remains read-only.

It is not a production restore executor.

The physical C6.5 restore drill remains the current recovery proof.

RPO, RTO, backup retention, production encryption, production scheduling, off-site replication, provider choice, and the production restore executor remain OPEN.

## Observability boundary

C6 remains provider-neutral.

Five-minute recurrence and rate-limit abuse thresholds remain DEFERRED until a real persistent collector/aggregator exists.

## C7 separation

C6.7 does not replace the P11 C7 Final Gate.

C7 must independently re-prove the canonical end-to-end chain:

authoritative full refund
-> REFUND_COMPLETED v1
-> Entitlement REVOKED
-> resource authorization denied
-> protected download denied

Final result:

`P11-C6 = COMPLETE / PASS / DOCUMENTED / FROZEN`

Next:

`P11-C7 — Regression / Final Gate`
