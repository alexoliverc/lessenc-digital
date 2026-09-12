# LES-ROADMAP-DIG-R01 — Roadmap da L'Essenc Digital até produção

**STATUS: HISTORICAL / SUPERSEDED.** Preservado para o histórico do projeto. Este arquivo não é fonte autoritativa do produto, preço, regras comerciais, ambientes ou roadmap atuais da L'Essenc Digital; consulte [docs/README.md](README.md), os [documentos canônicos P01](product/README.md) e [ROADMAP.md](../ROADMAP.md).

> **Arquivo histórico.** Elaborado antes da missão de consolidação LES-DIG P00–P04. A decisão posterior do owner substituiu a sequência futura `MVP-*`, a definição do primeiro produto e a baseline de ferramenta. Consulte [ROADMAP.md](../ROADMAP.md) para fases e estado atuais, [MEMORY.md](../MEMORY.md) para a situação física e [docs/README.md](README.md) para as especificações. As evidências históricas das fases já realizadas permanecem aqui; esta nota não autoriza implementação.

**Projeto:** L'Essenc Digital
**Documento:** LES-ROADMAP-DIG-R01
**Revisão:** R01
**Data:** 11/09/2026
**Status do documento:** em processo de adoção; aguardando revisão técnica do ChatGPT
**Baseline local:** `4507a27` — `feat: establish MVP foundation scaffold`
**Estado da execução:** pausada por decisão do owner

## 1. Objetivo e limites

Organizar as fases da plataforma própria de infoprodutos até produção e estabilização, com entregas verificáveis, dependências e autorizações explícitas. O primeiro produto permanece o **Plano de Recuperação Capilar Pós-Química**. O ecossistema de cosméticos físicos está fora deste roadmap.

Este documento organiza o trabalho sobre a arquitetura aprovada. Não escolhe novo ORM, não define schema físico e não autoriza implementação, instalação de dependências, banco, migrations, autenticação, pagamentos, infraestrutura ou operações externas.

**O próximo candidato de implementação é `MVP-IMPL-02 — Data & Persistence Foundation`. Sua execução ainda não está autorizada.** Antes dela, o roadmap deve retornar ao ChatGPT para revisão e a fase deve receber um Phase Execution Brief específico e as autorizações aplicáveis do owner.

As três primeiras fases estão concluídas conforme decisão atual do owner e evidências existentes. As demais estão planejadas e não autorizadas. Conclusão técnica de uma fase, commit local, publicação e integração são estados distintos; o commit local atual não é evidência de push ou merge.

## 2. Fontes e compatibilidade com a baseline

Aplicar a precedência de fontes de verdade de [AGENTS.md](../AGENTS.md), incluindo a decisão explícita mais recente do owner. Fontes consultadas:

| Documento | Uso no roadmap |
| --- | --- |
| [MEMORY.md](../MEMORY.md) e [registro de 11/09/2026](../memory/2026-09-11.md) | Estado consolidado, decisões e evidências históricas de execução. |
| [LES-ARCH-DIG-R01](architecture/LES-ARCH-DIG-R01.md) | Arquitetura modular, backend como autoridade e baixo acoplamento. |
| [LES-DATA-DIG-R01](architecture/LES-DATA-DIG-R01.md) | Modelo lógico, dinheiro exato, estados, histórico e consistência. |
| [LES-FLOW-DIG-R01](architecture/LES-FLOW-DIG-R01.md) | Fluxos e transições; lacuna documental registrada na seção 7 deste roadmap. |
| [LES-INT-MP-R01](architecture/LES-INT-MP-R01.md) | Adapter, idempotência, webhooks e reconciliação financeira. |
| [LES-SEC-DIG-R01](architecture/LES-SEC-DIG-R01.md) | Segurança transversal e objetivo de verificação ASVS Level 2. |
| [LES-ADMIN-DIG-R01](architecture/LES-ADMIN-DIG-R01.md) | Painel, permissões, comandos operacionais e auditoria. |
| [LES-OBS-DIG-R01](architecture/LES-OBS-DIG-R01.md) | Logs, métricas, correlação, alertas e evidências operacionais. |
| [LES-DEPLOY-DIG-R01](architecture/LES-DEPLOY-DIG-R01.md) | Hostinger Cloud Startup, Node.js/Next.js, alvo MySQL, ambientes e recuperação. |
| [LES-READINESS-DIG-R01](architecture/LES-READINESS-DIG-R01.md) | Conclusão de MVP-ARCH-01 e autorização histórica do scaffold. |
| [Produto e oferta](product/README.md) | Documentos comerciais ainda a incorporar e aprovar antes das fases dependentes. |

