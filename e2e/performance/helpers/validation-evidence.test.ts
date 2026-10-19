import { describe, expect, it } from "vitest";

import {
  collectValidationEvidence,
  sanitizeValidationCommand,
  sanitizeValidationOutput,
} from "../../../scripts/p17-validation-evidence.mjs";

describe("P17 validation evidence sanitation", () => {
  it("redacts database credentials, authorization values and the local repository path", () => {
    const sanitized = sanitizeValidationOutput(
      "C:\\repo mysql://user:password@db/test Authorization: Bearer abc access_token=xyz",
      "C:\\repo",
    );
    expect(sanitized).toContain("<REPOSITORY_ROOT>");
    expect(sanitized).toContain("mysql://<REDACTED>@db/test");
    expect(sanitized).not.toContain("password");
    expect(sanitized).not.toContain("Bearer abc");
    expect(sanitized).not.toContain("xyz");
  });
  it("never persists arguments, including credential-shaped values", () => {
    const result = sanitizeValidationCommand("node", [
      "-e",
      "console.log('not-in-evidence')",
      "--password=synthetic-test-secret",
    ]);
    expect(result).toEqual([
      "node",
      "<ARGUMENT_REDACTED>",
      "<ARGUMENT_REDACTED>",
      "<ARGUMENT_REDACTED>",
    ]);
    expect(JSON.stringify(result)).not.toContain("synthetic-test-secret");
    expect(JSON.stringify(result)).not.toContain("not-in-evidence");
  });

  it("rejects non-allowlisted subprocess commands", () => {
    expect(() => sanitizeValidationCommand("curl", ["https://example.invalid"])).toThrow(
      "P17_VALIDATION_COMMAND_NOT_ALLOWED",
    );
  });

  it("rejects path-selected executables instead of trusting an allowlisted basename", () => {
    expect(() => sanitizeValidationCommand("C:\\untrusted\\node.exe", ["--version"])).toThrow(
      "P17_VALIDATION_COMMAND_PATH_FORBIDDEN",
    );
  });

  it("redacts sensitive argument and environment values echoed on stdout and stderr", () => {
    const argumentSecret = "synthetic-f02-argument-secret-7f36";
    const environmentSecret = "synthetic-f02-environment-token-91b4";
    const evidence = collectValidationEvidence({
      label: "f02-echo-redaction",
      command: "node",
      args: [
        "-e",
        "process.stdout.write(process.argv[1]); process.stderr.write(process.env.P17_F02_TEST_TOKEN);",
        `password=${argumentSecret}`,
      ],
      repositoryRoot: process.cwd(),
      environment: { ...process.env, P17_F02_TEST_TOKEN: environmentSecret },
    });
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain(argumentSecret);
    expect(serialized).not.toContain(environmentSecret);
    expect(evidence.command).toEqual([
      "node",
      "<ARGUMENT_REDACTED>",
      "<ARGUMENT_REDACTED>",
      "<ARGUMENT_REDACTED>",
    ]);
    expect(evidence.output).toMatchObject({
      stdout: "<REDACTED>",
      stderr: "<REDACTED>",
    });
  });
});
