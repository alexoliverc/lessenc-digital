# P04 — Baseline documental de runtime e toolchain

**Status:** specification COMPLETE; implementação física PENDING. Versões abaixo são metas documentais aprovadas, não dependências já instaladas ou validadas hoje.

**DOCUMENTED / APPROVED TARGET STACK ≠ CURRENT INSTALLED SCAFFOLD STACK.** As versões da coluna P04 são alvos arquiteturais; a coluna física registra evidência factual do scaffold existente até sua reconciliação deliberada. A divergência é intencional e permanece aberta porque a implementação física P04 ainda está pendente.

**CURRENT PHYSICAL SCAFFOLD:** `pnpm`/`pnpm-lock.yaml`. **APPROVED TARGET P04 BASELINE:** `npm` 11.19.1/`package-lock.json`/`npm ci`.

| Item | Baseline P04 | Situação física em `4507a27` quando verificável |
| --- | --- | --- |
| Node.js | 24.21.0 LTS | ambiente local histórico 24.19.0; confirmar ao executar |
| npm | 11.19.1 | ambiente histórico 11.17.0; gerenciador atual pnpm 11.26.0 |
| Next.js | 16.2.11 | 16.3.4 |
| React / React DOM | 19.2.7 / 19.2.7 | 19.3.0 / 19.3.0 |
| TypeScript | 6.0.3 | 6.0.3 |
| Prisma | 7.9.1 | não instalado |
| Vitest | 4.1.11 | 5.0.0 |
| ESLint | 10.10.0 | 10.10.0 |
| eslint-config-next | 16.2.11 | não instalado; plugin atual diferente |
| Prettier | 3.9.6 | 3.9.6 |

Gerenciador da baseline P04: **npm**, lockfile `package-lock.json`; pipeline começa por `npm ci`. O repositório físico continua com `pnpm-lock.yaml`, `packageManager: pnpm@11.26.0` e scripts `pnpm`; não executar `npm ci` ainda. Antes da instalação física, confirmar compatibilidade, correções de segurança e disponibilidade das versões sem mudar majors automaticamente. Migração precisa de brief, decisão de rollback e autorização explícita para adicionar/remover dependências; não alterar código ou lockfile nesta rodada.

**Regra até a reconciliação física P04:** não migrar o gerenciador automaticamente; não executar `npm install` apenas porque npm é a meta; não gerar `package-lock.json` ao lado de `pnpm-lock.yaml`; não remover o lockfile pnpm; não atualizar dependências de framework para igualar a especificação. A reconciliação é uma operação explícita da implementação P04. Depois dela, exatamente um lockfile de gerenciador deve permanecer autoritativo.
