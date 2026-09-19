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
