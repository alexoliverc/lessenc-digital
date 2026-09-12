# P04 — Bootstrap Prisma/MySQL planejado

**Status:** specification COMPLETE; instalação, banco, migrations e bootstrap físicos PENDING.

Fluxo futuro sob autorização do owner: confirmar stack compatível; instalar dependências aprovadas; criar `prisma/schema.prisma` e `prisma.config.ts`; definir saída explícita do client Prisma 7; criar banco MySQL local/test isolado; validar e gerar client; criar/revisar/testar migrations versionadas; rodar testes de integridade e recuperação. No CI futuro: `npm ci → Prisma validate → Prisma generate` antes de lint/test/build. Códigos de estado, tabelas e índices devem implementar P03 e não copiar cegamente o antigo `LES-DATA-DIG-R01`.

Política: LOCAL autorizado usa `migrate dev`; STAGING/PRODUCTION somente `migrate deploy` após review, backup e plano de rollback/recovery. Proibido `migrate reset` nesses ambientes e `db push` como método normal. Um eventual `db:reset:local` ou `db:reset:test` precisa de guards para confirmar o alvo; nunca `db:reset:production`. Nenhum desses comandos é executado nesta sessão.
