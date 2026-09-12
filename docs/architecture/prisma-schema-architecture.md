# P03 — Arquitetura do schema Prisma

**Status:** desenho documental COMPLETE; `prisma/schema.prisma` e `prisma.config.ts` NÃO existem, migrations PENDING.

Direção aprovada: Prisma 7.9.1 e MySQL com schema em `prisma/schema.prisma`, configuração em `prisma.config.ts` e client gerado em destino explícito compatível com Prisma 7. O domínio depende de contratos de repositório; não importa tipos do client gerado diretamente nas regras centrais. IDs de provedor têm campos separados, dinheiro é inteiro em unidades menores e `currency`, sem floats; preservar integridade e unicidades descritas em [restrições relacionais](relational-model-constraints.md).

Separar privilégios de migration e runtime, bancos por ambiente, sem segredos versionados. Aplicar `migrate dev` somente em LOCAL autorizado; `migrate deploy` em STAGING/PRODUCTION após review e backup/recovery. Nunca `migrate reset` em STAGING/PRODUCTION; `db push` não é fluxo normal. O modelo físico completo, migrations, índice de acesso e plano de transição da stack atual dependem de brief e autorização explícita para schema, dependências e banco. Esta especificação não cria tabela, arquivo Prisma ou conexão.
