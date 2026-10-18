# Operação LES-DIG

O [guia local de conectividade](LOCAL-CONNECTIVITY-R01.md) registra o bootstrap histórico no Windows. A [arquitetura de deploy P02](../architecture/deployment-architecture.md) define LOCAL, TEST, STAGING e PRODUCTION; as fundações de [configuração P04](../architecture/configuration-environment-system.md), [toolchain P04](../architecture/runtime-toolchain-baseline.md) e [testes](../architecture/testing-foundation.md) passaram na validação local, ainda sujeita à revisão técnica P04. CI continua como direção documentada, sem pipeline física implementada nesta fase.

**SCAFFOLD ANTERIOR À P04:** `pnpm` e `pnpm-lock.yaml`, com versões e scripts auditados na [toolchain P04](../architecture/runtime-toolchain-baseline.md). **ESTADO FÍSICO VALIDADO LOCALMENTE:** `npm@11.17.0` no host, `package-lock.json` como único lockfile autoritativo e `npm ci` aprovado a partir de `node_modules` ausente. O target Node.js 24.21.0/npm 11.19.1 ainda não foi atingido no host (24.19.0/11.17.0); a revisão técnica P04 está pendente.

A migração preservou as versões diretas aprovadas; `npm ci`, format check, lint, typecheck, 7 testes, build e smoke test local de `/api/health` passaram. Para executar os gates no PowerShell, definir primeiro o ambiente da aplicação: `$env:APP_ENV = 'local'`; depois executar `npm run check` e `npm run build`. `APP_ENV` é obrigatório e separado de `NODE_ENV`.

Fornecedores e procedimentos finais de armazenamento privado, email, observabilidade, limite de taxa distribuído, backup/restore e domínio: **OPEN**. O manual antigo pode citar comandos pnpm correspondentes ao scaffold histórico; não usá-lo como instrução normativa para a migração P04. Prisma/MySQL permanecem para P06.

## Development workstation

A [baseline canônica da workstation de desenvolvimento e VS Code](development-workstation-vscode.md) documenta o Profile L'Essenc, configuração compartilhada do workspace, extensões, terminal, Git/SCM, segurança, performance, Settings Sync e recuperação.

Esse documento é operacional e não redefine versões da stack, gerenciador de pacotes, ambientes da aplicação nem o estado da implementação P04. Para esses temas, prevalecem as fontes arquiteturais canônicas e a regra **CURRENT CANONICAL BASELINE WINS**.

<!-- P11-C6.5-BACKUP-RESTORE-RUNBOOK -->

## P11 security and recovery runbooks

- [P11 Backup and Restore Runbook](./p11-backup-restore-runbook.md) — frozen C6.5 backup, integrity verification, disposable restore drill, semantic restore equivalence, and post-restore application validation.

<!-- P11-C6.6-OBSERVABILITY-RUNBOOK-INDEX -->

## P11 observability and alerting

- [P11 Observability and Alerting Runbook](./p11-observability-alerting-runbook.md) — structured events, privacy and low-cardinality rules, immediate alert signals, deferred recurrence thresholds, operational health, 24-hour rate-limit retention and cleanup, and backup/restore validation observability.
- Public `/api/health` remains liveness-only; deep operational health is available only through the explicit operational command.
- External observability provider, five-minute aggregation, and production scheduling remain OPEN / DEFERRED.

<!-- P11-C6.7-SECURITY-RECOVERY-INDEX -->

## P11 final security and recovery review

- [P11 C6 Final Security and Recovery Review](./p11-security-recovery-review.md) — consolidated C6.1–C6.7 security invariants, adversarial evidence, recovery boundaries, open production decisions, and the explicit separation between C6 closeout and the mandatory C7 Final Gate.

<!-- P11-C7-FINAL-GATE -->

## P11 final gate

- [P11 Final Gate](./p11-final-gate.md) — final C1–C7 closeout, canonical refund-to-revocation-to-download-denial proof, regression evidence, frozen security boundaries, remaining production decisions, and Git publication boundary.

<!-- GATE-B-OPERATIONS-INDEX -->

## Gate B — Commerce Core Ready

