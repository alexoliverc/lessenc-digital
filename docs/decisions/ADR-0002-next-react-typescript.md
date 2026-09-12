# ADR-0002 — Next.js, React e TypeScript

**Status:** ACCEPTED — baseline documental P02/P04, 11/09/2026.

**Decisão:** Next.js App Router, React e TypeScript estrito em Node.js. Rotas e componentes sob `src/app/`; alias `@/*`, Node runtime default, sem novo Pages Router. Versões documentais em [runtime P04](../architecture/runtime-toolchain-baseline.md) requerem compatibilidade/security patch verificados antes de instalar.

**Consequência:** apresentação e APIs sob mesmo projeto, regras de domínio separadas da UI. O scaffold legado usa outras versões; migração física P04 PENDING.
