import { NextRequest, NextResponse } from "next/server";

import {
  createP11CorrelationId,
  p11Observability,
} from "../../../../../lib/observability/p11-observability";
import type { BuyerSubject } from "../../../../../modules/entitlements/application/buyer-session";
import type { PreparedProtectedDelivery } from "../../../../../modules/entitlements/application/protected-digital-delivery";
import { PrivateResourceStorageError } from "../../../../../modules/entitlements/application/private-resource-storage";
import {
  BUYER_ACCESS_NO_STORE_HEADERS,
  buyerAccessCookieName,
  type BuyerAccessAppEnv,
} from "../../http";
import {
  BuyerAccessRateLimitExceeded,
  BuyerAccessRateLimitUnavailable,
} from "../../../../../modules/entitlements/application/buyer-access-rate-limit-enforcement";

export interface ProtectedDownloadSessionValidator {
  execute(token: unknown): Promise<BuyerSubject>;
}

export interface ProtectedDownloadPreparer {
  execute(subject: BuyerSubject, resourceId: unknown): Promise<PreparedProtectedDelivery>;
}

export interface ProtectedDownloadOutcomeRecorder {
  succeeded(delivery: PreparedProtectedDelivery): Promise<void>;

  streamFailed(delivery: PreparedProtectedDelivery): Promise<void>;
}

type ProtectedDownloadDependencies = Readonly<{
  validateSession: ProtectedDownloadSessionValidator;
  prepareDelivery: ProtectedDownloadPreparer;
  recordOutcome: ProtectedDownloadOutcomeRecorder;
  appEnv: BuyerAccessAppEnv;
}>;

const CONTENT_TYPE_OPTIONS = "nosniff";

function asciiFilename(filename: string): string {
  const sanitized = filename
    .normalize("NFKD")
    .replace(/\p{Cc}/gu, "")
    .replace(/["\\/;]+/gu, "_")
    .replace(/[^\x20-\x7e]/gu, "_")
    .trim();

  return (sanitized || "download").slice(0, 180);
}

function encodedFilename(filename: string): string {
  return encodeURIComponent(filename).replace(
    /['()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function contentDisposition(filename: string): string {
  return (
    `attachment; filename="${asciiFilename(filename)}"; ` +
    `filename*=UTF-8''${encodedFilename(filename)}`
  );
}

async function closeIterator(iterator: AsyncIterator<Uint8Array>): Promise<void> {
  if (!iterator.return) {
    return;
  }

  try {
    await iterator.return();
  } catch {
    // Best-effort release only.
  }
}

function auditedBody(
  delivery: PreparedProtectedDelivery,
  recorder: ProtectedDownloadOutcomeRecorder,
  correlationId: string,
): ReadableStream<Uint8Array> {
  const iterator = delivery.body[Symbol.asyncIterator]();

  let started = false;

  let closed = false;

  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (closed) {
          return;
        }

        try {
          if (!started) {
            /*
             * SUCCEEDED means the protected response body
             * has actually started being consumed.
             *
             * Audit is persisted before the first byte is
             * released.
             */
            await recorder.succeeded(delivery);

            started = true;
          }

          const next = await iterator.next();

          if (next.done) {
            closed = true;

            controller.close();

            return;
          }

          controller.enqueue(next.value);
        } catch (error) {
          closed = true;

          if (
            !started &&
            error instanceof Error &&
            error.message === "DELIVERY_AUDIT_UNAVAILABLE"
          ) {
            p11Observability.error(
              "delivery_audit_unavailable",
              {
                correlationId,
                surface: "DELIVERY_AUDIT",
                outcome: "FAILED",
                failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
              },
            );
          }

          if (started) {
            try {
              await recorder.streamFailed(delivery);
            } catch {
              p11Observability.error(
                "delivery_audit_unavailable",
                {
                  correlationId,
                  surface: "DELIVERY_AUDIT",
                  outcome: "FAILED",
                  failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
                },
              );
            }

            p11Observability.warn(
              "delivery_stream_failed",
              {
                correlationId,
                surface: "PROTECTED_DOWNLOAD",
                outcome: "FAILED",
                failureCode: "STREAM_FAILED",
              },
            );
          }

          await closeIterator(iterator);

          controller.error(error instanceof Error ? error : new Error("SERVICE_UNAVAILABLE"));
        }
      },

      async cancel() {
        closed = true;

        await closeIterator(iterator);
      },
    },
    {
      highWaterMark: 0,
    },
  );
}

function genericJson(
  error: "SESSION_INVALID" | "RESOURCE_NOT_AVAILABLE" | "SERVICE_UNAVAILABLE",
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      error,
    },
    {
      status,
      headers: {
        ...BUYER_ACCESS_NO_STORE_HEADERS,
        "X-Content-Type-Options": CONTENT_TYPE_OPTIONS,
      },
    },
  );
}