O escopo inicial do readiness incluía estrutura de banco, ORM e CI na MVP-IMPL-01. A decisão mais recente do owner encerra a MVP-IMPL-01 no scaffold entregue em `4507a27` e organiza persistência na MVP-IMPL-02. CI não é declarado entregue: sua preparação operacional está prevista em MVP-OPS-01, com validação no ambiente em MVP-DEPLOY-01. Essa atualização de planejamento não amplia a autorização histórica do scaffold.

O alvo MySQL e a infraestrutura inicial permanecem os da baseline; escolha de ORM, configuração física e provisionamento exigem os gates próprios. Neste roadmap, **staging significa homologação no ambiente TEST já aprovado**, preservando LOCAL, TEST e PRODUCTION.

## 3. Modelo operacional e gates comuns

O modelo adotado é **ChatGPT → Codex → ChatGPT review**, formalizado na seção 15 de [AGENTS.md](../AGENTS.md).

- **ChatGPT:** direção técnica, arquitetura, planejamento, escopo, critérios de aceite, approval gates, revisão dos resultados, classificação PASS / PASS WITH FIXES / FAIL e definição da próxima fase.
- **Codex:** execução técnica limitada ao escopo autorizado na branch da fase, alteração de arquivos, implementação quando autorizada, validações, evidências e relato de blockers.
- **Owner:** autorizações explícitas para as operações protegidas por AGENTS.md. Parecer técnico favorável não substitui essas autorizações.

O fluxo obrigatório é:

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

Os seguintes gates comuns aplicam-se às fases futuras e complementam os gates específicos descritos em cada fase:

1. **Especificação:** Phase Execution Brief com objetivo, contexto, escopo, fora de escopo, dependências, arquivos/documentos relevantes, restrições, approval gates, testes obrigatórios, critérios de aceite e formato do relatório final. Identificar branch, base revisada e autorizações abrangidas. Instruções abertas como "continue o projeto" não são autorização de fase.
2. **Autorização do owner:** registrar as autorizações antes de executar operações protegidas. Isso inclui dependências, arquitetura, schema/migrations, autenticação/autorização, pagamentos/webhooks, infraestrutura/DNS/domínio/deploy, comandos com efeito externo, configurações fora do repositório e operações Git protegidas. Autorizações existentes valem somente para seu escopo; o roadmap não concede nenhuma delas.
3. **Validação do Codex:** executar lint, formatação, typecheck, testes, build e verificações de segurança aplicáveis; revisar diff completo, verificar segredos e executar `git diff --check`. Registrar evidências, falhas, checks não executados e justificativas. Mudanças exclusivamente documentais têm validação proporcional ao escopo.
4. **Revisão do ChatGPT e Final Quality Gate:** retornar o resultado ao ChatGPT antes da progressão. PASS permite avaliar o gate final; PASS WITH FIXES exige correções e revisão das evidências; FAIL exige correção ou redefinição do brief. O gate final exige critérios atendidos, correções verificadas e ausência de bloqueadores. A revisão do próprio Codex não substitui esse retorno.
5. **Versionamento e memória:** commit somente após o gate final e respeitando instruções do owner; push e merge somente quando explicitamente autorizados. Atualizar documentação e registro da sessão antes de eventual commit, consolidando depois os resultados efetivamente ocorridos. Etapas pendentes não são presumidas concluídas. A próxima fase depende de novo brief e autorização correspondente.

## 4. Visão das fases

| Fase | Nome | Status em 11/09/2026 |
| --- | --- | --- |
| GOV-01 | Project Governance & Repository Bootstrap | Concluída |
| MVP-ARCH-01 | Architecture Baseline | Concluída |
| MVP-IMPL-01 | Foundation & Project Scaffold | Concluída |
| MVP-IMPL-02 | Data & Persistence Foundation | Próximo candidato; não autorizada |
| MVP-IMPL-03 | Core Domain & Application Services | Planejada; não autorizada |
| MVP-IMPL-04 | Public Sales Experience | Planejada; não autorizada |
| MVP-IMPL-05 | Checkout & Order Creation | Planejada; não autorizada |
| MVP-IMPL-06 | Mercado Pago Integration | Planejada; não autorizada |
| MVP-IMPL-07 | Entitlement & Secure Digital Delivery | Planejada; não autorizada |
| MVP-IMPL-08 | Admin, Authentication & Authorization | Planejada; não autorizada |
| MVP-IMPL-09 | Analytics, Attribution & Growth Infrastructure | Planejada; não autorizada |
| MVP-SEC-01 | Security Hardening | Planejada; não autorizada |
| MVP-OPS-01 | Observability, Backup & Operational Readiness | Planejada; não autorizada |
| MVP-DEPLOY-01 | Staging Deployment | Planejada; não autorizada |
| MVP-QA-01 | End-to-End Validation | Planejada; não autorizada |
| MVP-QA-02 | Production Readiness Review | Planejada; não autorizada |
| MVP-PROD-01 | Production Launch | Planejada; não autorizada |
| MVP-PROD-02 | Stabilization | Planejada; não autorizada |

