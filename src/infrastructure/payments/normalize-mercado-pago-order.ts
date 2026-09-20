import type {
  PaymentMethod,
  PaymentPresentation,
  ProviderReviewReason,
  ProviderSnapshot,
} from "../../modules/payments/application/payment-provider";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
const string = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= 128 ? value : null;

export function decimalToMinor(value: unknown): number | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,7})\.\d{2}$/u.test(value)) return null;
  const [whole, fraction] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 4_294_967_295 ? minor : null;
}

export function minorToDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 4_294_967_295) {
    throw new Error("Invalid payment amount");
  }
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

const PENDING_PAIRS = new Set([
  "created/created",
  "processing/in_process",
  "processing/pending_review_manual",
  "processing/in_review",
  "in_review/in_review",
  "action_required/waiting_payment",
  "action_required/waiting_transfer",
  "action_required/waiting_capture",
  "action_required/pending_challenge",
  "action_required/waiting_retry",
]);
const FAILED_DETAILS = new Set([
  "failed",
  "bad_filled_card_data",
  "invalid_card_token",
  "high_risk",
  "rejected_by_issuer",
  "required_call_for_authorize",
  "max_attempts_exceeded",
  "card_disabled",
  "insufficient_amount",
  "amount_limit_exceeded",
  "processing_error",
  "invalid_installments",
  "3ds_challenge_expired",
  "card_insufficient_amount",
  "cc_rejected_3ds_challenge",
]);

