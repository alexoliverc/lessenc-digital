import type { BuyerAccessCredentialSecretService } from "./buyer-access-credential";
import type { BuyerSessionService, BuyerSubject } from "./buyer-session";

export interface BuyerAccessCredentialExchangeRepository {
  exchange(secretHash: string): Promise<BuyerSubject | null>;
}

export type BuyerAccessExchangeResult = Readonly<{
  sessionToken: string;
}>;

export class ExchangeBuyerAccessCredential {
  constructor(
    private readonly repository: BuyerAccessCredentialExchangeRepository,
    private readonly secretService: BuyerAccessCredentialSecretService,
    private readonly sessionService: BuyerSessionService,
  ) {}

  async execute(rawCredential: unknown): Promise<BuyerAccessExchangeResult> {
    const hashed = this.secretService.hash(rawCredential);

    if (!hashed.ok) {
      throw new Error("ACCESS_INVALID");
    }

    const subject = await this.repository.exchange(hashed.secretHash);

    if (!subject) {
      throw new Error("ACCESS_INVALID");
    }

    return Object.freeze({
      sessionToken: this.sessionService.issue(subject),
    });
  }
}