## 5. Definição das fases

### GOV-01 — Project Governance & Repository Bootstrap

- **Objetivo:** estabelecer regras, memória e base de trabalho rastreável no repositório.
- **Escopo:** governança do agente, organização documental, ambiente Windows/VS Code/Codex/Git e bootstrap local.
- **Principais entregas:** AGENTS.md, MEMORY.md, registros diários, configuração inicial do editor, script de bootstrap, documentação de conectividade e baseline Git.
- **Dependências:** decisões iniciais do owner sobre produto, plataforma própria e separação da operação digital.
- **Approval gates:** revisão da governança e autorizações históricas para configuração externa e publicação do baseline; esses atos não autorizam novas operações.
- **Critérios de saída:** repositório utilizável, regras de segurança e autonomia registradas, memória operacional estabelecida e baseline versionado. Evidências no registro diário, incluindo o commit inicial `0a12083`.
- **Status:** concluída. A formalização atual complementa a governança e aguarda revisão documental.

### MVP-ARCH-01 — Architecture Baseline

- **Objetivo:** definir arquitetura suficiente para implementação incremental do MVP.
- **Escopo:** arquitetura geral, dados e estados, fluxos, Mercado Pago, segurança, admin, observabilidade e deploy.
- **Principais entregas:** oito documentos de arquitetura e LES-READINESS-DIG-R01 com resultado PASS.
- **Dependências:** GOV-01 e escopo inicial do produto definidos.
- **Approval gates:** revisão e aprovação da baseline; autorização histórica limitada ao início de MVP-IMPL-01 após integração à main. Mudanças futuras da arquitetura continuam protegidas.
- **Critérios de saída:** baseline aprovada, invariantes registradas e arquitetura integrada à main antes do scaffold, conforme histórico operacional. A lacuna atual no arquivo de fluxos exige tratamento antes das regras dependentes, sem apagar a aprovação histórica.
- **Status:** concluída, conforme decisão do owner e readiness registrado.

### MVP-IMPL-01 — Foundation & Project Scaffold

- **Objetivo:** entregar a fundação técnica executável antes dos módulos de negócio.
- **Escopo:** Next.js/React, TypeScript estrito, estrutura modular, configuração de ambiente validada, logging inicial, health endpoint e quality gates locais.
- **Principais entregas:** scaffold no commit `4507a27`, página raiz mínima, `GET /api/health`, teste inicial e comandos de lint, formatação, typecheck e build.
- **Dependências:** MVP-ARCH-01 integrada à main; branch `phase/mvp-impl-01-foundation` criada da base `36508de`.
- **Approval gates:** autorização histórica do Foundation Batch 01 e validação documentada; banco, ORM, migrations, autenticação, integração financeira e infraestrutura externa permaneceram fora do lote.
- **Critérios de saída:** evidências históricas de Prettier, ESLint, TypeScript, Vitest (1 teste), build de produção e diff check aprovados; smoke test local de health com HTTP 200 e `Cache-Control: no-store`, seguido de encerramento do servidor.
- **Status:** concluída no commit local `4507a27`. Esta rodada documental não reexecuta os testes da aplicação nem afirma publicação ou integração desse commit.

### MVP-IMPL-02 — Data & Persistence Foundation

- **Objetivo:** preparar persistência consistente e testável sobre o modelo lógico aprovado.
- **Escopo:** detalhamento físico para MySQL, decisão de ORM/camada de acesso, configuração local e de teste, schema e migrations iniciais, integridade referencial, unicidade, representação exata de dinheiro, timestamps e limites transacionais. Preservar separação entre Order, Payment, Entitlement e Delivery.
- **Principais entregas:** decisão técnica revisada de persistência, mapeamento lógico/físico, repositórios básicos, migrations versionadas, dados fictícios de teste, evidências de integridade e procedimento de recuperação não produtivo.
- **Dependências:** MVP-IMPL-01 concluída, base da fase revisada, LES-DATA/SEC/DEPLOY, brief próprio e esclarecimento de lacunas de fluxos que afetem estados ou restrições.
- **Approval gates:** gates comuns; autorização explícita para ORM/dependências, schema, migrations e criação/configuração do banco no ambiente identificado. Mudança do alvo MySQL exige revisão e autorização arquitetural. Nenhum provisionamento produtivo está incluído implicitamente.
- **Critérios de saída:** modelo físico aprovado; migrations aplicáveis em banco não produtivo autorizado; precisão financeira, relações, unicidade e comportamento transacional verificados; rollback de transação e recuperação documentados; segredos protegidos; quality gates e revisão técnica aprovados.
- **Status:** próximo candidato de implementação; **execução ainda não autorizada**. Nenhum banco, ORM, schema ou migration deve ser criado nesta rodada.

