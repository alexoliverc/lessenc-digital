import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

export function verifyHash(bytes, expected) {
  assert.match(expected, /^[A-F0-9]{64}$/u, "P17_TOOLCHAIN_HASH_CONTRACT_INVALID");
  assert.equal(
    createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    expected,
    "P17_TOOLCHAIN_HASH_MISMATCH",
  );
}

export function verifyElf(bytes) {
  assert.ok(bytes.length >= 64, "P17_TOOLCHAIN_ELF_TRUNCATED");
  assert.ok(bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])), "P17_TOOLCHAIN_ELF_MAGIC");
  assert.ok(
    bytes[4] === 2 && bytes[5] === 1 && bytes.readUInt16LE(18) === 62,
    "P17_TOOLCHAIN_ELF_AMD64_REQUIRED",
  );
}

function regularBytes(path) {
  const stat = lstatSync(path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), "P17_TOOLCHAIN_REGULAR_FILE_REQUIRED");
  return readFileSync(path);
}

export function verifyInputs(manifest, input) {
  for (const item of [manifest.npm, manifest.openssl, manifest.prisma]) {
    assert.equal(item.file, item.file.split(/[\\/]/u).at(-1), "P17_TOOLCHAIN_FILENAME_INVALID");
    verifyHash(regularBytes(join(input, item.file)), item.sha256);
  }
  const engine = gunzipSync(regularBytes(join(input, manifest.prisma.file)), {
    maxOutputLength: 64 * 1024 * 1024,
  });
  verifyHash(engine, manifest.prisma.executableSha256);
  verifyElf(engine);
  return engine;
}

function main() {
  const [command, manifestPath, input, output] = process.argv.slice(2);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (command === "inputs") {
    const engine = verifyInputs(manifest, input);
    if (output) writeFileSync(output, engine, { flag: "wx", mode: 0o550 });
  } else if (command === "libraries") {
    for (const [name, expected] of Object.entries(manifest.openssl.libraries)) {
      const bytes = regularBytes(join(input, name));
      verifyHash(bytes, expected);
      verifyElf(bytes);
    }
  } else {
    throw new Error("P17_TOOLCHAIN_COMMAND_INVALID");
  }
  process.stdout.write(`P17_TOOLCHAIN_${command.toUpperCase()}_PASS\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch {
    process.stderr.write("P17_TOOLCHAIN_VERIFICATION_FAILED\n");
    process.exitCode = 1;
  }
}
