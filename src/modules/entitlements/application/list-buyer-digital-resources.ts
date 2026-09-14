import type { BuyerSubject } from "./buyer-session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type BuyerDigitalResource = Readonly<{
  resourceId: string;
  filename: string;
  mediaType: string;
}>;

export interface BuyerResourceLibraryRepository {
  list(subject: BuyerSubject): Promise<readonly BuyerDigitalResource[]>;
}

function validSubject(subject: BuyerSubject): boolean {
  return (
    UUID_PATTERN.test(subject.customerId) &&
    UUID_PATTERN.test(subject.orderId) &&
    UUID_PATTERN.test(subject.credentialId)
  );
}

export class ListBuyerDigitalResources {
  constructor(private readonly repository: BuyerResourceLibraryRepository) {}

  async execute(subject: BuyerSubject): Promise<readonly BuyerDigitalResource[]> {
    if (!validSubject(subject)) {
      throw new Error("SESSION_INVALID");
    }

    const resources = await this.repository.list(
      Object.freeze({
        customerId: subject.customerId.toLowerCase(),
        orderId: subject.orderId.toLowerCase(),
        credentialId: subject.credentialId.toLowerCase(),
      }),
    );

    return Object.freeze(
      resources.map((resource) =>
        Object.freeze({
          resourceId: resource.resourceId,
          filename: resource.filename,
          mediaType: resource.mediaType,
        }),
      ),
    );
  }
}
