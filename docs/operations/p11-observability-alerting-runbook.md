# P11 Observability and Alerting Runbook

Status: P11-C6.6 = COMPLETE / PASS / DOCUMENTED / FROZEN.

## Purpose

This runbook defines the operational observability, health-probe, alert-signal, and rate-limit-retention contract implemented by P11-C6.6.

The design is provider-neutral.

C6.6 does not select or install Sentry, Datadog, OpenTelemetry, Prometheus, Grafana, CloudWatch, Loki, or another external observability provider.

C6.6 also does not create a persistent metrics store or a fake process-local rolling-window evaluator.

## Structured observability contract

P11 structured events use server-generated correlation IDs and low-cardinality operational dimensions.

Permitted operational dimensions include:

- event;
- level;
- correlationId;
- surface;
- scope when applicable;
- outcome;
- failureCode;
- retryAfterSeconds when applicable;
- windowSeconds when applicable;
- limit when applicable.

Routine observability must not emit:

- raw Buyer Access credentials;
- Buyer Session cookies or tokens;
- Authorization values;
- HMAC/session secrets;
- Mercado Pago credentials;
- complete database URLs or passwords;
- absolute private-storage paths;
- request bodies;
- complete customer email addresses;
- arbitrary error.message;
- stack traces as operational payload;
- routine customer, order, entitlement, resource, credential, or IP identifiers.

## Frozen P11 observability events

The frozen event vocabulary includes:

- buyer_access_invalid;
- buyer_access_rate_limited;
- buyer_access_limiter_unavailable;
- private_storage_failure;
- delivery_audit_unavailable;
- delivery_stream_failed;
- credential_recovery_failed;
- entitlement_revocation_failed;
- backup_verification_failed;
- restore_validation_failed;
- rate_limit_cleanup_completed;
- rate_limit_cleanup_failed;
- rate_limit_stale_buckets_detected.

Observability must not mutate BuyerAccessCredential, Entitlement, Order, Payment, digital-resource grants, or other commercial-right state.

## Immediate alert matrix

The following conditions are immediate alert conditions on one occurrence:

| Signal | Failure condition |
| --- | --- |
| delivery_audit_unavailable | DELIVERY_AUDIT_UNAVAILABLE |
| private_storage_failure | STORAGE_ESCAPE_DETECTED |
| private_storage_failure | STORAGE_ROOT_INVALID |
| entitlement_revocation_failed | ENTITLEMENT_REVOCATION_FAILED |
| buyer_access_limiter_unavailable | RATE_LIMIT_UNAVAILABLE |
| backup_verification_failed | BACKUP_VERIFICATION_FAILED |
| restore_validation_failed | RESTORE_VALIDATION_FAILED |
| rate_limit_cleanup_failed | RATE_LIMIT_CLEANUP_FAILED |
| rate_limit_stale_buckets_detected | stale bucket remains after cleanup |

These are structured operational signals.

C6.6 does not bind them to an external paging or monitoring vendor.

## Deferred recurrence and abuse rules

The following thresholds require a real collector or aggregator capable of preserving event history across processes and evaluating a reliable five-minute window:

| Condition | Frozen threshold |
| --- | --- |
| STORAGE_ROOT_UNAVAILABLE | >= 3 events / 5 minutes |
| STORAGE_UNAVAILABLE | >= 3 events / 5 minutes |
| RESOURCE_NOT_FOUND | >= 3 events / 5 minutes |
| STREAM_FAILED | >= 5 events / 5 minutes |
| rate-limit 429 signals | >= 20 events / 5 minutes per surface/scope |

These rules are DEFERRED until a real aggregation boundary exists.

No fake process-local rolling-window evaluator is implemented.

## Public health boundary

The public endpoint `/api/health` remains LIVENESS ONLY.

Its public contract remains equivalent to:

`{"status":"ok"}`

The public health endpoint does not expose:

- database connectivity;
- private-storage state;
- stale rate-limit bucket counts;
- alert state;
- internal failure codes;
- infrastructure configuration;
- database URLs;
- private-storage paths.

Deep operational health is intentionally separated from the public request path.

## Operational health probe

The operational health probe is executed explicitly with:

`npm run ops:p11:operational-health -- --target-database=<database>`

It performs five checks:

1. APPLICATION_CONTRACT;
2. DATABASE_CONNECTIVITY;
3. RATE_LIMIT_RETENTION;
4. PRIVATE_STORAGE;
5. OBSERVABILITY_CONTRACT.

Overall statuses are:

- OK;
- DEGRADED;
- FAILED.

FAILED takes precedence over DEGRADED, which takes precedence over OK.

The probe is read-only.

Database access consists only of SELECT operations.

The rate-limit retention check counts buckets older than 24 hours.

The private-storage check validates root policy and availability without enumerating buyer resources or exposing the absolute path.

A FAILED result exits non-zero.

A DEGRADED result remains machine-readable without using FAILED exit semantics.

