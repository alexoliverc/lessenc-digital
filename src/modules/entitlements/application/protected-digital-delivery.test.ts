import { describe, expect, it, vi } from "vitest";

import type { AuthorizedDigitalResource } from "./authorize-digital-resource";
import type { BuyerSubject } from "./buyer-session";
import { PrivateResourceStorageError } from "./private-resource-storage";
import {
  PrepareProtectedDelivery,
  RecordProtectedDeliveryOutcome,
} from "./protected-digital-delivery";

const SUBJECT: BuyerSubject = Object.freeze({
  customerId: "11111111-1111-4111-8111-111111111111",
  orderId: "22222222-2222-4222-8222-222222222222",
  credentialId: "33333333-3333-4333-8333-333333333333",
});

const AUTHORIZED: AuthorizedDigitalResource = Object.freeze({
  resourceId: "44444444-4444-4444-8444-444444444444",
  entitlementId: "55555555-5555-4555-8555-555555555555",
  storageKey: "resources/abc/v1.pdf",
  filename: "lessenc-resource.pdf",
  mediaType: "application/pdf",
});

async function* resourceBody(): AsyncGenerator<Uint8Array> {
  yield new Uint8Array([1, 2, 3]);
}

describe("P11 protected digital delivery application service", () => {
  it("prepares an authorized private resource without prematurely recording SUCCEEDED", async () => {
    const authorize = vi.fn().mockResolvedValue(AUTHORIZED);

    const stat = vi.fn().mockResolvedValue({
      sizeBytes: 3,
    });

    const open = vi.fn().mockResolvedValue(resourceBody());

    const record = vi.fn();

    const service = new PrepareProtectedDelivery(
      {
        execute: authorize,
      },
      {
        stat,
        open,
      },
      {
        record,
      },
    );

    const prepared = await service.execute(SUBJECT, AUTHORIZED.resourceId);

    expect(prepared).toMatchObject({
      resourceId: AUTHORIZED.resourceId,
      entitlementId: AUTHORIZED.entitlementId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      filename: AUTHORIZED.filename,
      mediaType: AUTHORIZED.mediaType,
      sizeBytes: 3,
    });

    expect(authorize).toHaveBeenCalledWith(SUBJECT, AUTHORIZED.resourceId);

    expect(stat).toHaveBeenCalledWith(AUTHORIZED.storageKey);

    expect(open).toHaveBeenCalledWith(AUTHORIZED.storageKey);

    expect(record).not.toHaveBeenCalled();
  });

  it("does not touch storage or delivery audit when C4 authorization fails", async () => {
    const stat = vi.fn();

    const open = vi.fn();

    const record = vi.fn();

    const service = new PrepareProtectedDelivery(
      {
        execute: vi.fn().mockRejectedValue(new Error("RESOURCE_NOT_AVAILABLE")),
      },
      {
        stat,
        open,
      },
      {
        record,
      },
    );

    await expect(service.execute(SUBJECT, AUTHORIZED.resourceId)).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );

    expect(stat).not.toHaveBeenCalled();

    expect(open).not.toHaveBeenCalled();

    expect(record).not.toHaveBeenCalled();
  });

  it("records RESOURCE_NOT_FOUND when an authorized storage object is missing", async () => {
    const record = vi.fn().mockResolvedValue(undefined);

    const open = vi.fn();

    const service = new PrepareProtectedDelivery(
      {
        execute: vi.fn().mockResolvedValue(AUTHORIZED),
      },
      {
        stat: vi.fn().mockRejectedValue(new PrivateResourceStorageError("RESOURCE_NOT_FOUND")),
        open,
      },
      {
        record,
      },
    );

    await expect(service.execute(SUBJECT, AUTHORIZED.resourceId)).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    expect(open).not.toHaveBeenCalled();

    expect(record).toHaveBeenCalledWith({
      entitlementId: AUTHORIZED.entitlementId,
      resourceId: AUTHORIZED.resourceId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      outcome: "FAILED",
      failureCode: "RESOURCE_NOT_FOUND",
    });
  });

  it("records STORAGE_UNAVAILABLE when opening an authorized resource fails unexpectedly", async () => {
    const record = vi.fn().mockResolvedValue(undefined);

    const service = new PrepareProtectedDelivery(
      {
        execute: vi.fn().mockResolvedValue(AUTHORIZED),
      },
      {
        stat: vi.fn().mockResolvedValue({
          sizeBytes: 3,
        }),
        open: vi.fn().mockRejectedValue(new Error("private adapter detail")),
      },
      {
        record,
      },
    );

    await expect(service.execute(SUBJECT, AUTHORIZED.resourceId)).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "FAILED",
        failureCode: "STORAGE_UNAVAILABLE",
      }),
    );
  });

  it("fails closed with DELIVERY_AUDIT_UNAVAILABLE when a storage failure cannot be audited", async () => {
    const service = new PrepareProtectedDelivery(
      {
        execute: vi.fn().mockResolvedValue(AUTHORIZED),
      },
      {
        stat: vi.fn().mockRejectedValue(new PrivateResourceStorageError("RESOURCE_NOT_FOUND")),
        open: vi.fn(),
      },
      {
        record: vi.fn().mockRejectedValue(new Error("database unavailable")),
      },
    );

    await expect(service.execute(SUBJECT, AUTHORIZED.resourceId)).rejects.toThrow(
      "DELIVERY_AUDIT_UNAVAILABLE",
    );
  });

  it("records SUCCEEDED only through the explicit delivery outcome boundary", async () => {
    const record = vi.fn().mockResolvedValue(undefined);

    const auditor = new RecordProtectedDeliveryOutcome({
      record,
    });

    const delivery = Object.freeze({
      resourceId: AUTHORIZED.resourceId,
      entitlementId: AUTHORIZED.entitlementId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      filename: AUTHORIZED.filename,
      mediaType: AUTHORIZED.mediaType,
      sizeBytes: 3,
      body: resourceBody(),
    });

    await auditor.succeeded(delivery);

    expect(record).toHaveBeenCalledWith({
      entitlementId: AUTHORIZED.entitlementId,
      resourceId: AUTHORIZED.resourceId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      outcome: "SUCCEEDED",
      failureCode: null,
    });
  });

  it("records STREAM_FAILED for a delivery body failure without revoking the commercial right", async () => {
    const record = vi.fn().mockResolvedValue(undefined);

    const auditor = new RecordProtectedDeliveryOutcome({
      record,
    });

    const delivery = Object.freeze({
      resourceId: AUTHORIZED.resourceId,
      entitlementId: AUTHORIZED.entitlementId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      filename: AUTHORIZED.filename,
      mediaType: AUTHORIZED.mediaType,
      sizeBytes: 3,
      body: resourceBody(),
    });

    await auditor.streamFailed(delivery);

    expect(record).toHaveBeenCalledWith({
      entitlementId: AUTHORIZED.entitlementId,
      resourceId: AUTHORIZED.resourceId,
      buyerAccessCredentialId: SUBJECT.credentialId,
      outcome: "FAILED",
      failureCode: "STREAM_FAILED",
    });
  });
});
