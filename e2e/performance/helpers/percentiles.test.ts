import { describe, expect, it } from "vitest";

import { calculatePerformancePercentiles, nearestRank } from "./percentiles";

describe("P17 performance nearest-rank", () => {
  it("selects the approved positions for forty valid samples", () => {
    const samples = Array.from({ length: 40 }, (_, index) => index + 1);

    expect(calculatePerformancePercentiles(samples)).toEqual({
      p50: 20,
      p75: 30,
      p95: 38,
    });
  });

  it("sorts a copy without mutating the source", () => {
    const samples = [30, 10, 20];

    expect(nearestRank(samples, 0.5)).toBe(20);
    expect(samples).toEqual([30, 10, 20]);
  });

  it.each([
    { values: [] as number[], percentile: 0.5, code: "P17_PERCENTILE_EMPTY" },
    { values: [1], percentile: 0, code: "P17_PERCENTILE_INVALID" },
    { values: [1], percentile: 1.1, code: "P17_PERCENTILE_INVALID" },
    { values: [-1], percentile: 0.5, code: "P17_PERFORMANCE_SAMPLE_INVALID" },
    { values: [Number.NaN], percentile: 0.5, code: "P17_PERFORMANCE_SAMPLE_INVALID" },
    { values: [Number.POSITIVE_INFINITY], percentile: 0.5, code: "P17_PERFORMANCE_SAMPLE_INVALID" },
  ])("rejects invalid percentile input", ({ values, percentile, code }) => {
    expect(() => nearestRank(values, percentile)).toThrow(code);
  });

  it("requires exactly forty valid samples for the approved cohort contract", () => {
    expect(() => calculatePerformancePercentiles([1, 2, 3])).toThrow(
      "P17_VALID_SAMPLE_COUNT_INVALID",
    );
  });
});
