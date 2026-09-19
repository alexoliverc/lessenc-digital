import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaCanonicalPurchaseRepository } from "@/infrastructure/database/prisma-canonical-purchase-repository";
import {
  ProjectCanonicalPurchase,
  ReconcileCanonicalPurchases,
  type CanonicalPurchaseReconciliationReport,
} from "@/modules/analytics/application/canonical-purchase";

/**
 * Bounded application entrypoint for an explicitly authorized scheduler
 * or administrative operation. It is intentionally not exposed as a
 * public HTTP route by P13-E.
 */
export async function reconcileMissingCanonicalPurchases(
  limit = 50,
): Promise<CanonicalPurchaseReconciliationReport> {
  const repository = new PrismaCanonicalPurchaseRepository(getDatabaseClient());
  const projector = new ProjectCanonicalPurchase(repository, randomUUID);

  return new ReconcileCanonicalPurchases(repository, projector).execute(limit);
}
