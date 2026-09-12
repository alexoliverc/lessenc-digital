# ADR-0003 — MySQL e Prisma

**Status:** ACCEPTED — baseline documental P02/P03/P04, 11/09/2026.

**Decisão:** MySQL relacional e Prisma 7.9.1 na especificação. Schema `prisma/schema.prisma`, config `prisma.config.ts`, client em saída explícita; migrations versionadas, revisadas e aplicadas por ambiente. Dinheiro em minor units inteiras com currency e constraints críticas em [modelo relacional](../architecture/relational-model-constraints.md).

**Consequência:** transações e restrições sustentam idempotência. Dependência, banco, schema e migrations físicos ainda PENDING e sujeitos à autorização do owner; o código atual não contém Prisma.
