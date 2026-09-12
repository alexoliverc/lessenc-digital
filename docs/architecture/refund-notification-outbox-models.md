# P03 — Refund, Notification e Transactional Outbox

**Status:** especificação COMPLETE; persistência/worker PENDING.

`Refund`: `REQUESTED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELED`, `UNKNOWN`. Timeout não comprova falha: manter `UNKNOWN` e reconciliar antes de retry com idempotency key. Em reembolso **integral concluído pela autoridade financeira**, preferir a mesma transação local para `Refund.COMPLETED`, `Payment.REFUNDED`, `Order.REFUNDED`, `Entitlement.REVOKED` e `OutboxEvent`. Política de reembolso parcial ou chargeback: **OPEN**; não inferir transição automática.

`Notification` por canal `EMAIL`, tipos `PAYMENT_APPROVED`, `PRODUCT_ACCESS`, `PAYMENT_PENDING`, `PAYMENT_FAILED`, `REFUND_CONFIRMED`, `ACCESS_REISSUED`; estados `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELED`. Provedor de email: **OPEN**. Entrega falha não desfaz pagamento ou entitlement.

`OutboxEvent`: `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`; tipos `ORDER_PAID`, `PAYMENT_APPROVED`, `ENTITLEMENT_ACTIVATED`, `REFUND_COMPLETED`, `ACCESS_REISSUE_REQUESTED`. Produção na transação que grava a verdade de negócio; worker posterior entrega eventos para notifications, fulfillment e analytics, com deduplicação, retry seguro, observabilidade e idempotência de consumidores. Múltiplos workers não executam o mesmo efeito lógico duas vezes.
