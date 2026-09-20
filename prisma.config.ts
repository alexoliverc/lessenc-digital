import { fileURLToPath } from "node:url";

import { defineConfig } from "prisma/config";

import { resolvePrismaDatasourceUrl } from "./scripts/lib/p16-prisma-migration-tls.mjs";

const prismaDirectory = fileURLToPath(new URL("./prisma/", import.meta.url));

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: resolvePrismaDatasourceUrl({
      appEnvironment: process.env.APP_ENV,
      databaseUrl: process.env.DATABASE_URL,
      databaseTlsCaFile: process.env.DB_TLS_CA_FILE,
      prismaDirectory,
    }),
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