### MVP-IMPL-03 — Core Domain & Application Services

- **Objetivo:** centralizar regras de negócio e transições em serviços testáveis.
- **Escopo:** produtos, clientes, pedidos e contratos de pagamento, entitlement e entrega; invariantes, comandos de aplicação, coordenação transacional, idempotência e auditoria apropriadas. Usar interfaces e doubles de teste para integrações ainda não implementadas.
- **Principais entregas:** serviços de domínio/aplicação, contratos de repositórios e adapters, catálogo de transições permitidas e negadas e testes das invariantes críticas.
- **Dependências:** MVP-IMPL-02 aprovada; LES-DATA/ARCH/FLOW/INT-MP; lacunas de especificação das transições resolvidas pelo ChatGPT antes da implementação dependente.
- **Approval gates:** gates comuns; autorização específica para implementar regras de pagamento e autorização de acesso, mesmo sem integração externa. Alterações adicionais de schema exigem gate próprio.
- **Critérios de saída:** transições inválidas negadas, dinheiro calculado no servidor, histórico preservado, duplicidade/concorrência e falhas parciais cobertas por testes, domínio desacoplado de fornecedor e erros relevantes observáveis; revisão técnica aprovada.
- **Status:** planejada; não autorizada.

### MVP-IMPL-04 — Public Sales Experience

- **Objetivo:** apresentar a oferta aprovada em uma jornada pública clara e acessível.
- **Escopo:** página de vendas, navegação e CTA para o checkout futuro, responsividade, acessibilidade, metadados e desempenho. Conteúdo educativo sem promessas de cura, resultado garantido ou reversão total de danos.
- **Principais entregas:** experiência pública coerente com produto e copy aprovados, estados visuais e evidências de validação em telas representativas.
- **Dependências:** MVP-IMPL-03; documentos de produto/oferta/copy incorporados e aprovados em docs/product/. O scaffold não representa aprovação da oferta final.
- **Approval gates:** gates comuns; aceite da oferta e copy pelo owner e revisão técnica da experiência. Novos pacotes ou serviços de terceiros exigem autorização própria.
- **Critérios de saída:** conteúdo corresponde à oferta aprovada, CTA e navegação coerentes com a disponibilidade real do checkout, navegação por teclado e estados acessíveis verificados, critérios de desempenho do brief atendidos, sem acesso público aos arquivos digitais; revisão técnica aprovada.
- **Status:** planejada; não autorizada.

### MVP-IMPL-05 — Checkout & Order Creation

- **Objetivo:** transformar a intenção de compra em pedido válido no backend.
- **Escopo:** formulário mínimo, validação server-side, preço/moeda/disponibilidade determinados no servidor, Customer/Order/OrderItem, snapshot da compra e proteção contra envios repetidos. Preparar consulta segura do estado do pedido e experiência de agradecimento, sem cobrança externa nesta fase.
- **Principais entregas:** checkout, criação de pedido, contratos para início posterior do pagamento, estados de erro/pendência e testes de manipulação de entrada.
- **Dependências:** MVP-IMPL-02/03/04; regras aprovadas de checkout, identidade/propriedade da consulta e políticas comerciais aplicáveis.
- **Approval gates:** gates comuns; aprovação das regras comerciais e autorização para controles de autorização/propriedade do pedido. Dependências e alterações de schema, se necessárias, recebem gates específicos.
- **Critérios de saída:** adulteração de preço/produto negada, dados minimizados, snapshot correto, duplo envio tratado conforme regra aprovada, consulta de pedido de terceiro bloqueada e nenhuma liberação pela página de agradecimento; testes e revisão técnica aprovados.
- **Status:** planejada; não autorizada.

### MVP-IMPL-06 — Mercado Pago Integration

