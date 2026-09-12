# P04 — Baseline de runtime e toolchain

**Status:** specification COMPLETE; migração física npm/`APP_ENV` validada localmente, revisão técnica pendente; Node/npm do host abaixo da meta.
**Última reconciliação documental:** 12/09/2026.

A P04 define a fundação física de runtime e toolchain da aplicação.

Banco, ORM, schema, migrations e persistência pertencem à **P06 — Data & Persistence Foundation** e não fazem parte da implementação física da P04.

## Princípio de reconciliação

**APPROVED TARGET P04 BASELINE ≠ CURRENT INSTALLED SCAFFOLD STACK**

O estado físico deve ser confirmado no repositório e por comandos; a especificação não comprova a instalação.

Nenhuma versão deve ser alterada apenas para reproduzir uma especificação histórica quando a versão física existente foi revalidada como target atual.

## Scaffold anterior à reconciliação — auditado em 12/09/2026

| Item | Estado físico antes da P04 |
| --- | --- |
| Node.js | 24.19.0 |
| npm | 11.17.0 |
| pnpm | 11.26.0 |
| package manager declarado | `pnpm@11.26.0` |
| lockfile | `pnpm-lock.yaml` |
| Next.js | 16.3.4 |
| React | 19.3.0 |
| React DOM | 19.3.0 |
| TypeScript | 6.0.3 |
| Vitest | 5.0.0 |
| ESLint | 10.10.0 |
| `@eslint/js` | 10.0.1 |
| `@next/eslint-plugin-next` | 16.3.4 |
| `typescript-eslint` | 8.70.0 |
| `eslint-plugin-react-hooks` | 7.1.1 |
| Prettier | 3.9.6 |
| Zod | 4.6.2 |
| Prisma | NOT INSTALLED |

Esse estado está preservado no commit `71488f1` e na tag `checkpoint/p04-baseline-reconciled`; a árvore de trabalho durante a P04 deve ser inspecionada diretamente. A execução física está autorizada pelo brief do owner de 12/09/2026 na branch `phase/p04-physical-reconciliation`, sem autorização para commit, tag, push ou merge nesta rodada.

## Estado físico da árvore de trabalho após validação local

Na branch `phase/p04-physical-reconciliation`, a reconciliação final validada declara `packageManager: npm@11.19.1`, usa `package-lock.json` como único lockfile autoritativo e executa sob Node.js 24.21.0 LTS e npm 11.19.1.

`npm ci`, Prettier, ESLint, TypeScript, sete testes Vitest, build de produção com `APP_ENV=local` e smoke `GET /api/health` passaram localmente. O host ainda executa Node.js 24.19.0 e npm 11.17.0, abaixo do target; não há evidência de atualização global. A P04 permanece aguardando revisão técnica e decisão sobre esse desvio.

## Approved target P04 baseline

| Item | Target P04 |
| --- | --- |
| Node.js | 24.21.0 LTS |
| npm | 11.19.1 |
| package manager | npm |
| authoritative lockfile | `package-lock.json` |
| clean install command | `npm ci` |
| Next.js | 16.3.4 |
| React | 19.3.0 |
| React DOM | 19.3.0 |
| TypeScript | 6.0.3 |
| Vitest | 5.0.0 |
| ESLint | 10.10.0 |
| `@eslint/js` | 10.0.1 |
| `@next/eslint-plugin-next` | 16.3.4 |
| `typescript-eslint` | 8.70.0 |
| `eslint-plugin-react-hooks` | 7.1.1 |
| Prettier | 3.9.6 |
| Zod | 4.6.2 |

## Deliberate physical reconciliation

The intended P04 physical operation is limited to the runtime/toolchain foundation.

Expected reconciliation includes, when explicitly authorized:

- Node.js 24.19.0 → 24.21.0 LTS;
- npm 11.17.0 → 11.19.1;
- pnpm → npm as the authoritative package manager;
- `pnpm-lock.yaml` → `package-lock.json`;
- `packageManager` metadata reconciliation;
- repository scripts that explicitly invoke pnpm → equivalent npm-compatible commands;
- `APP_ENV` configuration foundation;
- runtime/toolchain validation;
- repeatable clean installation with `npm ci`.

The following already installed versions are retained as the approved target unless a later explicit decision changes them:

- Next.js 16.3.4;
- React 19.3.0;
- React DOM 19.3.0;
- TypeScript 6.0.3;
- Vitest 5.0.0;
- ESLint 10.10.0;
- Prettier 3.9.6.

P04 MUST NOT downgrade these packages merely to reproduce the superseded target versions previously recorded in this document.

## Explicitly deferred to P06

P04 MUST NOT introduce:

- Prisma;
- MySQL integration;
- database schema;
- migrations;
- repositories backed by a database;
- database seed;
- persistence integration tests;
- physical database environments.

Those concerns belong to:

**P06 — Data & Persistence Foundation**

and remain subject to their own Phase Execution Brief and approval gates.

## Lockfile rule

Before reconciliation, the existing `pnpm-lock.yaml` was the factual physical lockfile at the checkpoint above.

During the authorized migration, package-manager reconciliation must be atomic enough to avoid treating two lockfiles as authoritative.

After P04 physical reconciliation:

- `package-lock.json` is the sole authoritative package-manager lockfile;
- `pnpm-lock.yaml` must no longer remain as an authoritative project lockfile;
- clean installation must be reproducible through `npm ci`.

## Approval rule

This document by itself does not authorize the physical migration. The owner supplied the separate P04 execution brief on 12/09/2026.

Dependency changes, package-manager migration and other protected operations continue to require the applicable authorization defined in `AGENTS.md`.

## Final P04 validation

Em 12/09/2026, a reconciliação física atingiu a baseline aprovada:

- Node.js 24.21.0 LTS;
- npm 11.19.1;
- npm como package manager autoritativo;
- `package-lock.json` como único lockfile;
- `npm ci` PASS;
- `APP_ENV` com `local`, `test`, `staging` e `production`;
- lint PASS;
- typecheck PASS;
- 7/7 testes PASS;
- format check PASS;
- build de produção PASS;
- `/api/health` smoke test PASS em `127.0.0.1:31271`;
- `git diff --check` PASS;
- Prisma/MySQL não introduzidos.

A implementação física P04 está COMPLETE.
