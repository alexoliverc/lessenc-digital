import { type Clock } from "../../../shared/clock";
import { attempt } from "../../../shared/result";
import { type Order } from "../domain/order";
import { applyOrderFact, type OrderFact } from "../domain/order-transition";

export class ApplyOrderTransition {
  constructor(private readonly clock: Clock) {}

  execute(order: Order, fact: OrderFact) {
    return attempt(() => applyOrderFact(order, fact, this.clock));
  }
}
