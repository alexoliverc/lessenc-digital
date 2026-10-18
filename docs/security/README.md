# Segurança LES-DIG

- [Arquitetura de segurança P02](security-architecture.md): invariantes e superfícies de confiança.
- [Baseline de aplicação P04](application-security-baseline.md): controles e testes planejados.
- [P14 Security Hardening — final gate](p14-security-hardening-candidate.md):
  implementação P14-01–P14-06, correções R1/R2, evidências, findings, hosted CI, merge canônico,
  checkpoint permanente e limites explicitamente deferidos a P15–P17.
- [P16-07 Hosted Security Validation](p16-hosted-security-validation.md): inventário, TLS/headers,
  auth/readiness, disclosure, isolamento, negativos controlados e remediação dos dois findings
  externos de staging; COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED.
- [LES-SEC-RA-001](les-sec-ra-001-temporary-braces-risk-acceptance.md): aceitação temporária,
  hoje encerrada e preservada como registro histórico, do advisory `GHSA-vfj7-8cjw-p6xm` em
  `braces@3.0.3`.
- [LES-SEC-RA-001 — remediação mantida](les-sec-ra-001-braces-remediation.md): patch vendorizado,
  fixado por commit e hashes, auditoria completa sem findings e evaluator fail-closed; remove apenas
  o hard stop deste risco e não concede autorização de produção.
- [P18-02 Security Controls & Gap Matrix](p18-02-security-controls-gap-matrix-r01.md): revisão
  preparatória dos controles e gaps, transporte das 15 pendências P17 e dos 31 riscos/bloqueadores,
  sem novo PASS técnico ou autorização de produção.
- [Revisão histórica extensa](../architecture/LES-SEC-DIG-R01.md): referência anterior, válida apenas onde compatível com a decisão LES-DIG P00–P04.

Documentação não representa implementação ou conformidade atestada.
