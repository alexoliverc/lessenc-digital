import { describe, expect, it } from "vitest";

import {
  evaluateServiceHealth,
  projectPublicStatus,
  SERVICE_COMPONENTS,
  type ComponentHealthInput,
} from "./service-health";

function operationalComponents(): ComponentHealthInput[] {
  return SERVICE_COMPONENTS.map((component) => ({ component, status: "OPERATIONAL" }));
}

describe("P15 service health and public status projection", () => {
  it("aggregates the worst component state deterministically", () => {
    const components = operationalComponents();
    components[2] = {
      component: "PAYMENTS",
      status: "DEGRADED",
      failureCode: "PAYMENT_PROVIDER_DEGRADED",
    };

    const health = evaluateServiceHealth(components);

    expect(health.status).toBe("DEGRADED");
    expect(projectPublicStatus(health).status).toBe("degraded");
  });

  it("projects only sanitized public component names and states", () => {
    const components = operationalComponents();
    components[3] = {
      component: "BUYER_ACCESS_DELIVERY",
      status: "UNAVAILABLE",
      failureCode: "DATABASE_UNAVAILABLE",
      databaseHost: "private-db.internal",
      storagePath: "C:\\private\\storage",
    } as ComponentHealthInput;

    const projection = projectPublicStatus(evaluateServiceHealth(components));
    const serialized = JSON.stringify(projection);

    expect(projection.status).toBe("major_outage");
    expect(projection.components[3]).toEqual({
      name: "Buyer Access / Digital Delivery",
      status: "major_outage",
    });
    expect(serialized).not.toContain("DATABASE_UNAVAILABLE");
    expect(serialized).not.toContain("private-db");
    expect(serialized).not.toContain("C:\\private");
  });

  it("requires every canonical component exactly once", () => {
    expect(() => evaluateServiceHealth(operationalComponents().slice(0, -1))).toThrow(
      "INVALID_SERVICE_HEALTH_COMPONENT_SET",
    );

    const duplicate = operationalComponents();
    duplicate[4] = duplicate[0]!;
    expect(() => evaluateServiceHealth(duplicate)).toThrow("DUPLICATE_SERVICE_HEALTH_COMPONENT");
  });
});
