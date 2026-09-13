import type { PaymentStatus } from "../domain/payment";

export type PaymentMethod = "PIX" | "CREDIT_CARD";

export type PaymentPresentation =
  | Readonly<{
      kind: "PIX";
      qrCode?: string;
      qrCodeBase64?: string;
      ticketUrl?: string;
    }>
  | Readonly<{ kind: "CHALLENGE"; url: string }>
  | null;

export type ProviderReviewReason =
  | "UNKNOWN_STATUS"
  | "INCONSISTENT_STATUS"
  | "INVALID_FINANCIAL_DATA"
  | "UNSUPPORTED_PAYMENT_METHOD"
  | "UNEXPECTED_TRANSACTION_COUNT"
  | "UNEXPECTED_CAPTURE_MODE"
  | "PARTIAL_REFUND"
  | "CHARGEBACK"
  | "UNPROVEN_FULL_REFUND"
  | "INVALID_PRESENTATION";

/** Only authenticated provider observations cross this port; never HTTP/browser payloads. */
export type ProviderSnapshot = Readonly<{
  providerOrderId: string;
  providerPaymentId: string | null;
  providerAccountId: string | null;
  externalReference: string | null;
  amountMinor: number | null;
  paymentAmountMinor: number | null;
  currency: string | null;
  paymentMethod: PaymentMethod | null;
  paidAmountMinor: number | null;
  refundedAmountMinor: number | null;
  status: PaymentStatus;
  requiresReview: boolean;
  reviewReason: ProviderReviewReason | null;
  /** Opaque, sanitized journal fields: application code must not branch on these strings. */
  providerStatus: string;
  providerStatusDetail: string | null;
  occurredAt: string | null;
  createdAt: string | null;
  presentation: PaymentPresentation;
}>;

export type CreateProviderPayment = Readonly<{
  paymentId: string;
  orderId: string;
  amountMinor: number;
  currency: "BRL";
  paymentMethod: PaymentMethod;
  payerEmail: string;
  /** Ephemeral only: never persist, log, journal or include in a fingerprint. */
  card?: Readonly<{
    token: string;
    paymentMethodId: string;
    installments: 1;
    paymentType: "credit_card";
  }>;
}>;

export type SearchProviderPayments = Readonly<{
  externalReference: string;
  beginDate: string;
  endDate: string;
}>;

export type ProviderSearchResult = Readonly<{
  snapshots: readonly ProviderSnapshot[];
  /** False means bounds or inconsistent pagination prevented an exhaustive search. */
  complete: boolean;
}>;

export interface PaymentProvider {
  createPayment(input: CreateProviderPayment): Promise<ProviderSnapshot>;
  getSnapshot(providerOrderId: string): Promise<ProviderSnapshot>;
  searchPayments(input: SearchProviderPayments): Promise<ProviderSearchResult>;
}

export type ProviderErrorCode =
  | "CONFIGURATION"
  | "INVALID_INPUT"
  | "INVALID_RESPONSE"
  | "AMBIGUOUS"
  | "TRANSIENT"
  | "UNAVAILABLE";

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    readonly retryable = false,
    readonly providerOrderId: string | null = null,
  ) {
    super(code);
    this.name = "ProviderError";
  }
}
