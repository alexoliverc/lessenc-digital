import { ProviderError } from "./payment-provider";
import { createCorrelationId } from "../../../lib/observability/correlation";
import { logger } from "../../../lib/observability/logger";
import type {
  CreateProviderPayment,
  PaymentMethod,
  PaymentPresentation,
  PaymentProvider,
  ProviderSnapshot,
} from "./payment-provider";

export type FinancialAttempt = Readonly<{
  paymentId: string;
  orderId: string;
  amountMinor: number;
  currency: "BRL";
  paymentMethod: PaymentMethod;
  payerEmail: string;
  status: string;
  providerOrderId: string | null;
  createdAt: Date;
  requiresReview: boolean;
}>;

export interface FinancialRepository {
  reserve(
    orderId: string,
    paymentMethod: PaymentMethod,
  ): Promise<{ attempt: FinancialAttempt; send: boolean }>;
  load(paymentId: string): Promise<FinancialAttempt | null>;
  findByProviderOrderId(providerOrderId: string): Promise<FinancialAttempt | null>;
  findRecoverableByOrderId(orderId: string): Promise<FinancialAttempt | null>;
  state(
    orderId: string,
  ): Promise<{ state: string; paymentId: string | null; orderId: string } | null>;
  markAmbiguous(paymentId: string): Promise<void>;
  rememberProviderOrderId(paymentId: string, providerOrderId: string): Promise<void>;
  claimReconciliation(paymentId: string, minimumIntervalMs: number): Promise<boolean>;
  recordRecoveryReview(
    paymentId: string,
    reason: "MULTIPLE_CANDIDATES" | "INCOMPLETE_SEARCH",
  ): Promise<void>;
  applyObservation(
    input: Readonly<{
      paymentId: string;
      snapshot: ProviderSnapshot;
      source: "CREATE_RESPONSE" | "WEBHOOK" | "RECONCILIATION" | "RECOVERY";
      providerEventId?: string;
    }>,
  ): Promise<"APPLIED" | "NOOP" | "REVIEW" | "REJECTED">;
}

export type FinancialObservationResult = Readonly<{
  orderId: string;
  paymentId: string;
  source: "CREATE_RESPONSE" | "WEBHOOK" | "RECONCILIATION" | "RECOVERY";
  result: "APPLIED" | "NOOP" | "REVIEW" | "REJECTED";
}>;

export interface FinancialObservationObserver {
  afterFinancialObservation(input: FinancialObservationResult): Promise<void>;
}

export type BuyerPaymentState = Readonly<{
  state:
    | "awaiting_payment"
    | "processing"
    | "challenge_required"
    | "approved"
    | "rejected"
    | "canceled"
    | "refunded"
    | "unknown"
    | "review_required";
  presentation: PaymentPresentation;
}>;

function publicState(value: string, presentation: PaymentPresentation = null): BuyerPaymentState {
  const safe = [
    "awaiting_payment",
    "processing",
    "approved",
    "rejected",
    "canceled",
    "refunded",
    "unknown",
    "review_required",
  ].includes(value)
    ? (value as BuyerPaymentState["state"])
    : "unknown";
  return {
    state:
      presentation?.kind === "CHALLENGE" && safe === "processing" ? "challenge_required" : safe,
    presentation,
  };
}

export class FinancialCoordinator {
  constructor(
    private readonly repo: FinancialRepository,
    private readonly provider: PaymentProvider,
    private readonly observer?: FinancialObservationObserver,
  ) {}

  private async notifyObserver(input: FinancialObservationResult): Promise<void> {
    if (this.observer === undefined) {
      return;
    }

    try {
      await this.observer.afterFinancialObservation(input);
    } catch {
      /*
       * Analytics is a post-commit projection. Its failure
       * must never roll back or reinterpret financial truth.
       */
      logger.error("canonical_purchase_projection_failed", {
        correlationId: createCorrelationId(),
        surface: "PAYMENTS",
        outcome: "DEGRADED",
        failureCode: "CANONICAL_PURCHASE_PROJECTION_FAILED",
      });
    }
  }

  private async applyObservation(
    orderId: string,
    input: Parameters<FinancialRepository["applyObservation"]>[0],
  ): Promise<"APPLIED" | "NOOP" | "REVIEW" | "REJECTED"> {
    const result = await this.repo.applyObservation(input);

    await this.notifyObserver({
      orderId,
      paymentId: input.paymentId,
      source: input.source,
      result,
    });

    return result;
  }

