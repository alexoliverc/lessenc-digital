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