- **Objetivo:** implementar processamento financeiro verificável e recuperável via adapter.
- **Escopo:** criação e consulta de pagamentos, normalização de estados, assinatura e processamento de webhooks, idempotência, retries seguros, timeout como resultado potencialmente desconhecido, reconciliação e eventos de reembolso/chargeback conforme regras aprovadas.
- **Principais entregas:** adapter Mercado Pago, serviços de pagamento/webhook/reconciliação, registros de eventos, testes de contrato e de falha, documentação de configuração por ambiente sem segredos.
- **Dependências:** MVP-IMPL-02/03/05; LES-INT-MP/FLOW/SEC/OBS; modalidade/API/SDK e estados compatíveis revisados antes de codificar. Recursos de teste do provedor dependem de disponibilidade e autorização.
- **Approval gates:** gates comuns; autorização explícita para pagamentos, webhooks, SDK/dependências e chamadas externas de teste. Qualquer endpoint público, túnel ou provisionamento antecipado exige autorização própria; não é presumido nesta fase.
- **Critérios de saída:** evidências locais e de contrato para aprovação, pendência, rejeição, assinatura inválida, duplicidade, concorrência, timeout e reconciliação; estados desconhecidos falham sem conceder acesso; segredos não expostos e erro financeiro rastreável. Integração real de webhook hospedado fica explicitamente pendente para DEPLOY-01/QA-01, sem ser declarada validada por simulações.
- **Status:** planejada; não autorizada.

### MVP-IMPL-07 — Entitlement & Secure Digital Delivery

- **Objetivo:** entregar o produto somente ao comprador com direito válido e permitir acesso posterior seguro.
- **Escopo:** concessão idempotente após confirmação financeira válida, recuperação de falhas entre pagamento e acesso, revogação conforme política, ativos privados, entrega temporária individual, expiração, reemissão controlada e verificação de propriedade do comprador.
- **Principais entregas:** serviços de entitlement/delivery, adapter de storage, fluxo de acesso inicial e posterior, testes de acesso indevido e falhas de entrega, auditoria e rastreabilidade.
- **Dependências:** MVP-IMPL-02/03/06; LES-DATA/INT-MP/SEC/DEPLOY; escolha de storage privado, mecanismo de identificação do comprador e política de validade/reemissão/revogação aprovados. Produto digital e materiais finais precisam estar disponíveis para homologação.
- **Approval gates:** gates comuns; autorização explícita para controles de acesso, efeitos ligados a pagamentos/reembolso e dependências. Storage, canais externos de entrega e seu provisionamento exigem autorização específica. A segurança do comprador deve existir nesta fase, independentemente do admin posterior.
- **Critérios de saída:** acesso sem origem financeira válida ou com direito revogado/expirado negado; arquivo original inacessível publicamente; tokens individuais protegidos e temporários; revogação e reemissão testadas conforme política; duplicidade não multiplica direitos; falhas de storage/concessão são detectáveis e recuperáveis.
- **Status:** planejada; não autorizada.

### MVP-IMPL-08 — Admin, Authentication & Authorization

- **Objetivo:** disponibilizar operação administrativa segura sobre os serviços de domínio.
- **Escopo:** autenticação individual, MFA, sessões seguras e revogáveis, matriz OWNER/ADMIN/SUPPORT, dashboard, produtos/ativos, pedidos, pagamentos, clientes, acessos, entregas, auditoria e configurações do MVP.
- **Principais entregas:** painel com APIs protegidas, filtros/paginação no servidor, comandos críticos explícitos com confirmação e auditoria, gestão de contas e testes de permissões. Reembolso iniciado pelo painel só entra se incluído expressamente no brief aprovado.
- **Dependências:** MVP-IMPL-03/06/07; LES-ADMIN/SEC/OBS; estratégia de autenticação, recuperação, MFA e permissões detalhadas e aprovadas.
- **Approval gates:** gates comuns; autorização explícita para autenticação/autorização, dependências e comandos financeiros ou de revogação. Contas e serviços externos dependem de autorização específica.
- **Critérios de saída:** cada operação verifica permissão server-side; SUPPORT não executa ações financeiras privilegiadas; MFA e ciclo de sessão validados; nenhuma edição arbitrária de estado financeiro; uploads seguros/privados, histórico e auditoria preservados; analytics publicitário desativado no admin.
- **Status:** planejada; não autorizada.

### MVP-IMPL-09 — Analytics, Attribution & Growth Infrastructure

- **Objetivo:** medir a jornada e atribuição comercial com separação da autoridade financeira.
- **Escopo:** plano de eventos, UTMs, atribuição, métricas de funil, deduplicação e contratos/adapters de analytics. Meta Pixel/CAPI ou outro serviço apenas conforme plano aprovado, com minimização de dados e regras de consentimento/privacidade definidas.
- **Principais entregas:** dicionário de eventos, captura de atribuição, integração analítica autorizada, testes de deduplicação e comparações documentadas com receita confirmada internamente.
- **Dependências:** MVP-IMPL-04/05/06/07/08; diretrizes LES-ARCH/SEC/OBS e plano de mensuração aprovado. Credenciais/contas de terceiros e eventual persistência adicional são dependências explícitas.
- **Approval gates:** gates comuns; owner aprova ferramentas, dados enviados e política aplicável; dependências, schema e chamadas/configurações externas exigem autorização. Compra de tráfego e campanhas não são autorizadas por esta fase.
- **Critérios de saída:** evento de compra vinculado à confirmação server-side, duplicidade controlada, UTMs tratadas como entrada não confiável, ausência de tokens/segredos/dados administrativos nos eventos e falha de analytics sem corromper compra ou entrega; revisão técnica aprovada.
- **Status:** planejada; não autorizada.

