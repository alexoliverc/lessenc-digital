import { Buffer } from "node:buffer";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  P16_HOSTED_BACKUP_MANUAL_AUTHORITY,
  P16_HOSTED_BACKUP_SCHEDULED_AUTHORITY,
  cleanupHostedBackupWorkspace,
  createHostedBackupId,
  materializeR2Snapshot,
  resolveHostedBackupCliExecutionAuthority,
  resolveS3SdkCapabilities,
  runP16HostedBackupOrchestrator,
  updateBackupIndexAtomic,
} from "../../../scripts/lib/p16-hosted-backup-orchestrator.mjs";
import { evaluateP16HostedRpoEvidence } from "../../../scripts/lib/p16-recovery.mjs";

const RELEASE = "a".repeat(40);
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const NOW = "2026-10-02T12:34:56.789Z";
const roots = new Set<string>();

type Harness = Awaited<ReturnType<typeof createHarness>>;

class ListObjectsV2Command {
  readonly input: Record<string, unknown>;

  constructor(input: Record<string, unknown>) {
    this.input = input;
  }
}

class GetObjectCommand {
  readonly input: Record<string, unknown>;

  constructor(input: Record<string, unknown>) {
    this.input = input;
  }
}

class S3Client {}

async function createHarness() {
  const root = await mkdtemp(join(tmpdir(), "lessenc-p16-hosted-backup-"));
  roots.add(root);
  const repositoryRoot = join(root, "repository");
  const workRoot = join(root, "work");
  const outputRoot = join(root, "output");
  const historyRoot = join(root, "history");
  const caFile = join(root, "hosted-ca.pem");
  await Promise.all([
    mkdir(repositoryRoot),
    mkdir(workRoot),
    mkdir(outputRoot),
    mkdir(historyRoot),
    writeFile(caFile, "synthetic-ca", "utf8"),
  ]);
  if (process.platform !== "win32") {
    await Promise.all([
      chmod(workRoot, 0o700),
      chmod(outputRoot, 0o700),
      chmod(historyRoot, 0o700),
    ]);
  }
  await writeFile(join(repositoryRoot, "package.json"), "{}\n", "utf8");
  const env: Record<string, string | undefined> = {
    APP_ENV: "staging",
    NODE_ENV: "production",
    P16_STAGING_ENVIRONMENT_ID: "lessenc-staging",
    P16_DATABASE_ACCESS_MODEL: "distinct-users",
    P16_DATABASE_MIGRATION_WINDOW: "disabled",
    P16_DATABASE_EXPECTED_HOST: "db.example.internal",
    P16_DATABASE_DUMP_CLIENT: "mariadb",
    P16_RELEASE_COMMIT: RELEASE,
    DB_TLS_CA_FILE: caFile,
    DATABASE_URL: "mysql://migrate:database-secret@db.example.internal:3306/lessenc_staging",
    DB_RUNTIME_URL: "mysql://runtime:database-secret@db.example.internal:3306/lessenc_staging",
    PRIVATE_STORAGE_DRIVER: "hosted",
    P16_PRIVATE_STORAGE_PROVIDER: "r2",
    PRIVATE_STORAGE_S3_ENDPOINT: "https://synthetic.r2.cloudflarestorage.com",
    PRIVATE_STORAGE_S3_REGION: "auto",
    PRIVATE_STORAGE_S3_BUCKET: "lessenc-staging-private",
    PRIVATE_STORAGE_S3_ACCESS_KEY_ID: "synthetic-access-key-id",
    PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: "synthetic-secret-access-key-0123456789",
    P16_BACKUP_ENCRYPTION_KEY: ENCRYPTION_KEY,
    P16_BACKUP_ENCRYPTION_KEY_ID: "p16-hosted-k1",
    P16_HOSTED_BACKUP_WORK_ROOT: workRoot,
    P16_HOSTED_BACKUP_OUTPUT_ROOT: outputRoot,
    P16_HOSTED_BACKUP_RUN_HISTORY_ROOT: historyRoot,
    P16_BACKUP_INDEX_FILE: join(historyRoot, "backup-index.json"),
  };
  return { root, repositoryRoot, workRoot, outputRoot, historyRoot, env };
}

