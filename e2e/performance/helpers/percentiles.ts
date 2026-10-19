export const REQUIRED_VALID_SAMPLES = 40;

function assertValidSample(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("P17_PERFORMANCE_SAMPLE_INVALID");
  }
}

export function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    throw new Error("P17_PERCENTILE_EMPTY");
  }

  if (!Number.isFinite(percentile) || percentile <= 0 || percentile > 1) {
    throw new Error("P17_PERCENTILE_INVALID");
  }

  values.forEach(assertValidSample);

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentile * sorted.length) - 1;
  const result = sorted[index];

  if (result === undefined) {
    throw new Error("P17_PERCENTILE_POSITION_INVALID");
  }

  return result;
}

export type PerformancePercentiles = Readonly<{
  p50: number;
  p75: number;
  p95: number;
}>;

export function calculatePerformancePercentiles(values: readonly number[]): PerformancePercentiles {
  if (values.length !== REQUIRED_VALID_SAMPLES) {
    throw new Error("P17_VALID_SAMPLE_COUNT_INVALID");
  }

  return Object.freeze({
    p50: nearestRank(values, 0.5),
    p75: nearestRank(values, 0.75),
    p95: nearestRank(values, 0.95),
  });
}
