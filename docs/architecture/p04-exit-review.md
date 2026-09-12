# P04 — Exit review da especificação

**Specification:** COMPLETE.
**Physical implementation:** COMPLETE — final validation PASS on 12/09/2026.
**Current execution:** P04 closed; P05 is the next candidate and remains NOT AUTHORIZED.

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

## Estado físico anterior, auditado em 12/09/2026

O scaffold físico preservado no checkpoint anterior possuía:

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

O brief do owner de 12/09/2026 autorizou a execução física com escopo limitado à toolchain e à fundação `APP_ENV`. A árvore de trabalho não comitada usa npm com lockfile único; `npm ci` independente, formatação, lint, typecheck, sete testes Vitest, build e smoke `/api/health` passaram. A auditoria do host confirmou Node.js 24.19.0 e npm 11.17.0, abaixo da meta; nenhum gerenciador local de versões foi encontrado, e a atualização global não foi improvisada. O Validation Report deve apresentar o desvio ao ChatGPT. Este documento não antecipa PASS nem checkpoint final.
