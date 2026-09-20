import { NextResponse } from "next/server";

import { getHealthStatus } from "@/modules/health/health";
import {
  resolveRequestCorrelationId,
  setCorrelationResponseHeader,
} from "@/lib/observability/correlation";
import { recordOperationalMetric, startOperationalSpan } from "@/lib/observability/telemetry";

export function GET(request: Request) {
  const correlationId = resolveRequestCorrelationId(request.headers);
  const span = startOperationalSpan({
    correlationId,
    surface: "HEALTH",
    operation: "LIVENESS_CHECK",
  });
  recordOperationalMetric({
    name: "http_requests_total",
    value: 1,
    correlationId,
    labels: {
      surface: "HEALTH",
      operation: "LIVENESS_CHECK",
      outcome: "SUCCEEDED",
      method: "GET",
      statusClass: "2XX",
    },
  });
  const completed = span.end({ outcome: "SUCCEEDED" });
  recordOperationalMetric({
    name: "http_request_duration_ms",
    value: completed.durationMs,
    correlationId,
    labels: {
      surface: "HEALTH",
      operation: "LIVENESS_CHECK",
      outcome: "SUCCEEDED",
      method: "GET",
      statusClass: "2XX",
    },
  });

  const headers = new Headers({
    "Cache-Control": "no-store",
  });
  setCorrelationResponseHeader(headers, correlationId);

  return NextResponse.json(getHealthStatus(), {
    status: 200,
    headers,
  });
}
