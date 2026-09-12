# P04 — Testes e quality gates da fundação

**Status:** specification COMPLETE; physical P04 validation PENDING.

P04 é responsável por garantir que o scaffold e a toolchain tenham quality gates reproduzíveis.

## P04 quality gates

A implementação física P04 deverá preservar ou estabelecer, conforme aplicável:

- formatting check;
- ESLint;
- TypeScript typecheck;
- unit tests existentes;
- production build;
- environment configuration validation;
- runtime/toolchain validation;
- clean-install reproducibility.

O runner aprovado atualmente é:

**Vitest 5.0.0**

A migração de package manager deve demonstrar que os testes existentes continuam operacionais.

## Current historical executable evidence

O scaffold anterior já demonstrou historicamente:

- Prettier PASS;
- ESLint PASS;
- TypeScript PASS;
- Vitest PASS;
- Next.js production build PASS;
- `/api/health` smoke test PASS.

Essas evidências não substituem a validação após a reconciliação física P04.

## Deferred testing concerns

Os seguintes testes pertencem a fases posteriores:

### P06

- MySQL integration tests;
- Prisma validation;
- Prisma generation;
- schema/migration validation;
- constraint tests;
- transaction tests;
- persistence integration tests.

### P07+

- domain invariants;
- business state machines;
- application use cases.

### P10+

- payment integration;
- webhook;
- idempotency;
- reconciliation;
- concurrency scenarios.

### P17

- full end-to-end business validation.

## CI

GitHub Actions permanece como direção prevista para CI.

A pipeline final poderá evoluir ao longo das fases.

P04 não deve adicionar passos Prisma/MySQL enquanto P06 não tiver sido especificada e autorizada.

Uma pipeline mínima compatível com P04 deve conceitualmente validar:

`npm ci → format check → lint → typecheck → tests → build`

Security checks adicionais devem ser incorporados de acordo com a baseline de segurança e a maturidade das fases.

## Scripts

Scripts de banco planejados em documentação anterior não pertencem à implementação física P04.

Scripts como:

- `db:generate`;
- `db:validate`;
- `db:migrate:*`;
- `db:seed`;
- `db:health`;
- `db:reset:*`

somente poderão ser introduzidos na fase responsável pela persistência e mediante os approval gates aplicáveis.
