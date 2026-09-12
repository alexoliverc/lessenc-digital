# ADR-0002 — Next.js, React e TypeScript

**Status:** ACCEPTED — baseline documental P02/P04, 11/09/2026.

**Decisão:** Next.js App Router, React e TypeScript estrito em Node.js. Rotas e componentes sob `src/app/`; alias `@/*`, Node runtime default, sem novo Pages Router. Versões documentais em [runtime P04](../architecture/runtime-toolchain-baseline.md) requerem compatibilidade/security patch verificados antes de instalar.

**Consequência:** apresentação e APIs sob mesmo projeto, regras de domínio separadas da UI.

## Emenda — 12/09/2026

As versões físicas Next.js 16.3.4 e React/React DOM 19.3.0 do scaffold anterior foram revalidadas como target P04. A reconciliação física validada localmente preservou essas versões ao migrar o gerenciador de pacotes, sem incluir Prisma, reservado à P06. A revisão técnica P04 permanece pendente.
