# P15 Incident Response and Operational Runbooks

**Status:** IMPLEMENTATION CANDIDATE — LOCAL/PROCEDURAL FOUNDATION

## Roles

- `OWNER_ON_CALL`: incident commander for customer-impacting or business-critical incidents.
- `OPERATIONS`: diagnosis, platform coordination, evidence and recovery execution.
- `COMMERCE_OPERATIONS`: payment, webhook, Order/Entitlement and customer-impact analysis.
- `SECURITY`: containment and evidence for suspected compromise or boundary violation.

Real paging channels and schedules remain P16. Until provisioned, routing names are responsibilities,
not claims that a paging integration exists.

## Severity

| Severity | Meaning | Initial response objective |
| --- | --- | --- |
| SEV-1 | broad outage, confirmed security compromise, unsafe financial/delivery behavior or unrecoverable data risk | immediate human coordination; stop unsafe change/traffic where authorized |
| SEV-2 | major component unavailable or repeated high-risk operational failure with material customer impact | urgent owner/on-call coordination |
| SEV-3 | degraded component, bounded failures or operational debt without immediate integrity risk | business-hours investigation with monitored containment |
| SEV-4 | informational/low-impact anomaly or improvement item | backlog and trend review |

These are classifications, not invented hosted response-time SLOs.

## Incident lifecycle

1. **Detect:** capture UTC time, sanitized signal, component and correlation ID.
2. **Acknowledge:** assign incident commander, severity and owner.
3. **Contain:** stop unsafe changes or isolate the failing component without rewriting business truth.
4. **Investigate:** use liveness, readiness, deep operational health, logs and provider-neutral
   telemetry. Do not paste secrets or PII into incident notes.
5. **Mitigate:** apply the smallest authorized reversible action.
6. **Recover:** restore service or execute the separately authorized data-recovery procedure.
7. **Verify:** test the customer path and relevant integrity invariants; monitor recurrence.
8. **Close:** record duration, impact, evidence, unresolved risks and follow-up owner.
9. **Review:** for SEV-1/SEV-2, create a blameless post-incident review with prevention actions.

## Safe initial diagnostics

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
$readinessHeaders = @{ Authorization = "Bearer $env:P16_READINESS_TOKEN" }
Invoke-WebRequest http://127.0.0.1:3000/api/readiness -Headers $readinessHeaders -SkipHttpErrorCheck
npm run ops:p15:operational-health -- --target-database=lessenc_test
```

Use the correct explicitly authorized environment/target. Never print `DB_RUNTIME_URL`, secrets,
cookies, access tokens or private storage paths in evidence. Missing readiness authorization must
return a generic denial without probing dependencies.

## Runbook — application unavailable

1. Check external monitor evidence independently of the application.
2. Check `/api/health`; if absent, classify instance/process failure.
3. Check `/api/readiness`; if liveness passes but readiness fails, continue with DB/storage runbooks.
4. Identify the last approved artifact and deployment event.
5. If the current artifact alone is faulty and schema compatibility is proven, request/execute the
   authorized application rollback.
6. Verify liveness, readiness, public page, checkout boundary and admin login surface.
7. Do not describe application rollback as database rollback.

## Runbook — database unavailable or degraded

1. Confirm generic readiness failure and run deep health through the operator boundary.
2. Verify target identity without exposing the URL or password.
3. Check provider/database availability, connection capacity and TLS certificate validity.
4. Do not run reset, db push, ad-hoc table updates or destructive recovery.
5. If data recovery is required, follow the P15 backup/recovery policy and obtain target-specific
   authorization.
6. After recovery, validate migrations, constraints, key business states and application behavior.

## Runbook — private storage unavailable

1. Confirm readiness/deep-health storage state without listing customer resources publicly.
2. Distinguish invalid root policy, unavailable root, missing object and stream failure.
3. Restore availability or the verified storage hierarchy; do not mutate Entitlement or Payment.
4. Reissue the authorized download request. Preserve failed delivery audit and append the new result.
5. Escalate storage-escape or invalid-root signals to Security/SEV-1 or SEV-2 as appropriate.

## Runbook — payment provider degradation

1. Keep local financial truth authoritative; browser/provider presentation is not approval.
2. Inspect bounded payment/webhook/reconciliation outcomes and provider status information.
3. Preserve ambiguous/unknown state; do not mark paid manually.
4. Use the existing bounded reconciliation flow when authorized.
5. Never grant Entitlement merely because a provider page or thank-you page indicates success.

## Runbook — webhook or reconciliation failure

1. Confirm signature failures versus authenticated processing failures.
2. Check duplicate, delayed and out-of-order event behavior.
3. Use correlation IDs and safe failure codes; never log the signature or raw provider payload.
4. Reconcile through the existing server-side provider adapter only.
5. Verify persisted Payment/Order state and downstream outbox/entitlement processing.

## Runbook — entitlement or delivery failure

1. Verify persisted Order PAID, Payment APPROVED, Entitlement state and immutable grant through
   authorized operator tools.
2. Check Buyer Access/session validation, rate limiting, authorization, storage and delivery audit.
3. Do not fabricate an Entitlement or update tables directly.
4. For a full authoritative refund, preserve the canonical revocation path and deny delivery.
5. Credential recovery rotates access material; it does not invent or revoke commercial rights.

## Runbook — security operational signal

1. Classify as suspected or confirmed; avoid publishing sensitive detail on the status page.
2. Preserve immutable logs/audit/evidence and restrict access.
3. Contain the relevant credential, session, route or artifact only under authorized procedures.
4. Do not destroy evidence, force-push history or rotate unrelated secrets indiscriminately.
5. Route confirmed compromise to `SECURITY` and `OWNER_ON_CALL`; production actions require explicit
   owner authority.

## Runbook — backup or restore validation failure

1. Mark the recovery point invalid; never rely on an unverified bundle.
2. Preserve the generic structured failure signal and sanitized manifest evidence.
3. Create and verify a replacement backup if the source remains authoritative and available.
4. If restore validation fails, stop before destructive cutover.
5. Escalate inability to meet the provisional RPO/RTO objective to the owner and P18 go/no-go.

## Runbook — rate-limit infrastructure failure

1. Distinguish expected `429` abuse control from limiter backend unavailability.
2. A limiter failure must fail safely and never mutate Payment, Order, Entitlement or credentials.
3. Check database connectivity and stale-bucket retention through deep health.
4. Cleanup remains dry-run-first and outside request paths.
5. Never introduce unverified proxy/IP trust as an emergency shortcut.

## Communication and public status

Public communication uses only sanitized component state, customer impact, mitigation progress and
next update time. It must not disclose topology, database/storage detail, raw failure codes, security
weaknesses, PII, secrets or provider credentials.

The application-side projection exists, but `status.lessenc.com.br` and real incident communication
channels are not deployed by P15.

## Closure and post-incident review

Record:

- UTC start/detection/acknowledgement/recovery/closure times;
- affected high-level components;
- customer/business impact without unnecessary PII;
- correlation IDs and safe evidence references;
- root cause and contributing conditions;
- containment, mitigation and verification;
- whether provisional RPO/RTO objectives were met;
- follow-up action, owner and due date.

Do not copy raw credentials, request bodies, database URLs, private paths or arbitrary stack traces
into the review.
