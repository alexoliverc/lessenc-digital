# P15 — Observability & Operational Readiness Architecture

**Status:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED

**Branch:** `phase/p15-observability-operational-readiness`

**Canonical parent:** `ec12362c21682516f4882c7d70fac51974f17072`

**Deployment:** NOT PERFORMED

## Purpose and authority boundaries

P15 consolidates the operational foundations implemented from P04 through P14 into one
provider-neutral system for diagnosis, service health, recovery and incident response.

Observability is evidence, not authority. A correlation ID, log, metric, trace, alert, health result
or public status never authenticates a user, authorizes a resource, approves a payment, changes an
Order or Entitlement, or proves commercial truth.

P15 does not select an observability vendor, provision hosted infrastructure, deploy a status page,
configure DNS/TLS, schedule production jobs or validate staging. Those activities remain P16.

## P15-01 — Structured logging and correlation

### Correlation contract

The canonical primitive is `src/lib/observability/correlation.ts`.

- IDs are UUIDs generated server-side.
- Client values in `x-correlation-id` and `x-lessenc-correlation-id` are not trusted. The application
  Proxy overwrites the internal value for every matched request.
- `x-lessenc-correlation-id` is the private upstream request header used inside the Next.js request.
- `x-correlation-id` is the public response header returned for support/diagnostic reference.
- Static Next.js assets and the favicon are excluded from the Proxy matcher.
- A handler invoked outside the Proxy boundary generates a fresh server-side ID.
- Correlation is safe propagation only. It conveys no identity, authorization or financial state.

### Structured log envelope

The canonical logger protects these reserved fields from caller override:

| Field | Contract |
| --- | --- |
| `schemaVersion` | integer `1` |
| `timestamp` | server-generated UTC ISO timestamp |
| `level` | `info`, `warn` or `error` |
| `event` | bounded lower-case taxonomy using `_` or `.` separators |
| `service` | `lessenc-digital` |
| `applicationEnvironment` | `local`, `test`, `staging`, `production` or safe `unknown` |

Relevant context may include server-generated `correlationId`, low-cardinality `surface`, `outcome`
and bounded `failureCode`. Recursive redaction from P14 remains active for credentials, sessions,
cookies, provider identifiers, email, IP/User-Agent, database URLs, private storage paths and secret
aliases. `Error.message` and stack traces are not routine payload.

All direct runtime `console.*` output under `src/` is now isolated in the canonical logger. Operational
scripts retain bounded machine-readable CLI output where that output is their explicit interface.
Frozen P11 event names and contexts remain compatible.

## P15-02 — Liveness, readiness and deep operational health

The three contracts are intentionally distinct:

| Contract | Boundary | Result | Detail |
| --- | --- | --- | --- |
| liveness | public `GET /api/health` | HTTP 200, `{"status":"ok"}` | process/application contract only |
| readiness | machine/internal `GET /api/readiness` contract | HTTP 200 `ready` or HTTP 503 `not_ready` | no component or failure detail |
| operational health | explicit CLI | `OK`, `DEGRADED`, `FAILED` with safe check codes | operator-only diagnostic |

Public liveness does not query the database, storage, alert state or infrastructure configuration.

Readiness evaluates the minimum dependencies needed to serve the current product safely:

1. application contract;
2. database connectivity through a read-only `SELECT 1`;
3. private-storage root policy, existence and directory state.

The readiness HTTP response never exposes which check failed. It uses `Cache-Control: no-store`,
inherits the P14 global `Referrer-Policy: strict-origin-when-cross-origin` security header and returns
the canonical correlation response header.

`/api/readiness` is intended for machine/internal readiness evaluation, not as a general public
diagnostic API. P15 provides a sanitized application response but does not invent a hosted exposure
control. P16 must select and validate the hosted access model—such as infrastructure/reverse-proxy
restriction or another approved machine-monitor boundary—while `/api/health` remains the lightweight
public liveness endpoint.

Deep operational health remains read-only and preserves the frozen P11 five-check contract:

- `APPLICATION_CONTRACT`;
- `DATABASE_CONNECTIVITY`;
- `RATE_LIMIT_RETENTION`;
- `PRIVATE_STORAGE`;
- `OBSERVABILITY_CONTRACT`.

Run it with:

```powershell
. .\output\p06\session.ps1
$env:APP_ENV = 'test'
$env:DB_RUNTIME_URL = $env:TEST_DATABASE_URL
$env:PRIVATE_FILE_STORAGE_PATH = '<absolute-private-test-path>'
npm run ops:p15:operational-health -- --target-database=lessenc_test
```

The legacy P11 command remains available for compatibility. The observability-contract check now
also verifies the P15 service envelope, correlation header and metric definitions.

## P15-03 — Metrics and local tracing boundary

P15 adds no direct OpenTelemetry or vendor SDK dependency. Transitive packages are not imported.

The provider-neutral boundary is `src/lib/observability/telemetry.ts`. It emits structured metric
and completed-span records that a future collector may ingest. It does not pretend to be a durable
time-series store or distributed tracing backend.

### Metrics

Implemented instruments include:

- `http_requests_total`;
- `http_request_duration_ms`;
- `operational_failures_total`;
- `payment_operations_total`;
- `webhook_operations_total`;
- `delivery_operations_total`;
- `rate_limit_decisions_total`;
- `storage_failures_total`;
- `operational_jobs_total`;
- `readiness_evaluations_total`.

Allowed labels are limited to fixed enums:

- `surface`;
- `operation`;
- `outcome`;
- HTTP method (`GET`, `POST`, `JOB`) where applicable;
- status class (`2XX`, `4XX`, `5XX`, `NONE`).

