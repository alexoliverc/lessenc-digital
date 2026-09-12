import { describe, expect, it } from "vitest";

import { getHealthStatus } from "./health";

describe("getHealthStatus", () => {
  it("reports the application as operational", () => {
    expect(getHealthStatus()).toEqual({
      status: "ok",
    });
  });
});
