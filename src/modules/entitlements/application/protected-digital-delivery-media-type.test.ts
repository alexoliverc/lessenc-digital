import { describe, expect, it, vi } from "vitest";

import type { AuthorizedDigitalResource } from "./authorize-digital-resource";
import type { BuyerSubject } from "./buyer-session";
import { PrepareProtectedDelivery } from "./protected-digital-delivery";

const SUBJECT: BuyerSubject = Object.freeze({
  customerId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  credentialId: "33333333-3333-4333-8333-333333333333",
});

const BASE_RESOURCE = Object.freeze({
  resourceId: "44444444-4444-4444-8444-444444444444",
  entitlementId: "55555555-5555-4555-8555-555555555555",
  storageKey: "resources/media/v1.bin",
  filename: "resource.bin",
});

async function* body() {
  yield new Uint8Array([1]);
}

function authorized(mediaType: string): AuthorizedDigitalResource {
  return Object.freeze({
    ...BASE_RESOURCE,
    mediaType,
  });
}

describe("P11 protected delivery MIME allowlist", () => {
  it("allows PDF, ZIP, and EPUB protected resources", async () => {
    for (const mediaType of ["application/pdf", "application/zip", "application/epub+zip"]) {
      const record = vi.fn();

      const service = new PrepareProtectedDelivery(
        {
          execute: vi.fn().mockResolvedValue(authorized(mediaType)),
        },
        {
          stat: vi.fn().mockResolvedValue({
            sizeBytes: 1,
          }),
          open: vi.fn().mockResolvedValue(body()),
        },
        {
          record,
        },
      );

      const result = await service.execute(SUBJECT, BASE_RESOURCE.resourceId);

      expect(result.mediaType).toBe(mediaType);

      expect(record).not.toHaveBeenCalled();
    }
  });

  it("fails closed and audits an unsupported persisted media type before touching private storage", async () => {
    const stat = vi.fn();

    const open = vi.fn();

    const record = vi.fn().mockResolvedValue(undefined);

    const service = new PrepareProtectedDelivery(
      {
        execute: vi.fn().mockResolvedValue(authorized("text/html")),
      },
      {
        stat,
        open,
      },
      {
        record,
      },
    );

    await expect(service.execute(SUBJECT, BASE_RESOURCE.resourceId)).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    expect(stat).not.toHaveBeenCalled();

    expect(open).not.toHaveBeenCalled();

    expect(record).toHaveBeenCalledWith({
      entitlementId: BASE_RESOURCE.entitlementId,
      resourceId: BASE_RESOURCE.resourceId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      outcome: "FAILED",
      failureCode: "UNSUPPORTED_MEDIA_TYPE",
    });
  });
});
