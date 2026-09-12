> **STATUS: DEFERRED TO P06 — DATA & PERSISTENCE FOUNDATION**
>
> Este documento contém planejamento de persistência originalmente associado à antiga estrutura P04.
>
> Após a reestruturação canônica do `ROADMAP.md`, Prisma, MySQL, schema, migrations e persistência pertencem à **P06**.
>
> Este arquivo NÃO autoriza implementação de banco ou ORM durante P04.
>
> O conteúdo deverá ser revalidado durante o Phase Execution Brief da P06 antes de qualquer implementação.
# P06 — Bootstrap Prisma/MySQL planejado

**Status:** planejamento arquitetural original preservado; a implementação física P06 foi autorizada e está em revisão na [baseline corrente](../persistence/README.md).

Fluxo futuro sob autorização do owner: confirmar stack compatível; instalar dependências aprovadas; criar `prisma/schema.prisma` e `prisma.config.ts`; definir saída explícita do client Prisma 7; criar banco MySQL local/test isolado; validar e gerar client; criar/revisar/testar migrations versionadas; rodar testes de integridade e recuperação. No CI futuro: `npm ci → Prisma validate → Prisma generate` antes de lint/test/build. Códigos de estado, tabelas e índices devem implementar P03 e não copiar cegamente o antigo `LES-DATA-DIG-R01`.

Na execução autorizada de 12/09/2026, o pin físico passou a Prisma 7.10.0 e o fluxo local foi materializado em `docs/persistence/`. O texto acima permanece como intenção anterior, não como resultado de teste ou instrução para repetir a P04.

Política: LOCAL autorizado usa `migrate dev`; STAGING/PRODUCTION somente `migrate deploy` após review, backup e plano de rollback/recovery. Proibido `migrate reset` nesses ambientes e `db push` como método normal. Um eventual `db:reset:local` ou `db:reset:test` precisa de guards para confirmar o alvo; nunca `db:reset:production`. Nenhum desses comandos é executado nesta sessão.
