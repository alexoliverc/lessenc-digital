import { OBSERVABILITY_SERVICE_NAME } from "./contracts";

export type LogLevel = "info" | "warn" | "error";

export type LogContext = Readonly<Record<string, unknown>>;

export { OBSERVABILITY_SERVICE_NAME } from "./contracts";

const LOG_SCHEMA_VERSION = 1;

const APPLICATION_ENVIRONMENTS = new Set(["local", "test", "staging", "production"]);

const EVENT_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/u;

const REDACTED_KEYS = new Set([
  "password",
  "passwordhash",
  "authorization",
  "cookie",
  "cookies",
  "setcookie",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "secret",
  "webhooksecret",
  "mfasecret",
  "totpsecret",
  "backupcode",
  "backupcodes",
  "token",
  "sessionid",
  "sessiontoken",
  "adminsessionid",
  "buyersessiontoken",
  "databaseurl",
  "dbruntimeurl",
  "testdatabaseurl",
  "shadowdatabaseurl",
  "connectionstring",
  "privatefilestoragepath",
  "privatekey",
  "mysqlrootpassword",
  "p11buyersessionsecret",
  "p12adminauthsecret",
  "p09submissionsecret",
  "p10paymentcontinuationsecret",
  "mercadopayowebhooksecret",
  "mercadopagoaccesstoken",
  "metacapiaccesstoken",
  "email",
  "customeremail",
  "ip",
  "ipaddress",
  "useragent",
  "providerorderid",
  "providerpaymentid",
  "providereventid",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function shouldRedactKey(key: string): boolean {
  return REDACTED_KEYS.has(normalizeKey(key));
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return "[UNSUPPORTED]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return Object.freeze({
      name: value.name,
    });
  }

  if (typeof value !== "object") {
    return "[UNSUPPORTED]";
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((entry) => sanitizeValue(entry, seen));
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      sanitized[key] = shouldRedactKey(key) ? "[REDACTED]" : sanitizeValue(entry, seen);
    }

    return sanitized;
  } finally {
    seen.delete(value);
  }
}

function redact(context: LogContext): LogContext {
  return sanitizeValue(context, new WeakSet<object>()) as LogContext;
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  if (!EVENT_PATTERN.test(event)) {
    throw new Error("INVALID_OBSERVABILITY_EVENT");
  }

  const applicationEnvironment = APPLICATION_ENVIRONMENTS.has(process.env.APP_ENV ?? "")
    ? process.env.APP_ENV
    : "unknown";

  const record = {
    ...redact(context),
    schemaVersion: LOG_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    level,
    event,
    service: OBSERVABILITY_SERVICE_NAME,
    applicationEnvironment,
  };

  const serialized = JSON.stringify(record);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.info(serialized);
}

export const logger = Object.freeze({
  info(event: string, context?: LogContext) {
    write("info", event, context);
  },

  warn(event: string, context?: LogContext) {
    write("warn", event, context);
  },

  error(event: string, context?: LogContext) {
    write("error", event, context);
  },
});
