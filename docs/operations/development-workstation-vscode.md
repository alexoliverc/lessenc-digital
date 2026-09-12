# Development workstation — VS Code

**Status:** CANONICAL operational baseline for the L'Essenc development workstation.

**Scope:** Visual Studio Code, developer profile, terminal, Git integration, editor tooling, security, performance, synchronization and recovery.

This document does not redefine application architecture, runtime targets, package-manager policy, application environments or deployment architecture.

**CURRENT CANONICAL BASELINE WINS** whenever historical workstation instructions conflict with current canonical repository documentation.

## Source-of-truth boundaries

| Concern | Canonical source |
| --- | --- |
| Runtime and package-manager baseline | `../architecture/runtime-toolchain-baseline.md` |
| Application environments and configuration | `../architecture/configuration-environment-system.md` |
| Testing baseline | `../architecture/testing-foundation.md` |
| Application security baseline | `../security/application-security-baseline.md` |
| Development workstation and VS Code | this document |
| Shared editor configuration | `.vscode/`, `.editorconfig`, `.gitattributes` |
| Personal editor preferences | local VS Code profile and Settings Sync |

Runtime and framework versions must not be duplicated here as independent project truth.

The current physical repository continues to use `pnpm` and `pnpm-lock.yaml` until the P04 physical migration is explicitly authorized and reconciled.

## Reference workstation

The workstation verified on 2026-09-12 used:

- Visual Studio Code 1.137.0;
- Windows 10.0.26200;
- PowerShell 7.6.6;
- Git for Windows;
- VS Code profile `L'Essenc`;
- generic VS Code windows using profile `Padrão`.

These values describe the verified workstation and do not replace the canonical runtime/toolchain specification.

Internal VS Code profile IDs and absolute user paths are local implementation details and are not project requirements.

## VS Code profile model

The intended profile separation is:

- `L'Essenc` for the L'Essenc repository;
- `Smith Sterling Development` for Smith Sterling;
- `Padrão` for generic or unrelated workspaces.