function isMercadoPagoHost(hostname: string): boolean {
  return ["mercadopago.com", "mercadopago.com.br"].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

function safeMercadoPagoHttps(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      isMercadoPagoHost(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function safeThreeDsChallengeHttps(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
    const literalIp = /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) || /^\[.*\]$/u.test(hostname);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hostname.length > 0 &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !literalIp
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Treat unrecognized or incomplete provider data as review, never approval. */
export function normalizeMercadoPagoOrder(raw: unknown): ProviderSnapshot {
  const order = record(raw);
  if (!order || !string(order.id) || !/^ORD[A-Za-z0-9]+$/u.test(order.id as string)) {
    throw new Error("Invalid provider order response");
  }
  const transactions = record(order.transactions);
  const payments = transactions?.payments;
  const cardinalityValid = Array.isArray(payments) && payments.length === 1;
  const payment = cardinalityValid ? record(payments[0]) : null;
  const method = record(payment?.payment_method);
  const methodType = string(method?.type);
  const paymentMethod: PaymentMethod | null =
    methodType === "bank_transfer" && method?.id === "pix"
      ? "PIX"
      : methodType === "credit_card"
        ? "CREDIT_CARD"
        : null;
  const providerStatus = string(order.status) ?? "unknown";
  const providerStatusDetail = string(order.status_detail);
  const pair = `${providerStatus}/${providerStatusDetail ?? ""}`;
  let status: ProviderSnapshot["status"] = "UNKNOWN";
  let reviewReason: ProviderReviewReason | null = null;
  if (PENDING_PAIRS.has(pair)) status = "PENDING";
  else if (pair === "processed/accredited") status = "APPROVED";
  else if (providerStatus === "failed" && FAILED_DETAILS.has(providerStatusDetail ?? ""))
    status = "REJECTED";
  else if (
    pair === "canceled/canceled" ||
    pair === "expired/expired" ||
    pair === "canceled/expired"
  )
    status = "CANCELED";
  else if (pair === "refunded/refunded") status = "REFUNDED";
  else if (pair === "processed/partially_refunded") reviewReason = "PARTIAL_REFUND";
  else if (providerStatus === "charged_back") reviewReason = "CHARGEBACK";
  else reviewReason = "UNKNOWN_STATUS";

  const transactionStatus = string(payment?.status);
  const transactionDetail = string(payment?.status_detail);
  if (payment && transactionStatus && transactionDetail) {
    const transactionPair = `${transactionStatus}/${transactionDetail}`;
    const compatible =
      transactionPair === pair ||
      (status === "PENDING" && PENDING_PAIRS.has(transactionPair)) ||
      (status === "APPROVED" && transactionPair === "processed/accredited") ||
      (status === "REJECTED" && transactionStatus === "failed") ||
      (status === "CANCELED" && ["canceled", "expired"].includes(transactionStatus)) ||
      (status === "REFUNDED" && transactionPair === "refunded/refunded");
    if (!compatible) reviewReason = "INCONSISTENT_STATUS";
  }
  if (!cardinalityValid) reviewReason = "UNEXPECTED_TRANSACTION_COUNT";
  if (!string(payment?.id) || !string(order.user_id) || !string(order.external_reference)) {
    reviewReason = "INVALID_FINANCIAL_DATA";
  }
  if (!paymentMethod) reviewReason = "UNSUPPORTED_PAYMENT_METHOD";
  if (pair === "action_required/waiting_capture") reviewReason = "UNEXPECTED_CAPTURE_MODE";
  if (order.processing_mode !== "automatic") reviewReason = "INVALID_FINANCIAL_DATA";
  if (order.capture_mode !== undefined && order.capture_mode !== "automatic") {
    reviewReason = "UNEXPECTED_CAPTURE_MODE";
  }

  const amountMinor = decimalToMinor(order.total_amount);
  const paymentAmountMinor = decimalToMinor(payment?.amount);
  const currency = string(order.currency);
  if (!amountMinor || !paymentAmountMinor || !currency) reviewReason = "INVALID_FINANCIAL_DATA";
  const refunds = transactions?.refunds;
  let refundedAmountMinor: number | null = null;
  if (Array.isArray(refunds)) {
    refundedAmountMinor = refunds.reduce<number>((sum, entry) => {
      const refund = record(entry);
      if (
        !refund ||
        refund.status !== "approved" ||
        (refund.transaction_id !== undefined && refund.transaction_id !== payment?.id)
      ) {
        reviewReason = "UNPROVEN_FULL_REFUND";
        return sum;
      }
      const amount = decimalToMinor(refund.amount);
      if (amount === null) reviewReason = "UNPROVEN_FULL_REFUND";
      return amount === null ? sum : sum + amount;
    }, 0);
  }
  const paymentRefunded =
    payment?.refunded_amount === undefined ? null : decimalToMinor(payment.refunded_amount);
  if (
    paymentRefunded !== null &&
    refundedAmountMinor !== null &&
    paymentRefunded !== refundedAmountMinor
  )
    reviewReason = "UNPROVEN_FULL_REFUND";
  if (status === "REFUNDED" && (!refundedAmountMinor || refundedAmountMinor !== amountMinor)) {
    reviewReason = "UNPROVEN_FULL_REFUND";
  }

  let presentation: PaymentPresentation = null;
  if (paymentMethod === "PIX") {
    const qrCode =
      typeof method?.qr_code === "string" && method.qr_code.length <= 4096
        ? method.qr_code
        : undefined;
    const qrCodeBase64 =
      typeof method?.qr_code_base64 === "string" && method.qr_code_base64.length <= 128_000
        ? method.qr_code_base64
        : undefined;
    const ticketUrl = safeMercadoPagoHttps(method?.ticket_url);
    if (qrCode || qrCodeBase64 || ticketUrl)
      presentation = {
        kind: "PIX",
        ...(qrCode ? { qrCode } : {}),
        ...(qrCodeBase64 ? { qrCodeBase64 } : {}),
        ...(ticketUrl ? { ticketUrl } : {}),
      };
  }
  if (pair === "action_required/pending_challenge") {
    const url = safeThreeDsChallengeHttps(record(method?.transaction_security)?.url);
    if (!url) reviewReason = "INVALID_PRESENTATION";
    else if (status === "PENDING" && paymentMethod === "CREDIT_CARD" && reviewReason === null) {
      presentation = { kind: "CHALLENGE", url };
    }
  }
  const occurredAt = string(order.last_updated_date) ?? string(order.updated_date);
  const createdAt = string(order.created_date) ?? string(order.date_created);
  return Object.freeze({
    providerOrderId: order.id as string,
    providerPaymentId: string(payment?.id),
    providerAccountId: string(order.user_id),
    externalReference: string(order.external_reference),
    amountMinor,
    paymentAmountMinor,
    currency,
    paymentMethod,
    paidAmountMinor: decimalToMinor(payment?.paid_amount),
    refundedAmountMinor,
    status,
    requiresReview: reviewReason !== null,
    reviewReason,
    providerStatus,
    providerStatusDetail,
    occurredAt,
    createdAt,
    presentation,
  });
}