- [Gate B — Commerce Core Ready](./gate-b-commerce-core-ready.md) — final cross-phase validation of P09 -> P10 -> P11, positive protected delivery, refund/revocation denial, regression evidence and P12 authorization boundary.

<!-- P12-FINAL-GATE -->

## P12 final gate

- [P12 Final Gate](./p12-final-gate.md) — canonical P12-A through P12-H closeout and durable integration record, including isolated administrative identity, mandatory MFA, session policy, RBAC, backoffice boundaries, administrative audit, regression evidence, safe delivery-recovery defer, implementation PR #18 / merge `482e095e9c515c163dd4b057f07baf06f3450f95`, and documentation-closeout PR #19 / merge `f29487c67621eb3151fa45f1337c0a9e6dd19ca5`.

## P13 measurement gates

- [P13-B Final Gate](./p13-b-final-gate.md) — provider-neutral attribution and analytics persistence foundation.
- [P13-C Final Gate](./p13-c-final-gate.md) — AcquisitionJourney, First/Last Touch and immutable OrderAttribution.
- [P13-D Final Gate](./p13-d-final-gate.md) — canonical VIEW_CONTENT and INITIATE_CHECKOUT producers, runtime consent, browser-safe projection and exact HTTP + MySQL temporal proof.
- [P13-E Final Gate](./p13-e-final-gate.md) — canonical Purchase from persisted financial truth, concurrency-safe uniqueness, reconciliation and post-commit failure isolation.
- [P13-F Final Gate](./p13-f-final-gate.md) — GTM + Google Consent Mode, GA4, Google Ads, Meta Pixel, Meta CAPI policy block, provider-neutral dispatch and final P13-F regression evidence.
- [P13-G Final Gate](./p13-g-final-gate.md) — server-protected read-only Admin Analytics, canonical Purchase revenue, First/Last Touch temporal reporting and RBAC evidence.
- [P13-H Final Gate](./p13-h-final-gate.md) — complete P13 technical validation, regressions, security/privacy boundaries and final lifecycle closure.

## P15 operational-readiness candidate

- [P15 architecture](../architecture/p15-observability-operational-readiness.md) — canonical correlation, structured logging, liveness/readiness/deep-health separation, provider-neutral telemetry, alerting, service health and sanitized public status projection.
- [P15 Backup, Restore and Recovery Policy](./p15-backup-recovery-policy.md) — recovery unit, integrity, encryption/off-site requirements, provisional RPO/RTO and retention objectives, restore safeguards and rollback/recovery separation.
- [P15 Incident Response and Operational Runbooks](./p15-incident-response-runbook.md) — severity, lifecycle, ownership and actionable runbooks for the required failure classes.
- [P15 R1 Gate C Candidate](./p15-final-gate.md) — corrected local validation evidence, residual risks, P16/P17 deferrals and Git lifecycle boundary pending ChatGPT re-review.

## P16 staging internal implementation

- [P16 Staging Deployment Runbook](./p16-staging-runbook.md) — fail-closed configuration,
  migration, protected readiness, hosted smoke, TEST payment, storage, recovery and rollback
  procedures.
- [P16 Internal Repository Gate](./p16-internal-gate.md) — internal deliverables, finding
  disposition and the strict hosted/external stop boundary.
- [P16-08 Backup and Recovery Candidate](./p16-backup-recovery-candidate.md) — isolated repository
  candidate for encrypted recovery units, guarded database dumps, deterministic 7/4/3 retention,
  integrity verification, isolated local restore, RPO/RTO evidence classification and plan-only
  application rollback. Hosted execution remains pending.

## P17 validation operations

- [P17 Gate D evidence matrix](./p17-gate-d-evidence-matrix.md) — current evidence authority and
  unresolved Gate D boundaries.
- [P17 local validation report](./p17-local-validation-report.md) — local browser, integration,
  performance-capsule and provenance evidence with explicit authority limits.
- [P17 CI verification build contract](./p17-ci-build-contract.md) — synthetic, non-deployable-by-
  authority CI build contract and independent job boundary.
