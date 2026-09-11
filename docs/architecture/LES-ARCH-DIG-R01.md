# LES-ARCH-DIG-R01 — Arquitetura Técnica Geral da L'Essenc Digital

**Projeto:** L'Essenc Digital
**Documento:** LES-ARCH-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento estabelece a arquitetura técnica geral da primeira operação digital da L'Essenc.

A plataforma será responsável pela comercialização de infoprodutos autorais, começando pelo produto **Plano de Recuperação Capilar Pós-Química**.

A arquitetura deve suportar uma operação inicialmente enxuta, porém construída com fundamentos suficientes para evolução, segurança, observabilidade e crescimento de volume sem exigir reconstrução completa da plataforma.

A simplicidade comercial do MVP não deve ser confundida com simplicidade técnica irresponsável.

---

## 2. Escopo do MVP

A primeira versão deverá possuir:

### Jornada pública

1. Página de vendas.
2. Iniciação do checkout.
3. Integração com Mercado Pago.
4. Página de agradecimento.
5. Confirmação server-side do pagamento.
6. Liberação segura do produto digital.
7. Possibilidade de acesso posterior ao conteúdo adquirido.

### Administração

Painel administrativo para:

- produtos;
- pedidos;
- pagamentos;
- clientes;
- status de entrega;
- indicadores principais;
- auditoria operacional.

### Infraestrutura

A solução deverá incluir:

- frontend;
- backend;
- banco de dados;
- integração de pagamentos;
- armazenamento privado dos produtos digitais;
- observabilidade;
- controles de segurança;
- ambientes separados;
- implantação controlada.

---

## 3. Fora do escopo desta revisão

Este documento não detalha:

- esquema definitivo do banco;
- campos de todas as entidades;
- implementação específica dos webhooks;
- regras detalhadas de autenticação administrativa;
- política completa de segurança;
- infraestrutura final de produção;
- pipeline de CI/CD;
- estratégia detalhada de backup;
- copy da página;
- conteúdo editorial do produto.

Esses temas serão tratados pelos documentos especializados da arquitetura.

---

## 4. Princípios arquiteturais

A arquitetura seguirá os seguintes princípios.

### 4.1 Código próprio

A plataforma será desenvolvida com código próprio.

Não serão utilizados como base:

- WordPress;
- Elementor;
- WooCommerce;
- construtores equivalentes.

Bibliotecas e frameworks podem ser utilizados como infraestrutura de software, desde que não substituam o controle da arquitetura pela L'Essenc.

### 4.2 Baixo acoplamento

Hostinger e Mercado Pago são fornecedores, não o núcleo da arquitetura.

As regras de negócio da L'Essenc não deverão ser implementadas de forma que impossibilite futura substituição desses fornecedores.

### 4.3 Backend como autoridade

O navegador nunca será considerado fonte confiável para:

- pagamento aprovado;
- autorização de acesso;
- preço;
- propriedade de pedido;
- liberação de produto.

Decisões críticas deverão ocorrer no servidor.

### 4.4 Falha segura

Na dúvida:

> não liberar acesso.

Falha de webhook, timeout, inconsistência ou pagamento não confirmado não pode resultar em entrega indevida do conteúdo.

### 4.5 Reversibilidade

Alterações de arquitetura, banco e implantação devem possuir estratégia de recuperação ou rollback proporcional ao risco.

### 4.6 Observabilidade desde o início

Eventos críticos deverão ser rastreáveis.

A operação não deverá depender apenas de relatos de clientes para descobrir falhas de pagamento ou entrega.

---

## 5. Visão macro

A arquitetura será organizada em cinco grandes zonas:

