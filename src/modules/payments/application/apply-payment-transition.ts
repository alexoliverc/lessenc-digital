import { type Clock } from "../../../shared/clock";
import { attempt } from "../../../shared/result";
import { applyPaymentFact, type Payment, type PaymentFact } from "../domain/payment";

export class ApplyPaymentTransition {
  constructor(private readonly clock: Clock) {}

  execute(payment: Payment, fact: PaymentFact) {
    return attempt(() => applyPaymentFact(payment, fact, this.clock));
  }
}
