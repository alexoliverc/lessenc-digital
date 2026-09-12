# P01 — Product Requirements (LES-DIG)

**Status:** documentação COMPLETE; implementação PENDING.

L'Essenc Digital é a frente inicial de caixa por produtos digitais próprios em beleza, cosméticos e autocuidado. O canal de aquisição inicial é paid traffic; meta de negócio: **10 vendas concluídas por dia até o segundo mês**, sem garantia técnica. A plataforma pertence à L'Essenc e não usa WordPress, WooCommerce ou Elementor. Hostinger é infraestrutura inicial e Mercado Pago é provedor de pagamento substituível.

O MVP oferece página de vendas, checkout, pagamento, pedido, entitlement, entrega digital segura e comunicação pós-compra/página de agradecimento. A ordem técnica da criação de `Order` e `Payment` é determinada pela [arquitetura de integração](../architecture/integrations-architecture.md): registrar intenção interna antes do efeito financeiro externo. A representação da jornada aqui não concede acesso por retorno do navegador.

Requisitos: venda avulsa, moeda BRL, Brasil, PIX ou cartão, quantidade 1 por pedido no MVP; arquitetura prepara múltiplos produtos. Conta de cliente prévia não é obrigatória. O backend determina preço e elegibilidade, cria e consulta estados financeiros com fonte confiável e libera ativos somente para `Entitlement.ACTIVE`. Admin exige autenticação e autorização; analytics não é fonte de verdade financeira. Veja [matriz de requisitos](requirements-matrix.md), [regras comerciais](offer-commercial-rules.md) e [fluxo do comprador](customer-journey-business-rules.md).

**Fora do escopo P01:** tela, código, credenciais, política de reembolso ou suporte ainda não aprovada e decisão de fornecedores OPEN. O conteúdo deve ser educativo e não prometer cura ou resultado garantido.
