import type { AcquisitionJourneyRecord } from "../../attribution/application/persistence";
import { projectAnalyticsConsent, type AnalyticsConsentProjection } from "./consent";
import {
  P13_ANALYTICS_SCHEMA_VERSION,
  type P13DInternalMeasurementType,
} from "./internal-measurement";

export type BrowserMeasurementProjection = Readonly<{
  event: "lessenc_measurement";
  eventId: string;
  measurementType: P13DInternalMeasurementType;
  productId: string;
  offerId: string;
  amountMinor: number | null;
  currency: string | null;
  schemaVersion: number;
}>;

export type BrowserMeasurementBoundary = Readonly<{
  consent: AnalyticsConsentProjection;
  measurement: BrowserMeasurementProjection;
}>;

export function projectBrowserMeasurement(input: {
  eventId: string;
  type: P13DInternalMeasurementType;
  journey: AcquisitionJourneyRecord | null;
  productId: string;
  offerId: string;
  amountMinor: number | null;
  currency: string | null;
}): BrowserMeasurementBoundary {
  return Object.freeze({
    consent: projectAnalyticsConsent(input.journey),
    measurement: Object.freeze({
      event: "lessenc_measurement",
      eventId: input.eventId,
      measurementType: input.type,
      productId: input.productId,
      offerId: input.offerId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      schemaVersion: P13_ANALYTICS_SCHEMA_VERSION,
    }),
  });
}
