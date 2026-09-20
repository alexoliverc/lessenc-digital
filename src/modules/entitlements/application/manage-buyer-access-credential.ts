import {
  createP11CorrelationId,
  p11Observability,
} from "../../../lib/observability/p11-observability";
import type { BuyerAccessCredentialSecretService } from "./buyer-access-credential";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type RevokeBuyerAccessCredentialResult = "REVOKED" | "NOOP";

export type ReissuedBuyerAccessCredential = Readonly<{
  credentialId: string;
  orderId: string;
  rawCredential: string;
}>;

export interface BuyerAccessCredentialLifecycleRepository {
  revoke(orderId: string, expectedCredentialId: string): Promise<RevokeBuyerAccessCredentialResult>;

  reissue(
    orderId: string,
    expectedCredentialId: string,
    newSecretHash: string,
  ): Promise<
    Readonly<{
      credentialId: string;
      orderId: string;
    }>
  >;
}

function requireUuid(value: string, error: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(error);
  }

  return value.toLowerCase();
}

export class RevokeBuyerAccessCredential {
  constructor(private readonly repository: BuyerAccessCredentialLifecycleRepository) {}

  async execute(
    orderId: string,
    expectedCredentialId: string,
  ): Promise<RevokeBuyerAccessCredentialResult> {
    const normalizedOrderId = requireUuid(orderId, "INVALID_BUYER_ACCESS_ORDER_ID");

    const normalizedCredentialId = requireUuid(
      expectedCredentialId,
      "INVALID_BUYER_ACCESS_CREDENTIAL_ID",
    );

    const correlationId = createP11CorrelationId();

    try {
      return await this.repository.revoke(normalizedOrderId, normalizedCredentialId);
    } catch (error) {
      p11Observability.error("credential_recovery_failed", {
        correlationId,
        surface: "CREDENTIAL_RECOVERY",
        outcome: "FAILED",
        failureCode: "CREDENTIAL_REVOCATION_FAILED",
      });

      throw error;
    }
  }
}

export class ReissueBuyerAccessCredential {
  constructor(
    private readonly repository: BuyerAccessCredentialLifecycleRepository,
    private readonly secretService: BuyerAccessCredentialSecretService,
  ) {}

  async execute(
    orderId: string,
    expectedCredentialId: string,
  ): Promise<ReissuedBuyerAccessCredential> {
    const normalizedOrderId = requireUuid(orderId, "INVALID_BUYER_ACCESS_ORDER_ID");

    const normalizedCredentialId = requireUuid(
      expectedCredentialId,
      "INVALID_BUYER_ACCESS_CREDENTIAL_ID",
    );

    const correlationId = createP11CorrelationId();

    try {
      const material = this.secretService.issue();

      const persisted = await this.repository.reissue(
        normalizedOrderId,
        normalizedCredentialId,
        material.secretHash,
      );

      return Object.freeze({
        credentialId: persisted.credentialId,
        orderId: persisted.orderId,
        rawCredential: material.rawCredential,
      });
    } catch (error) {
      p11Observability.error("credential_recovery_failed", {
        correlationId,
        surface: "CREDENTIAL_RECOVERY",
        outcome: "FAILED",
        failureCode: "CREDENTIAL_REISSUE_FAILED",
      });

      throw error;
    }
  }
}
