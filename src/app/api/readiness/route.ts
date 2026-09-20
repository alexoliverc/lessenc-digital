import { NextResponse } from "next/server";

import { runReadinessProbe } from "@/infrastructure/health/readiness-probes";
import {
  resolveRequestCorrelationId,
  setCorrelationResponseHeader,
} from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import {
  recordOperationalMetric,
  startOperationalSpan,
  statusClass,
} from "@/lib/observability/telemetry";
import { projectPublicReadiness, type ReadinessReport } from "@/modules/health/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReadinessProbe = (correlationId: string) => Promise<ReadinessReport>;

export function createReadinessHandler(probe: ReadinessProbe = runReadinessProbe) {
  return async function GET(request: Request): Promise<Response> {
    const correlationId = resolveRequestCorrelationId(request.headers);
    const span = startOperationalSpan({
      correlationId,
      surface: "HEALTH",
      operation: "READINESS_CHECK",
    });

    let report: ReadinessReport;
    try {
      report = await probe(correlationId);
    } catch {
      report = Object.freeze({ status: "NOT_READY", checks: Object.freeze([]) });
    }

    const ready = report.status === "READY";
    const status = ready ? 200 : 503;
    const outcome = ready ? "SUCCEEDED" : "FAILED";

    logger[ready ? "info" : "error"]("readiness_evaluated", {
      correlationId,
      surface: "HEALTH",
      outcome,
      ...(ready ? {} : { failureCode: "INSTANCE_NOT_READY" }),
    });
    recordOperationalMetric({
      name: "readiness_evaluations_total",
      value: 1,
      correlationId,
      labels: {
        surface: "HEALTH",
        operation: "READINESS_CHECK",
        outcome,
        method: "GET",
        statusClass: statusClass(status),
      },
    });
    recordOperationalMetric({
      name: "http_requests_total",
      value: 1,
      correlationId,
      labels: {
        surface: "HEALTH",
        operation: "READINESS_CHECK",
        outcome,
        method: "GET",
        statusClass: statusClass(status),
      },
    });
    const completed = span.end({
      outcome,
      ...(ready ? {} : { failureCode: "INSTANCE_NOT_READY" }),
    });
    recordOperationalMetric({
      name: "http_request_duration_ms",
      value: completed.durationMs,
      correlationId,
      labels: {
        surface: "HEALTH",
        operation: "READINESS_CHECK",
        outcome,
        method: "GET",
        statusClass: statusClass(status),
      },
    });

    const headers = new Headers({
      "Cache-Control": "no-store",
    });
    setCorrelationResponseHeader(headers, correlationId);

    return NextResponse.json(projectPublicReadiness(report), { status, headers });
  };
}

export const GET = createReadinessHandler();
