# P17 — Local Validation Report

## Result first

The owner-authorized autonomous local closeout was completed on 10/10/2026 on branch
`phase/p17-end-to-end-business-validation`. Every locally safe and executable item in the brief was
implemented or revalidated. Implementation commit:
`7ab1777a3363c969cd882d8bac0ffee25afe1b13`.

The isolated supply chain, offline build, runtime, synthetic MySQL integration, real-Chromium E2E,
dependency audit and diagnostic navigation measurements pass within their stated local authority.
Gate D remains `NOT READY`. No local result in this report is hosted or provider authority.

## Baseline preservation and boundaries

- repository: `C:\Projetos\lessenc-digital`;
- branch: `phase/p17-end-to-end-business-validation`;
- initial HEAD: `7f28c6f6bfcea034571e94e0306ff242a26e12fd`;
- initial state: 28 modified or untracked paths, empty staging and 534 index entries semantically
  equivalent to HEAD;
- external audit root:
  `C:\Users\Alex Oliveira\AppData\Local\Lessenc\P17\autonomous-closeout-20261010-090152`;
- captured before mutation: branch, HEAD, full status, staged and unstaged patches, untracked-file
  inventory, file hashes, semantic index and Docker containers/images/volumes;
- the unexplained historical `.git/index` hash divergence remains `UNKNOWN`; no reset, rebase or
  index replacement was used;
- protected pre-existing Docker resources were not modified or removed;
- push, PR, merge, tag, deploy, hosted database access, production credential use and real payment:
  not performed.

## Supply-chain closeout

| Component | Verified result |
| --- | --- |
| OpenSSL | Debian `libssl3` `3.0.22-1~deb12u1`, amd64, SHA-256 `F0A8AA8429209E556C278A9936BBD5F7D2CDB9F7E4E23B1E43ED399217BA80C1` |
| Debian provenance | signed index SHA-256 `E6223F7DE5FC427E898EA17683A2900785FE9E33015DB0CA976C9BA49E16F0E6`, trusted signer `B0CAB9266E8C3929798B3EEEBDE6D2B9216EC7A8` |
| OpenSSL libraries | `libssl.so.3` SHA-256 `DF53C8F504722CACD8035111FDAED5151CE17B79FD380EFCF28B3B4A1CA70CD5`; `libcrypto.so.3` SHA-256 `76DD3D93E5EE48950A92A58D59B94DE8143847F91A80D9682C938767B991577D` |
| Prisma Schema Engine | Prisma `7.10.0`, commit `0edf323efd1d98336f3f0a68684b56f689b900d3`, effective target `debian-openssl-3.0.x` |
| Prisma compressed artifact | SHA-256 `B7210B525A6E592C0D5DB7E7D48EDBC0F334E14E212AF7AF11C0D4A8DE755A31` |
| Prisma executable | ELF64 little-endian amd64, SHA-256 `29557C21D47DA6F1695EC1A747CB6C607DADE5E44E8B3E4FA687BD4DC226956D`, version execution PASS |
| npm bootstrap | npm `11.19.1` tarball SHA-256 `9F58BFF01604CB1B14008FEF14DCEB14D836A49225E45C6C2E37DE3BE3E707F0` |

The original `dpkg-deb` extraction failed because its target had no writable temporary filesystem.
Extraction then passed in isolated Linux `tmpfs` with `--network none`, a read-only root filesystem
and a non-root user. A later Windows bind-mount reproduction returned exit 0, so this execution does
not assign the historical failure to the Windows filesystem.

Prisma target detection initially selected OpenSSL 1.1 when libraries existed only through
`LD_LIBRARY_PATH`. Installing the verified libraries into the standard isolated Debian library path
made Prisma select `debian-openssl-3.0.x`; the engine then loaded and executed without database
access. No implicit engine download is part of the build.

## Offline dependency cache and security reconciliation

The security update changed `package-lock.json`, so the earlier approved cache remains preserved as
historical evidence but could no longer be the canonical build input. The refreshed Linux cache is
bound to:

- Node.js `24.21.0` and npm `11.19.1`;
- lockfile SHA-256
  `E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720`;
- 445 lock entries, 390/390 Linux-target entries and 13/13 mandatory packages;
- 786 cache files and 277,883,978 bytes;
- inventory SHA-256
  `E44A77D985BEE7299B9A27552274E19D8C2327DBDC1C56926654FFB534E839BC`;
