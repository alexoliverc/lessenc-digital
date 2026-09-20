export const PRISMA_CONFIG_ONLY_URL: "mysql://127.0.0.1:1/lessenc_unconfigured";

export type PrismaDatasourceInput = Readonly<{
  appEnvironment: string | undefined;
  databaseUrl: string | undefined;
}>;

export function resolvePrismaDatasourceUrl(input: PrismaDatasourceInput): string;