```text
Internet
   │
   ▼
┌──────────────────────────────┐
│       Camada Pública         │
│                              │
│ Página de vendas             │
│ Checkout                     │
│ Página de agradecimento      │
│ Acesso ao produto            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Camada de Aplicação     │
│                              │
│ Regras de negócio            │
│ Pedidos                      │
│ Pagamentos                   │
│ Clientes                     │
│ Autorizações                 │
│ Entrega digital              │
└───────┬───────────┬──────────┘
        │           │
        ▼           ▼
┌────────────┐   ┌────────────────┐
│   Banco    │   │ Armazenamento  │
│ de dados   │   │    privado     │
└────────────┘   └────────────────┘
        ▲
        │
┌───────┴──────────────────────┐
│         Integrações          │
│                              │
│ Mercado Pago                 │
│ Analytics / Meta             │
│ Serviços futuros             │
└──────────────────────────────┘

                +

┌──────────────────────────────┐
│    Painel Administrativo     │
│                              │
│ Produtos                     │
│ Pedidos                      │
│ Clientes                     │
│ Pagamentos                   │
│ Indicadores                  │
│ Auditoria                    │
└──────────────────────────────┘
```

---

## 6. Camada pública

A superfície pública compreenderá inicialmente quatro responsabilidades.

### 6.1 Página de vendas

Responsável por:

- apresentação da oferta;
- conteúdo comercial;
- prova e argumentação permitidas;
- CTA;
- eventos de analytics;
- encaminhamento para checkout.

Não deverá conter lógica crítica de autorização.

### 6.2 Checkout

Responsável por coletar somente as informações necessárias para iniciar a compra.

O servidor deverá determinar ou validar:

- produto;
- preço;
- disponibilidade;
- identificador interno do pedido.

O cliente não poderá determinar unilateralmente o valor cobrado.

### 6.3 Página de agradecimento

A página de agradecimento possui função de experiência do usuário.

Ela **não representa comprovação de pagamento**.

O simples acesso à URL não autoriza entrega.

### 6.4 Acesso ao produto

O acesso ao material deverá depender de uma autorização server-side vinculada a uma compra elegível.

O arquivo original não deverá possuir URL pública permanente.

---

## 7. Backend da L'Essenc

O backend será a autoridade das regras operacionais.

Deverá controlar, entre outros:

- catálogo;
- pedidos;
- clientes;
- pagamentos;
- estados financeiros;
- acesso;
- entrega;
- operações administrativas;
- auditoria.

O backend será responsável por validar todas as transições relevantes.

---

## 8. Modelo conceitual inicial

Sem definir ainda o esquema físico, a plataforma deverá considerar pelo menos as seguintes entidades conceituais:

```text
Product
Customer
Order
OrderItem
Payment
PaymentEvent
Entitlement
DigitalAsset
Delivery
AdminUser
AuditEvent
```

### Product

Representa o produto comercializado.

### Customer

Representa o comprador necessário à execução e suporte da transação.

### Order

Representa a intenção comercial.

### Payment

Representa o estado financeiro conhecido pela L'Essenc.

### PaymentEvent

Registra eventos relevantes recebidos ou consultados no provedor.

### Entitlement

Representa o direito concedido ao comprador.

Essa separação é importante:

> Pedido pago e direito de acesso são conceitos relacionados, mas não devem ser tratados como a mesma coisa.

### DigitalAsset

Representa o arquivo ou conteúdo privado.

### Delivery

Registra geração, uso, expiração ou revogação de mecanismos de entrega.

### AuditEvent

Mantém rastreabilidade das operações administrativas ou críticas.

O esquema definitivo será especificado em `LES-DATA-DIG-R01`.

---

## 9. Arquitetura de pagamento

O Mercado Pago será o provedor inicial.

O fluxo conceitual será:

```text
Cliente
   │
   ▼
L'Essenc cria Order
   │
   ▼
L'Essenc inicia pagamento
   │
   ▼
Mercado Pago
   │
   ├───────────────► Cliente
   │                  │
   │                  ▼
   │            Página de obrigado
   │
   ▼
Webhook / consulta
   │
   ▼
Backend L'Essenc
   │
   ├─ valida autenticidade
   ├─ identifica pagamento
   ├─ verifica estado
   ├─ trata idempotência
   └─ atualiza estado interno
                │
                ▼
          Entitlement
                │
                ▼
          Entrega digital
```

