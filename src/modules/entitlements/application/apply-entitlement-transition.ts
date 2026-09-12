import { type Clock } from "../../../shared/clock";
import { attempt } from "../../../shared/result";
import {
  applyEntitlementFact,
  type Entitlement,
  type EntitlementFact,
} from "../domain/entitlement";

export class ApplyEntitlementTransition {
  constructor(private readonly clock: Clock) {}

  execute(entitlement: Entitlement, fact: EntitlementFact) {
    return attempt(() => applyEntitlementFact(entitlement, fact, this.clock));
  }
}
