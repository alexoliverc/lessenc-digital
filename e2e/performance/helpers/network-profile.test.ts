import { describe, expect, it, vi } from "vitest";

import {
  applyPerformanceNetworkProfile,
  evaluateNetworkCalibration,
  PERFORMANCE_NETWORK_PROFILE,
} from "./network-profile";

describe("P17 performance network profile", () => {
  it("maps the approved bandwidth and RTT to CDP without external I/O", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    await applyPerformanceNetworkProfile({ send });

    expect(send).toHaveBeenNthCalledWith(1, "Network.enable");
    expect(send).toHaveBeenNthCalledWith(2, "Network.emulateNetworkConditions", {
      offline: false,
      latency: 80,
      downloadThroughput: 1_250_000,
      uploadThroughput: 250_000,
      connectionType: "other",
    });
  });

  it("accepts calibration inside the approved ten-percent tolerance", () => {
    expect(
      evaluateNetworkCalibration({
        downloadBitsPerSecond: 9_100_000,
        uploadBitsPerSecond: 2_100_000,
        roundTripTimeMs: 87,
      }),
    ).toEqual({ state: "VALID", tolerance: 0.1 });
  });

  it("blocks a missing or unreliable calibration", () => {
    expect(evaluateNetworkCalibration(null)).toEqual({
      state: "BLOCKED",
      reason: "CALIBRATION_MISSING",
      tolerance: 0.1,
    });

    expect(
      evaluateNetworkCalibration({
        ...PERFORMANCE_NETWORK_PROFILE,
        downloadBitsPerSecond: 8_000_000,
      }),
    ).toEqual({
      state: "BLOCKED",
      reason: "CALIBRATION_OUT_OF_RANGE",
      tolerance: 0.1,
    });
  });
});