function input(harness: Harness) {
  return {
    env: harness.env,
    repositoryRoot: harness.repositoryRoot,
    executionAuthority: P16_HOSTED_BACKUP_MANUAL_AUTHORITY,
  };
}

function scheduledInput(harness: Harness) {
  return {
    env: harness.env,
    repositoryRoot: harness.repositoryRoot,
    executionAuthority: P16_HOSTED_BACKUP_SCHEDULED_AUTHORITY,
  };
}

function databaseConfiguration() {
  return {
    hostname: "db.example.internal",
    port: "3306",
    databaseName: "lessenc_staging",
    username: "runtime",
    tlsCaFile: "synthetic",
    environmentId: "lessenc-staging" as const,
    dumpMode: "SINGLE_TRANSACTION_NO_LOCKS" as const,
  };
}

function successfulDependencies(trace: string[] = []) {
  return {
    platform: process.platform,
    clock: () => new Date(NOW),
    randomSuffix: () => "0123456789abcdef",
    validateDatabaseEnvironment: vi.fn(async () => {
      trace.push("database-validate");
      return databaseConfiguration();
    }),
    resolveS3Sdk: vi.fn(async () => {
      trace.push("sdk-resolve");
      return {
        S3Client,
        ListObjectsV2Command,
        GetObjectCommand,
        resolution: "repository",
      };
    }),
    createS3Client: vi.fn(() => ({})),
    createDatabaseDump: vi.fn(async ({ destinationPath }: { destinationPath: string }) => {
      trace.push("database-dump");
      await mkdir(resolve(destinationPath, ".."), { recursive: true });
      await writeFile(destinationPath, "SELECT 1;\n", "utf8");
      await writeFile(`${destinationPath}.evidence.json`, "{}\n", "utf8");
      return { evidencePath: `${destinationPath}.evidence.json` };
    }),
    materializeSnapshot: vi.fn(async ({ destinationRoot }: { destinationRoot: string }) => {
      trace.push("r2-snapshot");
      await writeFile(join(destinationRoot, "object.txt"), "snapshot", "utf8");
      return { objectCount: 1, totalBytes: 8, objectKeys: ["object.txt"] };
    }),
    createBundle: vi.fn(
      async ({
        backupId,
        databaseEvidencePath,
        outputRoot,
      }: {
        backupId: string;
        databaseEvidencePath: string;
        outputRoot: string;
      }) => {
        trace.push("bundle");
        await expect(readFile(databaseEvidencePath, "utf8")).resolves.toBe("{}\n");
        const bundleDirectory = join(outputRoot, backupId);
        await mkdir(bundleDirectory);
        await writeFile(join(bundleDirectory, "manifest.json"), "{}\n", "utf8");
        return { bundleDirectory, manifest: { createdAt: NOW } };
      },
    ),
    verifyBundle: vi.fn(async () => {
      trace.push("verify");
      return { manifest: { createdAt: NOW }, storageIndex: [] };
    }),
    measureRpo: vi.fn(() => {
      trace.push("manual-rpo");
      return { status: "UNKNOWN", reason: "RAW_INPUT_NOT_AUTHORITATIVE_HOSTED_EVIDENCE" };
    }),
    evaluateHostedRpoEvidence: vi.fn(() => {
      trace.push("scheduled-rpo");
      return { status: "PASS", reason: "WITHIN_TARGET" };
    }),
  };
}

afterEach(async () => {
  await Promise.all([...roots].map((root) => rm(root, { recursive: true, force: true })));
  roots.clear();
  vi.restoreAllMocks();
});

