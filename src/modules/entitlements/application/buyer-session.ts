export type BuyerSubject = Readonly<{
  customerId: string;
  orderId: string;
  credentialId: string;
}>;

export type BuyerSession = BuyerSubject &
  Readonly<{
    version: 1;
    purpose: "BUYER_SESSION";
    issuedAt: number;
    expiresAt: number;
  }>;

export interface BuyerSessionService {
  issue(subject: BuyerSubject): string;

  verify(token: unknown): BuyerSession | null;
}
