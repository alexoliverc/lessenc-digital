# P03 — Integridade, concorrência e evidências futuras

**Status:** revisão de cenários documentada; testes executáveis PENDING.

Matriz mínima para testes de integração em MySQL real e isolado:

| Corrida/falha | Invariante de saída |
| --- | --- |
| Webhook duplicado | Um efeito financeiro e um entitlement por item |
| Webhook + reconciliação | Mesmo estado final, sem regressão |
| Dupla concessão | `Entitlement.orderItemId UNIQUE` prevalece |
| Dois workers da outbox | Um efeito lógico por `deduplicationKey` |
| Refund duplicado | Não duplicar devolução, revogação ou evento |
| Timeout de refund | `UNKNOWN`, sem declarar falha definitiva |
| Refund vs fulfillment | Acesso negado após revogação válida |
| Aprovação vs cancelamento | Pedido pago não regride a cancelado |
| Evento antigo | Estado confirmado atual não sofre downgrade |

Esses são critérios para implementação e testes futuros, não evidência de testes já realizados. Projetar transações locais, restrições no banco e idempotência do worker antes de qualquer liberação. Ver [restrições](relational-model-constraints.md), [outbox](refund-notification-outbox-models.md) e [testing](testing-foundation.md).
