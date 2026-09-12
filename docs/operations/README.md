# Operação LES-DIG

O [guia local de conectividade](LOCAL-CONNECTIVITY-R01.md) registra o bootstrap histórico no Windows. A [arquitetura de deploy P02](../architecture/deployment-architecture.md) define LOCAL, TEST, STAGING e PRODUCTION; [configuração P04](../architecture/configuration-environment-system.md), [toolchain P04](../architecture/runtime-toolchain-baseline.md) e [testes/CI](../architecture/testing-foundation.md) ainda são especificações sem migração física.

**CURRENT PHYSICAL SCAFFOLD:** `pnpm` e `pnpm-lock.yaml`, com versões e scripts instalados descritos na [toolchain P04](../architecture/runtime-toolchain-baseline.md). **APPROVED TARGET P04 BASELINE:** `npm` 11.19.1, `package-lock.json` e `npm ci`. A diferença é intencional: **P04 physical implementation is still pending**. As versões aprovadas são metas; as instaladas são evidência do estado físico atual.

Até uma etapa de implementação/reconciliação física P04 explicitamente autorizada, Codex **não deve** migrar automaticamente o gerenciador, rodar `npm install` apenas porque npm é a meta, gerar `package-lock.json` ao lado de `pnpm-lock.yaml`, remover o lockfile pnpm nem atualizar dependências de framework para corresponder ao documento. A reconciliação deve ser uma operação P04 própria; após a migração, exatamente um lockfile autoritativo deve permanecer.

Fornecedores e procedimentos finais de armazenamento privado, email, observabilidade, limite de taxa distribuído, backup/restore e domínio: **OPEN**. O manual antigo pode citar comandos pnpm correspondentes ao scaffold existente; não executar npm/Prisma nele antes da migração autorizada.

## Development workstation

A [baseline canônica da workstation de desenvolvimento e VS Code](development-workstation-vscode.md) documenta o Profile L'Essenc, configuração compartilhada do workspace, extensões, terminal, Git/SCM, segurança, performance, Settings Sync e recuperação.

Esse documento é operacional e não redefine versões da stack, gerenciador de pacotes, ambientes da aplicação nem o estado da implementação P04. Para esses temas, prevalecem as fontes arquiteturais canônicas e a regra **CURRENT CANONICAL BASELINE WINS**.