describe("P16 hosted backup pre-mutation gates", () => {
  it.each([
    ["missing encryption key", "P16_BACKUP_ENCRYPTION_KEY", undefined, "P16_RECOVERY_KEY_REQUIRED"],
    [
      "invalid encryption key",
      "P16_BACKUP_ENCRYPTION_KEY",
      "not-base64",
      "P16_RECOVERY_KEY_INVALID",
    ],
    ["missing key id", "P16_BACKUP_ENCRYPTION_KEY_ID", undefined, "P16_RECOVERY_KEY_ID_INVALID"],
    [
      "missing work root",
      "P16_HOSTED_BACKUP_WORK_ROOT",
      undefined,
      "P16_HOSTED_BACKUP_WORK_ROOT_INVALID",
    ],
  ])("fails before mutation for %s", async (_label, name, value, failure) => {
    const harness = await createHarness();
    harness.env[name] = value;
    const mutation = vi.fn();

    await expect(
      runP16HostedBackupOrchestrator(input(harness), {
        createDatabaseDump: mutation,
      }),
    ).rejects.toThrow(failure);
    expect(mutation).not.toHaveBeenCalled();
    await expect(readdir(harness.workRoot)).resolves.toEqual([]);
  });

  it.each([
    ["P16_DATABASE_DUMP_CLIENT", undefined, "P16_BACKUP_CLIENT_INVALID"],
    ["P16_DATABASE_EXPECTED_HOST", undefined, "P16_BACKUP_DATABASE_AUTHORITY_INVALID"],
  ])("reuses the existing database contract when %s is absent", async (name, value, failure) => {
    const harness = await createHarness();
    harness.env[name] = value;
    const sdkResolver = vi.fn();

    await expect(
      runP16HostedBackupOrchestrator(input(harness), { resolveS3Sdk: sdkResolver }),
    ).rejects.toThrow(failure);
    expect(sdkResolver).not.toHaveBeenCalled();
    await expect(readdir(harness.workRoot)).resolves.toEqual([]);
  });
});

describe("P16 hosted backup execution provenance", () => {
  it("maps only explicit unambiguous CLI modes to separate authorities", () => {
    expect(resolveHostedBackupCliExecutionAuthority("run-manual")).toBe(
      P16_HOSTED_BACKUP_MANUAL_AUTHORITY,
    );
    expect(resolveHostedBackupCliExecutionAuthority("run-scheduled")).toBe(
      P16_HOSTED_BACKUP_SCHEDULED_AUTHORITY,
    );
    expect(() => resolveHostedBackupCliExecutionAuthority("run")).toThrow(
      "P16_HOSTED_BACKUP_MODE_INVALID",
    );
    expect(() => resolveHostedBackupCliExecutionAuthority(undefined)).toThrow(
      "P16_HOSTED_BACKUP_MODE_INVALID",
    );
    expect(() => resolveHostedBackupCliExecutionAuthority("run-manual", ["unexpected"])).toThrow(
      "P16_HOSTED_BACKUP_MODE_INVALID",
    );
  });

  it("rejects the superseded ambiguous automation authority before mutation", async () => {
    const harness = await createHarness();
    const mutation = vi.fn();

    await expect(
      runP16HostedBackupOrchestrator(
        {
          env: harness.env,
          repositoryRoot: harness.repositoryRoot,
          executionAuthority: "SCHEDULER_COMPATIBLE_AUTOMATION",
        },
        { createDatabaseDump: mutation },
      ),
    ).rejects.toThrow("P16_HOSTED_BACKUP_EXECUTION_AUTHORITY_INVALID");
    expect(mutation).not.toHaveBeenCalled();
    await expect(readdir(harness.workRoot)).resolves.toEqual([]);
  });

  it("keeps the manual CLI source free from direct scheduled authority or automated provenance", async () => {
    const cliSource = await readFile(
      resolve("scripts", "p16-hosted-backup-orchestrator.mjs"),
      "utf8",
    );

    expect(cliSource).toContain("resolveHostedBackupCliExecutionAuthority(mode, unexpected)");
    expect(cliSource).not.toContain("P16_HOSTED_BACKUP_SCHEDULED_AUTHORITY");
    expect(cliSource).not.toContain("PROVIDER_SCHEDULED_EXECUTION");
    expect(cliSource).not.toContain("AUTOMATED_PROVIDER_OBSERVATION");
  });

  it("keeps the default package command manual and exposes scheduled execution separately", async () => {
    const manifest = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(manifest.scripts["ops:p16:hosted-backup"]).toBe(
      "node scripts/p16-hosted-backup-orchestrator.mjs run-manual",
    );
    expect(manifest.scripts["ops:p16:hosted-backup:scheduled"]).toBe(
      "node scripts/p16-hosted-backup-orchestrator.mjs run-scheduled",
    );
  });
});

