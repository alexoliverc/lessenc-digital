import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const p08CommercialEnvSchema = z.object({
  P08_PRODUCT_ID: z.string().uuid(),
  P08_OFFER_ID: z.string().uuid(),
});

type ServerEnvInput = {
  APP_ENV?: string;
  APP_URL?: string;
  NODE_ENV?: string;
};

type P08CommercialEnvInput = {
  P08_PRODUCT_ID?: string | undefined;
  P08_OFFER_ID?: string | undefined;
};

export function parseServerEnv(input: ServerEnvInput) {
  const parsed = serverEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP08CommercialEnv(input: P08CommercialEnvInput) {
  const parsed = p08CommercialEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P08 commercial configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}