## Rate-limit retention and cleanup

BuyerAccessRateLimitBucket retention is 24 hours after windowStart.

Cleanup is intentionally outside the request path.

Operational command:

`npm run ops:p11:rate-limit-cleanup -- --target-database=<database>`

The operational script is dry-run-first.

Mutation requires its explicit execution flag.

Production execution additionally requires the explicit production authorization boundary implemented by the script.

Cleanup is:

- based on one fixed 24-hour cutoff;
- batched;
- idempotent;
- limited to stale buyer_access_rate_limit_buckets;
- isolated from commercial-right state;
- independent from Mercado Pago;
- outside Buyer Access HTTP request processing.

The default batch size is 500.

The implementation caps a cleanup batch at 5000.

A successful cleanup can emit rate_limit_cleanup_completed.

Cleanup failure emits rate_limit_cleanup_failed.

If stale rows remain after cleanup, rate_limit_stale_buckets_detected is emitted.

## Backup and restore validation observability

C6.6 extends the frozen C6.5 backup contract only with safe operational failure signaling.

Backup verification failure emits:

- event: backup_verification_failed;
- surface: BACKUP_RESTORE;
- outcome: FAILED;
- failureCode: BACKUP_VERIFICATION_FAILED.

Restore validation failure emits:

- event: restore_validation_failed;
- surface: BACKUP_RESTORE;
- outcome: FAILED;
- failureCode: RESTORE_VALIDATION_FAILED.

The CLI boundary does not expose arbitrary exception messages.

Its generic failure output is:

`P11_BACKUP_ERROR=BACKUP_OPERATION_FAILED`

The `restore-validate` mode validates an existing bundle through the frozen bundle verifier.

It is read-only.

`restore-validate` does not:

- drop a database;
- create a database;
- restore database.sql;
- copy restored storage into a production target;
- mutate application state;
- constitute an actual restore executor.

Successful restore validation produces:

`RESTORE_BUNDLE_VALIDATED=1`

The physical restore drill proven in C6.5 remains a separate, explicitly authorized recovery procedure.

## Operational scheduling

C6.6 provides explicit operational entrypoints.

C6.6 does not implement a production scheduler.

Scheduling policy and execution infrastructure remain future operational work.

## Open production decisions

The following remain OPEN:

- external observability provider;
- production log/metric collector;
- reliable five-minute aggregation engine;
- production rate-limit cleanup schedule;
- production backup schedule;
- production backup encryption;
- off-site backup replication;
- backup provider;
- RPO;
- RTO;
- backup retention;
- actual production restore executor.

The measured local restore drill does not define a production RTO.

## Final C4 validation evidence

The C6.6-C4 final review proved:

- targeted operational-health and backup tests: 15/15 PASS;
- full unit regression: 417/417 PASS;
- full MySQL regression: 125/125 PASS;
- operational health SQL calls: 2/2 SELECT-only;
- operational health smoke: 5/5 checks OK;
- typecheck: PASS;
- lint: PASS;
- public `/api/health` deep-health coupling: none;
- external observability provider: none;
- fake in-memory aggregation: none;
- schema change: none;
- new migration: none.

## Freeze boundary

P11-C6.6-C1 through C6.6-C4 are implemented and validated.

P11-C6.6-C5B freezes the operational documentation contract.

Final C6.6 regression, documentation consistency review, and overall C6.6 closeout remain assigned to P11-C6.6-C5C.

No commit, push, tag, PR, merge, or deploy is implied by this documentation freeze.

<!-- P11-C6.6-C5C-CLOSEOUT -->

## C6.6 final closeout

P11-C6.6-C5C completed the final regression and documentation-consistency gate.

Final evidence:

- targeted C6.6 test files: 6/6 PASS;
- targeted C6.6 tests: 32/32 PASS;
- full unit files: 37/37 PASS;
- full unit tests: 417/417 PASS;
- full MySQL files: 11/11 PASS;
- full MySQL tests: 125/125 PASS;
- operational health: 5/5 checks OK;
- operational-health SQL: 2/2 SELECT-only;
- rate-limit cleanup dry-run: PASS;
- observability AST privacy gate: PASS from the preceding C5C gate;
- forbidden structured-observability fields: 0;
- spread observability payloads: 0;
- backup/restore raw error.message: none;
- public /api/health: liveness-only;
- typecheck: PASS;
- lint: PASS;
- production build: PASS;
- schema change: none;
- migration count: 5;
- C6.3 migration checksum: preserved.

C6.6 remains provider-neutral.

Five-minute recurrence and rate-limit abuse thresholds remain DEFERRED until a real persistent collector/aggregator exists.

RPO, RTO, backup retention, production scheduling, external observability provider, and actual production restore execution remain OPEN / DEFERRED.

Final result:

`P11-C6.6 = COMPLETE / PASS / DOCUMENTED / FROZEN`

Next checkpoint:

`P11-C6.7 — Final Security & Recovery Review`