Requisitos fundamentais:

- webhooks tratados como entradas não confiáveis;
- validação de autenticidade quando aplicável;
- idempotência;
- proteção contra eventos duplicados;
- reconciliação entre estado local e provedor;
- rastreabilidade.

O detalhamento ocorrerá em `LES-INT-MP-R01`.

---

## 10. Entrega digital

O PDF e demais materiais não deverão ficar disponíveis em diretório público previsível.

A arquitetura deverá permitir:

- armazenamento privado;
- autorização de acesso;
- geração de acesso temporário;
- expiração;
- revogação;
- auditoria básica;
- futura substituição do mecanismo de armazenamento.

A tecnologia definitiva será escolhida em documento próprio após avaliação da infraestrutura disponível.

---

## 11. Painel administrativo

O painel não será uma aplicação desconectada das regras da plataforma.

Ele deverá utilizar a mesma camada de domínio e serviços autorizados pelo backend.

Áreas iniciais:

```text
Dashboard
├── Produtos
├── Pedidos
├── Pagamentos
├── Clientes
├── Entregas
├── Indicadores
└── Auditoria
```

Toda operação privilegiada deverá passar por autenticação e autorização.

Operações críticas deverão produzir registro de auditoria.

Detalhamento em `LES-ADMIN-DIG-R01`.

---

## 12. Segurança

A segurança será transversal à arquitetura.

Controles mínimos:

- validação de entradas;
- autorização server-side;
- menor privilégio;
- proteção de segredos;
- isolamento de ambientes;
- políticas seguras para cookies e sessões;
- proteção contra acesso direto aos ativos digitais;
- validação de pagamento;
- idempotência;
- rate limiting onde aplicável;
- logs sem vazamento de segredos;
- dependências controladas;
- headers de segurança;
- tratamento de erros sem exposição de detalhes internos;
- auditoria administrativa.

A arquitetura detalhada de segurança será formalizada em `LES-SEC-DIG-R01`.

---

## 13. Observabilidade

Devem existir evidências operacionais suficientes para responder perguntas como:

- o pedido foi criado?
- o pagamento foi iniciado?
- o provedor confirmou?
- o webhook chegou?
- houve erro?
- o direito de acesso foi criado?
- a entrega foi disponibilizada?
- houve tentativa administrativa sobre o pedido?

Logs devem utilizar identificadores técnicos correlacionáveis, evitando exposição desnecessária de dados pessoais.

Detalhamento em `LES-OBS-DIG-R01`.

---

## 14. Analytics

Analytics comercial deverá permanecer separado da autoridade transacional.

Meta Pixel, CAPI ou ferramentas equivalentes podem receber eventos analíticos, porém:

> analytics nunca determina estado financeiro nem autorização de acesso.

Eventos poderão incluir:

- visualização da página;
- início de checkout;
- intenção de compra;
- compra confirmada;
- outros eventos comerciais aprovados.

A definição definitiva será tratada separadamente da camada financeira.

---

## 15. Ambientes

A plataforma deverá evoluir para pelo menos:

```text
Local
Test
Production
```

### Local

Desenvolvimento.

Somente dados fictícios ou controlados.

### Test

Validação de integração, pagamento e comportamento sem comprometer produção.

### Production

Ambiente real.

Credenciais, banco e armazenamento devem permanecer separados dos demais ambientes.

---

## 16. Stack estrutural inicial

O scaffold atual estabelece como direção:

- Node.js;
- TypeScript;
- Next.js;
- pnpm/Corepack;
- banco relacional;
- Git;
- VS Code;
- Codex;
- Mercado Pago.

O banco relacional será especificado formalmente na documentação de dados e infraestrutura antes da implementação persistente.