- online acquisition in a disposable Linux container followed by a successful `npm ci --offline
  --ignore-scripts` replay with `--network none`;
- no `.npmrc`, log, credential file, symbolic link, hard link or unapproved registry origin in the
  sealed cache.

`sharp` was raised to `0.35.5` and `source-map-js` to `1.2.2` through root overrides. The final
runtime audit reports zero vulnerabilities. The full audit retains four HIGH findings only in the
development lint chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`); npm's
suggested fix would downgrade the Next ESLint plugin incompatibly and was not applied.

## Docker capsule and isolation

The application capsule uses digest-pinned Node 24.21.0, Playwright 1.63.0 and MySQL 8.4.11 images.
All build steps that consume the application dependencies execute with `--network=none`. The final
application image manifest was
`sha256:f8c9adb358d747cd7997c21282660a3e6be857bdfbd92b4aa25f4ca86d2ef199`.

Runtime validation proved:

- UID/GID `17017:17017`, non-root;
- Node `v24.21.0`, npm `11.19.1`, Prisma `7.10.0`, Next `16.3.8`, Playwright `1.63.0`;
- corrected `sharp 0.35.5` and `source-map-js 1.2.2` are present;
- Chromium `153.0.8010.12` launches with the Playwright sandbox defaults;
- Node and Chromium can reach only the loopback test server and cannot reach an external address;
- no non-loopback interface, IPv4/IPv6 default route or external resolver exists in the capsule;
- application root is read-only at runtime, with only explicit `tmpfs` paths writable;
- the application and MySQL share only the database container network namespace, publish no port
  and mount no persistent volume;
- MySQL runs as UID/GID `999:999` in disposable `tmpfs` storage;
- no provider endpoint or production credential was accessed.

The disposable database container and the two locally built images were removed after validation.
No container with label `com.lessenc.scope=p17-autonomous-closeout-r01` remains.

## Final validation results

| Command or gate | Environment | Result |
| --- | --- | --- |
| `node scripts/p17-npm-cache-verify.mjs verify-cache ...` | sealed Linux cache | PASS; 390 target entries, 13 required packages, 786 files |
| toolchain and procfs verifier tests | host Node 24 | 5/5 PASS |
| `npm run test:performance:infra` | local, provider-free | 7 files / 42 tests PASS |
| offline Docker build | digest-pinned images, `--network=none` | PASS; Prisma generate and Next production build PASS |
| runtime validation and smoke | read-only, non-root, network-isolated capsule | PASS |
| integration suite | disposable MySQL 8.4.11, TLS, DML-only runtime user | 22 files / 199 tests PASS |
| Playwright E2E | production build, real Chromium, synthetic MySQL | 14 PASS / 0 FAIL / 4 intentional viewport skips |
| `npm run check` | `APP_ENV=test` | lint PASS; typecheck PASS; 104 files / 1,032 tests PASS; format PASS |
| `npm audit --omit=dev` | final lockfile | PASS; zero vulnerabilities |
| full `npm audit` | final lockfile | 4 HIGH development-tooling findings; runtime unaffected |
| `git diff --check` | implementation candidate | PASS |
| changed-file secret scan | 48 implementation paths | PASS; no private filename, key, provider token or unclassified credential literal |

The four Playwright skips are deliberate: database-mutating checkout and security cases execute once
on desktop, while public rendering, navigation, CSP, keyboard and liveness execute on mobile, tablet
and desktop. These skips are not failed or omitted scenarios.

The exact post-E2E table-count audit found synthetic residue in four tables inside the disposable
database: 127 `acquisition_journeys`, 127 `attribution_touches`, one
`admin_auth_rate_limit_buckets` row and two `buyer_access_rate_limit_buckets` rows. The database
container and its `tmpfs` were removed, so no persistent or protected database was affected. This is
a local fixture-cleanup limitation; the passing suite does not prove zero residual rows after a full
combined run.

## Performance diagnostic

The isolated production build collected 240 valid navigation samples: 40 per route and viewport
group after two warmups. The loopback run was unthrottled and uncalibrated, so it is
`DIAGNOSTIC_ONLY`, not an acceptance PASS.

| Viewport | Route | TTFB p50/p95 | DOMContentLoaded p50/p95 |
| --- | --- | --- | --- |
| mobile | `/` | 2.70 / 4.60 ms | 36.30 / 47.10 ms |
| mobile | product | 18.40 / 24.80 ms | 55.30 / 64.30 ms |
| tablet | `/` | 2.50 / 3.10 ms | 33.40 / 39.60 ms |
| tablet | product | 14.60 / 17.50 ms | 48.70 / 57.50 ms |
| desktop | `/` | 2.30 / 2.90 ms | 35.20 / 40.90 ms |
| desktop | product | 14.80 / 19.50 ms | 47.50 / 58.00 ms |

Raw diagnostic evidence remains outside Git under the external audit root. P17-PR01 is
`DIAGNOSTIC_ONLY / BLOCKED_OWNER_BUDGET`. P17-PR02 through P17-PR04 remain `NOT_EXECUTED` because no
numeric acceptance budget exists and provider-sensitive execution is outside this local authority.

## Gate D and external blockers

The local work is exhausted, but the phase cannot close. The following authorities remain external:

- P17-E05: real Mercado Pago TEST webhook delivery and correlation;
- P17-F01: real declined-payment evidence;
- P17-B01 and P17-B03–B07: remaining hosted buyer, failure and recovery evidence as classified by
  the canonical matrix;
- P17-R01–R03: real interactive Payment Brick proved in mobile, tablet and desktop;
- P17-PR01–PR04: owner-approved numeric performance budget followed by authoritative evaluation;
- final hosted/source reconciliation after any later P17 publication.

No evidence was fabricated or promoted across authority boundaries. Production remains
unauthorized, and Gate D remains `NOT READY`.

## Subsequent owner performance budget decision — 10/10/2026

This addendum records a governance decision made after the local validation documented above. It does not alter the results or conditions of the historical local run.

The owner approved `LES-P17-PERFORMANCE-BUDGET-R01` with LCP P75 <= 2,500 ms (PR01), INP P75 <= 200 ms (PR02), browser-side payment initiation P95 <= 1,000 ms (PR03), and protected buyer delivery TTFB P95 <= 2,000 ms (PR04).

The approved protocol requires 15 independent cohorts, 3 warmups and 40 valid measurements per cohort, nearest-rank, zero Playwright retries, the documented mobile/tablet/desktop viewports, 10/2 Mbps with RTT 80 ms, and +/-10% network calibration tolerance.

The prior 240 navigation samples were collected without network throttling or calibration and cannot be reused for acceptance. PR01 remains DIAGNOSTIC_ONLY / ACCEPTANCE NOT PROVEN; PR02-PR04 remain NOT_EXECUTED.

The owner approved the policy only. No new test, provider access, hosted mutation, database operation, code change, deploy or production authorization follows from this decision. Gate D remains NOT READY.

## Autonomous local acceptance closeout — 11/10/2026

### Scope and provenance

Execution remained on `phase/p17-end-to-end-business-validation` at initial HEAD
`d73b2d678686fc805c6eb5f26a852ae60f870b91`, with an initially empty staging area and the existing
dirty baseline preserved. No reset, restore, rebase, commit, push, merge, tag, PR, deploy or
external mutation was performed.

The acceptance controller is bound to authority `LES-P17-AUTONOMOUS-CLOSEOUT-R01`, rejects
provider-bearing environment variables, creates only disposable local database/storage state and
uses loopback-only browser/application communication. Build input provenance is a SHA-256 digest
of 436 non-derived source inputs; the declared Git commit remains separate metadata and is not used
as a substitute for dirty-worktree provenance.

The last executed application image candidate was
`sha256:1fe580f50dde922297c139450ce7736e5c885fd68b10b496f0ea54d63878b4a7`, built from source digest
`6371612ba5bdfd62511a0365b7bd192cc8180e0b2763769f4b297df62c6d9461`. Later lint/configuration and
closeout-document edits mean the final worktree bytes are not represented by that runtime image;
that limitation is explicit and prevents a false final-image claim.

### Engineering changes

- added a fail-closed local performance controller, calibration server and source-provenance tool;
- materialized PR01 LCP, PR02 INP, PR03 PIX/card initiation and PR04 protected-delivery TTFB specs;
- added policy, orchestration, calibration, isolation, browser-network, browser-metric, acceptance
  evidence and reporting helpers with unit coverage;
- made the capsule's build input, output volume, source digest and declared commit independently
  auditable;
- supplied the shared MySQL TLS CA through a temporary read-only volume without weakening TLS;
- used the acquisition route to establish a real local consent journey and then validated the
  denied-consent projection before checkout;
- retained genuine Performance Event Timing semantics: auxiliary zero interaction IDs may be
  ignored only when a qualifying positive interaction exists, while zero-only or missing entries
  fail closed;
- declared `APP_ENV=test` in Vitest configuration and reconciled strict lint/format/type rules.

### Validation results

| Validation | Result |
| --- | --- |
| Offline cache verification | PASS; 390 target entries, 13 required packages, 786 cache files |
| Offline capsule build | PASS for the last executed image candidate |
| `npm run check` | PASS; lint, Prisma generate/typecheck, 104 files / 1,032 tests, format |
| `npm run test:performance:infra` | PASS; 14 files / 78 tests |
| Performance contract description | PASS; 15 cohorts, 45 warmups, 600 measurements, retries 0, worker 1 |
| Runtime dependency audit | PASS; zero vulnerabilities |
| Full dependency audit | 4 HIGH development-only lint-chain findings; no safe non-breaking automatic fix applied |
| Isolated MySQL integration attempt 1 | NOT_EXECUTED; Vitest could not create `.vite-temp` under the read-only image |
| Isolated MySQL integration attempt 2 | NOT_EXECUTED; Vitest could not create its API token in either read-only fallback path |
| Disposable resource cleanup | PASS after both integration attempts |

Both integration attempts applied all nine migrations successfully before the Vitest bootstrap
blocker. Because no test was collected, they provide migration/capsule diagnostics only and do not
replace the previously recorded 199-test evidence.

### Performance execution

Fifteen bounded attempts were preserved under
`C:\Users\Alex Oliveira\AppData\Local\Lessenc\P17\autonomous-closeout-20261011-0719`. The final run,
`p17-perf-acceptance-20261011-1312`, completed PR01 mobile with 3 warmups and 40 valid observations,
then stopped on the first PR02 mobile warmup with `ENTRY_MISSING`. The expected order-creation
outcome occurred, but Chromium supplied no qualifying Event Timing entry above the approved
observation threshold. The runner did not fabricate a duration and did not continue to PR03/PR04.

Therefore PR01 is only partial-cohort support, PR02 is blocked on local browser observability, and
PR03/PR04 are not executed. No one of PR01–PR04 has authoritative acceptance PASS.

### Closeout classification

- `P17 / PARTIALLY COMPLETE`;
- `GATE D / NOT READY`;
- `PRODUCTION / UNAUTHORIZED`;
- E05 real TEST webhook, F01 provider failure, provider-sensitive B/R rows and complete performance
  acceptance remain outside the authority proved by this local closeout.

## R02-C5 — Local F6-CA and OCI technical evidence — 11/10/2026

<!-- LES-P17-R02-C5-T06-F01-CA-OCI-EVIDENCE -->

### Classification and identity

This addendum records local infrastructure evidence only. F6-CA identifies the disposable database CA-volume initialization and export mechanism. It is not the Gate D failure scenario `P17-F06`, which concerns expired orders.

- Scope: `LES-P17-R02-C5-T05`, local isolated testing.
- Repository branch: `phase/p17-end-to-end-business-validation`.
- Git HEAD metadata: `e484f35352ec9bcedde645239342e15d3327cc25`.
- Worktree during validation: 23 modified and 16 untracked paths, staging empty.
- Provenance schema: 2; 462 source inputs, including 11 container-recipe inputs.
- Source-tree SHA-256: `23a6187f3829c3729230da6d23dfe774bef9022997f224664dedd2b1054868fc`.
- Local OCI tag: `lessenc/p17-performance-app:r02-source-23a6187f`.
- Local Docker image ID: `sha256:73aa9f79f9b11e6196d6f0b33e4f4eb8d5f27d5da37a741b8ad031fa02e888a7`.

The Git HEAD is declared metadata, not proof that the uncommitted worktree matches that commit. This OCI image is not identified as the current Hostinger deployment.

### Validated local execution ledger

| Execution | Observed result | Evidence boundary |
| --- | --- | --- |
| T05-T02 | PASS; BuildKit context audit, 2,061 effective files and zero forbidden negative-fixture files | Local Docker context |
| T05-T03 | PASS; 3 Vitest files, 14 tests, Prettier, ESLint and source integrity | Local regression |
| T05-T04 | PASS; local OCI application build (`--pull=false`; Dockerfile `RUN --network=none`; BuildKit-wide offline operation not attested), OCI labels, 462-file in-image provenance recomputation and F6 initializer byte identity | Local OCI image |
| T05-T05 | PASS; canonical CA-volume initializer and exporter, genuine Prisma Client authenticated SQL and negotiated TLS cipher | Isolated synthetic MySQL |
| T05-T05 cleanup | PASS; disposable containers, volumes and temporary harness removed; Git integrity preserved | Local cleanup |

The CA initializer was included in the Docker context, OCI runtime filesystem and canonical provenance. The tested Prisma connection used the synthetic isolated MySQL service, without application-server startup, hosted database access, migration execution or payment-provider activity.

Earlier negative TLS investigations proved that the MariaDB driver rejects an untrusted CA and a hostname mismatch. The Prisma Client also rejected the corresponding negative configurations, but the recorded `P2010` / driver-adapter error did not independently establish the precise TLS cause. Prisma negative-error classification remains pending; no TLS validation rule was weakened.

### Evidence limitations and authority

The execution identifiers above refer to operator-provided console transcripts reviewed during the R02-C5 session. This addendum does not claim an independently archived, immutable transcript bundle, complete per-run timestamps or a new hosted/provider execution. It does not promote local infrastructure results into a Gate D scenario PASS.

Existing hosted evidence remains bound to its separately documented release authority. Real Mercado Pago TEST webhook evidence, declined-payment evidence, outstanding buyer and responsive cases, and full PR01-PR04 performance acceptance remain unresolved.

`F6-CA LOCAL TECHNICAL VALIDATION = PASS`

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT READY`

