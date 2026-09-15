import { describe, expect, it } from "vitest";
import { adminNavigationFor } from "./admin-navigation";

describe("role-aware admin navigation", () => {
  it("hides catalog and audit from SUPPORT", () => {
    const paths = adminNavigationFor("SUPPORT").map(([, path]) => path);
    expect(paths).not.toContain("/admin/catalog");
    expect(paths).not.toContain("/admin/audit");
    expect(paths).toContain("/admin/orders");
  });
  it("shows operational surfaces to ADMIN without identity management", () => {
    const paths = adminNavigationFor("ADMIN").map(([, path]) => path);
    expect(paths).toContain("/admin/catalog");
    expect(paths).toContain("/admin/audit");
    expect(paths).not.toContain("/admin/identities");
  });
});
