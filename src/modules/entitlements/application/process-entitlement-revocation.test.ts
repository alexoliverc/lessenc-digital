import { describe, expect, it, vi } from "vitest";

import {
  ProcessEntitlementRevocation,
  type EntitlementRevocationRepository,
} from "./process-entitlement-revocation";

describe("ProcessEntitlementRevocation", () => {
  it("delegates a valid REFUND_COMPLETED outbox event id", async () => {
    const repository: EntitlementRevocationRepository = {
      processRefundCompleted: vi.fn().mockResolvedValue("PROCESSED"),
    };

    const service = new ProcessEntitlementRevocation(repository);

    await expect(service.execute("11111111-1111-4111-8111-111111111111")).resolves.toBe(
      "PROCESSED",
    );

    expect(repository.processRefundCompleted).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("preserves repository NOOP semantics", async () => {
    const repository: EntitlementRevocationRepository = {
      processRefundCompleted: vi.fn().mockResolvedValue("NOOP"),
    };

    const service = new ProcessEntitlementRevocation(repository);

    await expect(service.execute("22222222-2222-4222-8222-222222222222")).resolves.toBe("NOOP");
  });

  it("rejects a blank outbox event id before touching persistence", async () => {
    const processRefundCompleted = vi.fn();

    const service = new ProcessEntitlementRevocation({
      processRefundCompleted,
    });

    expect(() => service.execute("   ")).toThrow("INVALID_OUTBOX_EVENT_ID");

    expect(processRefundCompleted).not.toHaveBeenCalled();
  });
});
