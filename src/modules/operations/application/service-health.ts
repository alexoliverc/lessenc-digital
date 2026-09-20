export const SERVICE_COMPONENTS = [
  "WEBSITE",
  "CHECKOUT",
  "PAYMENTS",
  "BUYER_ACCESS_DELIVERY",
  "ADMIN",
] as const;

export type ServiceComponent = (typeof SERVICE_COMPONENTS)[number];

export const COMPONENT_HEALTH_STATUSES = [
  "OPERATIONAL",
  "DEGRADED",
  "UNAVAILABLE",
  "MAINTENANCE",
  "UNKNOWN",
] as const;

export type ComponentHealthStatus = (typeof COMPONENT_HEALTH_STATUSES)[number];

export type ComponentHealthInput = Readonly<{
  component: ServiceComponent;
  status: ComponentHealthStatus;
  failureCode?: string;
}>;

export type ServiceHealth = Readonly<{
  status: ComponentHealthStatus;
  components: readonly ComponentHealthInput[];
}>;

export type PublicStatusProjection = Readonly<{
  status: "operational" | "degraded" | "major_outage" | "maintenance" | "unknown";
  components: readonly Readonly<{
    name: "Website" | "Checkout" | "Payments" | "Buyer Access / Digital Delivery" | "Admin";
    status: "operational" | "degraded" | "major_outage" | "maintenance" | "unknown";
  }>[];
}>;

const FAILURE_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;

const STATUS_PRIORITY: Readonly<Record<ComponentHealthStatus, number>> = Object.freeze({
  OPERATIONAL: 0,
  MAINTENANCE: 1,
  UNKNOWN: 2,
  DEGRADED: 3,
  UNAVAILABLE: 4,
});

const PUBLIC_COMPONENT_NAMES = Object.freeze({
  WEBSITE: "Website",
  CHECKOUT: "Checkout",
  PAYMENTS: "Payments",
  BUYER_ACCESS_DELIVERY: "Buyer Access / Digital Delivery",
  ADMIN: "Admin",
} as const);

const PUBLIC_STATUSES = Object.freeze({
  OPERATIONAL: "operational",
  DEGRADED: "degraded",
  UNAVAILABLE: "major_outage",
  MAINTENANCE: "maintenance",
  UNKNOWN: "unknown",
} as const);

function normalizeComponent(input: ComponentHealthInput): ComponentHealthInput {
  if (!SERVICE_COMPONENTS.includes(input.component)) {
    throw new Error("INVALID_SERVICE_COMPONENT");
  }
  if (!COMPONENT_HEALTH_STATUSES.includes(input.status)) {
    throw new Error("INVALID_COMPONENT_HEALTH_STATUS");
  }

  if (input.status === "OPERATIONAL" || input.status === "MAINTENANCE") {
    if (input.failureCode !== undefined) {
      throw new Error("INVALID_COMPONENT_HEALTH_FAILURE_CODE");
    }
    return Object.freeze({ component: input.component, status: input.status });
  }

  if (input.failureCode !== undefined && !FAILURE_CODE_PATTERN.test(input.failureCode)) {
    throw new Error("INVALID_COMPONENT_HEALTH_FAILURE_CODE");
  }

  return Object.freeze({
    component: input.component,
    status: input.status,
    ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
  });
}

export function evaluateServiceHealth(input: readonly ComponentHealthInput[]): ServiceHealth {
  if (!Array.isArray(input) || input.length !== SERVICE_COMPONENTS.length) {
    throw new Error("INVALID_SERVICE_HEALTH_COMPONENT_SET");
  }

  const byComponent = new Map<ServiceComponent, ComponentHealthInput>();
  for (const candidate of input) {
    const component = normalizeComponent(candidate);
    if (byComponent.has(component.component)) {
      throw new Error("DUPLICATE_SERVICE_HEALTH_COMPONENT");
    }
    byComponent.set(component.component, component);
  }

  const components = SERVICE_COMPONENTS.map((component) => {
    const resolved = byComponent.get(component);
    if (resolved === undefined) {
      throw new Error("MISSING_SERVICE_HEALTH_COMPONENT");
    }
    return resolved;
  });

  let status: ComponentHealthStatus = "OPERATIONAL";
  for (const component of components) {
    if (STATUS_PRIORITY[component.status] > STATUS_PRIORITY[status]) {
      status = component.status;
    }
  }

  return Object.freeze({ status, components: Object.freeze(components) });
}

export function projectPublicStatus(health: ServiceHealth): PublicStatusProjection {
  return Object.freeze({
    status: PUBLIC_STATUSES[health.status],
    components: Object.freeze(
      health.components.map((component) =>
        Object.freeze({
          name: PUBLIC_COMPONENT_NAMES[component.component],
          status: PUBLIC_STATUSES[component.status],
        }),
      ),
    ),
  });
}