describe("P16 AWS SDK capability resolution", () => {
  const capabilities = { S3Client, ListObjectsV2Command, GetObjectCommand };

  it("uses repository package resolution first", async () => {
    const localRequire = vi.fn(() => capabilities);
    const createRequire = vi.fn(() => localRequire);
    const result = await resolveS3SdkCapabilities({
      repositoryPackageJson: resolve("package.json"),
      createRequire,
    });

    expect(result.resolution).toBe("repository");
    expect(createRequire).toHaveBeenCalledTimes(1);
    expect(localRequire).toHaveBeenCalledWith("@aws-sdk/client-s3");
  });

  it("falls back to the separately supplied runtime package anchor", async () => {
    const localError = Object.assign(new Error("Cannot find module '@aws-sdk/client-s3'"), {
      code: "MODULE_NOT_FOUND",
    });
    const localRequire = vi.fn(() => {
      throw localError;
    });
    const hostedRequire = vi.fn(() => capabilities);
    const createRequire = vi
      .fn()
      .mockReturnValueOnce(localRequire)
      .mockReturnValueOnce(hostedRequire);
    const assertRuntimeAnchor = vi.fn(async () => undefined);
    const result = await resolveS3SdkCapabilities({
      repositoryPackageJson: resolve("package.json"),
      runtimePackageJson: resolve("hosted", "nodejs", "package.json"),
      createRequire,
      assertRuntimeAnchor,
    });

    expect(result.resolution).toBe("runtime-anchor");
    expect(assertRuntimeAnchor).toHaveBeenCalledOnce();
    expect(hostedRequire).toHaveBeenCalledWith("@aws-sdk/client-s3");
  });

  it("fails closed when ListObjectsV2Command is unavailable", async () => {
    const createRequire = vi.fn(() => vi.fn(() => ({ S3Client, GetObjectCommand })));

    await expect(
      resolveS3SdkCapabilities({
        repositoryPackageJson: resolve("package.json"),
        createRequire,
      }),
    ).rejects.toThrow("P16_HOSTED_BACKUP_AWS_SDK_CAPABILITY_MISSING");
  });
});

describe("P16 R2 read-only snapshot", () => {
  it("paginates, sorts deterministically, streams bodies and never sends a mutating command", async () => {
    const harness = await createHarness();
    const snapshotRoot = join(harness.workRoot, "snapshot");
    await mkdir(snapshotRoot);
    const commands: unknown[] = [];
    const client = {
      async send(command: unknown) {
        commands.push(command);
        if (command instanceof ListObjectsV2Command) {
          return command.input.ContinuationToken === undefined
            ? {
                Contents: [{ Key: "z-last.txt" }, { Key: "nested/b.txt" }],
                IsTruncated: true,
                NextContinuationToken: "page-2",
              }
            : { Contents: [{ Key: "a-first.txt" }], IsTruncated: false };
        }
        if (command instanceof GetObjectCommand) {
          const key = String(command.input.Key);
          return {
            ContentLength: Buffer.byteLength(key),
            Body: (async function* () {
              yield Buffer.from(key.slice(0, 2));
              yield Buffer.from(key.slice(2));
            })(),
          };
        }
        throw new Error("unexpected command");
      },
    };

    const result = await materializeR2Snapshot({
      client,
      ListObjectsV2Command,
      GetObjectCommand,
      bucket: "lessenc-staging-private",
      destinationRoot: snapshotRoot,
    });

    expect(result.objectKeys).toEqual(["a-first.txt", "nested/b.txt", "z-last.txt"]);
    expect(commands.filter((command) => command instanceof ListObjectsV2Command)).toHaveLength(2);
    expect(
      commands
        .filter((command) => command instanceof GetObjectCommand)
        .map((command) => (command as GetObjectCommand).input.Key),
    ).toEqual(result.objectKeys);
    expect(
      commands.every(
        (command) => command instanceof ListObjectsV2Command || command instanceof GetObjectCommand,
      ),
    ).toBe(true);
    await expect(readFile(join(snapshotRoot, "nested", "b.txt"), "utf8")).resolves.toBe(
      "nested/b.txt",
    );
  });

  it.each(["", "../escape", "a/../escape", "/absolute", "C:/absolute", "a\\escape"])(
    "rejects unsafe object key %j before GetObject",
    async (key) => {
      const harness = await createHarness();
      const snapshotRoot = join(harness.workRoot, "snapshot");
      await mkdir(snapshotRoot);
      const getObject = vi.fn();
      const client = {
        async send(command: unknown) {
          if (command instanceof ListObjectsV2Command) {
            return { Contents: [{ Key: key }], IsTruncated: false };
          }
          getObject();
          return {};
        },
      };

      await expect(
        materializeR2Snapshot({
          client,
          ListObjectsV2Command,
          GetObjectCommand,
          bucket: "lessenc-staging-private",
          destinationRoot: snapshotRoot,
        }),
      ).rejects.toThrow("P16_HOSTED_BACKUP_OBJECT_KEY_UNSAFE");
      expect(getObject).not.toHaveBeenCalled();
    },
  );

  it("fails if a destination file unexpectedly exists", async () => {
    const harness = await createHarness();
    const snapshotRoot = join(harness.workRoot, "snapshot");
    await mkdir(snapshotRoot);
    await writeFile(join(snapshotRoot, "existing.txt"), "do-not-overwrite", "utf8");
    const client = {
      async send(command: unknown) {
        if (command instanceof ListObjectsV2Command) {
          return { Contents: [{ Key: "existing.txt" }], IsTruncated: false };
        }
        return { ContentLength: 3, Body: Buffer.from("new") };
      },
    };

    await expect(
      materializeR2Snapshot({
        client,
        ListObjectsV2Command,
        GetObjectCommand,
        bucket: "lessenc-staging-private",
        destinationRoot: snapshotRoot,
      }),
    ).rejects.toThrow("P16_HOSTED_BACKUP_OBJECT_MATERIALIZATION_FAILED");
    await expect(readFile(join(snapshotRoot, "existing.txt"), "utf8")).resolves.toBe(
      "do-not-overwrite",
    );
  });
});

