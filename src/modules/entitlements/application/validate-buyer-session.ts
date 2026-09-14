import type { BuyerSessionService, BuyerSubject } from "./buyer-session";

export interface BuyerSessionValidationRepository {
  validateSession(subject: BuyerSubject): Promise<BuyerSubject | null>;
}

export class ValidateBuyerSession {
  constructor(
    private readonly repository: BuyerSessionValidationRepository,
    private readonly sessionService: BuyerSessionService,
  ) {}

  async execute(token: unknown): Promise<BuyerSubject> {
    const session = this.sessionService.verify(token);

    if (!session) {
      throw new Error("SESSION_INVALID");
    }

    const subject = await this.repository.validateSession({
      customerId: session.customerId,
      orderId: session.orderId,
      credentialId: session.credentialId,
    });

    if (!subject) {
      throw new Error("SESSION_INVALID");
    }

    return Object.freeze({
      customerId: subject.customerId,
      orderId: subject.orderId,
      credentialId: subject.credentialId,
    });
  }
}