export function createProtectedDownloadHandler(dependencies: ProtectedDownloadDependencies) {
  return async function handleProtectedDownload(
    request: NextRequest,
    resourceId: string,
  ): Promise<NextResponse> {
    const correlationId = createP11CorrelationId();

    const cookieName = buyerAccessCookieName(dependencies.appEnv);

    const sessionToken = request.cookies.get(cookieName)?.value;

    if (!sessionToken) {
      return genericJson("SESSION_INVALID", 401);
    }

    let subject: BuyerSubject;

    try {
      subject = await dependencies.validateSession.execute(sessionToken);
    } catch {
      p11Observability.warn(
        "buyer_access_invalid",
        {
          correlationId,
          surface: "PROTECTED_DOWNLOAD",
          outcome: "DENIED",
          failureCode: "SESSION_INVALID",
        },
      );

      return genericJson("SESSION_INVALID", 401);
    }

    let delivery: PreparedProtectedDelivery;

    try {
      delivery = await dependencies.prepareDelivery.execute(subject, resourceId);
    } catch (error) {
      if (error instanceof BuyerAccessRateLimitExceeded) {
        p11Observability.warn(
          "buyer_access_rate_limited",
          {
            correlationId,
            surface: "PROTECTED_DOWNLOAD",
            scope: "DOWNLOAD_CREDENTIAL",
            outcome: "DENIED",
            failureCode: "RATE_LIMIT_EXCEEDED",
            retryAfterSeconds: error.retryAfterSeconds,
          },
        );

        return NextResponse.json(
          {
            error: "TOO_MANY_REQUESTS",
          },
          {
            status: 429,
            headers: {
              ...BUYER_ACCESS_NO_STORE_HEADERS,
              "X-Content-Type-Options": CONTENT_TYPE_OPTIONS,
              "Retry-After": String(error.retryAfterSeconds),
            },
          },
        );
      }

      if (error instanceof BuyerAccessRateLimitUnavailable) {
        p11Observability.error(
          "buyer_access_limiter_unavailable",
          {
            correlationId,
            surface: "RATE_LIMIT",
            scope: error.scope,
            outcome: "FAILED",
            failureCode: "RATE_LIMIT_UNAVAILABLE",
          },
        );

        return genericJson("SERVICE_UNAVAILABLE", 503);
      }

      if (error instanceof Error && error.message === "RESOURCE_NOT_AVAILABLE") {
        p11Observability.warn(
          "buyer_access_invalid",
          {
            correlationId,
            surface: "PROTECTED_DOWNLOAD",
            outcome: "DENIED",
            failureCode: "RESOURCE_NOT_AVAILABLE",
          },
        );

        return genericJson("RESOURCE_NOT_AVAILABLE", 404);
      }

      if (
        error instanceof Error &&
        error.message === "DELIVERY_AUDIT_UNAVAILABLE"
      ) {
        p11Observability.error(
          "delivery_audit_unavailable",
          {
            correlationId,
            surface: "DELIVERY_AUDIT",
            outcome: "FAILED",
            failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
          },
        );
      }

      if (
        error instanceof Error &&
        error.message === "DELIVERY_UNAVAILABLE"
      ) {
        const storageFailureCode =
          error.cause instanceof PrivateResourceStorageError
            ? error.cause.code
            : "STORAGE_UNAVAILABLE";

        if (storageFailureCode === "RESOURCE_NOT_FOUND") {
          p11Observability.warn(
            "private_storage_failure",
            {
              correlationId,
              surface: "PRIVATE_STORAGE",
              outcome: "DEGRADED",
              failureCode: storageFailureCode,
            },
          );
        } else {
          p11Observability.error(
            "private_storage_failure",
            {
              correlationId,
              surface: "PRIVATE_STORAGE",
              outcome: "FAILED",
              failureCode: storageFailureCode,
            },
          );
        }
      }

      return genericJson("SERVICE_UNAVAILABLE", 503);
    }

    const body = auditedBody(
      delivery,
      dependencies.recordOutcome,
      correlationId,
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        ...BUYER_ACCESS_NO_STORE_HEADERS,
        "X-Content-Type-Options": CONTENT_TYPE_OPTIONS,
        "Content-Type": delivery.mediaType,
        "Content-Length": String(delivery.sizeBytes),
        "Content-Disposition": contentDisposition(delivery.filename),
        "Accept-Ranges": "none",
      },
    });
  };
}
