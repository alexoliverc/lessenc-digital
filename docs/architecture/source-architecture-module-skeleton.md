# P04 — Estrutura fonte e esqueleto modular

**Status:** specification COMPLETE; módulos físicos PENDING, preservado scaffold anterior.

```text
src/
  app/              Next.js App Router, API e apresentação
  modules/          Catalog, Customers, Commerce, Payments, Entitlements,
                    Fulfillment, Notifications, Attribution, Administration, Audit
  infrastructure/   banco, provider adapters, storage e jobs
  shared/           primitivas de uso realmente transversal
  config/           configuração tipada e validada por ambiente
```

Alias `@/*` para `src/*`, TypeScript estrito, Node runtime default e nenhum novo Pages Router. Camadas de cada módulo separam Presentation/Application/Domain/Infrastructure, com acesso cruzado por contratos públicos e não por atualização direta no banco alheio. A existência de `src/app/` e alguns arquivos de health em `4507a27` não equivale ao esqueleto P04 completo: `src/lib/` físico permanece até migração aprovada. Não criar módulos vazios nesta sessão.
