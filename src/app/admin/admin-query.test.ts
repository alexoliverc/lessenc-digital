import { describe, expect, it } from "vitest";
import { isAdminResourceId, parseAdminListQuery, parseProductStatus } from "./admin-query";

describe("admin list query", () => {
  it("bounds pagination and search", () => {
    expect(parseAdminListQuery({ page: "0", limit: "999", q: " x " })).toEqual({
      page: 1,
      limit: 50,
      search: "x",
    });
    expect(parseAdminListQuery({ page: "bad", limit: "bad", q: "a".repeat(150) })).toEqual({
      page: 1,
      limit: 20,
      search: "a".repeat(100),
    });
  });
  it("allowlists catalog status values", () => {
    expect(parseProductStatus("ACTIVE")).toBe("ACTIVE");
    expect(parseProductStatus("PAID")).toBeNull();
    expect(parseProductStatus(null)).toBeNull();
  });
  it("accepts only canonical UUID resource identifiers", () => {
    expect(isAdminResourceId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isAdminResourceId("------------------------------------")).toBe(false);
  });
});
