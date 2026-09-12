# P03 — Máquina de estados de Order

**Status:** especificação COMPLETE; transições puras e testes implementados na [P07](p07-core-implementation.md), aguardando revisão técnica. Persistência financeira coordenada permanece adiada.

| Origem | Destino permitido | Condição de autoridade |
| --- | --- | --- |
| PENDING | PAID | Confirmação financeira confiável e transação coordenada |
| PENDING | FAILED | Regra interna confirmada sem pagamento aprovado; não usar timeout como falha |
| PENDING | CANCELED | Cancelamento elegível, respeitando corrida com aprovação |
| PAID | REFUNDED | Reembolso integral `COMPLETED`, confirmado pela fonte competente |

Proibido `PAID → FAILED`, `PAID → CANCELED`, `REFUNDED → PAID`. Mudanças devem preservar histórico e ser idempotentes. Em corrida entre aprovação e cancelamento, a transição rejeitada não altera verdade atual e deve gerar sinal para investigação. Não inventar `CREATED`, `PAYMENT_PENDING` ou `EXPIRED` como estados desta máquina: aparecem em registros históricos anteriores e não integram a baseline P03 aprovada.
