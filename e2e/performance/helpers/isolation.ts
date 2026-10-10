import { isAbsolute, relative, resolve } from "node:path";

export const PERFORMANCE_BASE_URL = "http://127.0.0.1:3100";
export const PERFORMANCE_DATABASE_HOST = "127.0.0.1";
export const PERFORMANCE_DATABASE_PORT = "3307";
export const PERFORMANCE_DATABASE_NAME = "lessenc_p17_perf_test";
export const PERFORMANCE_DATABASE_USER = "lessenc_p17_perf";

const forbiddenExternalEnvironmentNames = [
  "MERCADOPAGO_ACCESS_TOKEN",
  "P16_PRIVATE_STORAGE_PROVIDER",
  "PRIVATE_STORAGE_S3_ENDPOINT",
  "PRIVATE_STORAGE_S3_REGION",
  "PRIVATE_STORAGE_S3_BUCKET",
  "PRIVATE_STORAGE_S3_ACCESS_KEY_ID",
  "PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY",
  "PRIVATE_STORAGE_HEALTHCHECK_KEY",
  "GTM_CONTAINER_ID",
  "GOOGLE_ADS_CONVERSION_ID",
  "GOOGLE_ADS_CONVERSION_LABEL",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
] as const;

const safeSystemEnvironmentNames = [
  "PATH",
  "Path",
  "SYSTEMROOT",
  "SystemRoot",
  "COMSPEC",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
] as const;

export type Environment = Readonly<Record<string, string | undefined>>;

export function assertPerformanceTargetEnvironment(environment: Environment): void {
  const target = environment.P17_TARGET;

  if (target !== undefined && target !== "local") {
    throw new Error("P17_PERFORMANCE_TARGET_NOT_LOCAL");
  }

  if (Object.prototype.hasOwnProperty.call(environment, "P17_BASE_URL")) {
    throw new Error("P17_PERFORMANCE_BASE_URL_OVERRIDE_FORBIDDEN");
  }

  if (Object.prototype.hasOwnProperty.call(environment, "P17_ALLOW_HOSTED_READ_ONLY")) {
    throw new Error("P17_PERFORMANCE_HOSTED_ATTESTATION_FORBIDDEN");
  }
}

export function assertPerformanceExecutionContract(
  input: Readonly<{
    retries: number;
    workers: number;
    serviceWorkers: string;
    baseURL: string;
  }>,
): void {
  if (input.retries !== 0) throw new Error("P17_PERFORMANCE_RETRIES_NOT_ZERO");
  if (input.workers !== 1) throw new Error("P17_PERFORMANCE_WORKERS_NOT_ONE");
  if (input.serviceWorkers !== "block")
    throw new Error("P17_PERFORMANCE_SERVICE_WORKERS_NOT_BLOCKED");
  if (input.baseURL !== PERFORMANCE_BASE_URL) throw new Error("P17_PERFORMANCE_BASE_URL_NOT_LOCAL");
}

export type SafeDatabaseIdentity = Readonly<{
  host: typeof PERFORMANCE_DATABASE_HOST;
  port: typeof PERFORMANCE_DATABASE_PORT;
  database: typeof PERFORMANCE_DATABASE_NAME;
  user: typeof PERFORMANCE_DATABASE_USER;
}>;

export function validatePerformanceDatabaseUrl(rawUrl: string | undefined): SafeDatabaseIdentity {
  if (rawUrl === undefined || rawUrl.trim() === "") {
    throw new Error("P17_PERFORMANCE_DATABASE_URL_MISSING");
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("P17_PERFORMANCE_DATABASE_URL_INVALID");
  }

  let database: string;
  let user: string;
  let password: string;

  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error("P17_PERFORMANCE_DATABASE_URL_INVALID");
  }

  if (parsed.protocol !== "mysql:") throw new Error("P17_PERFORMANCE_DATABASE_PROTOCOL_INVALID");
  if (parsed.hostname !== PERFORMANCE_DATABASE_HOST)
    throw new Error("P17_PERFORMANCE_DATABASE_HOST_NOT_LOOPBACK");
  if (parsed.port !== PERFORMANCE_DATABASE_PORT)
    throw new Error("P17_PERFORMANCE_DATABASE_PORT_NOT_AUTHORIZED");
  if (database !== PERFORMANCE_DATABASE_NAME)
    throw new Error("P17_PERFORMANCE_DATABASE_NAME_INVALID");
  if (user !== PERFORMANCE_DATABASE_USER) throw new Error("P17_PERFORMANCE_DATABASE_USER_INVALID");
  if (!password.startsWith("p17_perf_"))
    throw new Error("P17_PERFORMANCE_DATABASE_IDENTITY_NOT_SYNTHETIC");
  if (parsed.search !== "" || parsed.hash !== "")
    throw new Error("P17_PERFORMANCE_DATABASE_URL_OPTIONS_FORBIDDEN");

  return Object.freeze({
    host: PERFORMANCE_DATABASE_HOST,
    port: PERFORMANCE_DATABASE_PORT,
    database: PERFORMANCE_DATABASE_NAME,
    user: PERFORMANCE_DATABASE_USER,
  });
}

export function performanceStorageRoot(repositoryRoot: string): string {
  return resolve(repositoryRoot, "tmp", "p17-performance-storage");
}