`PRODUCTION = UNAUTHORIZED`

## Autonomous closeout interrupted state — 12/10/2026

<!-- LES-P17-AUTONOMOUS-CLOSEOUT-R01-INTERRUPTED-20261012 -->

This entry records the verified local state when the owner ordered the active execution to stop.
The Docker Desktop start command that remained active after interruption was terminated. No
additional repair, implementation or runtime acceptance attempt was performed afterward.

### Newly verified local evidence

| Item | Observed result | Evidence boundary |
| --- | --- | --- |
| Effective Compose environment audit | PASS; exact synthetic database and public-key contract accepted, provider-secret and unexpected-variable fixtures rejected | Static/local Compose configuration only |
| PR03 / PIX / mobile | 3 valid excluded warmups; 40/40 valid measured samples; nearest-rank p95 3.5 ms; min 2.9 ms; max 3.7 ms; 1,000 ms budget | One local Chromium cohort only |
| PR03 calibration | VALID; download 9,626,955.475 bps, upload 1,971,025.919 bps, RTT 86.3 ms | Local CDP calibration only |
| PR03 action identity | One trusted click correlated with exactly one successful local `POST /checkout/payment/start` resource | Local synthetic endpoint only |
| General source checks | PASS; `npm run check` 104 files / 1,032 tests, performance infrastructure 24 files / 109 tests, Prettier, typecheck and targeted ESLint | Local source validation |
| Dependency audit | Runtime: zero findings; full development tree: four HIGH findings in the lint toolchain | Local lockfile/dependency evidence |
| Offline inputs | PASS; npm cache 390 target entries / 13 required packages / 786 files; Docker context 2,067 files and zero forbidden negative-fixture files | Local capsule inputs |

