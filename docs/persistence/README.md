# P06 — Data & Persistence Foundation

**Estado:** COMPLETE. Implementação física e validação local concluídas na branch `phase/p06-data-persistence-foundation`; ChatGPT Technical Review PASS.

A P06 introduz MySQL 8.4 LTS e Prisma 7.10.0 para o núcleo persistente do MVP, sem implementar serviços de negócio, checkout, provedor de pagamento, entrega ou autenticação. O [modelo físico](data-model.md) parte de P01/P02/P03; a [operação local e os testes](local-mysql-and-testing.md) explicam isolamento, migração e recuperação. O [exit review](p06-exit-review.md) registra evidências e pendências.

## Fontes executáveis

- Schema: [`prisma/schema.prisma`](../../prisma/schema.prisma); configuração CLI: [`prisma.config.ts`](../../prisma.config.ts).
- Migração inicial: [`prisma/migrations/`](../../prisma/migrations/); não usar `db push` ou reset como fluxo normal.
- Client de infraestrutura: [`src/infrastructure/database/client.ts`](../../src/infrastructure/database/client.ts); geração reproduzível em `src/generated/prisma/`, ignorada pelo Git.
- Guarda dos scripts locais: [`scripts/p06-db-guard.mjs`](../../scripts/p06-db-guard.mjs); integração: [`persistence.integration.ts`](../../src/infrastructure/database/persistence.integration.ts).

Extensões de schema devem usar nova migration revisada e conservar dados financeiros. Alterações de status, preço, direito ou credenciais não são autorizadas por este documento. P06 não publica banco nem executa migração em staging/produção.
