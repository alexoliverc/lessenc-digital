export const PERFORMANCE_NETWORK_PROFILE = Object.freeze({
  downloadBitsPerSecond: 10_000_000,
  uploadBitsPerSecond: 2_000_000,
  roundTripTimeMs: 80,
  downloadBytesPerSecond: 1_250_000,
  uploadBytesPerSecond: 250_000,
});

export const NETWORK_CALIBRATION_TOLERANCE = 0.1;

export type NetworkCalibration = Readonly<{
  downloadBitsPerSecond: number;
  uploadBitsPerSecond: number;
  roundTripTimeMs: number;
}>;

export type NetworkCalibrationResult =
  | Readonly<{
      state: "VALID";
      tolerance: number;
    }>
  | Readonly<{
      state: "BLOCKED";
      reason: "CALIBRATION_MISSING" | "CALIBRATION_INVALID" | "CALIBRATION_OUT_OF_RANGE";
      tolerance: number;
    }>;

function withinTolerance(observed: number, expected: number, tolerance: number): boolean {
  return Math.abs(observed - expected) / expected <= tolerance;
}

export function evaluateNetworkCalibration(
  calibration: NetworkCalibration | null,
  tolerance = NETWORK_CALIBRATION_TOLERANCE,
): NetworkCalibrationResult {
  if (calibration === null) {
    return Object.freeze({ state: "BLOCKED", reason: "CALIBRATION_MISSING", tolerance });
  }

  if (
    !Number.isFinite(calibration.downloadBitsPerSecond) ||
    !Number.isFinite(calibration.uploadBitsPerSecond) ||
    !Number.isFinite(calibration.roundTripTimeMs) ||
    calibration.downloadBitsPerSecond <= 0 ||
    calibration.uploadBitsPerSecond <= 0 ||
    calibration.roundTripTimeMs <= 0 ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    tolerance > 1
  ) {
    return Object.freeze({ state: "BLOCKED", reason: "CALIBRATION_INVALID", tolerance });
  }

  if (
    !withinTolerance(
      calibration.downloadBitsPerSecond,
      PERFORMANCE_NETWORK_PROFILE.downloadBitsPerSecond,
      tolerance,
    ) ||
    !withinTolerance(
      calibration.uploadBitsPerSecond,
      PERFORMANCE_NETWORK_PROFILE.uploadBitsPerSecond,
      tolerance,
    ) ||
    !withinTolerance(
      calibration.roundTripTimeMs,
      PERFORMANCE_NETWORK_PROFILE.roundTripTimeMs,
      tolerance,
    )
  ) {
    return Object.freeze({ state: "BLOCKED", reason: "CALIBRATION_OUT_OF_RANGE", tolerance });
  }

  return Object.freeze({ state: "VALID", tolerance });
}

export type CdpSession = Readonly<{
  send(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown>;
}>;

export async function applyPerformanceNetworkProfile(session: CdpSession): Promise<void> {
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: PERFORMANCE_NETWORK_PROFILE.roundTripTimeMs,
    downloadThroughput: PERFORMANCE_NETWORK_PROFILE.downloadBytesPerSecond,
    uploadThroughput: PERFORMANCE_NETWORK_PROFILE.uploadBytesPerSecond,
    connectionType: "other",
  });
}