- [LES-P17-CODEX-EXEC-R13 validation report](./les-p17-codex-exec-r13-temporary-risk-acceptance-validation-report.md)
  — local deterministic audit-policy implementation for `LES-SEC-RA-001`, fail-closed regression
  evidence and production hard-stop boundary.
- [LES-P17-CODEX-EXEC-R14-A pre-publication report](./les-p17-codex-exec-r14-a-pre-publication-validation-report.md)
  — owner ratification, complete R13 diff audit, regression evidence and controlled-publication
  readiness without performing Git publication.

P17 is administratively closed with deferred items under
`LES-OWNER-DEC-20261017-P17-P18-R01`; this does not grant technical PASS or Gate D. The Gate D
matrix remains the canonical inventory of preserved evidence and unresolved authority.

## P18 preparatory review

- [ADR-0012](../decisions/ADR-0012-p17-administrative-close-p18-preparatory-exception.md) — owner
  decision separating P17 administrative sequencing from technical acceptance.
- [P18 Preparatory Phase Execution Brief](../architecture/p18-production-readiness-preparatory-phase-execution-brief.md)
  — readiness inventory, inherited blockers, risk/deadline preservation, P19-A/P19-B preparation
  boundaries and explicit production stop gates.
- [ADR-0013](../decisions/ADR-0013-p18-completion-execution-mandate.md) and
  [P18-04–P18-09 Completion Phase Execution Brief](../architecture/p18-completion-phase-execution-brief.md)
  — later authority for controlled technical completion, local/isolated validation and Git
  integration without production activation or independent acceptance.
- [P18-01 Readiness Inventory](./p18-readiness-inventory-r01.md) — traceable control/evidence matrix
  across architecture, security, data, commerce, delivery, recovery and operations.
- [P18-01 Risk and Blocker Register](./p18-risk-and-blocker-register-r01.md) — inherited Gate D
  blockers, production hard stops, deadlines and missing evidence without fabricated ownership.
- [P18-01 Validation Report](./p18-01-validation-report-r01.md) — documentary execution baseline,
  audited sources, integrity checks, limitations and handoff state.
- [P18-02 Dependency & Remediation Map](./p18-02-dependency-and-remediation-map-r01.md) — propostas
  futuras P19-A/P19-B, dependências, critérios de fechamento e stop gates, sem iniciar execução.
- [P18-02 Validation Report](./p18-02-validation-report-r01.md) — fontes e código examinados,
  contagens reconciliadas, verificações, limitações e classificação preparatória.
- [P18-04 Consolidated Readiness Assessment](./p18-04-consolidated-readiness-assessment-r01.md) —
  matriz atual 57/15/31 com classificação e autoridade de evidência.
- [P18-05 Security, Privacy & Compliance Readiness](./p18-05-security-privacy-compliance-readiness-r01.md)
  — revisão integral e fechamento técnico de `LES-SEC-RA-001`, sem certificação legal ou produção.
- [P18-06 Data & Recovery Readiness](./p18-06-data-recovery-readiness-r01.md) — schema/migration
  hashes, compatibilidade e gaps de backup/recovery da release candidata.
- [P18-07 Commerce & Operations Validation](./p18-07-commerce-operations-validation-r01.md) —
  regressões locais e reconciliação das 15 pendências Gate D.
- [P18-08 Release Go/No-Go Package](./p18-08-release-go-no-go-package-r01.md) — release candidate,
  configuração, checklist, STOP criteria, rollback e preparação P19.
- [P18-09 Final Decision Dossier](./p18-09-final-decision-dossier-r01.md) — parecer NO-GO,
  31 riscos, Gate D/Gate E e handoff de auditoria independente.
- [P18 Final Audit Manifest](./p18-final-audit-manifest-r01.json) — identidades, contagens, hashes
  SHA-256 e links de CI para reprodução independente.

## P18-03 — Operational Resilience & Launch Readiness (preparatory candidate)

- [Operational Resilience Readiness Review](p18-03-operational-resilience-review-r01.md)
- [Incident, Rollback & Launch Readiness Plan](p18-03-incident-rollback-readiness-plan-r01.md)
- [Operational Risk & Ownership Matrix](p18-03-risk-ownership-matrix-r01.md)
- [P18-03 Validation Report](p18-03-validation-report-r01.md)
