#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", "3100"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_ENV: "local",
      APP_URL: "http://127.0.0.1:3100",
      NODE_ENV: "development",
      ...(process.env.P17_E2E_DATABASE === "true"
        ? {
            DB_RUNTIME_URL: process.env.TEST_DATABASE_URL,
            P08_PRODUCT_ID: "17000000-0000-4000-8000-000000000001",
            P08_OFFER_ID: "17000000-0000-4000-8000-000000000002",
            P09_SUBMISSION_SECRET: "p17-local-submission-secret-0000000000000001",
            P10_PAYMENT_CONTINUATION_SECRET: "p17-local-continuation-secret-000000000000001",
            P11_BUYER_SESSION_SECRET: "p17-local-buyer-session-secret-00000000000001",
            P12_ADMIN_AUTH_SECRET: "p17-local-admin-auth-secret-0000000000000001",
          }
        : {}),
    },
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
