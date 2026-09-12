# L'Essenc Digital — LES-DIG

**Estado:** baseline documental P00–P03 completa; P04 especificada, com implantação física pendente. Próxima fase documental: P05 — Design System. O scaffold já existente em `4507a27` foi construído antes dessa especificação e permanece preservado. Consulte [MEMORY.md](MEMORY.md) para a divergência entre documentação e código.

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
- `MEMORY.md`: estado consolidado e diferença entre baseline especificada e implementação atual.
- `ROADMAP.md`: sequência atual P00–P26 e próximos gates.
- `docs/README.md`: índice dos documentos técnicos oficiais e decisões.
- `memory/YYYY-MM-DD.md`: histórico operacional de cada sessão.
- `docs/`: documentação técnica, comercial e editorial versionada.
- `src/`: código da aplicação.
- `scripts/`: automações locais e de implantação.

## Desenvolvimento local

O projeto será operado preferencialmente pelo terminal PowerShell no Windows. O VS Code será o editor. ChatGPT orienta planejamento e revisão técnica; Codex executa o escopo autorizado no repositório e relata evidências.

O fluxo oficial é:

1. Abrir o diretório do repositório no VS Code.
2. Iniciar a sessão do Codex nesse mesmo diretório.
3. Ler `AGENTS.md`, `MEMORY.md`, `ROADMAP.md`, `memory/README.md`, o registro diário mais recente e os documentos relevantes em `docs/`, nessa ordem.
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

O projeto físico ainda usa pnpm, Next.js 16.3.4, React 19.3.0 e Vitest 5.0.0. A baseline documental P04 prevê npm, outras versões e Prisma; essa migração **não ocorreu**. O primeiro produto aprovado na nova baseline é `Cronograma Capilar Inteligente`, R$ 29,90. Nenhuma credencial real deve ser adicionada ao Git.
