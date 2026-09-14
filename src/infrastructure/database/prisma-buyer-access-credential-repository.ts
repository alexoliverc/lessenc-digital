import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { BuyerAccessCredentialExchangeRepository } from "../../modules/entitlements/application/exchange-buyer-access-credential";
import type { BuyerAccessCredentialRepository } from "../../modules/entitlements/application/issue-buyer-access-credential";
import type { BuyerSubject } from "../../modules/entitlements/application/buyer-session";
import type { BuyerSessionValidationRepository } from "../../modules/entitlements/application/validate-buyer-session";
import type {
  BuyerAccessCredentialLifecycleRepository,
  RevokeBuyerAccessCredentialResult,
} from "../../modules/entitlements/application/manage-buyer-access-credential";
import { type Clock, SystemClock } from "../../shared/clock";

type Tx = Prisma.TransactionClient;

export class PrismaBuyerAccessCredentialRepository
  implements
    BuyerAccessCredentialRepository,
    BuyerAccessCredentialLifecycleRepository,
    BuyerAccessCredentialExchangeRepository,
    BuyerSessionValidationRepository
{
  constructor(
    private readonly db: PrismaClient,
    private readonly clock: Clock = new SystemClock(),
  ) {}

  private async lockOrder(tx: Tx, orderId: string): Promise<void> {
    await tx.$queryRaw`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  private async assertEligibleOrder(tx: Tx, orderId: string): Promise<void> {
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        items: {
          include: {
            entitlement: {
              include: {
                resources: {
                  select: {
                    resourceId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error("BUYER_ACCESS_ORDER_NOT_FOUND");
    }

    if (order.status !== "PAID" || order.items.length === 0) {
      throw new Error("BUYER_ACCESS_ORDER_NOT_ELIGIBLE");
    }

    const entitlementReady = order.items.every(
      (item) => item.entitlement?.status === "ACTIVE" && item.entitlement.resources.length > 0,
    );

    if (!entitlementReady) {
      throw new Error("BUYER_ACCESS_ENTITLEMENT_NOT_READY");
    }
  }

  async issue(
    orderId: string,
    secretHash: string,
  ): Promise<
    Readonly<{
      credentialId: string;
      orderId: string;
    }>
  > {
    return this.db.$transaction(
      async (tx) => {
        await this.lockOrder(tx, orderId);
        await this.assertEligibleOrder(tx, orderId);

        const activeCredentials = await tx.buyerAccessCredential.findMany({
          where: {
            orderId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            activeOrderKey: true,
            revokedAt: true,
          },
        });

        if (activeCredentials.length > 0) {
          throw new Error("ACTIVE_CREDENTIAL_ALREADY_EXISTS");
        }

        const credential = await tx.buyerAccessCredential.create({
          data: {
            orderId,
            secretHash,
            status: "ACTIVE",
            activeOrderKey: orderId,
          },
          select: {
            id: true,
            orderId: true,
          },
        });

        return Object.freeze({
          credentialId: credential.id,
          orderId: credential.orderId,
        });
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }

  async revoke(
    orderId: string,
    expectedCredentialId: string,
  ): Promise<RevokeBuyerAccessCredentialResult> {
    return this.db.$transaction(
      async (tx) => {
        await this.lockOrder(tx, orderId);

        const credential = await tx.buyerAccessCredential.findFirst({
          where: {
            id: expectedCredentialId,
            orderId,
          },
        });

        if (!credential) {
          throw new Error("BUYER_ACCESS_CREDENTIAL_NOT_FOUND");
        }

        if (credential.status === "REVOKED") {
          if (credential.activeOrderKey !== null || credential.revokedAt === null) {
            throw new Error("BUYER_ACCESS_CREDENTIAL_STATE_CONFLICT");
          }

          return "NOOP";
        }

        if (
          credential.status !== "ACTIVE" ||
          credential.activeOrderKey !== orderId ||
          credential.revokedAt !== null
        ) {
          throw new Error("BUYER_ACCESS_CREDENTIAL_STATE_CONFLICT");
        }

        await tx.buyerAccessCredential.update({
          where: {
            id: credential.id,
          },
          data: {
            status: "REVOKED",
            activeOrderKey: null,
            revokedAt: this.clock.now(),
          },
        });

        return "REVOKED";
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }

  async reissue(
    orderId: string,
    expectedCredentialId: string,
    newSecretHash: string,
  ): Promise<
    Readonly<{
      credentialId: string;
      orderId: string;
    }>
  > {
    return this.db.$transaction(
      async (tx) => {
        await this.lockOrder(tx, orderId);
        await this.assertEligibleOrder(tx, orderId);

        const expected = await tx.buyerAccessCredential.findFirst({
          where: {
            id: expectedCredentialId,
            orderId,
          },
        });

        if (!expected) {
          throw new Error("BUYER_ACCESS_CREDENTIAL_NOT_FOUND");
        }

        if (
          expected.status === "REVOKED" &&
          expected.activeOrderKey === null &&
          expected.revokedAt !== null
        ) {
          throw new Error("BUYER_ACCESS_CREDENTIAL_ROTATED");
        }

        if (
          expected.status !== "ACTIVE" ||
          expected.activeOrderKey !== orderId ||
          expected.revokedAt !== null
        ) {
          throw new Error("BUYER_ACCESS_CREDENTIAL_STATE_CONFLICT");
        }

        const activeCredentials = await tx.buyerAccessCredential.findMany({
          where: {
            orderId,
            status: "ACTIVE",
          },
          select: {
            id: true,
            activeOrderKey: true,
          },
        });

        if (
          activeCredentials.length !== 1 ||
          activeCredentials[0]?.id !== expectedCredentialId ||
          activeCredentials[0]?.activeOrderKey !== orderId
        ) {
          throw new Error("BUYER_ACCESS_CREDENTIAL_STATE_CONFLICT");
        }

        const revokedAt = this.clock.now();

        await tx.buyerAccessCredential.update({
          where: {
            id: expected.id,
          },
          data: {
            status: "REVOKED",
            activeOrderKey: null,
            revokedAt,
          },
        });

        const next = await tx.buyerAccessCredential.create({
          data: {
            orderId,
            secretHash: newSecretHash,
            status: "ACTIVE",
            activeOrderKey: orderId,
          },
          select: {
            id: true,
            orderId: true,
          },
        });

        return Object.freeze({
          credentialId: next.id,
          orderId: next.orderId,
        });
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }

  async exchange(secretHash: string): Promise<BuyerSubject | null> {
    if (!/^[a-f0-9]{64}$/u.test(secretHash)) {
      return null;
    }

    /*
     * The first lookup only locates the owning Order.
     * No authorization decision is made before the
     * Order lock is acquired.
     */
    const locator = await this.db.buyerAccessCredential.findUnique({
      where: {
        secretHash,
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    if (!locator) {
      return null;
    }

    return this.db.$transaction(
      async (tx) => {
        /*
         * Serialize exchange with revoke/reissue so
         * credential state is re-read after acquiring
         * the same Order lock used by lifecycle writes.
         */
        await this.lockOrder(tx, locator.orderId);

        const credential = await tx.buyerAccessCredential.findUnique({
          where: {
            id: locator.id,
          },
          include: {
            order: {
              include: {
                items: {
                  include: {
                    entitlement: {
                      include: {
                        resources: {
                          select: {
                            resourceId: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!credential || credential.secretHash !== secretHash) {
          return null;
        }

        const order = credential.order;

        if (
          credential.status !== "ACTIVE" ||
          credential.activeOrderKey !== order.id ||
          credential.revokedAt !== null
        ) {
          return null;
        }

        if (order.status !== "PAID" || order.paidAt === null || order.items.length === 0) {
          return null;
        }

        const entitlementReady = order.items.every(
          (item) =>
            item.entitlement?.status === "ACTIVE" &&
            item.entitlement.activatedAt !== null &&
            item.entitlement.revokedAt === null &&
            item.entitlement.resources.length > 0,
        );

        if (!entitlementReady) {
          return null;
        }

        await tx.buyerAccessCredential.update({
          where: {
            id: credential.id,
          },
          data: {
            lastUsedAt: this.clock.now(),
          },
        });

        return Object.freeze({
          customerId: order.customerId,
          orderId: order.id,
          credentialId: credential.id,
        });
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }

  async validateSession(subject: BuyerSubject): Promise<BuyerSubject | null> {
    return this.db.$transaction(
      async (tx) => {
        /*
         * Session validation shares the Order lock used
         * by revoke/reissue. Once a lifecycle mutation
         * completes, a subsequent validation must observe
         * the new credential state.
         */
        await this.lockOrder(tx, subject.orderId);

        const credential = await tx.buyerAccessCredential.findUnique({
          where: {
            id: subject.credentialId,
          },
          include: {
            order: {
              include: {
                items: {
                  include: {
                    entitlement: {
                      include: {
                        resources: {
                          select: {
                            resourceId: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!credential) {
          return null;
        }

        const order = credential.order;

        if (
          credential.orderId !== subject.orderId ||
          order.id !== subject.orderId ||
          order.customerId !== subject.customerId
        ) {
          return null;
        }

        if (
          credential.status !== "ACTIVE" ||
          credential.activeOrderKey !== order.id ||
          credential.revokedAt !== null
        ) {
          return null;
        }

        if (order.status !== "PAID" || order.paidAt === null || order.items.length === 0) {
          return null;
        }

        const entitlementReady = order.items.every(
          (item) =>
            item.entitlement?.status === "ACTIVE" &&
            item.entitlement.activatedAt !== null &&
            item.entitlement.revokedAt === null &&
            item.entitlement.resources.length > 0,
        );

        if (!entitlementReady) {
          return null;
        }

        return Object.freeze({
          customerId: order.customerId,
          orderId: order.id,
          credentialId: credential.id,
        });
      },
      {
        isolationLevel: "ReadCommitted",
      },
    );
  }
}