describe("P16 hosted backup ordering, publication and cleanup", () => {
  it("runs a controlled manual backup without manufacturing automated provenance or authoritative RPO PASS", async () => {
    const harness = await createHarness();
    const trace: string[] = [];
    const dependencies = successfulDependencies(trace);

    const result = (await runP16HostedBackupOrchestrator(
      input(harness),
      dependencies,
    )) as Readonly<{
      backupId: string;
      bundleDirectory: string;
      observation: Record<string, unknown>;
      rpo: Record<string, unknown>;
      rpoAuthority: string;
      providerSchedulerAttestation: string;
    }>;

    expect(trace).toEqual([
      "database-validate",
      "sdk-resolve",
      "database-dump",
      "r2-snapshot",
      "bundle",
      "verify",
      "manual-rpo",
    ]);
    expect(result.backupId).toBe("p16-hosted-auto-20261002T123456789Z-0123456789abcdef");
    expect(Object.keys(result.observation).sort()).toEqual(
      [
        "evidenceType",
        "evidenceScope",
        "provenance",
        "outcome",
        "observedAt",
        "latestVerifiedBackupAt",
      ].sort(),
    );
    expect(result.observation.provenance).toBe("MANUAL_CONTROLLED_OBSERVATION");
    expect(result.rpo).toMatchObject({ status: "UNKNOWN" });
    expect(result.rpoAuthority).toBe("NOT_AUTHORITATIVE");
    expect(result.providerSchedulerAttestation).toBe("NOT_APPLICABLE_MANUAL_EXECUTION");
    expect(() => evaluateP16HostedRpoEvidence(result.observation)).toThrow(
      "P16_RPO_HOSTED_EVIDENCE_INVALID",
    );
    expect(dependencies.evaluateHostedRpoEvidence).not.toHaveBeenCalled();
    await expect(readFile(join(result.bundleDirectory, "manifest.json"), "utf8")).resolves.toBe(
      "{}\n",
    );
    await expect(readdir(harness.workRoot)).resolves.toEqual([]);

    const index = JSON.parse(
      await readFile(String(harness.env.P16_BACKUP_INDEX_FILE), "utf8"),
    ) as unknown[];
    expect(index).toEqual([{ id: result.backupId, createdAt: NOW }]);
    const observation = JSON.parse(
      await readFile(join(harness.historyRoot, `${result.backupId}.observation.json`), "utf8"),
    ) as Record<string, unknown>;
    const history = JSON.parse(
      await readFile(join(harness.historyRoot, `${result.backupId}.run.json`), "utf8"),
    ) as Record<string, unknown>;
    const serializedEvidence = JSON.stringify({ index, observation, history });
    for (const secret of [
      harness.env.DB_RUNTIME_URL,
      harness.env.DATABASE_URL,
      harness.env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID,
      harness.env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY,
      harness.env.P16_BACKUP_ENCRYPTION_KEY,
    ]) {
      expect(serializedEvidence).not.toContain(secret);
    }
    expect(serializedEvidence).not.toContain("process.env");
    expect(history).toMatchObject({
      historyVersion: 2,
      executionContext: "CONTROLLED_MANUAL",
      observationProvenance: "MANUAL_CONTROLLED_OBSERVATION",
      rpoAuthority: "NOT_AUTHORITATIVE",
      providerSchedulerAttestation: "NOT_APPLICABLE_MANUAL_EXECUTION",
      outcome: "SUCCESS",
      objectCount: 1,
      totalSnapshotBytes: 8,
      failureCode: null,
    });
  });

  it("reserves automated provider observation for scheduled compatibility and marks provider attestation pending", async () => {
    const harness = await createHarness();
    const trace: string[] = [];
    const dependencies = successfulDependencies(trace);

    const result = (await runP16HostedBackupOrchestrator(
      scheduledInput(harness),
      dependencies,
    )) as Readonly<{
      observation: Record<string, unknown>;
      rpo: Record<string, unknown>;
      rpoEvaluation: Record<string, unknown>;
      executionContext: string;
      rpoAuthority: string;
      providerSchedulerAttestation: string;
      history: Record<string, unknown>;
    }>;

    expect(trace).toEqual([
      "database-validate",
      "sdk-resolve",
      "database-dump",
      "r2-snapshot",
      "bundle",
      "verify",
      "scheduled-rpo",
    ]);
    expect(result.observation.provenance).toBe("AUTOMATED_PROVIDER_OBSERVATION");
    expect(evaluateP16HostedRpoEvidence(result.observation)).toMatchObject({ status: "PASS" });
    expect(result.rpoEvaluation).toMatchObject({ status: "PASS" });
    expect(result.rpo).toMatchObject({
      status: "UNKNOWN",
      candidateAssessment: "PASS",
      reason: "PROVIDER_SCHEDULER_ATTESTATION_PENDING",
    });
    expect(result.executionContext).toBe("PROVIDER_SCHEDULED");
    expect(result.rpoAuthority).toBe("PENDING_PROVIDER_SCHEDULER_CORRELATION");
    expect(result.providerSchedulerAttestation).toBe("PENDING_INDEPENDENT_PROVIDER_HISTORY");
    expect(result.history).toMatchObject({
      historyVersion: 2,
      executionContext: "PROVIDER_SCHEDULED",
      observationProvenance: "AUTOMATED_PROVIDER_OBSERVATION",
      rpoAuthority: "PENDING_PROVIDER_SCHEDULER_CORRELATION",
      providerSchedulerAttestation: "PENDING_INDEPENDENT_PROVIDER_HISTORY",
    });
    expect(dependencies.measureRpo).not.toHaveBeenCalled();
  });

  it("does not publish observation/index on failed verification, cleans plaintext and only removes the broken current bundle", async () => {
    const harness = await createHarness();
    const historical = join(harness.outputRoot, "historical-valid-backup");
    await mkdir(historical);
    await writeFile(join(historical, "manifest.json"), "historical", "utf8");
    const dependencies = successfulDependencies();
    dependencies.verifyBundle.mockRejectedValueOnce(new Error("P16_RECOVERY_MANIFEST_UNREADABLE"));

    await expect(runP16HostedBackupOrchestrator(input(harness), dependencies)).rejects.toThrow(
      "P16_RECOVERY_MANIFEST_UNREADABLE",
    );

    await expect(readdir(harness.workRoot)).resolves.toEqual([]);
    await expect(readFile(join(historical, "manifest.json"), "utf8")).resolves.toBe("historical");
    const outputEntries = await readdir(harness.outputRoot);
    expect(outputEntries).toEqual(["historical-valid-backup"]);
    const historyEntries = await readdir(harness.historyRoot);
    expect(historyEntries).toHaveLength(1);
    expect(historyEntries[0]).toMatch(/\.run\.json$/u);
    expect(historyEntries.some((name) => name.endsWith(".observation.json"))).toBe(false);
    await expect(readFile(String(harness.env.P16_BACKUP_INDEX_FILE), "utf8")).rejects.toMatchObject(
      {
        code: "ENOENT",
      },
    );
    const history = JSON.parse(
      await readFile(join(harness.historyRoot, String(historyEntries[0])), "utf8"),
    ) as Record<string, unknown>;
    expect(history).toMatchObject({
      outcome: "FAIL",
      failureCode: "P16_RECOVERY_MANIFEST_UNREADABLE",
      verifiedBackupAt: null,
    });
  });

  it("cleans the unique plaintext workspace after a snapshot failure", async () => {
    const harness = await createHarness();
    const dependencies = successfulDependencies();
    dependencies.materializeSnapshot.mockRejectedValueOnce(
      new Error("P16_HOSTED_BACKUP_OBJECT_MATERIALIZATION_FAILED"),
    );

    await expect(runP16HostedBackupOrchestrator(input(harness), dependencies)).rejects.toThrow(
      "P16_HOSTED_BACKUP_OBJECT_MATERIALIZATION_FAILED",
    );
    await expect(readdir(harness.workRoot)).resolves.toEqual([]);
    expect(dependencies.createBundle).not.toHaveBeenCalled();
    expect(dependencies.verifyBundle).not.toHaveBeenCalled();
  });
});

