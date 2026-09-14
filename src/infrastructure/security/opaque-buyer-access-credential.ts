import { createHash, randomBytes } from "node:crypto";

import type {
  BuyerAccessCredentialHashResult,
  BuyerAccessCredentialMaterial,
  BuyerAccessCredentialSecretService,
} from "../../modules/entitlements/application/buyer-access-credential";

const CREDENTIAL_PREFIX = "lba_";
const SECRET_BYTES = 32;
const BASE64URL_SECRET_LENGTH = 43;
const CREDENTIAL_PATTERN = /^lba_[A-Za-z0-9_-]{43}$/u;

type RandomBytesSource = (size: number) => Buffer;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export class OpaqueBuyerAccessCredentialService implements BuyerAccessCredentialSecretService {
  constructor(private readonly randomSource: RandomBytesSource = randomBytes) {}

  issue(): BuyerAccessCredentialMaterial {
    const secret = this.randomSource(SECRET_BYTES);

    if (!Buffer.isBuffer(secret) || secret.length !== SECRET_BYTES) {
      throw new Error("BUYER_ACCESS_CREDENTIAL_RANDOM_SOURCE_INVALID");
    }

    const encoded = secret.toString("base64url");

    if (encoded.length !== BASE64URL_SECRET_LENGTH) {
      throw new Error("BUYER_ACCESS_CREDENTIAL_ENCODING_INVALID");
    }

    const rawCredential = `${CREDENTIAL_PREFIX}${encoded}`;

    return Object.freeze({
      rawCredential,
      secretHash: sha256Hex(rawCredential),
    });
  }

  hash(rawCredential: unknown): BuyerAccessCredentialHashResult {
    if (typeof rawCredential !== "string" || !CREDENTIAL_PATTERN.test(rawCredential)) {
      return Object.freeze({
        ok: false,
        reason: "MALFORMED_CREDENTIAL",
      });
    }

    return Object.freeze({
      ok: true,
      secretHash: sha256Hex(rawCredential),
    });
  }
}
