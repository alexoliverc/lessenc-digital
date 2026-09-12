# Operação LES-DIG

O [guia local de conectividade](LOCAL-CONNECTIVITY-R01.md) registra o bootstrap histórico no Windows. A [arquitetura de deploy P02](../architecture/deployment-architecture.md) define LOCAL, TEST, STAGING e PRODUCTION; as fundações de [configuração P04](../architecture/configuration-environment-system.md), [toolchain P04](../architecture/runtime-toolchain-baseline.md) e [testes](../architecture/testing-foundation.md) passaram na validação local, ainda sujeita à revisão técnica P04. CI continua como direção documentada, sem pipeline física implementada nesta fase.

**SCAFFOLD ANTERIOR À P04:** `pnpm` e `pnpm-lock.yaml`, com versões e scripts auditados na [toolchain P04](../architecture/runtime-toolchain-baseline.md). **ESTADO FÍSICO VALIDADO LOCALMENTE:** `npm@11.17.0` no host, `package-lock.json` como único lockfile autoritativo e `npm ci` aprovado a partir de `node_modules` ausente. O target Node.js 24.21.0/npm 11.19.1 ainda não foi atingido no host (24.19.0/11.17.0); a revisão técnica P04 está pendente.

A migração preservou as versões diretas aprovadas; `npm ci`, format check, lint, typecheck, 7 testes, build e smoke test local de `/api/health` passaram. Para executar os gates no PowerShell, definir primeiro o ambiente da aplicação: `$env:APP_ENV = 'local'`; depois executar `npm run check` e `npm run build`. `APP_ENV` é obrigatório e separado de `NODE_ENV`.

Fornecedores e procedimentos finais de armazenamento privado, email, observabilidade, limite de taxa distribuído, backup/restore e domínio: **OPEN**. O manual antigo pode citar comandos pnpm correspondentes ao scaffold histórico; não usá-lo como instrução normativa para a migração P04. Prisma/MySQL permanecem para P06.

## Development workstation

A [baseline canônica da workstation de desenvolvimento e VS Code](development-workstation-vscode.md) documenta o Profile L'Essenc, configuração compartilhada do workspace, extensões, terminal, Git/SCM, segurança, performance, Settings Sync e recuperação.

Esse documento é operacional e não redefine versões da stack, gerenciador de pacotes, ambientes da aplicação nem o estado da implementação P04. Para esses temas, prevalecem as fontes arquiteturais canônicas e a regra **CURRENT CANONICAL BASELINE WINS**.
