# ADR-0004 — Mercado Pago atrás de PaymentProvider

**Status:** ACCEPTED — baseline documental P02, 11/09/2026.

**Decisão:** `MercadoPagoAdapter` implementa `PaymentProvider` sem SDK no domínio. Criação, consulta, assinatura do webhook, idempotência e reconciliação passam pelo backend; navegador e analytics não aprovam pagamentos.

**Consequência:** substituição do provedor sem reescrever regras centrais e falha segura por padrão. Credenciais e chamadas reais dependem de gate específico. [Detalhes](../architecture/integrations-architecture.md).
