# P04 — Configuração e ambientes

**Status:** specification COMPLETE; migração física PENDING.

Ambientes da aplicação `APP_ENV`: `local`, `test`, `staging`, `production`; distintos de `NODE_ENV`, que governa comportamento do runtime/framework. Um ponto de entrada valida `process.env` por schema e disponibiliza configuração tipada. Módulos de configuração e secrets do servidor devem ter barreira `server-only`; apenas dados conscientemente públicos usam `NEXT_PUBLIC_*`. Segredos nunca entram em bundle, logs ou Git.

Cada ambiente tem banco MySQL, secrets, credenciais de Mercado Pago, storage e configuração isolados. `.env.example` existente contém apenas exemplos fictícios; não ler `.env` sem tarefa que exija. O scaffold anterior possui `src/lib/config/env.ts`, `NODE_ENV` e `APP_URL`, mas não equivale à política `APP_ENV` P04. Provedores físicos, segredos e forma de distribuição da configuração: **OPEN** até briefs autorizados.
