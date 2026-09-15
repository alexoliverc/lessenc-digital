import { describe, expect, it } from "vitest";

import { adminPageDecision } from "./admin-page-decision";
import type { AdminSessionState } from "@/modules/administration/infrastructure/admin-subject";

const base: AdminSessionState = {
  adminUserId: "fixture",
  adminSessionId: "session",
  role: "SUPPORT",
  fresh: true,
  mfaComplete: true,
};

describe("administrative page gate", () => {
  it("routes absent and enrollment-only sessions before protected content", () => {
    expect(adminPageDecision(null)).toBe("LOGIN");
    expect(adminPageDecision({ ...base, mfaComplete: false })).toBe("ENROLL");
  });

  it("allows a valid subject but denies hidden surfaces on the server", () => {
    expect(adminPageDecision(base, "order.read")).toBe("ALLOWED");
    expect(adminPageDecision(base, "catalog.read")).toBe("FORBIDDEN");
    expect(adminPageDecision(base, "audit.read")).toBe("FORBIDDEN");
    expect(adminPageDecision({ ...base, role: "ADMIN" }, "admin.role.manage")).toBe("FORBIDDEN");
  });
});
