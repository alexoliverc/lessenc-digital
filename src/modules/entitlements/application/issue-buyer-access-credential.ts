import type { BuyerAccessCredentialSecretService } from "./buyer-access-credential";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type IssuedBuyerAccessCredential = Readonly<{
  credentialId: string;
  orderId: string;
  rawCredential: string;
}>;

export interface BuyerAccessCredentialRepository {
  issue(
    orderId: string,
    secretHash: string,
  ): Promise<Readonly<{ credentialId: string; orderId: string }>>;
}

export class IssueBuyerAccessCredential {
  constructor(
    private readonly repository: BuyerAccessCredentialRepository,
    private readonly secretService: BuyerAccessCredentialSecretService,
  ) {}

  async execute(orderId: string): Promise<IssuedBuyerAccessCredential> {
    if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId)) {
      throw new Error("INVALID_BUYER_ACCESS_ORDER_ID");
    }

    const material = this.secretService.issue();

    const persisted = await this.repository.issue(orderId.toLowerCase(), material.secretHash);

    return Object.freeze({
      credentialId: persisted.credentialId,
      orderId: persisted.orderId,
      rawCredential: material.rawCredential,
    });
  }
}
