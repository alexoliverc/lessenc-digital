# AGENTS.md — Regras permanentes do Codex

## 1. Identidade e objetivo

Este repositório pertence ao projeto L'Essenc Digital, a frente inicial de receita com infoprodutos autorais. O objetivo é construir uma plataforma própria, simples na jornada e robusta em segurança, pagamentos, entrega e mensuração.

Esta frente não substitui o roadmap de cosméticos físicos da L'Essenc. Não adicionar funcionalidades do ecossistema físico sem decisão documentada.

## 2. Ordem obrigatória de toda sessão

Antes de planejar ou alterar código, ler nesta ordem:

1. `AGENTS.md`.
2. `MEMORY.md`.
3. `memory/YYYY-MM-DD.md` da data atual; criar o registro se não existir.
4. Documentos diretamente relacionados à tarefa em `docs/`.

Ao concluir uma sessão, atualizar `MEMORY.md` somente quando o estado consolidado mudar e registrar o trabalho em `memory/YYYY-MM-DD.md`.

## 3. Princípios de engenharia

- Definir comportamento e critérios de aceite antes de codar.
- Preferir mudanças pequenas, revisáveis e reversíveis.
- Não introduzir dependência sem justificar finalidade, risco e manutenção.
- Não usar WordPress, Elementor, WooCommerce ou construtores prontos como base.
- Manter baixo acoplamento à Hostinger e ao Mercado Pago.
- Usar TypeScript com tipagem estrita quando o código for iniciado.
- Validar entrada, autorização, estado de pagamento e acesso a arquivos no servidor.
- Tratar webhooks de pagamento como eventos não confiáveis até validação e idempotência.
- Nunca liberar produto apenas porque o navegador chegou à página de agradecimento.

## 4. Segurança e dados

- Nunca colocar chaves, tokens, senhas, URLs autenticadas ou credenciais no Git.
- Usar `.env.example` apenas com nomes de variáveis e valores fictícios.
- Não registrar dados integrais de cartão, tokens brutos, senhas ou dados pessoais desnecessários.
- Aplicar menor privilégio em painel administrativo, banco, armazenamento e integrações.
- Manter arquivos digitais fora de acesso público direto.
- Usar links temporários, individuais e revogáveis para entrega.
- Registrar auditoria mínima de ações administrativas e eventos financeiros.
- Toda falha de pagamento deve ser segura por padrão: sem liberação do conteúdo.

## 5. Produto e comunicação

- O primeiro produto é autoral: `Plano de Recuperação Capilar Pós-Química`.
- Não fazer promessas de cura, resultado garantido, tratamento de queda ou reversão total de danos.
- Cabelo, couro cabeludo e cosméticos devem ser tratados como conteúdo educativo, não como diagnóstico médico.
- Copy, criativos e página de vendas devem respeitar a oferta aprovada em `docs/product/`.

## 6. Processo de alteração

Para cada mudança relevante:

1. Declarar objetivo e escopo.
2. Identificar arquivos afetados.
3. Implementar com o menor diff necessário.
4. Executar testes, lint, build e verificações de segurança aplicáveis.
5. Revisar o diff completo.
6. Atualizar memória e documentação.
7. Fazer commit com mensagem objetiva.

Não apagar, sobrescrever ou reestruturar arquivos amplos sem confirmar o alvo e preservar uma forma de recuperação.

## 7. Preferências operacionais do proprietário

- Explicações em português do Brasil.
- Comandos preferencialmente fornecidos para PowerShell no Windows.
- Mostrar o resultado antes dos detalhes.
- Evitar jargão sem utilidade prática.
- Ser direto sobre bloqueios, riscos e decisões pendentes.

## 8. Definition of Done

Uma entrega só está concluída quando:

- o comportamento pedido está implementado;
- testes relevantes passam;
- não existem segredos expostos;
- eventos e erros importantes são observáveis;
- documentação e memória estão atualizadas;
- o diff foi revisado;
- a implantação, quando aplicável, tem rollback definido.

## 9. Limites de autonomia

O Codex pode, sem aprovação adicional:

- ler arquivos do repositório;
- analisar código, documentação e Git;
- criar ou editar arquivos dentro do escopo solicitado;
- executar lint, testes, typecheck e build;
- propor melhorias e registrar riscos;
- atualizar memória operacional conforme estas regras.

O Codex deve pedir aprovação antes de:

- adicionar ou remover dependências;
- alterar arquitetura aprovada;
- alterar esquema de banco ou migrations;
- modificar autenticação, autorização, pagamentos ou webhooks;
- alterar infraestrutura, DNS, domínio ou deploy;
- executar comandos com efeito externo;
- alterar configurações fora deste repositório;
- fazer push, merge, rebase ou criar tags;
- apagar dados, branches, arquivos amplos ou histórico Git.

## 10. Git e versionamento

- Nunca trabalhar diretamente sobre histórico remoto sem verificar branch e status.
- Antes de alterar arquivos, executar `git status --short --branch`.
- Não usar `git reset --hard`, `git clean -fd`, force push ou comandos destrutivos sem autorização explícita.
- Commits devem ser pequenos, coerentes e relacionados a uma única finalidade.
- Não incluir arquivos secretos, caches, builds ou dependências versionadas.
- Antes de commit, revisar `git diff` e `git status`.
- Push para repositório remoto exige autorização do proprietário, salvo regra futura documentada em contrário.

## 11. Fonte de verdade

Em caso de conflito, obedecer esta precedência:

1. decisão explícita mais recente do proprietário;
2. `AGENTS.md`;
3. documentação vigente em `docs/`;
4. `MEMORY.md`;
5. registros históricos em `memory/`;
6. código existente.

Registros históricos não substituem decisões consolidadas mais recentes.

## 12. Segredos e ambientes

- Nunca exibir segredos completos em logs, memória ou documentação.
- Nunca ler ou alterar `.env` sem necessidade explícita da tarefa.
- Nunca copiar valores reais de `.env` para `.env.example`.
- `.env.example` deve conter somente nomes de variáveis e exemplos fictícios.
- Credenciais de produção não devem ser utilizadas em testes locais.

## 13. Protocolo de início de sessão

Toda sessão deve:

1. confirmar o diretório do repositório;
2. executar `git status --short --branch`;
3. ler `AGENTS.md`;
4. ler `MEMORY.md`;
5. ler ou criar `memory/YYYY-MM-DD.md`;
6. consultar documentação relacionada;
7. declarar objetivo, escopo e riscos antes de alterar código relevante.

## 14. Protocolo de encerramento

Antes de encerrar uma sessão com mudanças:

1. executar verificações aplicáveis;
2. revisar o diff;
3. verificar ausência de segredos;
4. atualizar documentação necessária;
5. atualizar `MEMORY.md` somente se o estado consolidado mudou;
6. registrar ações, testes, decisões e pendências em `memory/YYYY-MM-DD.md`;
7. informar claramente o próximo movimento.

