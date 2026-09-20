import {
  parseP08CommercialEnv,
  parseP09SubmissionEnv,
  parseP11BuyerSessionEnv,
  parseP11PrivateStorageEnv,
  parseP13GoogleTagEnv,
  parseP16ReadinessEnv,
  parseP16PrivateStorageDriverEnv,
  parseP16HostedPrivateStorageEnv,
  parseServerEnv,
} from "./env-schema";

export const serverEnv = parseServerEnv(process.env);

export function getP13GoogleTagEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P13 Google Tag configuration is server-only");
  }

  return parseP13GoogleTagEnv({
    GTM_CONTAINER_ID: process.env.GTM_CONTAINER_ID,
  });
}
export function getP08CommercialEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P08 commercial configuration is server-only");
  }

  return parseP08CommercialEnv({
    P08_PRODUCT_ID: process.env.P08_PRODUCT_ID,
    P08_OFFER_ID: process.env.P08_OFFER_ID,
  });
}

export function getP09SubmissionEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P09 submission configuration is server-only");
  }

  return parseP09SubmissionEnv({
    P09_SUBMISSION_SECRET: process.env.P09_SUBMISSION_SECRET,
  });
}
export function getP11BuyerSessionEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P11 buyer session configuration is server-only");
  }

  return parseP11BuyerSessionEnv({
    P11_BUYER_SESSION_SECRET: process.env.P11_BUYER_SESSION_SECRET,
  });
}
export function getP11PrivateStorageEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P11 private storage configuration is server-only");
  }

  return parseP11PrivateStorageEnv({
    PRIVATE_FILE_STORAGE_PATH: process.env.PRIVATE_FILE_STORAGE_PATH,
  });
}

export function getP16ReadinessEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P16 readiness configuration is server-only");
  }

  return parseP16ReadinessEnv({
    P16_READINESS_TOKEN: process.env.P16_READINESS_TOKEN,
  });
}

export function getP16PrivateStorageDriverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P16 private storage configuration is server-only");
  }

  return parseP16PrivateStorageDriverEnv({
    PRIVATE_STORAGE_DRIVER: process.env.PRIVATE_STORAGE_DRIVER,
  });
}

// P16-H3-B2-HOSTED-STORAGE-ENV
export function getP16HostedPrivateStorageEnv() {
  if (typeof window !== "undefined") {
    throw new Error("P16 hosted private storage configuration is server-only");
  }

  return parseP16HostedPrivateStorageEnv({
    P16_PRIVATE_STORAGE_PROVIDER: process.env.P16_PRIVATE_STORAGE_PROVIDER,
    PRIVATE_STORAGE_S3_ENDPOINT: process.env.PRIVATE_STORAGE_S3_ENDPOINT,
    PRIVATE_STORAGE_S3_REGION: process.env.PRIVATE_STORAGE_S3_REGION,
    PRIVATE_STORAGE_S3_BUCKET: process.env.PRIVATE_STORAGE_S3_BUCKET,
    PRIVATE_STORAGE_S3_ACCESS_KEY_ID: process.env.PRIVATE_STORAGE_S3_ACCESS_KEY_ID,
    PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY: process.env.PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY,
    PRIVATE_STORAGE_HEALTHCHECK_KEY: process.env.PRIVATE_STORAGE_HEALTHCHECK_KEY,
  });
}
