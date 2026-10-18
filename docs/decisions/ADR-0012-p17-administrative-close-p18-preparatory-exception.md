# ADR-0012 — P17 administrative closeout and P18 preparatory exception

**Status:** ACCEPTED — owner decision `LES-OWNER-DEC-20261017-P17-P18-R01`

**Date:** 2026-10-17

**Phases:** P17 — End-to-End & Business Validation; P18 — Production Readiness Review; P19 —
Production Launch preparation

## Context

P17 produced substantial local, hosted, provider-adjacent and operational evidence, but mandatory
Gate D items remain unresolved. Keeping all later preparation blocked until those items can be
executed in one suitable window would unnecessarily stop independent readiness analysis and
non-activating launch preparation.

The owner therefore separates administrative sequencing from technical acceptance. This decision
does not reinterpret a deferred validation as successful evidence and does not relax the production
gates.

## Decision

Active P17 execution is administratively closed with all unresolved items preserved and transferred
to the canonical readiness/blocker inventory.

The mandatory state is:

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED`;
- `GATE D = NOT_READY`;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `P19 = FUTURE PREPARATION / PRODUCTION ACTIVATION CONDITIONED`;
- `PRODUCTION = NOT AUTHORIZED`.

Administrative closeout is not technical PASS. It creates no P17 Final Quality Gate, checkpoint,
production-readiness approval or waiver.

## Deferred P17 authority

The following mandatory items remain unresolved and retain their evidence requirements:

- P17-E05: authenticated real Mercado Pago TEST webhook delivery, currently associated with
  `HMAC_MISMATCH / NEITHER_MATCH` diagnostic evidence but without authenticated-delivery proof;
- P17-F01: real declined-payment scenario;
- P17-B01 and P17-B03–B07: residual Buyer Access, failure and recovery evidence;
- P17-R01–R03: real Mercado Pago Payment Brick across the required mobile, tablet and desktop
  viewports;
- P17-PR01–PR04: definitive acceptance under the owner-approved performance budget and the
  applicable provenance/authority requirements;
- remaining security, infrastructure and operational findings under their existing severity,
  deadline and ownership rules.

Previously approved evidence, gates, checkpoints and historical records remain valid within their
original scopes. No PASS is revoked, upgraded or broadened by this decision.

## P18 owner exception

P18 may begin preparatory execution before Gate D PASS only to:

- inventory controls already proven;
- identify unresolved evidence and production blockers;
- reconcile risks, dependencies, owners, deadlines and stop conditions;
- prepare an independently reviewable Production Readiness package;
- prepare, but not execute, P19-A procedures and the P19-B remediation backlog.

The exception does not authorize:

- a formal P18 GO or GO WITH CONDITIONS decision;
- Gate E GO;
- application, authentication, payment or webhook code changes;
- database schema, migration or hosted-data changes;
- access to or modification of secrets, credentials or provider configuration;
- infrastructure, DNS, domain, deployment or production mutations;
- real or simulated payment/webhook operations;
- commit, push, PR, merge, tag or checkpoint creation.

Any work beyond documentary preparation requires a revised brief and explicit owner authorization
for the protected operations involved.

## Approved sequence

1. **P18 preparatory review:** build the evidence, risk, dependency and blocker inventory.
2. **P19-A non-activating preparation:** prepare original launch components and procedures that do
   not activate production, under a future separately reviewed brief.
3. **P19-B consolidated remediation:** resolve inherited P17/P18 items under their specific
   authorities.
4. **P19-C controlled production execution:** only after Gate D PASS, formal P18 decision, Gate E
   GO and specific owner authorization for deploy and real transactions.
5. **P20 stabilization:** only after an authorized production launch.

## Risk and deadline preservation

Risk acceptance does not equal remediation. In particular, `LES-SEC-RA-001` remains HIGH,
development/CI-only, expires on 13/11/2026 at 23:59:59 America/Sao_Paulo and remains a production
hard stop until definitive remediation and review. Other open findings retain their canonical risk
levels and dates.

## Consequences

Positive consequences:

- production-readiness analysis can progress without fabricating Gate D evidence;
- deferred work is consolidated into an explicit future remediation window;
- proven historical evidence and immutable checkpoints remain preserved;
- production authority remains fail-closed.

Costs and constraints:

- P18 preparation cannot conclude GO while Gate D remains NOT_READY;
- P19-A/P19-B work requires separate briefs and authorization;
- P19-C cannot start until every stated gate and authorization condition is satisfied;
- the deferred inventory must remain visible rather than being treated as phase-completion debt that
  can be silently ignored.

## Supersession boundary

This decision supersedes prior statements only where they said P18 preparatory work could not begin
before Gate D PASS. It does not supersede Gate D acceptance criteria, historical evidence facts,
security hard stops, checkpoint immutability or production-authorization requirements.
