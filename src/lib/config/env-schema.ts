import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

type ServerEnvInput = {
  APP_ENV?: string;
  APP_URL?: string;
  NODE_ENV?: string;
};

export function parseServerEnv(input: ServerEnvInput) {
  const parsed = serverEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}