export function assertPerformanceStorage(
  input: Readonly<{
    driver: string | undefined;
    path: string | undefined;
    repositoryRoot: string;
  }>,
): string {
  if (input.driver !== "local-filesystem") {
    throw new Error("P17_PERFORMANCE_STORAGE_DRIVER_INVALID");
  }

  if (input.path === undefined || !isAbsolute(input.path)) {
    throw new Error("P17_PERFORMANCE_STORAGE_PATH_INVALID");
  }

  const allowedRoot = performanceStorageRoot(input.repositoryRoot);
  const candidate = resolve(input.path);
  const relation = relative(allowedRoot, candidate);

  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("P17_PERFORMANCE_STORAGE_PATH_OUTSIDE_SYNTHETIC_ROOT");
  }

  const publicRoot = resolve(input.repositoryRoot, "public");
  const publicRelation = relative(publicRoot, candidate);

  if (publicRelation === "" || (!publicRelation.startsWith("..") && !isAbsolute(publicRelation))) {
    throw new Error("P17_PERFORMANCE_STORAGE_PATH_PUBLIC");
  }

  return candidate;
}

export function assertNoExternalServiceEnvironment(environment: Environment): void {
  for (const name of forbiddenExternalEnvironmentNames) {
    if (Object.prototype.hasOwnProperty.call(environment, name)) {
      throw new Error("P17_PERFORMANCE_EXTERNAL_SERVICE_ENV_FORBIDDEN");
    }
  }
}

export type PerformanceEnvironmentInput = Readonly<{
  databaseUrl: string | undefined;
  repositoryRoot: string;
  storagePath?: string;
  runId: string;
}>;

export function buildPerformanceChildEnvironment(
  parentEnvironment: Environment,
  input: PerformanceEnvironmentInput,
): Readonly<Record<string, string>> {
  assertPerformanceTargetEnvironment(parentEnvironment);
  validatePerformanceDatabaseUrl(input.databaseUrl);

  if (!/^p17-perf-[a-z0-9][a-z0-9._-]{7,80}$/u.test(input.runId)) {
    throw new Error("P17_PERFORMANCE_RUN_ID_INVALID");
  }

  const storagePath = assertPerformanceStorage({
    driver: "local-filesystem",
    path: input.storagePath ?? performanceStorageRoot(input.repositoryRoot),
    repositoryRoot: input.repositoryRoot,
  });

  const child: Record<string, string> = {};

  for (const name of safeSystemEnvironmentNames) {
    const value = parentEnvironment[name];
    if (value !== undefined) child[name] = value;
  }

  Object.assign(child, {
    APP_ENV: "local",
    NODE_ENV: "production",
    APP_URL: PERFORMANCE_BASE_URL,
    P17_TARGET: "local",
    P17_PERF_MODE: "infrastructure-only",
    P17_PERF_RUN_ID: input.runId,
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: input.databaseUrl,
    DB_RUNTIME_URL: input.databaseUrl,
    PRIVATE_STORAGE_DRIVER: "local-filesystem",
    PRIVATE_FILE_STORAGE_PATH: storagePath,
    P08_PRODUCT_ID: "17000000-0000-4000-8000-000000000101",
    P08_OFFER_ID: "17000000-0000-4000-8000-000000000102",
    P09_SUBMISSION_SECRET: "p17_perf_submission_secret_synthetic_only_0001",
    P10_PAYMENT_CONTINUATION_SECRET: "p17_perf_payment_continuation_synthetic_0001",
    P11_BUYER_SESSION_SECRET: "p17_perf_buyer_session_synthetic_only_0001",
    P12_ADMIN_AUTH_SECRET: "p17_perf_admin_auth_synthetic_only_000001",
  });

  assertNoExternalServiceEnvironment(child);

  return Object.freeze(child);
}

export type CapsuleNetworkSnapshot = Readonly<{
  interfaces: readonly string[];
  ipv4Routes: readonly string[];
  ipv6Routes: readonly string[];
  dnsServers: readonly string[];
}>;

export function assertCapsuleNetworkSnapshot(snapshot: CapsuleNetworkSnapshot): void {
  const interfaces = [...snapshot.interfaces].sort();

  if (interfaces.length !== 1 || interfaces[0] !== "lo") {
    throw new Error("P17_PERFORMANCE_CAPSULE_INTERFACE_INVALID");
  }

  const routes = [...snapshot.ipv4Routes, ...snapshot.ipv6Routes];
  if (routes.some((route) => /(^|\s)default(\s|$)/u.test(route))) {
    throw new Error("P17_PERFORMANCE_CAPSULE_DEFAULT_ROUTE_PRESENT");
  }

  if (
    snapshot.dnsServers.some(
      (server) => server !== "127.0.0.1" && server !== "127.0.0.11" && server !== "::1",
    )
  ) {
    throw new Error("P17_PERFORMANCE_CAPSULE_EXTERNAL_DNS_PRESENT");
  }
}

export type OperationalIsolationEvidence = Readonly<{
  snapshot: CapsuleNetworkSnapshot;
  loopbackNode: boolean;
  loopbackChromium: boolean;
  loopbackDatabase: boolean;
  nodeEgressBlocked: boolean;
  chromiumEgressBlocked: boolean;
}>;

export function assertOperationalIsolation(evidence: OperationalIsolationEvidence): void {
  assertCapsuleNetworkSnapshot(evidence.snapshot);

  if (!evidence.loopbackNode || !evidence.loopbackChromium || !evidence.loopbackDatabase) {
    throw new Error("P17_PERFORMANCE_CAPSULE_LOOPBACK_NOT_PROVEN");
  }

  if (!evidence.nodeEgressBlocked || !evidence.chromiumEgressBlocked) {
    throw new Error("P17_PERFORMANCE_CAPSULE_EGRESS_NOT_PROVEN");
  }
}
