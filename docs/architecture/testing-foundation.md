# P04 — Testes e CI especificados

**Status:** specification COMPLETE; pipeline P04 e testes de domínio/persistência PENDING.

Runner: Vitest, com testes unitários, integração, contrato, HTTP, concorrência/idempotência, segurança e E2E. Integração de persistência usa **MySQL real compatível em ambiente isolado**; doubles não comprovam constraint nem transação. Framework de browser E2E: **OPEN**.

Invariantes de teste: Payment APPROVED não sofre downgrade; Order PAID não se torna FAILED; timeout de Refund não é falha; reembolso integral confirmado revoga entitlement; falha de email/fulfillment não desfaz pagamento; duplicata de webhook tem um resultado lógico; webhook inválido não muda estado; eventos antigos não anulam a verdade atual. Cobrir também os [cenários concorrentes P03](data-integrity-concurrency-review.md).

CI documental previsto em **GitHub Actions**: `npm ci → Prisma validate → Prisma generate → format check → lint → typecheck → tests → integration tests → build → security checks`. Scripts npm planejados: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `check`, `test`, `test:watch`, `test:unit`, `test:integration`, `test:coverage`, `db:generate`, `db:format`, `db:validate`, `db:migrate:dev`, `db:migrate:deploy`, `db:migrate:status`, `db:seed`, `db:health`, `env:check`, `doctor`, `clean`. Apenas `db:reset:local`/`db:reset:test` com guards poderão ser avaliados futuramente; nunca `db:reset:production`.

O teste inicial de health executado historicamente na stack pnpm não prova pipeline npm/Prisma. Nenhuma configuração de CI ou script executável é alterado agora.
