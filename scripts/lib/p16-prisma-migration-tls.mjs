import * as nativePath from "node:path";
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

function prismaRelativeCaPath(caFile, prismaDirectory, pathApi) {
  if (!caFile) throw configurationError("P16_PRISMA_MIGRATION_CA_REQUIRED");
  if (!pathApi.isAbsolute(caFile)) {
    throw configurationError("P16_PRISMA_MIGRATION_CA_MUST_BE_ABSOLUTE");
  }
  if (!pathApi.isAbsolute(prismaDirectory)) {
    throw configurationError("P16_PRISMA_DIRECTORY_MUST_BE_ABSOLUTE");
  }

  const relativePath = pathApi.relative(prismaDirectory, caFile);
  if (!relativePath || pathApi.isAbsolute(relativePath)) {
    throw configurationError("P16_PRISMA_MIGRATION_CA_PATH_UNREPRESENTABLE");
  }

  return relativePath.replaceAll("\\", "/");
}

function replaceTlsParameters(url, sslCertificatePath) {
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "sslaccept" || normalizedKey === "sslcert") {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.set("sslcert", sslCertificatePath);
  url.searchParams.set("sslaccept", "strict");
}

export function resolvePrismaDatasourceUrl(
  { appEnvironment, databaseUrl, databaseTlsCaFile, prismaDirectory },
  pathApi = nativePath,
) {
  if (databaseUrl === undefined) return PRISMA_CONFIG_ONLY_URL;
  if (appEnvironment !== "staging") return databaseUrl;

  const url = parseStagingMigrationUrl(databaseUrl);
  const sslCertificatePath = prismaRelativeCaPath(databaseTlsCaFile, prismaDirectory, pathApi);
  replaceTlsParameters(url, sslCertificatePath);

  return url.toString();
}
