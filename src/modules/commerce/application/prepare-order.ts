import { type Clock, utcNow } from "../../../shared/clock";
import { attemptAsync } from "../../../shared/result";
import { ResolvePurchasableOffer } from "../../catalog/application/resolve-purchasable-offer";
import { buildOrderItem, calculateOrderTotal, validateOrder, type Order } from "../domain/order";

export class PrepareOrder {
  constructor(
    private readonly resolveOffer: ResolvePurchasableOffer,
    private readonly clock: Clock,
  ) {}

  // IDs come from the internal caller. No price, total, email or HTTP contract is accepted.
  execute(
    input: Readonly<{
      orderId: string;
      itemId: string;
      customerId: string;
      productId: string;
      offerId: string;
      quantity: number;
    }>,
  ) {
    return attemptAsync(async () => {
      const resolved = await this.resolveOffer.execute(input);
      if (!resolved.ok) throw resolved.error;
      const now = utcNow(this.clock);
      const item = buildOrderItem(
        resolved.value,
        {
          id: input.itemId,
          orderId: input.orderId,
          productId: input.productId,
        },
        input.quantity,
        now,
      );
      const items = Object.freeze([item]);
      const order: Order = Object.freeze({
        id: input.orderId,
        customerId: input.customerId,
        status: "PENDING",
        items,
        total: calculateOrderTotal(items),
        createdAt: now,
        updatedAt: now,
        paidAt: null,
      });
      validateOrder(order);
      return order;
    });
  }
}
