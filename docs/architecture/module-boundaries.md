# P02 — Fronteiras dos módulos

**Status:** especificação COMPLETE; implementação PENDING.

| Módulo | Responsabilidade primária | Limite obrigatório |
| --- | --- | --- |
| Catalog | Produto, versão, oferta e asset associado | Não define estado de pagamento |
| Customers | Identidade operacional do comprador | Conta antes da compra não obrigatória |
| Commerce | Order e OrderItem; preço/quantidade confirmados | Não copia status bruto do provedor |
| Payments | Payment, tentativa, evento, reembolso e reconciliação | Não faz UPDATE direto em Entitlements |
| Entitlements | Direito de acesso e revogação | Só ativa por origem financeira válida |
| Fulfillment | Preparação e entrega do acesso | Falha não reverte Order.PAID |
| Notifications | Comunicação por email | Falha não revoga Entitlement |
| Attribution | Origem de tráfego e eventos analíticos | Não altera verdade financeira |
| Administration | Interface e comandos privilegiados | Autorização no servidor; não edita tabelas livremente |
| Audit | Eventos de ação crítica e rastreabilidade | Separado de logs técnicos |

Operações transversais coordenadas pela camada Application dentro de uma transação MySQL local, incluindo `OutboxEvent` na mesma transação. Mensagens e workers posteriores consomem a outbox de forma idempotente e sem acessar um módulo não relacionado como se compartilhassem sua autoridade. Catálogo e limites de contrato não criam dependência física de um provedor específico.
