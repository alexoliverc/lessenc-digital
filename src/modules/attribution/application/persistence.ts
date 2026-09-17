export type AnalyticsConsentState = "UNKNOWN" | "GRANTED" | "DENIED";

export type AttributionTouchType = "CAMPAIGN" | "REFERRAL" | "DIRECT";

export type AnalyticsEventType = "VIEW_CONTENT" | "INITIATE_CHECKOUT" | "PURCHASE";

export type AnalyticsDispatchStatus =
  "PENDING" | "PROCESSING" | "RETRYABLE" | "SUCCEEDED" | "FAILED" | "SUPPRESSED";

export type AnalyticsConsentSnapshot = Readonly<Record<string, string | number | boolean | null>>;

export type AcquisitionJourneyRecord = Readonly<{
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  firstTouchId: string | null;
  lastTouchId: string | null;
  analyticsConsentState: AnalyticsConsentState;
  advertisingConsentState: AnalyticsConsentState;
  policyVersion: string;
}>;

export type CreateAcquisitionJourney = Readonly<{
  id: string;
  expiresAt: Date;
  analyticsConsentState: AnalyticsConsentState;
  advertisingConsentState: AnalyticsConsentState;
  policyVersion: string;
}>;

export type AttributionTouchRecord = Readonly<{
  id: string;
  journeyId: string;
  occurredAt: Date;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  touchType: AttributionTouchType;
}>;

export type CreateAttributionTouch = Readonly<{
  id: string;
  journeyId: string;
  occurredAt: Date;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  touchType: AttributionTouchType;
}>;

export interface AttributionJourneyRepository {
  createJourney(input: CreateAcquisitionJourney): Promise<AcquisitionJourneyRecord>;

  findJourney(journeyId: string): Promise<AcquisitionJourneyRecord | null>;

  createTouch(input: CreateAttributionTouch): Promise<AttributionTouchRecord>;
}

export type OrderAttributionRecord = Readonly<{
  id: string;
  orderId: string;
  journeyId: string | null;
  firstTouchId: string | null;
  lastTouchId: string | null;
  firstSource: string | null;
  firstMedium: string | null;
  firstCampaign: string | null;
  firstContent: string | null;
  firstTerm: string | null;
  lastSource: string | null;
  lastMedium: string | null;
  lastCampaign: string | null;
  lastContent: string | null;
  lastTerm: string | null;
  capturedAt: Date;
}>;

export type CreateOrderAttributionSnapshot = Readonly<{
  id: string;
  orderId: string;
  journeyId: string | null;
  firstTouchId: string | null;
  lastTouchId: string | null;
  firstSource: string | null;
  firstMedium: string | null;
  firstCampaign: string | null;
  firstContent: string | null;
  firstTerm: string | null;
  lastSource: string | null;
  lastMedium: string | null;
  lastCampaign: string | null;
  lastContent: string | null;
  lastTerm: string | null;
  capturedAt: Date;
}>;

export interface OrderAttributionRepository {
  createSnapshot(input: CreateOrderAttributionSnapshot): Promise<OrderAttributionRecord>;

  findByOrderId(orderId: string): Promise<OrderAttributionRecord | null>;
}

export type AnalyticsEventRecord = Readonly<{
  id: string;
  type: AnalyticsEventType;
  occurredAt: Date;
  journeyId: string | null;
  productId: string | null;
  offerId: string | null;
  orderId: string | null;
  amountMinor: number | null;
  currency: string | null;
  attributionState: string;
  consentSnapshot: AnalyticsConsentSnapshot;
  schemaVersion: number;
  purchaseOrderKey: string | null;
  createdAt: Date;
}>;

export type CreateAnalyticsEvent = Readonly<{
  id: string;
  type: AnalyticsEventType;
  occurredAt: Date;
  journeyId: string | null;
  productId: string | null;
  offerId: string | null;
  orderId: string | null;
  amountMinor: number | null;
  currency: string | null;
  attributionState: string;
  consentSnapshot: AnalyticsConsentSnapshot;
  schemaVersion: number;
  purchaseOrderKey: string | null;
}>;

export interface AnalyticsEventRepository {
  create(input: CreateAnalyticsEvent): Promise<AnalyticsEventRecord>;

  findById(eventId: string): Promise<AnalyticsEventRecord | null>;

  findPurchaseByOrderKey(orderKey: string): Promise<AnalyticsEventRecord | null>;
}

export type AnalyticsDispatchRecord = Readonly<{
  id: string;
  analyticsEventId: string;
  provider: string;
  channel: string;
  status: AnalyticsDispatchStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  providerEventId: string | null;
  lastErrorCode: string | null;
  lastErrorClass: string | null;
  createdAt: Date;
  completedAt: Date | null;
}>;

export type CreateAnalyticsDispatch = Readonly<{
  id: string;
  analyticsEventId: string;
  provider: string;
  channel: string;
  status: AnalyticsDispatchStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  providerEventId: string | null;
  lastErrorCode: string | null;
  lastErrorClass: string | null;
  completedAt: Date | null;
}>;

export interface AnalyticsDispatchRepository {
  create(input: CreateAnalyticsDispatch): Promise<AnalyticsDispatchRecord>;

  findByEventProviderChannel(
    analyticsEventId: string,
    provider: string,
    channel: string,
  ): Promise<AnalyticsDispatchRecord | null>;
}
