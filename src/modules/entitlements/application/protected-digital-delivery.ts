import type { AuthorizedDigitalResource } from "./authorize-digital-resource";
import type { BuyerSubject } from "./buyer-session";
import {
  PrivateResourceStorageError,
  type PrivateResourceBody,
  type PrivateResourceStorage,
  type PrivateResourceStorageErrorCode,
} from "./private-resource-storage";

const PROTECTED_DELIVERY_MEDIA_TYPES = new Set<string>([
  "application/pdf",
  "application/zip",
  "application/epub+zip",
]);

function isProtectedDeliveryMediaType(mediaType: string): boolean {
  return PROTECTED_DELIVERY_MEDIA_TYPES.has(mediaType);
}
export type DigitalDeliveryAuditOutcome = "SUCCEEDED" | "FAILED";

export type DigitalDeliveryAuditRecord = Readonly<{
  entitlementId: string;
  resourceId: string;
  buyerAccessCredentialId: string;
  outcome: DigitalDeliveryAuditOutcome;
  failureCode: string | null;
}>;

export interface DigitalDeliveryAuditRepository {
  record(record: DigitalDeliveryAuditRecord): Promise<void>;
}

export interface DigitalResourceAuthorizer {
  execute(subject: BuyerSubject, resourceId: unknown): Promise<AuthorizedDigitalResource>;
}

export type PreparedProtectedDelivery = Readonly<{
  resourceId: string;
  entitlementId: string;
  buyerAccessCredentialId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  body: PrivateResourceBody;
}>;

function storageFailureCode(error: unknown): PrivateResourceStorageErrorCode {
  if (error instanceof PrivateResourceStorageError) {
    return error.code;
  }

  return "STORAGE_UNAVAILABLE";
}

async function recordOrThrow(
  repository: DigitalDeliveryAuditRepository,
  record: DigitalDeliveryAuditRecord,
): Promise<void> {
  try {
    await repository.record(record);
  } catch {
    throw new Error("DELIVERY_AUDIT_UNAVAILABLE");
  }
}

export class PrepareProtectedDelivery {
  constructor(
    private readonly authorizeResource: DigitalResourceAuthorizer,
    private readonly storage: PrivateResourceStorage,
    private readonly audit: DigitalDeliveryAuditRepository,
  ) {}

  async execute(subject: BuyerSubject, resourceId: unknown): Promise<PreparedProtectedDelivery> {
    /*
     * Authorization happens first.
     *
     * Authorization failures are NOT delivery events,
     * because no valid protected-delivery context has
     * been established yet.
     */
    const authorized = await this.authorizeResource.execute(subject, resourceId);

    const auditBase = Object.freeze({
      entitlementId: authorized.entitlementId,
      resourceId: authorized.resourceId,
      buyerAccessCredentialId: subject.credentialId,
    });

    if (!isProtectedDeliveryMediaType(authorized.mediaType)) {
      await recordOrThrow(
        this.audit,
        Object.freeze({
          ...auditBase,
          outcome: "FAILED",
          failureCode: "UNSUPPORTED_MEDIA_TYPE",
        }),
      );

      throw new Error("DELIVERY_UNAVAILABLE");
    }

    try {
      const metadata = await this.storage.stat(authorized.storageKey);

      const body = await this.storage.open(authorized.storageKey);

      /*
       * Do not record SUCCEEDED here.
       *
       * A body being opened is not equivalent to an HTTP
       * delivery having started. C5.3 owns that boundary.
       */
      return Object.freeze({
        ...auditBase,
        filename: authorized.filename,
        mediaType: authorized.mediaType,
        sizeBytes: metadata.sizeBytes,
        body,
      });
    } catch (error) {
      const failureCode = storageFailureCode(error);

      await recordOrThrow(
        this.audit,
        Object.freeze({
          ...auditBase,
          outcome: "FAILED",
          failureCode,
        }),
      );

      throw new Error("DELIVERY_UNAVAILABLE", {
        cause: error,
      });
    }
  }
}

export class RecordProtectedDeliveryOutcome {
  constructor(private readonly audit: DigitalDeliveryAuditRepository) {}

  async succeeded(delivery: PreparedProtectedDelivery): Promise<void> {
    await recordOrThrow(
      this.audit,
      Object.freeze({
        entitlementId: delivery.entitlementId,
        resourceId: delivery.resourceId,
        buyerAccessCredentialId: delivery.buyerAccessCredentialId,
        outcome: "SUCCEEDED",
        failureCode: null,
      }),
    );
  }

  async streamFailed(delivery: PreparedProtectedDelivery): Promise<void> {
    await recordOrThrow(
      this.audit,
      Object.freeze({
        entitlementId: delivery.entitlementId,
        resourceId: delivery.resourceId,
        buyerAccessCredentialId: delivery.buyerAccessCredentialId,
        outcome: "FAILED",
        failureCode: "STREAM_FAILED",
      }),
    );
  }
}
