import { describe, expect, it } from "vitest";

import { evaluateCalibrationProbes } from "./calibration";

describe("P17 browser-loopback network calibration evidence", () => {
  it("accepts medians inside the approved tolerance", () => {
    const result = evaluateCalibrationProbes({
      downloadBitsPerSecond: [9_800_000, 10_000_000, 10_200_000],
      uploadBitsPerSecond: [1_900_000, 2_000_000, 2_100_000],
      roundTripTimeMs: [78, 80, 82],
    });
    expect(result.evaluation.state).toBe("VALID");
    expect(result.probes.downloadBitsPerSecond).toEqual([9_800_000, 10_000_000, 10_200_000]);
  });

  it("blocks out-of-tolerance evidence and missing probes", () => {
    expect(
      evaluateCalibrationProbes({
        downloadBitsPerSecond: [7_000_000, 7_100_000, 7_200_000],
        uploadBitsPerSecond: [2_000_000, 2_000_000, 2_000_000],
        roundTripTimeMs: [80, 80, 80],
      }).evaluation,
    ).toMatchObject({ state: "BLOCKED", reason: "CALIBRATION_OUT_OF_RANGE" });

    expect(() =>
      evaluateCalibrationProbes({
        downloadBitsPerSecond: [10_000_000],
        uploadBitsPerSecond: [2_000_000],
        roundTripTimeMs: [80],
      }),
    ).toThrow("P17_CALIBRATION_PROBE_COUNT_INVALID");

    expect(() =>
      evaluateCalibrationProbes({
        downloadBitsPerSecond: [10_000_000, 10_000_000, 10_000_000, 10_000_000],
        uploadBitsPerSecond: [2_000_000, 2_000_000, 2_000_000, 2_000_000],
        roundTripTimeMs: [80, 80, 80, 80],
      }),
    ).toThrow("P17_CALIBRATION_PROBE_COUNT_INVALID");
  });
});