The successful bounded cohort used Chromium 153.0.8010.12, Playwright 1.63.0, source-tree SHA-256
`836221e17fd76eb5e1455187499d21d9171ba874a275bbc8aed41dbaebf24e84` and image digest
`sha256:5d7ba9397dc66711f7686c787a91c4bbd398a2227934d06692b2f372817386f9`.
Git HEAD `e484f35352ec9bcedde645239342e15d3327cc25` is metadata only, not source authority.

### Interruption and unverified final source state

After the cohort, the selective reporter was changed so `PR03_PIX_MOBILE` can record a selective
PASS while deliberately retaining global `NOT_PROVEN / FULL_ACCEPTANCE_SCOPE_NOT_EXECUTED`.
Source tests for that contract passed. The subsequent local OCI rebuild failed while copying or
exporting the application-runtime layer with a Docker/BuildKit RPC `Unavailable` / `EOF`. Docker
Desktop then became unavailable. The final worktree has not been rebuilt into a validated image,
and the reporter correction has no post-change runtime execution.

The full 15-cohort matrix, isolated MySQL integration rerun, hosted correlation, Mercado Pago TEST
webhook, provider-declined payment and remaining buyer/responsive cases were not completed. The
single PR03 cohort must not be promoted to a PR03 scenario PASS or a global performance PASS.

