import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { verifyElf, verifyHash, verifyInputs } from "./p17-toolchain-verify.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();
const elf = () => {
  const bytes = Buffer.alloc(64);
  bytes.set([127, 69, 76, 70, 2, 1]);
  bytes.writeUInt16LE(62, 18);
  return bytes;
};

test("rejects changed bytes and malformed hash contracts", () => {
  const bytes = Buffer.from("verified artifact");
  verifyHash(bytes, hash(bytes));
  assert.throws(() => verifyHash(Buffer.from("changed"), hash(bytes)));
  assert.throws(() => verifyHash(bytes, ""));
});

test("rejects truncated, non-ELF, wrong-class and wrong-architecture engines", () => {
  verifyElf(elf());
  assert.throws(() => verifyElf(Buffer.alloc(8)));
  for (const offset of [0, 4, 5, 18]) {
    const bytes = elf();
    bytes[offset] = 0;
    assert.throws(() => verifyElf(bytes));
  }
});

test("checks both compressed and executable checksums before materialization", () => {
  const root = mkdtempSync(join(tmpdir(), "p17-toolchain-"));
  try {
    const engine = elf();
    const compressed = gzipSync(engine);
    const manifest = {
      npm: { file: "npm.tgz", sha256: hash(Buffer.from("npm")) },
      openssl: { file: "ssl.deb", sha256: hash(Buffer.from("ssl")) },
      prisma: { file: "engine.gz", sha256: hash(compressed), executableSha256: hash(engine) },
    };
    writeFileSync(join(root, "npm.tgz"), "npm");
    writeFileSync(join(root, "ssl.deb"), "ssl");
    writeFileSync(join(root, "engine.gz"), compressed);
    assert.deepEqual(verifyInputs(manifest, root), engine);
    assert.throws(() =>
      verifyInputs(
        { ...manifest, prisma: { ...manifest.prisma, executableSha256: "0".repeat(64) } },
        root,
      ),
    );
    writeFileSync(join(root, "npm.tgz"), "tampered");
    assert.throws(() => verifyInputs(manifest, root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects non-regular files and symbolic-link toolchain inputs", () => {
  const root = mkdtempSync(join(tmpdir(), "p17-toolchain-fd-"));

  try {
    const engine = elf();
    const compressed = gzipSync(engine);

    writeFileSync(join(root, "npm.tgz"), "npm");
    writeFileSync(join(root, "ssl.deb"), "ssl");
    writeFileSync(join(root, "engine.gz"), compressed);

    const manifest = {
      npm: {
        file: "npm.tgz",
        sha256: hash(Buffer.from("npm")),
      },
      openssl: {
        file: "ssl.deb",
        sha256: hash(Buffer.from("ssl")),
      },
      prisma: {
        file: "engine.gz",
        sha256: hash(compressed),
        executableSha256: hash(engine),
      },
    };

    assert.deepEqual(verifyInputs(manifest, root), engine);

    mkdirSync(join(root, "directory-input"));

    assert.throws(() =>
      verifyInputs(
        {
          ...manifest,
          npm: {
            ...manifest.npm,
            file: "directory-input",
          },
        },
        root,
      ),
    );

    if (process.platform !== "win32") {
      symlinkSync(join(root, "npm.tgz"), join(root, "linked-input"));

      assert.throws(() =>
        verifyInputs(
          {
            ...manifest,
            npm: {
              ...manifest.npm,
              file: "linked-input",
            },
          },
          root,
        ),
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
