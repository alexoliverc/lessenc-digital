# ADR-0006 — Hostinger managed Node primeiro

**Status:** ACCEPTED — baseline documental P02, 11/09/2026.

**Decisão:** Hostinger managed Node/Web App hospeda inicialmente a aplicação Next.js. Banco e assets devem ser recuperáveis e desacoplados; sem Kubernetes no MVP sem evidência. Separar deploy, rollback de app e recuperação de dados.

**Consequência:** operação inicial mais simples, portabilidade mantida. Infraestrutura e deploy físicos não foram autorizados nesta consolidação. [Detalhes](../architecture/deployment-architecture.md).
