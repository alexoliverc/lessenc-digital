# P04 — Primitivas compartilhadas

**Status:** specification COMPLETE; Money/Currency, Clock/SystemClock, Result/ApplicationError e assertNever implementados na [P07](p07-core-implementation.md), aguardando revisão técnica. CorrelationId e paginação permanecem adiados até uso concreto.

Primitivas previstas: `Money` (inteiro em unidades menores + `Currency`, operações seguras), `Currency`, `Clock`, `SystemClock` (tempo UTC consistente), `Result`, `ApplicationError` (código e contexto seguro), `correlationId`, paginação com limites explícitos e `assertNever` para estados exaustivos. Elas apoiam domínio sem acoplar regras específicas de Payments, Catalog ou Entitlements a `shared/`.

Dados de entrada não viram objetos de banco sem validação; erros internos não exibem segredos. No desenho de testes, substituir Clock e providers por doubles sem confundir doubles com evidência de integridade em MySQL real. Não implementar nem refatorar o scaffold anterior nesta rodada.
