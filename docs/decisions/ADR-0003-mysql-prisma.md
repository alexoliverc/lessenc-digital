# ADR-0003 — MySQL e Prisma

**Status:** ACCEPTED — baseline documental P02/P03/P04, 11/09/2026.

**Decisão:** MySQL relacional e Prisma 7.9.1 na especificação. Schema `prisma/schema.prisma`, config `prisma.config.ts`, client em saída explícita; migrations versionadas, revisadas e aplicadas por ambiente. Dinheiro em minor units inteiras com currency e constraints críticas em [modelo relacional](../architecture/relational-model-constraints.md).

**Consequência:** transações e restrições sustentam idempotência. Dependência, banco, schema e migrations físicos ainda PENDING e sujeitos à autorização do owner; o código atual não contém Prisma.
## Amendment — 12/09/2026

A decisão arquitetural **MySQL relacional + Prisma ORM** permanece ACCEPTED.

A referência original a **Prisma 7.9.1** registra a versão considerada na baseline documental de 11/09/2026, mas não constitui pin físico permanente.

Após a reorganização canônica do `ROADMAP.md`:

- arquitetura lógica de dados permanece coberta por P03;
- implementação física de ORM, banco, schema e migrations pertence à **P06 — Data & Persistence Foundation**;
- a versão exata do Prisma deve ser revalidada no Phase Execution Brief da P06 antes de qualquer instalação;
- este ADR não autoriza instalação de Prisma ou criação de banco durante P04.

A decisão principal deste ADR continua válida; somente o momento de implementação e o pin exato da versão foram desacoplados da P04.

## Amendment — P06 em 12/09/2026

O Phase Execution Brief P06 do owner fixou `prisma`, `@prisma/client` e `@prisma/adapter-mariadb` em **7.10.0**, mantendo MySQL 8.4 LTS. A implementação física e as evidências estão em [docs/persistence](../persistence/README.md), ainda aguardando revisão técnica. A referência original a 7.9.1 permanece como histórico da decisão anterior.
