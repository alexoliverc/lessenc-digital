export type ComposeService = Readonly<{
  environment?: Readonly<Record<string, string>>;
}>;

export type ComposeEnvironmentAudit = Readonly<{
  schemaVersion: 1;
  state: "PASS";
  services: readonly Readonly<{ name: string; environmentNames: readonly string[] }>[];
  databaseIdentity: "LOOPBACK_SYNTHETIC_DISPOSABLE";
  providerCredentials: "ABSENT";
}>;

export function auditComposeEnvironment(
  services: Readonly<Record<string, ComposeService>>,
): ComposeEnvironmentAudit;

export function verifyComposeEnvironment(repositoryRoot?: string): ComposeEnvironmentAudit;
