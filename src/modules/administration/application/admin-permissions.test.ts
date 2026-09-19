import { describe, expect, it } from "vitest";

import { ADMIN_PERMISSIONS, hasAdminPermission } from "./admin-permissions";
import {
  AdminAccessDenied,
  requireAdminPermission,
  type AdminSubject,
} from "../infrastructure/admin-subject";
import { sanitizeAdminAuditMetadata } from "../infrastructure/admin-audit";

function subject(role: AdminSubject["role"], fresh = true): AdminSubject {
  return { adminUserId: "fixture-admin", adminSessionId: "fixture-session", role, fresh };
}

describe("server-owned administrative permissions", () => {
  it("grants every defined permission to OWNER and denies unknown permissions", () => {
    for (const permission of ADMIN_PERMISSIONS)
      expect(hasAdminPermission("OWNER", permission)).toBe(true);
    expect(hasAdminPermission("OWNER", "payment.approve")).toBe(false);
    expect(hasAdminPermission("OWNER", "entitlement.activate")).toBe(false);
  });

  it("allows ADMIN operations without role management or financial fabrication", () => {
    for (const permission of [
      "catalog.read",
      "catalog.write",
      "audit.read",
      "analytics.read",
      "delivery.recover",
    ]) {
      expect(hasAdminPermission("ADMIN", permission)).toBe(true);
    }
    for (const permission of ["admin.role.manage", "payment.approve", "entitlement.activate"]) {
      expect(hasAdminPermission("ADMIN", permission)).toBe(false);
    }
  });

  it("limits SUPPORT to read/support operations and own security", () => {
    for (const permission of ["order.read", "payment.read", "delivery.recover", "security.self"]) {
      expect(hasAdminPermission("SUPPORT", permission)).toBe(true);
    }
    for (const permission of [
      "catalog.write",
      "analytics.read",
      "admin.identity.manage",
      "admin.role.manage",
    ]) {
      expect(hasAdminPermission("SUPPORT", permission)).toBe(false);
    }
  });

  it("denies missing permission and stale fresh-auth operations", () => {
    expect(() => requireAdminPermission(subject("OWNER"), "unknown")).toThrow(AdminAccessDenied);
    expect(() =>
      requireAdminPermission(subject("OWNER", false), "admin.role.manage", { fresh: true }),
    ).toThrow(AdminAccessDenied);
    expect(() => requireAdminPermission(subject("OWNER", false), "order.read")).not.toThrow();
  });

  it("rejects secret and unknown audit metadata keys", () => {
    expect(sanitizeAdminAuditMetadata({ reasonCode: "ACCESS_DENIED" })).toEqual({
      reasonCode: "ACCESS_DENIED",
    });
    for (const key of [
      "password",
      "passwordHash",
      "sessionToken",
      "cookie",
      "totpCode",
      "backupCode",
      "authorization",
    ]) {
      expect(() => sanitizeAdminAuditMetadata({ [key]: "fixture-only" })).toThrow();
    }
    expect(() => sanitizeAdminAuditMetadata({ reasonCode: "syntheticPassword123" })).toThrow();
  });
});
