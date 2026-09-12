# P04 — Exit review da especificação

**Specification:** COMPLETE.
**Physical implementation:** PENDING.
**Current execution candidate:** P04 Physical Implementation / Reconciliation.

A reorganização estratégica do `ROADMAP.md` estabeleceu P04 como a próxima execução necessária antes de P05.

## Escopo físico atual da P04

A P04 física cobre:

- runtime;
- Node.js;
- npm;
- package-manager reconciliation;
- authoritative lockfile;
- application toolchain;
- scripts de toolchain;
- `APP_ENV` foundation;
- quality gates;
- reproducibilidade de instalação;
- validação do scaffold.

## Fora do escopo da P04

Os seguintes itens foram transferidos para **P06 — Data & Persistence Foundation**:

- Prisma;
- MySQL;
- schema;
- migrations;
- database repositories;
- seed;
- persistência;
- testes físicos de persistência.

A documentação histórica que anteriormente associava esses itens à P04 não concede autorização para implementá-los nesta fase.

## Estado físico auditado em 12/09/2026

O scaffold físico atual possui:

- pnpm 11.26.0;
- `pnpm-lock.yaml`;
- `packageManager: pnpm@11.26.0`;
- Node.js 24.19.0;
- npm 11.17.0;
- Next.js 16.3.4;
- React 19.3.0;
- React DOM 19.3.0;
- TypeScript 6.0.3;
- Vitest 5.0.0;
- ESLint 10.10.0;
- Prettier 3.9.6;
- Prisma não instalado.

## Target reconciliado

A baseline física aprovada da P04 passa a mirar:

- Node.js 24.21.0 LTS;
- npm 11.19.1;
- npm como package manager autoritativo;
- `package-lock.json`;
- `npm ci`;
- manutenção das versões atualmente aprovadas de Next.js, React, React DOM, TypeScript, Vitest, ESLint e Prettier, salvo decisão posterior explícita.

A implementação física somente poderá ser declarada COMPLETE após execução, validação e revisão formal da reconciliação.

Estado documental COMPLETE não equivale a implementação física COMPLETE.
