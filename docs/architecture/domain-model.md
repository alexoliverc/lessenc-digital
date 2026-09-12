# P03 — Modelo de domínio

**Status:** documentação COMPLETE; entidades Prisma/banco PENDING.

Entidades por área: `Catalog`: Product, ProductVersion, Offer, DigitalAsset, AssetVersion, ProductAsset; `Customers`: Customer; `Commerce`: Order, OrderItem; `Payments`: Payment, PaymentAttempt, PaymentEvent, Refund; `Entitlements`: Entitlement, DownloadEvent; `Fulfillment`: Fulfillment; `Notifications`: Notification; `Attribution`: AttributionSnapshot; `Administration`: AdminUser; `Audit`: AuditLog; coordenação: OutboxEvent.

Product: `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`. Order: `PENDING`, `PAID`, `FAILED`, `CANCELED`, `REFUNDED`. Payment: `PENDING`, `APPROVED`, `REJECTED`, `CANCELED`, `REFUNDED`, `UNKNOWN`. Entitlement: `PENDING`, `ACTIVE`, `REVOKED`, `EXPIRED`. Ver [pedido](order-state-machine.md), [pagamento](payment-state-machine.md), [acesso e fulfillment](entitlement-fulfillment-state-machines.md) e [refund/outbox](refund-notification-outbox-models.md).

Preços, totais e pagamentos usam inteiro em unidades menores **mais currency** (`2990 BRL`), sem float como fonte de verdade. IDs internos independem de referências do provedor; snapshots de oferta/item preservam histórico; timestamps consistentes em UTC. `Entitlement.orderItemId` é único; email de Customer não é globalmente único no MVP. Detalhes de associação, política de retenção e comportamento de reembolso parcial permanecem **OPEN** até o brief de implementação.
