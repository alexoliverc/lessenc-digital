# L'Essenc Digital

Plataforma inicial de receita digital da L'Essenc para venda de e-books autorais.

## Objetivo da primeira versão

- Página de vendas.
- Checkout integrado ao Mercado Pago.
- Página de agradecimento.
- Entrega digital segura após pagamento aprovado.
- Painel administrativo para produtos, pedidos e indicadores.

Esta operação é uma fase de geração de caixa. Ela deve compartilhar fundamentos reutilizáveis com o futuro ecossistema de cosméticos físicos, mas não deve misturar escopos prematuramente.

## Fonte de verdade

- `AGENTS.md`: regras permanentes de trabalho do Codex.
- `MEMORY.md`: estado consolidado do projeto.
- `memory/YYYY-MM-DD.md`: histórico operacional de cada sessão.
- `docs/`: documentação técnica, comercial e editorial versionada.
- `src/`: código da aplicação.
- `scripts/`: automações locais e de implantação.

## Desenvolvimento local

O projeto será operado preferencialmente pelo terminal PowerShell no Windows. O VS Code será o editor e o Codex será o agente de planejamento, implementação, revisão e testes.

O fluxo oficial é:

1. Abrir o diretório do repositório no VS Code.
2. Iniciar a sessão do Codex nesse mesmo diretório.
3. Ler `AGENTS.md`, `MEMORY.md` e o registro do dia.
4. Planejar a alteração antes de editar.
5. Executar testes e registrar a sessão.
6. Fazer commit somente após os gates passarem.

## Bootstrap no Windows

Na primeira configuração, execute no PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\bootstrap-windows.ps1
```

O script cria ou atualiza o diretório `C:\Projetos\lessenc-digital`, inicializa o Git quando necessário e abre o projeto no VS Code quando o comando `code` estiver disponível.

## Estado atual

O repositório está no estágio de scaffold e governança. Nenhuma credencial real deve ser adicionada antes da definição dos ambientes e do cofre de segredos.