A infraestrutura inicial de produção deverá ser compatível com a Hostinger, mantendo baixo acoplamento.

---

## 17. Organização lógica do código

A implementação deverá evitar concentração de todas as regras dentro de páginas ou controllers.

Direção estrutural:

```text
src/
├── app/
├── modules/
│   ├── products/
│   ├── customers/
│   ├── orders/
│   ├── payments/
│   ├── entitlements/
│   ├── delivery/
│   └── admin/
├── integrations/
│   ├── payments/
│   ├── storage/
│   └── analytics/
├── infrastructure/
├── security/
├── observability/
└── shared/
```

Esta é uma organização conceitual inicial e poderá ser refinada antes da implementação.

---

## 18. Dependências externas

Dependências externas devem ser encapsuladas.

Exemplo:

```text
Domínio L'Essenc
       │
       ▼
Payment Provider Interface
       │
       ▼
MercadoPagoAdapter
```

Assim, regras de negócio não dependem diretamente da API do Mercado Pago.

A mesma filosofia será aplicada a:

- storage;
- analytics;
- e-mail;
- infraestrutura externa;
- integrações futuras.

---

## 19. Requisitos não funcionais

### Segurança

Falhas críticas devem assumir estado seguro.

### Performance

A página de vendas deve priorizar carregamento rápido e baixo peso.

### Disponibilidade

Falhas de integrações externas não devem corromper o estado interno.

### Integridade

Pedidos e pagamentos devem possuir transições consistentes e auditáveis.

### Manutenibilidade

Código tipado, modular, testável e documentado.

### Escalabilidade

A arquitetura deve permitir aumento de vendas sem exigir reconstrução integral.

### Portabilidade

A dependência de Hostinger e Mercado Pago deverá permanecer restrita às camadas de infraestrutura e integração.

---

## 20. Fluxo de desenvolvimento

Mudanças deverão seguir:

```text
Decisão
   ↓
Documentação
   ↓
Branch
   ↓
Implementação
   ↓
Lint / Typecheck / Test
   ↓
Build
   ↓
Revisão
   ↓
Commit
   ↓
Pull Request
   ↓
Main
```

Mudanças críticas de arquitetura devem atualizar a documentação antes ou junto da implementação.

---

## 21. Documentos derivados

Após aprovação deste documento, serão produzidos:

1. `LES-DATA-DIG-R01` — modelo de dados e estados;
2. `LES-FLOW-DIG-R01` — fluxos funcionais;
3. `LES-INT-MP-R01` — Mercado Pago;
4. `LES-SEC-DIG-R01` — segurança;
5. `LES-ADMIN-DIG-R01` — painel administrativo;
6. `LES-OBS-DIG-R01` — observabilidade;
7. `LES-DEPLOY-DIG-R01` — ambientes e implantação.

---

## 22. Critérios de aceite da arquitetura R01

Esta arquitetura estará aprovada quando houver consenso de que:

- a jornada comercial inicial está contemplada;
- pagamento e agradecimento permanecem desacoplados;
- somente o backend concede acesso;
- arquivos digitais permanecem privados;
- o painel administrativo utiliza controles de autorização;
- fornecedores externos estão encapsulados;
- existe separação entre aplicação, domínio, integrações e infraestrutura;
- segurança e observabilidade fazem parte da arquitetura;
- o escopo permite evolução sem overengineering;
- documentos técnicos subsequentes possuem limites claramente definidos.

---

## 23. Decisão arquitetural central

A primeira versão da L'Essenc Digital será pequena em superfície, mas não será descartável em arquitetura.

O MVP deverá otimizar três objetivos simultaneamente:

1. **entrar em operação rapidamente;**
2. **proteger receita, dados e conteúdo;**
3. **criar fundamentos reutilizáveis pela evolução futura da L'Essenc.**

A plataforma deverá permanecer simples onde simplicidade reduz custo e complexidade, e rigorosa onde falhas podem afetar segurança, dinheiro, acesso ou confiança.
