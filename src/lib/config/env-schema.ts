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

const p16HostedPrivateStorageEnvSchema = z.object({
  P16_PRIVATE_STORAGE_PROVIDER: z.literal("r2"),
  PRIVATE_STORAGE_S3_ENDPOINT: z
    .string()
    .url()
    .refine((value) => {
      try {
        const endpoint = new URL(value);

        return (
          endpoint.protocol === "https:" &&
          endpoint.username === "" &&
          endpoint.password === "" &&
          endpoint.pathname === "/" &&
          endpoint.search === "" &&
          endpoint.hash === "" &&
          /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/iu.test(endpoint.hostname)
        );
      } catch {
        return false;
      }
    }, "PRIVATE_STORAGE_S3_ENDPOINT must be a canonical Cloudflare R2 HTTPS endpoint"),
  PRIVATE_STORAGE_S3_REGION: z.literal("auto"),
  PRIVATE_STORAGE_S3_BUCKET: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/u),
  PRIVATE_STORAGE_S3_ACCESS_KEY_ID: z.string().min(16).max(128),
  PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(32).max(256),
  PRIVATE_STORAGE_HEALTHCHECK_KEY: z.literal("_health/p16-readiness"),
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

type P16HostedPrivateStorageEnvInput = {
  P16_PRIVATE_STORAGE_PROVIDER?: string | undefined;
  PRIVATE_STORAGE_S3_ENDPOINT?: string | undefined;
  PRIVATE_STORAGE_S3_REGION?: string | undefined;
  PRIVATE_STORAGE_S3_BUCKET?: string | undefined;
  PRIVATE_STORAGE_S3_ACCESS_KEY_ID?: string | undefined;
  PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY?: string | undefined;
  PRIVATE_STORAGE_HEALTHCHECK_KEY?: string | undefined;
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

export function parseP16HostedPrivateStorageEnv(input: P16HostedPrivateStorageEnvInput) {
  const parsed = p16HostedPrivateStorageEnvSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `Invalid P16 hosted private storage configuration: ${z.prettifyError(parsed.error)}`,
    );
  }

  return Object.freeze(parsed.data);
}
