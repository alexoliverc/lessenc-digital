import type { BuyerSubject } from "./buyer-session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type AuthorizedDigitalResource = Readonly<{
  resourceId: string;
  entitlementId: string;
  storageKey: string;
  filename: string;
  mediaType: string;
}>;

export interface ResourceAuthorizationRepository {
  authorize(subject: BuyerSubject, resourceId: string): Promise<AuthorizedDigitalResource | null>;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export class AuthorizeDigitalResource {
  constructor(private readonly repository: ResourceAuthorizationRepository) {}

  async execute(subject: BuyerSubject, resourceId: unknown): Promise<AuthorizedDigitalResource> {
    if (
      !isUuid(subject.customerId) ||
      !isUuid(subject.orderId) ||
      !isUuid(subject.credentialId) ||
      !isUuid(resourceId)
    ) {
      throw new Error("RESOURCE_NOT_AVAILABLE");
    }

    const authorized = await this.repository.authorize(
      Object.freeze({
        customerId: subject.customerId.toLowerCase(),
        orderId: subject.orderId.toLowerCase(),
        credentialId: subject.credentialId.toLowerCase(),
      }),
      resourceId.toLowerCase(),
    );

    if (!authorized) {
      throw new Error("RESOURCE_NOT_AVAILABLE");
    }

    return authorized;
  }
}