`LOCAL PR03 / PIX / MOBILE COHORT = PASS`

`FULL PERFORMANCE ACCEPTANCE = NOT_PROVEN`

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT READY`

`PRODUCTION = UNAUTHORIZED`

## LES-P17-R49 — Remediation authorized, execution not yet revalidated — 12/10/2026

<!-- LES-P17-R49-REMEDIATION-STARTED-20261012 -->

Owner authorized remediation of the three R48 review findings. This entry documents the proposed
local source changes, not completed acceptance. The R42 evidence package remains immutable with
SHA-256 `76ce09696341d38a4b2d72a1004add2bbe2015a7f122367d0fd3dd090472fbd7`.

- F01: acceptance reporter unit-test provenance must be isolated in a disposable test directory;
  existing root provenance files must not be replaced or deleted.
- F02: validation evidence must not store raw command arguments and must constrain subprocess
  execution on Windows; redact all argument values in archived command metadata.
- F03: perform a fail-closed authenticated TLS SQL handshake against the running disposable
  MySQL before any integration or performance execution. Re-export the active CA when MySQL
  is recreated; a stale exported CA must fail prior to migration or Playwright.

Prior R38 integration (199/199) and R42 performance (15/15 calibrated cohorts, 600 valid samples)
refer exclusively to the pre-R49 source digest `06ba5492eb69f797de8cf2b13d1e07aaa3c56d6503f18a66d78897efe3502ff3`.
After R49 edits, source provenance and OCI image identity change and require new validation.
No historical evidence is rewritten, and the R42 official reviewer remains
`PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY`.

`R49 = IMPLEMENTATION PENDING REGRESSION`

`GATE D = NOT_READY`

`PRODUCTION = UNAUTHORIZED`

## LES-P17-R49 — Commit-bound local remediation closeout — 12/10/2026

<!-- LES-P17-R49-FINAL-LOCAL-REMEDIATION-CLOSEOUT-20261012 -->

### Baseline and recoverability

- Branch: `phase/p17-end-to-end-business-validation`.
- HEAD: `e484f35352ec9bcedde645239342e15d3327cc25`; five commits ahead of upstream.
- Initial pending tree: 52 paths, comprising 28 tracked modifications and 24 untracked files;
  staging was empty.
- External pre-change backup:
  `C:\Users\Alex Oliveira\AppData\Local\Lessenc\P17\master-continuation-r01\20261012-190210`;
  52/52 file hashes verified, manifest SHA-256
  `0b3221c2e6cf5ab4fa7416bbbf65b068f61ed050b0cfc00341d6d40a825ed4a4` and tracked binary
  patch SHA-256 `58235e6c9bdf277f950077dbbc77cd48328a0b88c0fa5fcf6ec79164b858d9b6`.
- Sensitive-filename and credential-pattern scans over the 52 pending paths returned zero hits.

### F01 and F02 audit

F01 now exercises success, malformed intermediate attachment and explicit output cleanup using
disposable provenance sandboxes. Preexisting `.p17-source-tree.sha256` and
`.p17-source-provenance.json` bytes remain unchanged in all covered paths; cleanup is restricted to
the randomized reporter output directory.

F02 keeps every archived argument value as `<ARGUMENT_REDACTED>`, rejects an allowlisted executable
when selected through an arbitrary path, runs subprocesses with `shell: false`, and executes npm on
Windows through the trusted current Node runtime plus `npm-cli.js` instead of `cmd.exe`. Values
derived from command arguments and sensitive environment variables are also removed from captured
stdout/stderr. Negative tests use recognizable synthetic values and persist neither value.

### F03 isolated runtime proof

The entrypoint now exposes `tls-preflight`, a narrowly authorized mode that calls the same
`wait_for_loopback_database` and `verify_authenticated_mysql_tls` functions used by `run`,
`run-pr03-pix-mobile` and `integration`, then exits before controller, Prisma migration or Vitest
execution.

Final commit/image identity:

- commit: `7ddfbf668d1648cf968eb3243748c89f288539cc`;
- tag: `lessenc/p17-performance-app:r49-final-7ddfbf6-8f961f5b`;
- OCI ID: `sha256:22c54f0c643615677bd0e6921b5c4f92ac609748ece66ea92ab6d600fd0c8ece`;
- source schema/file count: 2 / 467;
- source-tree SHA-256:
  `8f961f5bbb2e54e8a95ffc13005581d4ad2c3db5b0a89b805e761d24443a2bea`;
- image revision label and in-image declared commit exactly match the implementation commit.

The positive execution shared only the R34 network namespace, mounted the active CA volume read-only
and completed with exit code 0, `P17_CAPSULE_LOOPBACK_ONLY_PASS`,
`P17_CAPSULE_DB_TLS_HANDSHAKE_PASS`, cipher `TLS_AES_256_GCM_SHA384` and
`P17_CAPSULE_DB_TLS_PREFLIGHT_ONLY_COMPLETE`.

The negative execution mounted an independently generated incompatible CA in a separate labeled
ephemeral volume. It exited 1 with `P17_CAPSULE_DB_TLS_HANDSHAKE_FAILED`; no PASS, cipher,
preflight-complete, controller, migration, Vitest or performance-acceptance marker followed. The
negative volume and synthetic environment file were removed after verification.

The active CA retained SHA-256
`b2bd505b16822486a1f1800494f8c330b4a06abd18bccc0739f79fdcb033f869`. The R34 container ID,
start time, restart count and historical data-volume identity were unchanged. A read-only logical
snapshot over 28 application tables and 9 rows was identical before and after:
`7dfda28cc61a0d60c4109f97989744fa5f3be053dcfd3ed2d3d81de194f3d8ea`.

The implementation deliberately retains `rejectUnauthorized: true` but overrides
`checkServerIdentity` because the synthetic loopback certificate lacks a loopback SAN. The runtime
emits `P17_CAPSULE_DB_TLS_HOSTNAME_IDENTITY=NOT_VERIFIED_LOOPBACK_OVERRIDE`. This proves CA-chain
authentication and encrypted cipher negotiation, not complete hostname identity.

Sanitized final F03 evidence is stored outside the repository at
`C:\Users\Alex Oliveira\AppData\Local\Lessenc\P17\r49-final-tls-preflight\20261012-193758`;
summary SHA-256: `58d8fb13ccc3484ed0d725cce225a211fa0eeae96f5f7e481543323c4b043761`.

### Final regression

| Validation | Result |
| --- | --- |
| F01/F02/F03 targeted regression | PASS; 3 files / 20 tests at the targeted checkpoint |
| Performance infrastructure | PASS; 25 files / 117 tests |
| `npm run check` | PASS; lint, Prisma generate/typecheck, 104 files / 1,032 tests, Prettier |
| Offline npm cache | PASS; 390 target entries, 13 required packages, 786 files |
| Docker context audit | PASS; 2,068 effective files, zero forbidden negative-fixture files |
| Commit-bound R49 production build | PASS; commit, offline inputs and in-image provenance recomputation matched |
| Fresh isolated MySQL integration | PASS; authenticated TLS preflight, 9/9 migrations, 22 files / 199 tests |
| Disposable integration cleanup | PASS; zero project containers and zero project volumes remain |
| `git diff --check` | PASS |

The isolated integration summary is outside the repository at
`C:\Users\Alex Oliveira\AppData\Local\Lessenc\P17\r49-a5-integration\20261012-192500`;
summary SHA-256: `59a9db5e730e89f3f9aa5f8bdb5202fa79de463de9a81ec02fe21ed61d00c0ba`.

The 199-test integration run used A5 with the exact same source digest as the final commit-bound
image; the final image then repeated the positive and negative F03 runtime proof. No full 15-cohort
performance rerun was performed after R49. R42 remains immutable historical evidence with official
authority `PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY`; it is not attributed to the final R49 image.
Hosted/provider/payment evidence and hosted release identity are unchanged.

`R49 F01 / F02 / F03 LOCAL REMEDIATION = PASS`

`FULL PERFORMANCE ACCEPTANCE = NOT_PROVEN FOR FINAL R49 SOURCE`

`P17 = PARTIALLY COMPLETE`

`GATE D = NOT_READY`

`PRODUCTION = UNAUTHORIZED`
