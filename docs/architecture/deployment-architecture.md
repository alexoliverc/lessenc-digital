# P02 — Arquitetura de implantação

**Status:** especificação COMPLETE; nenhum ambiente novo provisionado.

Hospedagem inicial: Hostinger managed Node/Web App para o monólito Next.js; dados MySQL e assets privados são externos ao código e recuperáveis. Ambientes da decisão posterior: `LOCAL`, `TEST`, `STAGING`, `PRODUCTION`, isolados por `APP_ENV`, credenciais, banco, storage, configuração e provedor de pagamentos. `NODE_ENV` indica modo de execução, não substitui `APP_ENV`. `STAGING` é ambiente distinto de `TEST` na baseline atual; a documentação anterior usava três ambientes.

Deploy deve usar versão aprovada de `main`, `npm ci` e o lockfile npm, migrations versionadas e validadas, health/readiness, smoke tests, monitoramento e rollback. Em `STAGING`/`PRODUCTION`: `prisma migrate deploy`; jamais `migrate reset` ou `db push` como fluxo normal. Rollback do aplicativo não implica rollback do banco; planejar compatibilidade, backup e recuperação antes de alterações. Produção exige TLS, domínio oficial, webhook autenticado, contas MFA, plano de suporte e go-live controlado. Domínio e política RPO/RTO: **OPEN**.

O scaffold auditado antes da P04 usava `pnpm` e não tinha Prisma. A reconciliação física passou nas validações locais com `package-lock.json` como único lockfile autoritativo; a revisão técnica P04 ainda está pendente. Prisma permanece fora da P04 e sua implementação física pertence à P06. Esta especificação não altera infraestrutura. Ver [runtime P04](runtime-toolchain-baseline.md) e [ambientes](configuration-environment-system.md).
