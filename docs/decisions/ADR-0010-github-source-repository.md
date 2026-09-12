# ADR-0010 — GitHub como repositório de origem

**Status:** ACCEPTED — baseline documental P00/P02, 11/09/2026.

**Decisão:** GitHub privado é repositório fonte; `main` representa código integrado/revisado e branches de fase concentram execução. Commits são identificáveis e reviews precedem promoção e deploy; segredos fora do Git.

**Consequência:** push, merge, rebase e tags continuam sujeitos aos gates de [AGENTS.md](../../AGENTS.md), salvo autorização explícita e delimitada do owner. Não houve push ou merge nesta consolidação.