### MVP-SEC-01 — Security Hardening

- **Objetivo:** verificar e endurecer os controles de segurança construídos ao longo das fases.
- **Escopo:** revisão de ameaças, autorização, sessão/MFA, CSRF, XSS, injection, IDOR/BOLA, SSRF, uploads, rate limiting, headers/CSP, dependências, segredos e exposição de erros/arquivos.
- **Principais entregas:** matriz de verificação baseada em LES-SEC e ASVS Level 2, achados priorizados, correções autorizadas e testes de regressão. Planejar teste dedicado no ambiente TEST para QA-01.
- **Dependências:** MVP-IMPL-02 a MVP-IMPL-09; brief com superfícies e escopo de verificação delimitados.
- **Approval gates:** gates comuns; correções que afetem autenticação, pagamentos, schema, dependências ou arquitetura mantêm gates próprios. Varredura/teste em sistemas externos exige autorização do owner sobre os alvos.
- **Critérios de saída:** controles obrigatórios verificados no escopo disponível, sem bloqueadores críticos de segurança; achados residuais com tratamento e decisão registrados; testes aplicáveis aprovados e itens exclusivos do ambiente explicitamente remetidos a QA-01. Não declarar conformidade ASVS apenas por adotar a referência.
- **Status:** planejada; não autorizada.

### MVP-OPS-01 — Observability, Backup & Operational Readiness

- **Objetivo:** preparar diagnóstico, recuperação e operação antes da implantação de homologação.
- **Escopo:** consolidar logs/métricas/correlação, liveness/readiness, detectores de inconsistência, alertas acionáveis, jobs recuperáveis, procedimentos de incidente, backup/restore, rollback e preparação dos quality gates de CI.
- **Principais entregas:** instrumentação operacional, runbooks, plano de backup/retenção e recuperação, inventário seguro de configuração, checklist de deploy, definições de CI revisáveis e plano de validação no ambiente TEST.
- **Dependências:** fases de implementação e MVP-SEC-01; LES-OBS/DEPLOY/SEC; capacidades de banco/storage/hospedagem e responsáveis operacionais identificados.
- **Approval gates:** gates comuns; autorização específica para dependências, integrações de monitoramento, CI remoto, jobs e infraestrutura. Políticas de retenção, acesso, perda aceitável de dados (RPO) e tempo de recuperação (RTO) devem ser revisadas com o owner conforme evidência, sem valores presumidos.
- **Critérios de saída:** falhas críticas simuladas geram sinais seguros, sem segredos; alertas têm destinatário e procedimento definidos; backup/restore e rollback ensaiados em ambiente não produtivo autorizado, com tempos medidos; plano de CI completo e limitações do provedor registradas. Ativação e ensaio da configuração hospedada ficam em DEPLOY-01.
- **Status:** planejada; não autorizada.

### MVP-DEPLOY-01 — Staging Deployment

- **Objetivo:** disponibilizar versão revisada no ambiente TEST para homologação integrada.
- **Escopo:** implantação controlada de aplicação, banco, storage e configurações isoladas; migrations revisadas, HTTPS, endpoint de webhook de teste, CI/checks, monitoramento, backup/restore e rollback no ambiente hospedado.
- **Principais entregas:** TEST operacional com commit identificável, configuração sem segredos no Git, evidências de build/runtime, smoke tests, isolamento e ensaios operacionais.
- **Dependências:** MVP-SEC-01 e MVP-OPS-01; implementação integrada por operações Git autorizadas; plano de implantação, acessos e recursos de TEST aprovados. Staging corresponde ao TEST existente, sem novo ambiente arquitetural.
- **Approval gates:** gates comuns; autorização explícita para deploy, infraestrutura, banco/migrations, domínio/DNS quando necessários, configuração de webhook e comandos externos. Push e merge continuam independentes da autorização de deploy.
- **Critérios de saída:** commit implantado corresponde ao revisado, checks e build passam, health/readiness e páginas respondem, recursos de teste isolados de produção, recepção de webhook de teste demonstrada, monitoramento e backup/restore/rollback do ambiente verificados; ambiente apto ao QA completo.
- **Status:** planejada; não autorizada.

