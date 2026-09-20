import { defineConfig } from "prisma/config";

import { resolvePrismaDatasourceUrl } from "./scripts/lib/p16-prisma-migration-tls.mjs";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: resolvePrismaDatasourceUrl({
      appEnvironment: process.env.APP_ENV,
      databaseUrl: process.env.DATABASE_URL,
    }),
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
