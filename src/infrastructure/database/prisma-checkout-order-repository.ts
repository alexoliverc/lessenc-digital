import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import {
  type CheckoutOrderPersistenceResult,
  type CheckoutOrderRepository,
} from "../../modules/commerce/application/create-checkout-order";
import { type Order } from "../../modules/commerce/domain/order";

type CreateCheckoutInput = Parameters<CheckoutOrderRepository["create"]>[0];

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function sameNullableText(left: string | null, right: string | null): boolean {
  return left === right;
}

function isCompatibleExistingOrder(
  existing: Readonly<{
    id: string;
    totalMinor: number;
    currency: string;
    customer: Readonly<{
      email: string;
    }>;
    items: readonly Readonly<{
      productId: string;
      offerId: string;
      productNameSnapshot: string;
      productDescriptionSnapshot: string | null;
      unitPriceMinor: number;
      quantity: number;
      totalMinor: number;
      currency: string;
    }>[];
  }>,
  input: CreateCheckoutInput,
): boolean {
  const candidate = input.order;

  if (
    existing.id !== candidate.id ||
    existing.customer.email !== input.email ||
    existing.totalMinor !== candidate.total.amountMinor ||
    existing.currency !== candidate.total.currency ||
    existing.items.length !== candidate.items.length
  ) {
    return false;
  }

  if (existing.items.length !== 1 || candidate.items.length !== 1) {
    return false;
  }

  const existingItem = existing.items[0];
  const candidateItem = candidate.items[0];

  if (!existingItem || !candidateItem) {
    return false;
  }

  return (
    existingItem.productId === candidateItem.productId &&
    existingItem.offerId === candidateItem.offerId &&
    existingItem.productNameSnapshot === candidateItem.productNameSnapshot &&
    sameNullableText(
      existingItem.productDescriptionSnapshot,
      candidateItem.productDescriptionSnapshot,
    ) &&
    existingItem.unitPriceMinor === candidateItem.unitPrice.amountMinor &&
    existingItem.quantity === candidateItem.quantity &&
    existingItem.totalMinor === candidateItem.total.amountMinor &&
    existingItem.currency === candidateItem.total.currency
  );
}

function orderCreateData(order: Order) {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    totalMinor: order.total.amountMinor,
    currency: order.total.currency,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
    paidAt: order.paidAt === null ? null : new Date(order.paidAt),
  };
}

function orderItemCreateData(item: Order["items"][number]) {
  return {
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    offerId: item.offerId,
    productNameSnapshot: item.productNameSnapshot,
    productDescriptionSnapshot: item.productDescriptionSnapshot,
    unitPriceMinor: item.unitPrice.amountMinor,
    quantity: item.quantity,
    totalMinor: item.total.amountMinor,
    currency: item.total.currency,
    createdAt: new Date(item.createdAt),
  };
}

export class PrismaCheckoutOrderRepository implements CheckoutOrderRepository {
  constructor(private readonly database: PrismaClient) {}

  async create(input: CreateCheckoutInput): Promise<CheckoutOrderPersistenceResult> {
    try {
      await this.database.$transaction(async (transaction) => {
        await transaction.customer.create({
          data: {
            id: input.order.customerId,
            email: input.email,
          },
        });

        await transaction.order.create({
          data: orderCreateData(input.order),
        });

        for (const item of input.order.items) {
          await transaction.orderItem.create({
            data: orderItemCreateData(item),
          });
        }
      });

      return Object.freeze({
        state: "CREATED" as const,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.database.order.findUnique({
        where: {
          id: input.order.id,
        },
        include: {
          customer: true,
          items: true,
        },
      });

      if (!existing) {
        throw error;
      }

      if (!isCompatibleExistingOrder(existing, input)) {
        return Object.freeze({
          state: "CONFLICT" as const,
        });
      }

      return Object.freeze({
        state: "EXISTING" as const,
      });
    }
  }
}
