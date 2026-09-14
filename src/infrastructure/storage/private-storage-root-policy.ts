import { isAbsolute, relative, resolve, sep } from "node:path";

export class PrivateStorageRootPolicyError extends Error {
  constructor() {
    super("PRIVATE_STORAGE_ROOT_NOT_PRIVATE");

    this.name = "PrivateStorageRootPolicyError";
  }
}

function isInsideOrEqual(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);

  return (
    relation === "" ||
    (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation))
  );
}

export function assertPrivateStorageRootIsPrivate(
  storageRoot: string,
  applicationRoot: string = process.cwd(),
): void {
  if (!isAbsolute(storageRoot)) {
    throw new PrivateStorageRootPolicyError();
  }

  const canonicalStorageRoot = resolve(storageRoot);

  const canonicalApplicationRoot = resolve(applicationRoot);

  const forbiddenPublicRoots = [
    resolve(canonicalApplicationRoot, "public"),
    resolve(canonicalApplicationRoot, "static"),
    resolve(canonicalApplicationRoot, ".next", "static"),
  ];

  for (const forbiddenRoot of forbiddenPublicRoots) {
    if (isInsideOrEqual(forbiddenRoot, canonicalStorageRoot)) {
      throw new PrivateStorageRootPolicyError();
    }
  }
}