### MVP-QA-01 — End-to-End Validation

- **Objetivo:** demonstrar a jornada completa e a recuperação de falhas em TEST.
- **Escopo:** compra até acesso, múltiplas tentativas, aprovação/pendência/rejeição, duplicidade e concorrência, webhook inválido/atrasado, reconciliação, reembolso/chargeback, revogação, reemissão, operação administrativa, analytics e segurança no ambiente.
- **Principais entregas:** matriz E2E rastreável ao brief, evidências por cenário, relatório do teste de segurança dedicado, defeitos/correções e resultados de reteste. Cenários sem suporte no sandbox terão simulação controlada e limitação declarada.
- **Dependências:** MVP-DEPLOY-01; conteúdo e políticas comerciais aprovados, contas/dados fictícios e condições de teste definidas.
- **Approval gates:** gates comuns; autorização das operações externas de teste e dos alvos de segurança; correções protegidas exigem autorização do respectivo escopo. Não usar credenciais produtivas nem executar cobranças reais nesta fase.
- **Critérios de saída:** cenários críticos aprovados, sem entrega indevida ou duplicação financeira; isolamento e controles de acesso confirmados; sinais operacionais úteis; defeitos bloqueadores corrigidos e revalidados. Diferenciar evidência real do sandbox, simulação e limitações para revisão em QA-02.
- **Status:** planejada; não autorizada.

### MVP-QA-02 — Production Readiness Review

- **Objetivo:** decidir se há evidência suficiente para propor o lançamento ao owner.
- **Escopo:** revisão consolidada de funcionalidade, segurança, operação, oferta/conteúdo, privacidade/termos aplicáveis, suporte/reembolso, ambiente, backup/restore, rollback, monitoramento e plano de lançamento gradual.
- **Principais entregas:** checklist de readiness, parecer técnico do ChatGPT, riscos residuais e decisões, versão candidata identificada, responsáveis e janela de lançamento/estabilização propostos.
- **Dependências:** MVP-QA-01 aprovada; decisões comerciais e operacionais pendentes resolvidas; plano produtivo revisável, credenciais disponíveis por mecanismo seguro e recuperação ensaiada.
- **Approval gates:** gates comuns; ChatGPT classifica PASS / PASS WITH FIXES / FAIL. O owner decide sobre riscos e autorização explícita de lançamento, deploy e efeitos reais; readiness favorável não executa nem autoriza automaticamente esses atos.
- **Critérios de saída:** critérios de produção atendidos, bloqueadores encerrados, limitações de teste avaliadas, plano de contenção/rollback praticável, suporte e responsáveis definidos, parecer final favorável. Verificações que só podem ocorrer em produção ficam delimitadas no brief de lançamento antes da abertura de tráfego.
- **Status:** planejada; não autorizada.

### MVP-PROD-01 — Production Launch

- **Objetivo:** colocar a plataforma em operação real com liberação gradual e monitorada.
- **Escopo:** deploy produtivo da versão revisada, migrations autorizadas, configuração segura por ambiente, validação de domínio/DNS/HTTPS, pagamentos/webhook de produção, storage privado, smoke tests e transações reais controladas aprovadas.
- **Principais entregas:** produção com commit identificável, registro de implantação, evidências do fluxo financeiro e de entrega, observação inicial, responsáveis por suporte e condições de interrupção do lançamento.
- **Dependências:** MVP-QA-02 favorável, Final Quality Gate concluído, código integrado à main por operações autorizadas, autorização explícita de lançamento e plano de recuperação pronto.
- **Approval gates:** gates comuns; owner autoriza deploy, banco/migrations produtivas, DNS/domínio, configuração financeira, efeitos externos e transações reais delimitadas. Nenhuma tag, campanha, push ou merge é presumido autorizado pelo nome da fase.
- **Critérios de saída:** produção isolada e saudável, backup/monitoramento ativos, MFA administrativo validado, pagamento real controlado confirmado server-side com entitlement e entrega corretos; rollback/kill switches disponíveis; observação inicial sem bloqueadores e aceite técnico para estabilização.
- **Status:** planejada; não autorizada.

### MVP-PROD-02 — Stabilization