The L'Essenc repository should open using the `L'Essenc` profile.

Profile associations are local VS Code state and are not canonical repository configuration.

## Versioned workspace configuration

Project-wide editor policy is stored in:

- `.vscode/settings.json`;
- `.vscode/extensions.json`;
- `.editorconfig`;
- `.gitattributes`.

Machine-specific UI preferences, personal keybindings, internal profile IDs and unrelated extensions remain outside project-wide configuration.

## Shared editor behavior

The current workspace configuration establishes:

- Prettier for supported source formatting;
- format on explicit save;
- ESLint fixes on explicit save;
- project-local TypeScript SDK through `./node_modules/typescript/lib`;
- exclusions for generated and dependency directories;
- LF repository text policy.

The editor configuration must not silently migrate the package manager, create an additional lockfile or reconcile the documented P04 target without an explicitly authorized implementation task.

## Approved project extensions

The repository recommends:

| Extension | Purpose |
| --- | --- |
| `dbaeumer.vscode-eslint` | ESLint diagnostics and fixes |
| `esbenp.prettier-vscode` | Prettier integration |
| `editorconfig.editorconfig` | EditorConfig integration |
| `github.vscode-pull-request-github` | GitHub pull-request workflow |
| `vitest.explorer` | Vitest testing integration |

The local L'Essenc profile also contains:

- `ms-ceintl.vscode-language-pack-pt-br`;
- `openai.chatgpt`.

Those profile-level extensions are useful to the workstation but are not automatically project requirements.

## Formatting and code quality

Responsibility is separated as follows:

- Prettier owns formatting;
- ESLint owns lint diagnostics and explicit fixes;
- EditorConfig owns basic text consistency;
- TypeScript uses the workspace SDK when available.

Automatic import organization is not globally forced.

## Terminal baseline

PowerShell is the default integrated terminal for the L'Essenc profile.

The baseline includes:

- shell integration enabled;
- persistent terminal sessions enabled;
- persistent-session replay;
- scrollback of 10,000 lines;
- inherited working directory for split terminals;
- terminal tabs enabled;
- multiline paste warning set to `always`.

The integrated terminal remains unavailable in untrusted workspaces.

## Git and SCM baseline

The VS Code Git integration uses conservative operating defaults:

- automatic fetch enabled;
- pruning on fetch;
- sync confirmation enabled;
- smart commit disabled;
- normal force push blocked;
- force-with-lease preferred when force operations are required;
- staged changes shown separately;
- incoming and outgoing changes visible.

Before checkpoint commits, verify:

- `git diff --check`;
- `git diff --cached --check`;
- `git status --short --branch`;
- `git diff --cached --stat`.

## Explorer, search and watchers

Generated or dependency-heavy directories are excluded where appropriate, including:

- `node_modules`;
- `.next`;
- `coverage`;
- `dist`;
- `out`;
- `.turbo`;
- configured TypeScript build-info artifacts.

## Security baseline

Workspace Trust is enabled.

Verified global controls:

- `security.workspace.trust.enabled = true`;
- `security.workspace.trust.startupPrompt = once`;
- `security.workspace.trust.untrustedFiles = newWindow`;
- `security.workspace.trust.emptyWindow = false`;
- `terminal.integrated.allowInUntrustedWorkspace = false`.

The L'Essenc profile also uses:

- `terminal.integrated.enableMultiLinePasteWarning = always`.

Unknown repositories must not be trusted merely to suppress Restricted Mode.

Before trusting downloaded or cloned repositories, inspect executable configuration, package scripts, shell scripts, VS Code tasks, launch configuration and extension recommendations.

At this baseline, the repository does not require `.vscode/tasks.json` or `.vscode/launch.json`.

## Secrets and environment files

Secrets must not be stored in Git, VS Code settings, project documentation examples or source files.

The repository tracks `.env.example` as a non-secret template while ignoring real environment files and common private-key or certificate formats.

The authoritative environment policy remains in `../architecture/configuration-environment-system.md`.

## Performance baseline

The workstation was profiled after configuration.

A reloaded VS Code window showed approximately:

- renderer ready: 355 ms;
- workbench ready: 385 ms;
- extensions registered: 1,113 ms.

The report indicated `Initial Startup: false`, so these measurements represent a window reload rather than a cold startup.

No measured issue justified disabling GPU acceleration, persistent terminals, TypeScript language services, Codex, GitHub Pull Requests or Vitest Explorer.

Performance tuning must remain evidence-driven.

## Settings Sync and portability

VS Code Settings Sync is active on the verified workstation.

The recovery model has three layers:

1. Git repository for project and shared editor policy;
2. Settings Sync for synchronized profile configuration;
3. exported `.code-profile` for offline recovery.

Exported profile snapshots and local backup archives remain workstation artifacts and should normally stay outside the repository.

## Recovery on a new workstation

Recommended order:

1. install Visual Studio Code;
2. install required shell and Git tooling;
3. enable authorized Settings Sync;
4. restore or select profile `L'Essenc`;
5. clone the approved repository;
6. verify repository origin before granting Workspace Trust;
7. inspect the current physical repository state;
8. follow the canonical runtime/toolchain documentation;
9. do not migrate package managers or create lockfiles implicitly;
10. install dependencies only through the currently authorized workflow;
11. verify the TypeScript workspace SDK;
12. validate Prettier, ESLint, tests and Git state;
13. resume implementation only after validation.

## Troubleshooting

### Wrong VS Code profile

Switch the workspace to `L'Essenc` through the normal VS Code profile interface.

Do not edit VS Code internal storage as the normal remediation method.

### TypeScript workspace version unavailable

Open a `.ts` or `.tsx` file and use the TypeScript version selector.

The workspace points to `./node_modules/typescript/lib`.

### Repository opens in Restricted Mode

Verify origin and repository contents before granting trust.

Restricted Mode is a security boundary, not an error.

### VS Code appears slow

Use `Developer: Show Running Extensions` and `Developer: Startup Performance` before disabling extensions or GPU acceleration.

## Change management

Changes to this document must remain operational in scope.

Runtime versions, framework versions, package-manager migration and environment semantics belong to their canonical architecture documents.

New project-wide VS Code settings or extensions must be justified by repository-wide need and reviewed through Git diff before commit.

Personal UI preferences remain local to the VS Code profile.

**CURRENT CANONICAL BASELINE WINS**.