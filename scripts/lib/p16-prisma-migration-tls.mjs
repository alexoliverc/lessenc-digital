import { URL } from "node:url";

export const PRISMA_CONFIG_ONLY_URL = "mysql://127.0.0.1:1/lessenc_unconfigured";

function configurationError(code) {
  return new Error(code);
}

function parseStagingMigrationUrl(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw configurationError("P16_PRISMA_MIGRATION_DATABASE_URL_INVALID");
  }

  let database;

  try {
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw configurationError("P16_PRISMA_MIGRATION_DATABASE_URL_INVALID");
  }

  if (url.protocol !== "mysql:" || !url.hostname || !url.username || !url.password || !database) {
    throw configurationError("P16_PRISMA_MIGRATION_DATABASE_URL_INVALID");
  }

  return url;
}

function canonicalizeStagingTls(url) {
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "sslaccept" || normalizedKey === "sslcert") {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.set("sslaccept", "strict");
}

export function resolvePrismaDatasourceUrl({ appEnvironment, databaseUrl }) {
  if (databaseUrl === undefined) {
    return PRISMA_CONFIG_ONLY_URL;
  }

  if (appEnvironment !== "staging") {
    return databaseUrl;
  }

  const url = parseStagingMigrationUrl(databaseUrl);

  canonicalizeStagingTls(url);

  return url.toString();
}