- **Objetivo:** consolidar confiabilidade com evidências da operação inicial.
- **Escopo:** acompanhamento de erros, latência, pagamentos, reconciliação, entrega, suporte e segurança; correções delimitadas; revisão de alertas, capacidade, backups e procedimentos. Não inclui expansão automática de produto ou infraestrutura.
- **Principais entregas:** relatório de estabilização, incidentes e correções rastreados, baseline operacional medida, runbooks atualizados e backlog priorizado para revisão do ChatGPT.
- **Dependências:** MVP-PROD-01; janela de observação e critérios de estabilidade definidos no brief com o owner, responsáveis e sinais operacionais disponíveis.
- **Approval gates:** gates comuns; cada correção, deploy, alteração financeira, de acesso ou infraestrutura respeita sua autorização. A autorização de lançamento não é permissão irrestrita de operação ou crescimento.
- **Critérios de saída:** janela acordada observada, sem incidentes críticos abertos ou divergências financeiras/de acesso sem tratamento; recuperação e suporte operantes; métricas e limites revisados com dados reais; relatório aceito pelo ChatGPT e próxima etapa definida em novo brief.
- **Status:** planejada; não autorizada.

## 6. Dependências transversais e progressão

A sequência da seção 4 é a ordem planejada de progressão. Antecipação ou paralelismo que altere escopo, dependências ou arquitetura requer revisão do ChatGPT e autorização do owner quando aplicável; o Codex não reorganiza fases por conta própria.

Segurança, observabilidade e auditoria acompanham cada superfície desde sua implementação. MVP-SEC-01 e MVP-OPS-01 consolidam esses controles; não adiam validação server-side, idempotência, proteção de acesso ou logs seguros.

A construção dos contratos de domínio em MVP-IMPL-03 e os testes da integração em MVP-IMPL-06 não exigem que produção ou um webhook público já existam. Evidências dependentes do ambiente hospedado serão completadas em MVP-DEPLOY-01 e MVP-QA-01. Qualquer infraestrutura de teste antecipada depende de autorização explícita.

O acesso seguro do comprador faz parte de MVP-IMPL-05/07 quando aplicável e não aguarda o painel administrativo da MVP-IMPL-08. Nenhuma superfície que manipule recurso de um comprador poderá ser exposta sem autorização server-side.

Datas, custos, duração de fases, metas de desempenho e tolerâncias operacionais serão definidos nos briefs com base em evidência. Este roadmap não cria compromissos de prazo, novas dependências ou fornecedores adicionais.

## 7. Pendências e conflitos documentais para revisão

| Pendência ou divergência | Tratamento e momento de resolução |
| --- | --- |
| LES-READINESS-DIG-R01 incluía banco, ORM e CI no escopo inicial de MVP-IMPL-01. | A decisão atual do owner prevalece: scaffold concluído; dados em MVP-IMPL-02; preparação de CI em MVP-OPS-01 e validação hospedada em MVP-DEPLOY-01. Documento histórico preservado. |
| LES-FLOW-DIG-R01 termina na seção 25, em `compar`, com bloco de código sem fechamento. | Registrar lacuna de integridade documental para o ChatGPT confirmar/complementar sob escopo próprio antes de implementar estados, restrições ou fluxos dependentes. Não reconstruir regras nesta rodada nem reclassificar a fase histórica sem revisão. |
| README.md atribui ao Codex planejamento e revisão amplos; índices documentais ainda descrevem documentos como futuros. | A decisão atual e a seção 15 de AGENTS.md regem os papéis. Harmonização editorial desses arquivos fica pendente de escopo próprio; eles não autorizam progressão. |
| Oferta, copy, manuscrito final e políticas ainda não estão incorporados em docs/product/. | Incorporar e aprovar antes das fases dependentes, começando por MVP-IMPL-04/05; conteúdo final e suporte/reembolso necessários para homologação e go-live. |
| ORM, modelo físico, representação do dinheiro, índices e identidade/unicidade de comprador precisam detalhamento. | Resolver no brief e nos gates de MVP-IMPL-02 e das regras dependentes, preservando o alvo MySQL aprovado. |
| Provedor de storage, identidade para acesso posterior e política de entrega permanecem pendentes. | Decisão e autorização antes da implementação dependente em MVP-IMPL-07; provisionamento e efeitos externos têm gates separados. |
| Domínio, credenciais por ambiente, configuração final de banco, retenção/backup, RPO/RTO e canais operacionais precisam confirmação. | Resolver progressivamente nos briefs de integração, operação e deploy; revisar evidências em MVP-QA-02. Não registrar valores secretos na documentação. |

## 8. Próximo movimento autorizado nesta rodada

Criar e revisar este roadmap, acrescentar o modelo operacional a AGENTS.md e atualizar MEMORY.md e memory/2026-09-11.md. Validar o diff documental e apresentar o relatório ao owner para retorno ao ChatGPT.

**Parar ao final e aguardar revisão. Não fazer commit, push, merge, rebase ou tags. Não iniciar MVP-IMPL-02.** Sua candidatura no roadmap não autoriza Data & Persistence.
