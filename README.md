# L'Essenc Digital — LES-DIG

**Estado:** P00–P05 COMPLETE. Gate A — FOUNDATION READY PASS. P06 é a próxima fase candidata e ainda não está autorizada.

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

`APP_ENV` é obrigatório e aceita `local`, `test`, `staging` ou `production`; `.env.example` é apenas modelo e não é carregado automaticamente. Para validar ou executar localmente em uma sessão PowerShell, defina `$env:APP_ENV = 'local'` antes de `npm run build`, `npm run start` ou `npm run dev`. `NODE_ENV` continua separado e é gerido pelo runtime/framework.

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

O scaffold anterior usava pnpm; a baseline física aprovada usa npm e `package-lock.json`, mantendo Next.js 16.3.4, React 19.3.0 e Vitest 5.0.0. A fundação visual P05 passou na validação local na branch própria, sem implementar a página de vendas final. Prisma e MySQL pertencem à P06. O primeiro produto aprovado é `Cronograma Capilar Inteligente`, R$ 29,90. Nenhuma credencial real deve ser adicionada ao Git.
