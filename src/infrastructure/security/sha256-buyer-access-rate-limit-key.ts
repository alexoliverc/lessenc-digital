import { createHash } from "node:crypto";

import {
  BUYER_ACCESS_RATE_LIMIT_SCOPES,
  type BuyerAccessRateLimitScope,
} from "../../modules/entitlements/application/buyer-access-rate-limit";

const MAX_MATERIAL_LENGTH = 4096;

function validScope(value: string): value is BuyerAccessRateLimitScope {
  return (BUYER_ACCESS_RATE_LIMIT_SCOPES as readonly string[]).includes(value);
}

export class Sha256BuyerAccessRateLimitKey {
  hash(scope: BuyerAccessRateLimitScope, material: string): string {
    if (!validScope(scope)) {
      throw new Error("INVALID_RATE_LIMIT_SCOPE");
    }

    if (
      typeof material !== "string" ||
      material.length < 1 ||
      material.length > MAX_MATERIAL_LENGTH
    ) {
      throw new Error("INVALID_RATE_LIMIT_MATERIAL");
    }

    return createHash("sha256")
      .update(JSON.stringify([1, scope, material]), "utf8")
      .digest("hex");
  }
}
