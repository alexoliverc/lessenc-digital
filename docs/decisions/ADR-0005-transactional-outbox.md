# ADR-0005 — Transactional Outbox

**Status:** ACCEPTED — baseline documental P02/P03, 11/09/2026.

**Decisão:** gravar `Payment.APPROVED`, `Order.PAID`, `Entitlement.ACTIVE` e `OutboxEvent` na mesma transação local. Consumidores posteriores idempotentes cuidam de notificações, fulfillment e analytics. Eventos deduplicados por chave única.

**Consequência:** falha assíncrona não desfaz verdade financeira; retries e múltiplos workers exigem controle de concorrência e recuperação. [Modelo](../architecture/refund-notification-outbox-models.md). Worker e schema ainda PENDING.
