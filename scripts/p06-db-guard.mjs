import process from "node:process";
import { URL } from "node:url";

const mode = process.argv[2];

function requireLocalDatabase(variable, expectedName) {
  const value = process.env[variable];
  if (!value) throw new Error(`${variable} is required for ${mode}`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} is not a valid database URL`);
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    database !== expectedName ||
    !url.username ||
    !url.password
  ) {
    throw new Error(
      `${variable} must target the isolated local ${expectedName} database on port 3307`,
    );
  }
  return url;
}

try {
  if (mode === "dev") {
    if (process.env.APP_ENV !== "local") throw new Error("APP_ENV must be local for migrate dev");
    const database = requireLocalDatabase("DATABASE_URL", "lessenc_dev");
    const shadow = requireLocalDatabase("SHADOW_DATABASE_URL", "lessenc_shadow");
    if (database.href === shadow.href) throw new Error("Development and shadow URLs must differ");
  } else if (mode === "test" || mode === "test-deploy" || mode === "fresh-deploy") {
    if (process.env.APP_ENV !== "test") throw new Error("APP_ENV must be test");
    const testDatabase = mode === "fresh-deploy" ? "lessenc_test_rebuild" : "lessenc_test";
    if (mode === "test") {
      const testUrl = process.env.TEST_DATABASE_URL;
      const selectedName = testUrl && new URL(testUrl).pathname.slice(1);
      if (!["lessenc_test", "lessenc_test_rebuild"].includes(selectedName)) {
        throw new Error("Integration tests require an explicitly named P06 test database");
      }
      requireLocalDatabase("TEST_DATABASE_URL", selectedName);
    } else {
      requireLocalDatabase("TEST_DATABASE_URL", testDatabase);
    }
    if (mode === "test-deploy") requireLocalDatabase("DATABASE_URL", "lessenc_test");
    if (mode === "fresh-deploy") requireLocalDatabase("DATABASE_URL", "lessenc_test_rebuild");
  } else if (mode === "status") {
    if (process.env.APP_ENV === "local") requireLocalDatabase("DATABASE_URL", "lessenc_dev");
    else if (process.env.APP_ENV === "test") requireLocalDatabase("DATABASE_URL", "lessenc_test");
    else throw new Error("Migration status is limited to local or test in P06");
  } else {
    throw new Error("Unknown P06 database guard mode");
  }
  process.stdout.write(`P06 database target verified for ${mode}.\n`);
} catch (error) {
  process.stderr.write(`P06 database guard refused operation: ${error.message}\n`);
  process.exitCode = 1;
}
