import { defineConfig } from "prisma/config";

// Generation and static builds may run without a database. Port 1 is deliberately unreachable.
const configOnlyUrl = "mysql://127.0.0.1:1/lessenc_unconfigured";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? configOnlyUrl,
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
