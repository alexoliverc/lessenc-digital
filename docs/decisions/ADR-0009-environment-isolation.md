# ADR-0009 — Isolamento de ambientes

**Status:** ACCEPTED — baseline documental P02/P04, 11/09/2026.

**Decisão:** separar LOCAL, TEST, STAGING e PRODUCTION, com `APP_ENV` diferente de `NODE_ENV`; isolar banco, storage, segredos e credenciais de pagamento. Testes de persistência rodam em MySQL compatível isolado, jamais no banco de produção.

**Consequência:** mais um ambiente que a baseline histórica, exigindo decisão e autorização de provisionamento; esta documentação não o criou fisicamente. [Detalhes](../architecture/configuration-environment-system.md).
