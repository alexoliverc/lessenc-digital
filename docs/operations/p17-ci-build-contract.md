# P17 CI verification build contract

`npm run build:ci` exists only to compile the application in the quality/security workflow with
synthetic configuration. It is not a staging or production release build and grants no deployment
authority.

The guard fails closed unless all of the following are true:

- `APP_ENV=test`, `NODE_ENV=production`, `CI=true`, `NEXT_TELEMETRY_DISABLED=1` and
  `P17_CI_BUILD_ID=lessenc-ci-verification-only` are exact;
- `APP_URL=https://lessenc.invalid` and the fixed P08 IDs and P09-P12 synthetic secrets match the
  workflow contract;
- private storage is the local filesystem at an absolute, CI-dedicated path outside the repository;
- no loadable `.env*` file exists in the repository root, using case-insensitive discovery on every
  platform; `.env.example` is the only allowed exact name;
- no hosted database, staging/release identity, remote storage, external payment, hosted telemetry
  or common provider credential variable is present.

The orchestrator revalidates the same contract before Prisma generation and again before the Next
build. Environment identifiers are normalized before comparison; case variants and collisions are
rejected. Each subprocess receives an explicit allowlist containing only the canonical synthetic
configuration and the system variables needed by Node, Prisma and Next. The Prisma and Next CLIs are
resolved as regular files inside the repository, and `npm_execpath` is neither trusted nor forwarded.
Failure codes never include environment values. The generated headers and all other build-time
configuration are therefore test-environment output and are not evidence of the deployed staging
release.

The protected staging path remains unchanged:

```text
npm run build
  -> prebuild
  -> ops:p16:preflight
  -> db:generate
  -> next build
```

The CI workflow neither uploads nor deploys the verification output. This is an operational control,
not a cryptographic or filesystem property of `.next`: a person with access to the runner could copy
the directory, so the artifact is not claimed to be physically non-deployable. Any release workflow
must continue to use the protected `npm run build` path with authorized staging configuration and an
exact release binding.

The workflow runs this build in an independent job, without `needs`, so it can provide Linux build
evidence even when the complete dependency audit blocks `Application gates`. The application job
continues to run the explicit R51 regression before the unchanged
`npm audit --audit-level=high`. A successful verification-build job does not override a failed
application job, authorize a merge or prove a staging/production release.
