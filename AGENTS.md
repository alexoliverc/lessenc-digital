# AGENTS.md — Regras permanentes do Codex

## 1. Identidade e objetivo

Este repositório pertence ao projeto L'Essenc Digital, a frente inicial de receita com infoprodutos autorais. O objetivo é construir uma plataforma própria, simples na jornada e robusta em segurança, pagamentos, entrega e mensuração.

Esta frente não substitui o roadmap de cosméticos físicos da L'Essenc. Não adicionar funcionalidades do ecossistema físico sem decisão documentada.

## 2. Ordem obrigatória de toda sessão

Antes de planejar ou alterar código ou documentação, ler nesta ordem:

1. `AGENTS.md`.
2. `MEMORY.md`.
3. `ROADMAP.md`.
4. `memory/README.md`.
5. O registro `memory/YYYY-MM-DD.md` mais recente; ler ou criar também o registro da data atual para relatar a sessão.
6. Documentos diretamente relacionados à fase ou ao módulo em `docs/`.

Não presumir que a memória de conversas externas esteja disponível. A verdade técnica oficial é a baseline documentada no repositório, respeitando a precedência da seção 11 e distinguindo especificação aprovada de implementação física verificada.

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

- O primeiro produto na baseline LES-DIG P01 é autoral: `Cronograma Capilar Inteligente`; descrição, preço e regras estão em `docs/product/`. O produto anterior pertence ao histórico documental e não deve ser anunciado como oferta atual.
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

1. `AGENTS.md` — regras operacionais;
2. `MEMORY.md` — estado consolidado atual do projeto;
3. `ROADMAP.md` — roadmap e status atuais aprovados;
4. documentos canônicos atuais indexados por `docs/README.md`;
5. ADRs aceitos — decisões arquiteturais aprovadas;
6. `memory/YYYY-MM-DD.md` — histórico operacional;
7. documentos históricos ou substituídos — apenas contexto, nunca fonte normativa.

Decisão explícita mais recente do proprietário prevalece sobre esta lista. Se um documento histórico conflitar com a baseline canônica atual: **CURRENT CANONICAL BASELINE WINS**. O Codex nunca deve inferir a arquitetura atual de um documento marcado como histórico ou substituído.

Para fatos sobre o código instalado, conferir arquivos e comandos atuais; especificação documental não comprova implementação física. O scaffold anterior à P04, preservado no checkpoint `71488f1`, usa `pnpm` e `pnpm-lock.yaml`; a meta P04 aprovada prevê Node 24.21.0, `npm` 11.19.1, `package-lock.json` e `npm ci`. O brief do owner de 12/09/2026 autorizou a reconciliação física P04 na branch `phase/p04-physical-reconciliation`, sem Prisma/MySQL e sem commit, tag, push ou merge nesta execução. A árvore de trabalho passou a usar npm e um único lockfile, e os gates locais passaram; o host ainda usa Node 24.19.0/npm 11.17.0 e a revisão técnica do ChatGPT está pendente. Não tratar dois lockfiles como autoritativos, nem atualizar dependências de framework apenas para corresponder a documentação substituída. A versão Node/npm do host e os gates físicos exigem evidência própria; a execução do Codex não substitui a revisão técnica do ChatGPT.

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
5. ler `ROADMAP.md` e `memory/README.md`;
6. ler o registro diário mais recente, ler ou criar o registro do dia e consultar a documentação da fase em `docs/`;
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

## 15. Modelo operacional — ChatGPT → Codex → ChatGPT review

O projeto adota separação explícita entre direção técnica, execução e revisão. O roadmap atual das fases está em `ROADMAP.md`; `docs/LES-ROADMAP-DIG-R01.md` preserva a sequência histórica anterior. Planejamento, revisão técnica ou inclusão de uma fase no roadmap não autorizam, por si só, sua execução nem operações protegidas pela seção 9.

### ChatGPT

Responsável pela direção técnica e por:

- planejamento das fases;
- arquitetura;
- definição de escopo;
- definição de critérios de aceite;
- identificação de approval gates;
- revisão técnica dos resultados produzidos pelo Codex;
- classificação da fase como `PASS`, `PASS WITH FIXES` ou `FAIL`;
- definição da próxima fase.

### Codex

Responsável pela execução técnica no repositório e por:

