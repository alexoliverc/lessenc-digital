# P18 — Production Readiness Review — Preparatory Phase Execution Brief

**Brief ID:** `LES-P18-PREPARATORY-BRIEF-R01`

**Owner authority:** `LES-OWNER-DEC-20261017-P17-P18-R01`

**Date:** 2026-10-17

**Status:** REVIEW READY / PREPARATORY DOCUMENTARY EXECUTION ONLY

## 1. Objective

Prepare an independently reviewable Production Readiness package that distinguishes proven controls,
open risks, deferred P17 evidence and hard production blockers without performing production
activation or protected mutations.

This brief authorizes preparation. It does not authorize a formal P18 GO decision.

## 2. Mandatory inherited state

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED`;
- `GATE D = NOT_READY`;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `P19 = FUTURE PREPARATION / PRODUCTION ACTIVATION CONDITIONED`;
- `PRODUCTION = NOT AUTHORIZED`.

Administrative closeout is not technical PASS. No P17 quality checkpoint may be created while
mandatory validations remain unresolved.

## 3. Repository and evidence context

Preparatory work begins from the physical repository state verified at execution time. Existing
local changes and untracked files belong to their originating work and must be preserved.

Canonical sources, in precedence order:

1. `AGENTS.md`;
2. `MEMORY.md`;
3. `ROADMAP.md`;
4. current documents indexed by `docs/README.md`;
5. accepted ADRs;
6. operational daily records;
7. historical/superseded evidence for context only.

Primary P17 sources:

- `docs/architecture/p17-validation-architecture.md`;
- `docs/operations/p17-gate-d-evidence-matrix.md`;
- `docs/operations/p17-local-validation-report.md`;
- `docs/security/les-sec-ra-001-temporary-braces-risk-acceptance.md`;
- applicable P14–P16 security, observability, backup, recovery and staging evidence.

No historical release, local test or provider-adjacent observation may be promoted beyond its
documented authority.

GitHub and the owner confirm that the canonical P17 branch HEAD is
`202a43bffd30ed2b85c22c83825da7697139e3a8` and that R04 commit
`f01a683c4f90d38b704906552406cb9833960866` is already integrated. Local `origin/*` references must
be refreshed under separate authority before being treated as current. The owner reports a Hostinger
deployment of `202a43bffd30ed2b85c22c83825da7697139e3a8`; independent release-binding and deployment
attestation remains pending. The last independently attested Hostinger release recorded in the
canonical evidence is `0f6534fcf1d5b87588f21f6dd64005309a50c786`.

## 4. Preparatory scope

### 4.1 Readiness inventory

Build a traceable inventory for:

- architecture and module boundaries;
- security findings, risk acceptances and deadlines;
- administrative authentication, MFA, session and RBAC;
- database authority, grants, migrations and rollback compatibility;
- payment creation, reconciliation and financial-authority boundaries;
- webhook authentication and idempotency;
- entitlement, Buyer Access and protected delivery;
- backup, restore, RPO, RTO, retention and off-site-copy limitations;
- liveness, readiness, observability, alerting and incident response;
- secrets inventory by required name/purpose only, never value;
- domain, DNS, HTTPS and security-header readiness;
- private storage and runtime least privilege;
- analytics, consent and provider policy blocks;
- support procedures and administrative recovery boundaries;
- release provenance, deployment, rollback and production smoke procedures.

Each inventory item must carry:

- control or requirement ID;
- canonical source;
- evidence layer: local/static, Git/documentary, hosted, provider-private or independently
  correlated;
- current classification;
- residual risk;
- owner and deadline when already established;
- missing evidence;
- production impact;
- next separately authorized action.

### 4.2 Deferred P17 inventory

At minimum, preserve and track:

| ID | Requirement | Current state | Production consequence |
| --- | --- | --- | --- |
| P17-E05 | Real authenticated Mercado Pago TEST webhook delivery | BLOCKED / DEFERRED; `HMAC_MISMATCH / NEITHER_MATCH` evidence is not authenticated-delivery proof | Gate D blocker |
| P17-F01 | Real declined payment | PENDING_EXTERNAL / DEFERRED | Gate D blocker |
| P17-B01 | Invalid buyer credential | PENDING_EXTERNAL / DEFERRED | Gate D blocker |
| P17-B03 | Buyer rate limit | NOT_EXECUTED / DEFERRED | Residual validation blocker |
| P17-B04 | Storage unavailable | NOT_EXECUTED / DEFERRED | Gate D blocker |
| P17-B05 | Stream failure | NOT_EXECUTED / DEFERRED | Residual validation blocker |
| P17-B06 | Delivery audit failure | NOT_EXECUTED / DEFERRED | Gate D blocker |
| P17-B07 | Recovery | NOT_EXECUTED / DEFERRED | Gate D blocker |
| P17-R01–R03 | Real Payment Brick on mobile/tablet/desktop | PENDING_EXTERNAL / DEFERRED | Gate D blocker |
| P17-PR01–PR04 | Definitive performance acceptance | DEFERRED; current complete local package remains provisional numeric evidence only | Gate D blocker until authority is reconciled |

Existing P17 PASS and HOSTED PROVEN rows remain preserved and must not be rerun without a new reason
and authorization.

### 4.3 Risk register

The preparatory package must include all current CRITICAL/HIGH findings and production hard stops.
Known mandatory carryover includes:

- `LES-SEC-RA-001`: HIGH, development/CI only, expiry 13/11/2026 23:59:59
  America/Sao_Paulo, definitive remediation mandatory before production;
- four HIGH development-tooling findings in the approved lint dependency chain, governed by the
  exact risk-acceptance scope;
- retention 7/4/3 still `PLAN_ONLY`;
- no independently proven final off-R2 copy;
- database/R2 capture is sequential rather than atomic;
- production secret rotation and environment-specific verification remain production-gated;
- administrative delivery recovery remains safely deferred until an atomic audit/reissue boundary
  is approved and proven;
- any current hosted-release or rollback limitation recorded in the canonical P16/P17 evidence.

The inventory must discover additional current findings from canonical sources rather than assume
this list is exhaustive.

### 4.4 P19 preparation

P18 may prepare proposals for:

- P19-A non-activating launch checklist, operator roles, communications, rollback decision tree and
  evidence-capture plan;
- P19-B remediation work packages grouped by provider, hosted/browser, database, security and
  performance authority;
- P19-C prerequisites and stop gates.

Preparation is documentary only. P19-A, P19-B and P19-C execution are not authorized by this brief.

## 5. Explicitly out of scope

- application-code changes;
- authentication, authorization, payment or webhook changes;
- dependency or lockfile changes;
- Prisma schema or migration changes;
- database access or mutation;
- Hostinger, Mercado Pago, DNS, domain, R2 or other provider access/mutation;
- reading or changing secrets, tokens, credentials, OAuth configuration or `.env` files;
- payment creation, real/simulated transaction, webhook simulation/replay/resend;
- deployment, restart, release switch or production smoke;
- first real purchase;
- commit, push, PR, merge, tag or checkpoint;
- formal Gate D PASS, formal P18 decision or Gate E GO.

## 6. Dependencies

- accepted ADR-0012;
- canonical P17 Gate D matrix with deferred disposition;
- preserved P16 and P17 evidence;
- current security risk register and deadlines;
- independent ChatGPT review of this preparatory brief;
- new owner authority before any protected or externally effective action.

## 7. Approval gates

The current owner exception permits only local documentary preparation and non-mutating analysis.

Stop and request a revised brief plus specific authorization before:

- querying a provider or hosted environment;
- inspecting private credentials or configuration values;
- running a payment, webhook or production-like external scenario;
- changing code, dependencies, database, infrastructure or deployment state;
- publishing Git changes;
- assigning Gate D PASS, P18 GO/GO WITH CONDITIONS or Gate E GO.

## 8. Required validation

For the documentary preparation:

1. reconcile branch, HEAD, staging, tracked/untracked baseline and preserve all preexisting changes;
2. validate Markdown formatting and links without installing dependencies;
3. run `git diff --check` over documentary paths;
4. search the documentary diff for accidental secret/token/credential values;
5. verify consistent state strings across `MEMORY.md`, `ROADMAP.md`, ADR-0012, Gate D matrix,
   documentation indexes and the current daily record;
6. confirm no application, schema, migration, dependency or infrastructure file changed;
7. review the complete documentary diff.

Application tests, builds and provider tests are not required for a documentation-only changeset.

## 9. Preparatory acceptance criteria

The brief is ready for independent review when:

- P17 is consistently represented as administratively closed with deferred items, never PASS;
- all inherited mandatory P17 items are present and retain their evidence authority;
- Gate D remains NOT_READY;
- P18 preparatory authority and its limits are explicit;
- Gate E remains GO NOT AUTHORIZED;
- P19-A/P19-B/P19-C sequencing and separate authorization gates are explicit;
- production remains NOT AUTHORIZED;
- previous PASS evidence and immutable checkpoints are preserved;
- risk levels and established deadlines are preserved;
- no secret or private identifier value is introduced;
- only documentation files are changed;
- documentary integrity checks pass.

## 10. Formal P18 decision criteria

This preparatory brief cannot satisfy the formal P18 exit. A later formal P18 decision requires a
separately authorized review brief and, at minimum:

- Gate D disposition reconciled under its canonical acceptance rules;
- every production blocker either remediated or explicitly resulting in NO-GO;
- all temporary risk acceptances reviewed before their deadlines;
- release/deploy/rollback identity and procedures independently reviewable;
- owner-controlled GO / GO WITH CONDITIONS / NO-GO decision;
- Gate E state recorded separately from technical readiness.

No documentary completeness alone can create production authority.

## 11. Validation report format

The future preparatory Validation Report must contain:

1. objective and authority;
2. branch, HEAD and preserved baseline;
3. documents inspected and changed;
4. readiness inventory summary;
5. deferred P17 blocker matrix;
6. risk/deadline register;
7. P19-A/P19-B preparation proposals;
8. consistency and integrity commands/results;
9. unexecuted protected checks;
10. blockers and decisions required;
11. final Git state;
12. explicit restatement of Gate D, Gate E and production status.

## 12. Stopping condition

Stop after the documentary package is review-ready. Do not progress automatically into protected
P18 implementation, P19 preparation execution, remediation, deployment or production activity.
