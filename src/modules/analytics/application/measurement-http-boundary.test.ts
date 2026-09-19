import { describe, expect, it } from "vitest";

import {
  VIEW_CONTENT_EVENT_REQUEST_HEADER,
  normalizeMeasurementEventId,
} from "./measurement-http-boundary";

describe("P13-D measurement HTTP boundary", () => {
  it("defines a private upstream VIEW_CONTENT event identity header", () => {
    expect(VIEW_CONTENT_EVENT_REQUEST_HEADER).toBe("x-lessenc-view-content-event-id");
  });

  it("accepts and normalizes a UUID event identity", () => {
    expect(normalizeMeasurementEventId(" 550E8400-E29B-41D4-A716-446655440000 ")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects malformed event identities", () => {
    expect(normalizeMeasurementEventId("not-a-uuid")).toBeNull();

    expect(normalizeMeasurementEventId("")).toBeNull();
  });

  it("rejects an absent event identity", () => {
    expect(normalizeMeasurementEventId(null)).toBeNull();

    expect(normalizeMeasurementEventId(undefined)).toBeNull();
  });
});
