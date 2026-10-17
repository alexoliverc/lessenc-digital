import type { Page } from "@playwright/test";

import {
  evaluateNetworkCalibration,
  PERFORMANCE_CALIBRATION_ORIGIN,
  type NetworkCalibration,
  type NetworkCalibrationResult,
} from "./network-profile.ts";

export const CALIBRATION_PROBES_PER_DIMENSION = 3;
export const CALIBRATION_DOWNLOAD_BYTES = 2_000_000;
export const CALIBRATION_UPLOAD_BYTES = 500_000;

export type NetworkCalibrationEvidence = Readonly<{
  schemaVersion: 1;
  method: "BROWSER_LOOPBACK_PROBES";
  configuredProfileApplied: true;
  downloadProbeCount: number;
  uploadProbeCount: number;
  roundTripProbeCount: number;
  probes: Readonly<{
    downloadBitsPerSecond: readonly number[];
    uploadBitsPerSecond: readonly number[];
    roundTripTimeMs: readonly number[];
  }>;
  roundTripDiagnostics?: Readonly<{
    baselineTimeMs: readonly number[];
    grossTimeMs: readonly number[];
  }>;
  observed: NetworkCalibration;
  evaluation: NetworkCalibrationResult;
}>;

function median(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("P17_CALIBRATION_SAMPLE_INVALID");
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const result = sorted[midpoint];
  if (result === undefined) throw new Error("P17_CALIBRATION_SAMPLE_INVALID");
  return result;
}

export function evaluateCalibrationProbes(
  input: Readonly<{
    downloadBitsPerSecond: readonly number[];
    uploadBitsPerSecond: readonly number[];
    roundTripTimeMs: readonly number[];
  }>,
): NetworkCalibrationEvidence {
  if (
    input.downloadBitsPerSecond.length !== CALIBRATION_PROBES_PER_DIMENSION ||
    input.uploadBitsPerSecond.length !== CALIBRATION_PROBES_PER_DIMENSION ||
    input.roundTripTimeMs.length !== CALIBRATION_PROBES_PER_DIMENSION
  ) {
    throw new Error("P17_CALIBRATION_PROBE_COUNT_INVALID");
  }

  const probes = Object.freeze({
    downloadBitsPerSecond: Object.freeze([...input.downloadBitsPerSecond]),
    uploadBitsPerSecond: Object.freeze([...input.uploadBitsPerSecond]),
    roundTripTimeMs: Object.freeze([...input.roundTripTimeMs]),
  });
  const observed = Object.freeze({
    downloadBitsPerSecond: median(probes.downloadBitsPerSecond),
    uploadBitsPerSecond: median(probes.uploadBitsPerSecond),
    roundTripTimeMs: median(probes.roundTripTimeMs),
  });

  return Object.freeze({
    schemaVersion: 1,
    method: "BROWSER_LOOPBACK_PROBES",
    configuredProfileApplied: true,
    downloadProbeCount: input.downloadBitsPerSecond.length,
    uploadProbeCount: input.uploadBitsPerSecond.length,
    roundTripProbeCount: input.roundTripTimeMs.length,
    probes,
    observed,
    evaluation: evaluateNetworkCalibration(observed),
  });
}

export async function collectRoundTripBaseline(page: Page): Promise<readonly number[]> {
  const probes = await page.evaluate(
    async ({ origin, count }) => {
      const values: number[] = [];
      for (let index = 0; index < count; index += 1) {
        const started = performance.now();
        const response = await fetch(`${origin}/calibration/rtt?baseline=${index}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("P17_CALIBRATION_BASELINE_HTTP_INVALID");
        await response.arrayBuffer();
        values.push(performance.now() - started);
      }
      return values;
    },
    { origin: PERFORMANCE_CALIBRATION_ORIGIN, count: CALIBRATION_PROBES_PER_DIMENSION },
  );

  if (
    probes.length !== CALIBRATION_PROBES_PER_DIMENSION ||
    probes.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error("P17_CALIBRATION_BASELINE_INVALID");
  }
  return Object.freeze(probes);
}

/**
 * Collects browser-observed loopback probe measurements while CDP
 * network emulation is active. These observations do not establish
 * independent physical network calibration or external provenance.
 */
export async function collectNetworkCalibration(
  page: Page,
  baselineRoundTripTimeMs: readonly number[],
): Promise<NetworkCalibrationEvidence> {
  const raw = await page.evaluate(
    async ({ origin, downloadBytes, uploadBytes, count }) => {
      const roundTrips: number[] = [];
      const downloads: number[] = [];
      const uploads: number[] = [];
      const uploadBody = "0".repeat(uploadBytes);

      for (let index = 0; index < count; index += 1) {
        let started = performance.now();
        const rttResponse = await fetch(`${origin}/calibration/rtt?probe=${index}`, {
          cache: "no-store",
        });
        if (!rttResponse.ok) {
          throw new Error("P17_CALIBRATION_RTT_HTTP_INVALID");
        }
        await rttResponse.arrayBuffer();
        roundTrips.push(performance.now() - started);

        started = performance.now();
        const downloadResponse = await fetch(`${origin}/calibration/download?probe=${index}`, {
          cache: "no-store",
        });
        const downloaded = await downloadResponse.arrayBuffer();
        const downloadElapsedMs = performance.now() - started;
        if (!downloadResponse.ok || downloaded.byteLength !== downloadBytes) {
          throw new Error("P17_CALIBRATION_DOWNLOAD_SIZE_INVALID");
        }
        const downloadTransportMs = Math.max(1, downloadElapsedMs - roundTrips[index]!);
        downloads.push((downloaded.byteLength * 8 * 1_000) / downloadTransportMs);

        started = performance.now();
        const uploadResponse = await fetch(`${origin}/calibration/upload?probe=${index}`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: uploadBody,
        });
        const uploadResult = (await uploadResponse.json()) as { receivedBytes?: unknown };
        const uploadElapsedMs = performance.now() - started;
        if (!uploadResponse.ok || uploadResult.receivedBytes !== uploadBytes) {
          throw new Error("P17_CALIBRATION_UPLOAD_SIZE_INVALID");
        }
        const transportMs = Math.max(1, uploadElapsedMs - roundTrips[index]!);
        uploads.push((uploadBytes * 8 * 1_000) / transportMs);
      }

      return {
        downloadBitsPerSecond: downloads,
        uploadBitsPerSecond: uploads,
        roundTripTimeMs: roundTrips,
      };
    },
    {
      origin: PERFORMANCE_CALIBRATION_ORIGIN,
      downloadBytes: CALIBRATION_DOWNLOAD_BYTES,
      uploadBytes: CALIBRATION_UPLOAD_BYTES,
      count: CALIBRATION_PROBES_PER_DIMENSION,
    },
  );

  const evaluated = evaluateCalibrationProbes({
    downloadBitsPerSecond: raw.downloadBitsPerSecond,
    uploadBitsPerSecond: raw.uploadBitsPerSecond,
    roundTripTimeMs: raw.roundTripTimeMs,
  });

  return Object.freeze({
    ...evaluated,
    roundTripDiagnostics: Object.freeze({
      baselineTimeMs: Object.freeze([...baselineRoundTripTimeMs]),
      grossTimeMs: Object.freeze([...raw.roundTripTimeMs]),
    }),
  });
}