- executar somente o escopo autorizado;
- trabalhar dentro da branch da fase, verificando sua base e o estado do Git;
- modificar arquivos dentro do escopo aprovado;
- implementar código quando autorizado;
- executar lint, typecheck, testes e build aplicáveis;
- produzir evidências verificáveis;
- relatar blockers, conflitos e decisões pendentes;
- não tomar decisões arquiteturais fora do escopo aprovado.

A validação e a revisão do próprio diff pelo Codex são obrigatórias, mas não substituem a revisão técnica do ChatGPT. O resultado de cada fase deverá retornar ao ChatGPT antes da progressão.

### Owner e approval gates

O owner mantém a autoridade de autorização. Todas as operações protegidas por `AGENTS.md` continuam exigindo autorização explícita do owner, inclusive quando previstas em um brief ou consideradas tecnicamente aprovadas pelo ChatGPT.

A autorização deverá identificar o escopo e as operações abrangidas. Autorizações já concedidas permanecem válidas para esse escopo; expansão de escopo ou novo gate não abrangido exige nova autorização. Aprovação de arquitetura não equivale a autorização para implementar banco, autenticação, pagamentos ou infraestrutura.

### Fluxo obrigatório

```text
Specification
→ Owner Authorization quando aplicável
→ Phase Branch
→ Codex Execution
→ Codex Validation Report
→ ChatGPT Technical Review
→ Corrections quando necessárias
→ Final Quality Gate
→ Commit
→ Push somente com autorização
→ Merge somente com autorização
→ Memory Update
→ Next Phase
```

Cada fase nova deverá ter branch própria identificada no brief, a partir de uma base revisada. A existência de uma branch não autoriza a execução da fase.

O `Codex Validation Report` deverá identificar objetivo e escopo executado, branch e commit de referência, arquivos criados e modificados, resumo do diff, comandos e resultados das validações, evidências dos critérios de aceite, blockers, riscos, decisões pendentes e estado final do Git. Verificações não executadas deverão ser declaradas com justificativa.

Na revisão técnica do ChatGPT:

- `PASS`: critérios de aceite atendidos e evidências suficientes; a fase pode seguir para o Final Quality Gate.
- `PASS WITH FIXES`: correções identificadas; o Codex executa apenas as correções autorizadas e devolve evidências ao ChatGPT. A progressão permanece suspensa até a revisão das correções e aprovação do Final Quality Gate.
- `FAIL`: critérios não atendidos ou bloqueadores relevantes; a fase retorna para correção ou redefinição do brief, sem progressão.

O `Final Quality Gate` confirma revisão técnica favorável, correções requeridas verificadas, validações aplicáveis aprovadas, diff revisado, ausência de segredos e atendimento aos gates do escopo executado. Ele não concede autorização para push, merge, deploy ou outra operação protegida.

As seções 6 e 14 continuam exigindo documentação e registro da sessão atualizados antes de eventual commit. O `Memory Update` ao final do fluxo consolida o resultado efetivamente ocorrido, incluindo revisão, commit, push ou merge quando realizados. Se uma etapa estiver aguardando revisão ou autorização, registrar esse estado e parar no limite autorizado; não presumir sua execução nem deixar de registrar a sessão. Alterações documentais posteriores também ficam sujeitas a diff, validação e versionamento próprios.

Uma instrução explícita do owner para aguardar revisão ou não fazer commit prevalece sobre o passo de commit da seção 6. A fase seguinte só pode começar após encerramento dos gates da fase anterior, definição de seu brief e autorização correspondente; não existe progressão automática.

### Phase Execution Brief obrigatório

O Codex não deve receber instruções abertas como "continue o projeto" como autorização de implementação. Se receber uma instrução sem delimitação suficiente, deverá explicitar o escopo ausente e aguardar um `Phase Execution Brief` antes de implementar uma nova fase.

Cada nova fase deverá possuir um `Phase Execution Brief` preparado sob direção técnica do ChatGPT, com:

- objetivo;
- contexto, incluindo fase, branch prevista e commit/base de referência;
- escopo;
- fora de escopo;
- dependências;
- arquivos/documentos relevantes;
- restrições;
- approval gates, com as autorizações concedidas e as ainda pendentes;
- testes obrigatórios;
- critérios de aceite;
- formato do relatório final.

O brief deverá ser específico e revisável. Dúvidas arquiteturais ou blockers deverão retornar ao ChatGPT e ao owner conforme a decisão necessária, antes da execução dependente.