  async start(
    orderId: string,
    method: PaymentMethod,
    card?: CreateProviderPayment["card"],
  ): Promise<BuyerPaymentState> {
    if (
      method === "CREDIT_CARD" &&
      (!card || card.installments !== 1 || card.paymentType !== "credit_card")
    ) {
      throw new Error("INVALID_CARD_INPUT");
    }
    if (method === "PIX" && card) throw new Error("INVALID_PAYMENT_METHOD");
    const { attempt, send } = await this.repo.reserve(orderId, method);
    if (!send) return this.status(orderId, false);
    try {
      const request: CreateProviderPayment = {
        paymentId: attempt.paymentId,
        orderId: attempt.orderId,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        paymentMethod: attempt.paymentMethod,
        payerEmail: attempt.payerEmail,
        ...(card ? { card } : {}),
      };
      const snapshot = await this.provider.createPayment(request);
      const applied = await this.applyObservation(attempt.orderId, {
        paymentId: attempt.paymentId,
        snapshot,
        source: "CREATE_RESPONSE",
      });
      const state = await this.repo.state(orderId);
      if (!state) throw new Error("PAYMENT_NOT_FOUND");
      return publicState(
        state.state,
        applied === "REJECTED" || applied === "REVIEW" ? null : snapshot.presentation,
      );
    } catch (error) {
      if (error instanceof ProviderError && error.providerOrderId) {
        try {
          await this.repo.rememberProviderOrderId(attempt.paymentId, error.providerOrderId);
        } catch {
          await this.repo.markAmbiguous(attempt.paymentId);
          return publicState("unknown");
        }
      }

      await this.repo.markAmbiguous(attempt.paymentId);
      return publicState("unknown");
    }
  }

  async status(orderId: string, reconcile = true): Promise<BuyerPaymentState> {
    let presentation: PaymentPresentation = null;
    const current = await this.repo.state(orderId);
    if (!current) throw new Error("ORDER_NOT_FOUND");
    if (reconcile && current.paymentId && ["processing", "unknown"].includes(current.state)) {
      const claimed = await this.repo.claimReconciliation(current.paymentId, 15_000);

      if (claimed) {
        const result = await this.reconcile(current.paymentId);
        presentation = result;
      }
    }
    const state = await this.repo.state(orderId);
    if (!state) throw new Error("ORDER_NOT_FOUND");

    if (state.state === "approved" && state.paymentId !== null) {
      await this.notifyObserver({
        orderId,
        paymentId: state.paymentId,
        source: "RECONCILIATION",
        result: "NOOP",
      });
    }

    return publicState(state.state, presentation);
  }

  async reconcile(paymentId: string): Promise<PaymentPresentation> {
    const attempt = await this.repo.load(paymentId);
    if (!attempt) throw new Error("PAYMENT_NOT_FOUND");
    let snapshot: ProviderSnapshot;
    if (attempt.providerOrderId) {
      snapshot = await this.provider.getSnapshot(attempt.providerOrderId);
    } else {
      const beginDate = new Date(attempt.createdAt.getTime() - 5 * 60_000).toISOString();
      const endDate = new Date(attempt.createdAt.getTime() + 2 * 60 * 60_000).toISOString();
      const result = await this.provider.searchPayments({
        externalReference: attempt.orderId,
        beginDate,
        endDate,
      });
      if (!result.complete) {
        await this.repo.recordRecoveryReview(paymentId, "INCOMPLETE_SEARCH");
        return null;
      }
      const candidates = result.snapshots.filter(
        (candidate) =>
          candidate.externalReference === attempt.orderId &&
          candidate.amountMinor === attempt.amountMinor &&
          candidate.currency === attempt.currency &&
          candidate.paymentMethod === attempt.paymentMethod,
      );
      if (candidates.length === 0) return null;
      if (candidates.length > 1) {
        await this.repo.recordRecoveryReview(paymentId, "MULTIPLE_CANDIDATES");
        return null;
      }
      const candidate = candidates[0];
      if (!candidate) return null;
      snapshot = await this.provider.getSnapshot(candidate.providerOrderId);
    }
    const applied = await this.applyObservation(attempt.orderId, {
      paymentId,
      snapshot,
      source: "RECONCILIATION",
    });
    return applied === "REJECTED" || applied === "REVIEW" ? null : snapshot.presentation;
  }

  async webhook(providerOrderId: string): Promise<"APPLIED" | "NOOP" | "REVIEW" | "REJECTED"> {
    const snapshot = await this.provider.getSnapshot(providerOrderId);
    const linked = await this.repo.findByProviderOrderId(providerOrderId);
    const attempt =
      linked ??
      (snapshot.externalReference
        ? await this.repo.findRecoverableByOrderId(snapshot.externalReference)
        : null);
    if (!attempt) throw new Error("PAYMENT_UNRESOLVED");
    return this.applyObservation(attempt.orderId, {
      paymentId: attempt.paymentId,
      snapshot,
      source: "WEBHOOK",
    });
  }
}