Customer, Order, Payment, provider, credential, resource, email, IP and URL values are forbidden as
metric labels. Correlation ID is attached as diagnostic metadata, not a metric label.

Physical emission covers liveness/readiness, payment create/status, Mercado Pago webhook processing
and the frozen P11 delivery/storage/rate-limit/operational-job event family.

### Tracing

P15 records local server spans with server-generated 128-bit trace IDs and 64-bit span IDs,
correlation ID, fixed surface/operation, outcome, duration and an optional bounded failure code.

The application does not accept or propagate arbitrary client `traceparent` as trusted context and
does not claim distributed tracing. Secrets, PII and arbitrary exception text are excluded.

## P15-04 — Alerts, SLI/SLO and service health

`src/modules/operations/application/alert-policy.ts` provides deterministic alert rules,
deduplication keys, severity and routing ownership without process-local aggregation state.

The frozen P11 immediate and recurrence rules are preserved, including:

- immediate delivery-audit, storage-policy, entitlement-revocation, rate-limit-backend,
  backup/restore and cleanup failures;
- storage failures `>= 3 / 5m`;
- resource-not-found `>= 3 / 5m`;
- delivery stream failures `>= 5 / 5m`;
- Buyer Access rate-limit responses `>= 20 / 5m`.

Rules carry one of `CRITICAL`, `HIGH`, `MEDIUM` or `LOW`, and route abstractly to
`OWNER_ON_CALL`, `OPERATIONS`, `COMMERCE_OPERATIONS` or `SECURITY`. The stable deduplication key is
`ruleId:component`; the rate-limit recurrence may append its bounded `surface:scope` partition.
Customer and business identifiers are never part of it.

The implementation can evaluate a supplied event window, but no fake in-process rolling window is
started. Durable collection, five-minute evaluation and real alert delivery remain P16.

Initial SLIs cover HTTP availability, payment-operation success, protected-delivery success and
readiness availability. Numerical SLO targets remain `OPEN_STAGING_BASELINE`; P15 does not invent
production latency or availability numbers without hosted evidence.

### Component and public service health

Canonical components are:

- Website;
- Checkout;
- Payments;
- Buyer Access / Digital Delivery;
- Admin.

Internal states are `OPERATIONAL`, `DEGRADED`, `UNAVAILABLE`, `MAINTENANCE` and `UNKNOWN`, with
worst-state deterministic aggregation. Failure codes remain internal.

## P15-05 — Backup, restore, RPO, RTO and retention

The frozen P11 backup bundle and disposable restore evidence are preserved without modification.
P15 adds the operational policy in
[`p15-backup-recovery-policy.md`](../operations/p15-backup-recovery-policy.md).

The proposed RPO (`<= 24h`), RTO (`<= 8h`) and retention (7 daily / 4 weekly / 3 monthly) carry the
governance state `OWNER APPROVED RELEASE OBJECTIVE / HOSTED VALIDATION REQUIRED IN P16`.
They are neither owner-approved tolerances nor achieved production guarantees.

Convenience entrypoints preserve the existing implementation:

```powershell
npm run ops:p15:backup -- --database-env <env-var-name> --storage-root <absolute-path> --output-root <absolute-path>
npm run ops:p15:backup-verify -- --bundle <absolute-bundle-path>
npm run ops:p15:restore-validate -- --bundle <absolute-bundle-path>
```

`restore-validate` remains read-only. It is not a physical restore executor.

## P15-06 — Incident management, runbooks and rollback

The canonical incident lifecycle, severity model, ownership and failure-class runbooks are in
[`p15-incident-response-runbook.md`](../operations/p15-incident-response-runbook.md).

Application rollback and database/data recovery are separate decisions. Rolling application code
back never rolls database state back and must not be described as doing so.

## P15-07 — Public status and external monitoring foundation

`src/modules/operations/application/service-health.ts` implements the safe projection:

```text
internal component health
-> bounded service-health aggregate
-> sanitized component names and public state
```

The public projection contains only the high-level component name and one of `operational`,
`degraded`, `major_outage`, `maintenance` or `unknown`. It excludes internal failure codes, database
or storage detail, topology, paths, secrets, PII and provider credentials.

This module is an application-side foundation only. `status.lessenc.com.br`, DNS, TLS, hosting,
external probes and alert delivery are NOT DEPLOYED and remain P16. External monitoring must be
hosted independently from the application it observes.

## P15-08 — Validation and Gate C boundary

The candidate validation and exact evidence are recorded in
[`p15-final-gate.md`](../operations/p15-final-gate.md).

Gate C remains subject to independent ChatGPT audit. P15 does not authorize P16, push, PR, merge,
tag, checkpoint movement or deployment.

The first independent audit returned `PASS WITH FIXES`. R1 canonicalized checkout/admin/readiness
correlation, made the global formatting gate green, corrected recovery-objective governance,
documented the machine/internal readiness exposure boundary and replaced source-text operational
contract checks with imports from the exported contracts module. Re-review remains pending.

## Residual risks and deferrals

### Medium

- no durable log/metric/trace collector or recurrence evaluator exists before P16;
- no real hosted alert delivery or external monitor has been proven;
- backup scheduling, encryption at rest and off-site replication are policy requirements awaiting
  hosted implementation/validation;
- proposed RPO/RTO/retention values remain `OWNER APPROVED` and are not achieved claims until
  approval plus P16 hosted recovery/lifecycle evidence exists.

### Low / informational

- observability records currently depend on the process stdout/stderr collection boundary;
- SLO numerical targets require staging data;
- status-page publication and incident communication channels remain unprovisioned.

No known CRITICAL or HIGH issue is silently accepted by this candidate.
