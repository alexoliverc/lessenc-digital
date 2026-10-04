import { execFileSync } from "node:child_process";

const RELEASE_COMMIT_PATTERN = /^[0-9a-f]{40}$/iu;

export function resolveRepositoryHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

export function validateReleaseCommitBinding(releaseCommit, resolveHead = resolveRepositoryHead) {
  const failures = [];
  const releaseCommitIsValid = RELEASE_COMMIT_PATTERN.test(releaseCommit ?? "");

  if (!releaseCommitIsValid) failures.push("P16_RELEASE_COMMIT_INVALID");

  let head;
  try {
    head = resolveHead().trim();
  } catch {
    failures.push("P16_RELEASE_COMMIT_HEAD_UNVERIFIABLE");
  }

  if (head !== undefined) {
    if (!RELEASE_COMMIT_PATTERN.test(head)) {
      failures.push("P16_RELEASE_COMMIT_HEAD_UNVERIFIABLE");
    } else if (releaseCommitIsValid && releaseCommit !== head) {
      failures.push("P16_RELEASE_COMMIT_DOES_NOT_MATCH_HEAD");
    }
  }

  return Object.freeze([...new Set(failures)].sort());
}

export function resolveStagingReleaseCommit(environment) {
  const stagingReleaseCommit = environment.STAGING_RELEASE_COMMIT;
  const p16ReleaseCommit = environment.P16_RELEASE_COMMIT;
  const failures = [];

  if (
    stagingReleaseCommit !== undefined &&
    p16ReleaseCommit !== undefined &&
    stagingReleaseCommit !== p16ReleaseCommit
  ) {
    failures.push("STAGING_RELEASE_COMMIT_CONFLICT");
  }

  return Object.freeze({
    releaseCommit: stagingReleaseCommit ?? p16ReleaseCommit,
    source:
      stagingReleaseCommit !== undefined
        ? "STAGING_RELEASE_COMMIT"
        : p16ReleaseCommit !== undefined
          ? "P16_RELEASE_COMMIT"
          : null,
    failures: Object.freeze(failures),
  });
}

export function validateStagingReleaseCommitBinding(
  environment,
  resolveHead = resolveRepositoryHead,
) {
  const resolved = resolveStagingReleaseCommit(environment);
  const failures = [...resolved.failures];
  const releaseCommitIsValid = RELEASE_COMMIT_PATTERN.test(resolved.releaseCommit ?? "");

  if (!releaseCommitIsValid) failures.push("STAGING_RELEASE_COMMIT_INVALID");

  let head;
  try {
    head = resolveHead().trim();
  } catch {
    failures.push("STAGING_RELEASE_COMMIT_HEAD_UNVERIFIABLE");
  }

  if (head !== undefined) {
    if (!RELEASE_COMMIT_PATTERN.test(head)) {
      failures.push("STAGING_RELEASE_COMMIT_HEAD_UNVERIFIABLE");
    } else if (releaseCommitIsValid && resolved.releaseCommit !== head) {
      failures.push("STAGING_RELEASE_COMMIT_DOES_NOT_MATCH_HEAD");
    }
  }

  return Object.freeze([...new Set(failures)].sort());
}
