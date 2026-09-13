import { attemptAsync } from "../../../shared/result";
import { type Order } from "../domain/order";
import { PrepareOrder } from "./prepare-order";

export type CheckoutOrderPersistenceResult =
  | Readonly<{
      state: "CREATED";
    }>
  | Readonly<{
      state: "EXISTING";
    }>
  | Readonly<{
      state: "CONFLICT";
    }>;

export interface CheckoutOrderRepository {
  create(
    input: Readonly<{
      email: string;
      order: Order;
    }>,
  ): Promise<CheckoutOrderPersistenceResult>;
}

export class CreateCheckoutOrder {
  constructor(
    private readonly prepareOrder: PrepareOrder,
    private readonly checkoutOrders: CheckoutOrderRepository,
  ) {}

  execute(
    input: Readonly<{
      orderId: string;
      itemId: string;
      customerId: string;
      productId: string;
      offerId: string;
      email: string;
    }>,
  ) {
    return attemptAsync(async () => {
      const prepared = await this.prepareOrder.execute({
        orderId: input.orderId,
        itemId: input.itemId,
        customerId: input.customerId,
        productId: input.productId,
        offerId: input.offerId,
        quantity: 1,
      });

      if (!prepared.ok) {
        throw prepared.error;
      }

      return this.checkoutOrders.create({
        email: input.email,
        order: prepared.value,
      });
    });
  }
}
