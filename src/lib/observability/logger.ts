type LogLevel = "info" | "warn" | "error";

type LogContext = Readonly<Record<string, unknown>>;

const REDACTED_KEYS = new Set([
  "password",
  "authorization",
  "cookie",
  "set-cookie",
  "access_token",
  "accessToken",
  "secret",
  "token",
]);

function redact(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      REDACTED_KEYS.has(key) ? "[REDACTED]" : value,
    ]),
  );
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(context),
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
