# P04 — Baseline de runtime e toolchain

**Status:** specification COMPLETE; physical implementation PENDING.
**Última reconciliação documental:** 12/09/2026.

A P04 define a fundação física de runtime e toolchain da aplicação.

Banco, ORM, schema, migrations e persistência pertencem à **P06 — Data & Persistence Foundation** e não fazem parte da implementação física da P04.

## Princípio de reconciliação

**APPROVED TARGET P04 BASELINE ≠ CURRENT INSTALLED SCAFFOLD STACK**

O estado físico atual continua sendo evidência factual até a execução deliberada da reconciliação.

Nenhuma versão deve ser alterada apenas para reproduzir uma especificação histórica quando a versão física existente foi revalidada como target atual.

## Current physical scaffold — auditado em 12/09/2026

| Item | Estado físico atual |
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

Before reconciliation, the existing `pnpm-lock.yaml` remains the factual physical lockfile.

During the authorized migration, package-manager reconciliation must be atomic enough to avoid treating two lockfiles as authoritative.

After P04 physical reconciliation:

- `package-lock.json` is the sole authoritative package-manager lockfile;
- `pnpm-lock.yaml` must no longer remain as an authoritative project lockfile;
- clean installation must be reproducible through `npm ci`.

## Approval rule

This document does not authorize the physical migration.

Dependency changes, package-manager migration and other protected operations continue to require the applicable authorization defined in `AGENTS.md`.
