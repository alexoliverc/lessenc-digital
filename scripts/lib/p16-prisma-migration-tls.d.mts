export const PRISMA_CONFIG_ONLY_URL: "mysql://127.0.0.1:1/lessenc_unconfigured";

export type PathApi = Readonly<{
  isAbsolute(path: string): boolean;
  relative(from: string, to: string): string;
}>;

export type PrismaDatasourceInput = Readonly<{
  appEnvironment: string | undefined;
  databaseUrl: string | undefined;
  databaseTlsCaFile: string | undefined;
  prismaDirectory: string;
}>;

export function resolvePrismaDatasourceUrl(input: PrismaDatasourceInput, pathApi?: PathApi): string;
