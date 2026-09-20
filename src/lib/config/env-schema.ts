import { isAbsolute } from "node:path";

import { z } from "zod";

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const p13GoogleTagEnvSchema = z.object({
  GTM_CONTAINER_ID: z.preprocess(
    (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^GTM-[A-Z0-9]+$/)
      .optional(),
  ),
});
const p08CommercialEnvSchema = z.object({
  P08_PRODUCT_ID: z.string().uuid(),
  P08_OFFER_ID: z.string().uuid(),
});

const p09SubmissionEnvSchema = z.object({
  P09_SUBMISSION_SECRET: z.string().min(32),
});

const p11BuyerSessionEnvSchema = z.object({
  P11_BUYER_SESSION_SECRET: z.string().min(32),
});

const p12AdminAuthEnvSchema = z.object({
  P12_ADMIN_AUTH_SECRET: z.string().min(32),
});

const p16ReadinessEnvSchema = z.object({
  P16_READINESS_TOKEN: z.string().min(32),
});

const p11PrivateStorageEnvSchema = z.object({
  PRIVATE_FILE_STORAGE_PATH: z
    .string()
    .min(1)
    .refine((value) => isAbsolute(value), "PRIVATE_FILE_STORAGE_PATH must be absolute"),
});

const p16PrivateStorageDriverEnvSchema = z.object({
  PRIVATE_STORAGE_DRIVER: z.enum(["local-filesystem", "hosted"]).default("local-filesystem"),
});

type ServerEnvInput = {
  APP_ENV?: string;
  APP_URL?: string;
  NODE_ENV?: string;
};

type P13GoogleTagEnvInput = {
  GTM_CONTAINER_ID?: string | undefined;
};
type P08CommercialEnvInput = {
  P08_PRODUCT_ID?: string | undefined;
  P08_OFFER_ID?: string | undefined;
};

type P09SubmissionEnvInput = {
  P09_SUBMISSION_SECRET?: string | undefined;
};

type P11BuyerSessionEnvInput = {
  P11_BUYER_SESSION_SECRET?: string | undefined;
};

type P12AdminAuthEnvInput = {
  P12_ADMIN_AUTH_SECRET?: string | undefined;
};

type P16ReadinessEnvInput = {
  P16_READINESS_TOKEN?: string | undefined;
};

type P11PrivateStorageEnvInput = {
  PRIVATE_FILE_STORAGE_PATH?: string | undefined;
};

type P16PrivateStorageDriverEnvInput = {
  PRIVATE_STORAGE_DRIVER?: string | undefined;
};

export function parseServerEnv(input: ServerEnvInput) {
  const parsed = serverEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP13GoogleTagEnv(input: P13GoogleTagEnvInput) {
  const parsed = p13GoogleTagEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P13 Google Tag configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze({
    GTM_CONTAINER_ID: parsed.data.GTM_CONTAINER_ID ?? null,
  });
}
export function parseP08CommercialEnv(input: P08CommercialEnvInput) {
  const parsed = p08CommercialEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P08 commercial configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP09SubmissionEnv(input: P09SubmissionEnvInput) {
  const parsed = p09SubmissionEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P09 submission configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}
export function parseP11BuyerSessionEnv(input: P11BuyerSessionEnvInput) {
  const parsed = p11BuyerSessionEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P11 buyer session configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP12AdminAuthEnv(input: P12AdminAuthEnvInput) {
  const parsed = p12AdminAuthEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P12 admin auth configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP16ReadinessEnv(input: P16ReadinessEnvInput) {
  const parsed = p16ReadinessEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P16 readiness configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP11PrivateStorageEnv(input: P11PrivateStorageEnvInput) {
  const parsed = p11PrivateStorageEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P11 private storage configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}

export function parseP16PrivateStorageDriverEnv(input: P16PrivateStorageDriverEnvInput) {
  const parsed = p16PrivateStorageDriverEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid P16 private storage configuration: ${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze(parsed.data);
}
