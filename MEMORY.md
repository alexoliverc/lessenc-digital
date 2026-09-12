# MEMORY.md — Estado consolidado da L'Essenc Digital

**Última atualização:** 11/09/2026
**Fase:** MVP-IMPL-01 — Foundation & Project Scaffold concluída
**Status:** Foundation Batch 01 implementado e validado; aguardando definição e autorização do próximo lote de implementação

## Decisões vigentes

- A L'Essenc Digital é uma frente temporária de geração de caixa.
- O primeiro produto é um e-book autoral sobre recuperação capilar pós-química.
- Preço de referência: R$ 39,90.
- Meta comercial do segundo mês: média de 10 vendas por dia.
- A jornada pública inicial terá página de vendas, checkout e página de agradecimento.
- Haverá painel administrativo para produtos, pedidos, clientes e indicadores.
- A plataforma será construída do zero, com baixo acoplamento à Hostinger e ao Mercado Pago.
- O desenvolvimento será feito com Codex, VS Code e Git.
- O projeto principal de cosméticos físicos continua separado e será retomado com a formação de caixa.

## Documentos estratégicos existentes

- `LES-DIG-R01.md`: estratégia de receita digital.
- `LES-PROD-R01.md`: definição do produto.
- `LES-EDI-R01.md`: plano editorial.
- `LES-EBOOK-R01.md`: manuscrito consolidado.
- `LES-SALES-R01.md`: copy da página de vendas.

Esses documentos serão incorporados ao diretório `docs/` na próxima etapa de organização documental.

## Entregas concluídas nesta sessão

- `AGENTS.md` criado com regras permanentes do Codex.
- `MEMORY.md` e política de memória criados.
- Configuração inicial do VS Code criada em `.vscode/`.
- `scripts/bootstrap-windows.ps1` criado para preparar `C:\Projetos\lessenc-digital`.
- `docs/operations/LOCAL-CONNECTIVITY-R01.md` criado com o procedimento de conexão.
- Git inicializado no scaffold local.

## Próximo marco

Definir o próximo lote da MVP-IMPL-01. Banco, ORM, schema e migrations permanecem sujeitos a aprovação explícita antes da implementação.

## Pendências
- Confirmar domínio ou subdomínio da operação digital.
- Confirmar conta e credenciais de teste do Mercado Pago.
- Definir política de reembolso e canal de suporte.
- Escolher armazenamento privado do PDF e materiais complementares.