describe("P16 metadata index and bounded cleanup", () => {
  it("validates the exact index schema, rejects duplicates and keeps deterministic ordering", async () => {
    const harness = await createHarness();
    const indexFile = String(harness.env.P16_BACKUP_INDEX_FILE);
    await writeFile(indexFile, `${JSON.stringify([{ id: "existing", createdAt: NOW }])}\n`, "utf8");

    await expect(
      updateBackupIndexAtomic({ indexFile, backupId: "existing", createdAt: NOW, now: NOW }),
    ).rejects.toThrow("P16_RETENTION_DUPLICATE_BACKUP_ID");

    await writeFile(
      indexFile,
      `${JSON.stringify([{ id: "existing", createdAt: NOW, secret: "forbidden" }])}\n`,
      "utf8",
    );
    await expect(
      updateBackupIndexAtomic({ indexFile, backupId: "new", createdAt: NOW, now: NOW }),
    ).rejects.toThrow("P16_RETENTION_ENTRY_INVALID");
  });

  it("hands a complete replacement to the atomic writer and never emits a deletion plan", async () => {
    const harness = await createHarness();
    const indexFile = String(harness.env.P16_BACKUP_INDEX_FILE);
    const writeJsonAtomic = vi.fn(async () => undefined);
    const updated = await updateBackupIndexAtomic({
      indexFile,
      backupId: "new-backup",
      createdAt: NOW,
      now: NOW,
      writeJsonAtomic,
    });

    expect(updated).toEqual([{ id: "new-backup", createdAt: NOW }]);
    expect(writeJsonAtomic).toHaveBeenCalledWith(indexFile, updated);
    expect(JSON.stringify(updated)).not.toContain("notRetained");
    await expect(readdir(harness.historyRoot)).resolves.toEqual([]);
  });

  it("refuses recursive cleanup outside the exact current-run workspace", async () => {
    const harness = await createHarness();
    const arbitrary = join(harness.workRoot, "arbitrary-caller-directory");
    await mkdir(arbitrary);
    await writeFile(join(arbitrary, "keep.txt"), "keep", "utf8");

    await expect(
      cleanupHostedBackupWorkspace({
        workspace: arbitrary,
        workRoot: harness.workRoot,
        repositoryRoot: harness.repositoryRoot,
        outputRoot: harness.outputRoot,
      }),
    ).rejects.toThrow("P16_HOSTED_BACKUP_WORKSPACE_CLEANUP_REFUSED");
    await expect(readFile(join(arbitrary, "keep.txt"), "utf8")).resolves.toBe("keep");
  });

  it("generates a deterministic scheduler-provenance backup id under an injected clock", () => {
    expect(createHostedBackupId({ now: NOW, randomSuffix: "0123456789abcdef" })).toBe(
      "p16-hosted-auto-20261002T123456789Z-0123456789abcdef",
    );
  });
});
