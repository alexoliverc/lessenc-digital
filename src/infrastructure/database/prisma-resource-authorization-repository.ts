import type { PrismaClient } from "../../generated/prisma/client";
import type {
  AuthorizedDigitalResource,
  ResourceAuthorizationRepository,
} from "../../modules/entitlements/application/authorize-digital-resource";
import type {
  BuyerDigitalResource,
  BuyerResourceLibraryRepository,
} from "../../modules/entitlements/application/list-buyer-digital-resources";
import type { BuyerSubject } from "../../modules/entitlements/application/buyer-session";

export class PrismaResourceAuthorizationRepository
  implements ResourceAuthorizationRepository, BuyerResourceLibraryRepository
{
  constructor(private readonly db: PrismaClient) {}

  async authorize(
    subject: BuyerSubject,
    resourceId: string,
  ): Promise<AuthorizedDigitalResource | null> {
    /*
     * Authorization deliberately uses the immutable
     * EntitlementDigitalResource purchase-time grant.
     *
     * ProductDigitalResource and current Product status
     * are NOT authorization sources for historical
     * purchases.
     *
     * This is one persisted authorization query so no
     * intermediate successful lookup grants access.
     */
    const grant = await this.db.entitlementDigitalResource.findFirst({
      where: {
        resourceId,
        resource: {
          is: {
            status: "ACTIVE",
          },
        },
        entitlement: {
          is: {
            status: "ACTIVE",
            activatedAt: {
              not: null,
            },
            revokedAt: null,
            orderItem: {
              is: {
                orderId: subject.orderId,
                order: {
                  is: {
                    id: subject.orderId,
                    customerId: subject.customerId,
                    status: "PAID",
                    paidAt: {
                      not: null,
                    },
                    buyerAccessCredentials: {
                      some: {
                        id: subject.credentialId,
                        status: "ACTIVE",
                        activeOrderKey: subject.orderId,
                        revokedAt: null,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        entitlementId: true,
        resourceId: true,
        resource: {
          select: {
            id: true,
            storageKey: true,
            filename: true,
            mediaType: true,
          },
        },
      },
    });

    if (!grant) {
      return null;
    }

    if (grant.resource.id !== grant.resourceId) {
      return null;
    }

    return Object.freeze({
      resourceId: grant.resource.id,
      entitlementId: grant.entitlementId,
      storageKey: grant.resource.storageKey,
      filename: grant.resource.filename,
      mediaType: grant.resource.mediaType,
    });
  }

  async list(subject: BuyerSubject): Promise<readonly BuyerDigitalResource[]> {
    /*
     * Buyer library is derived from immutable
     * EntitlementDigitalResource grants only.
     *
     * Current ProductDigitalResource mappings
     * and current Product status are deliberately
     * excluded from historical purchase rights.
     */
    const grants = await this.db.entitlementDigitalResource.findMany({
      where: {
        resource: {
          is: {
            status: "ACTIVE",
          },
        },
        entitlement: {
          is: {
            status: "ACTIVE",
            activatedAt: {
              not: null,
            },
            revokedAt: null,
            orderItem: {
              is: {
                orderId: subject.orderId,
                order: {
                  is: {
                    id: subject.orderId,
                    customerId: subject.customerId,
                    status: "PAID",
                    paidAt: {
                      not: null,
                    },
                    buyerAccessCredentials: {
                      some: {
                        id: subject.credentialId,
                        status: "ACTIVE",
                        activeOrderKey: subject.orderId,
                        revokedAt: null,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        resourceId: true,
        resource: {
          select: {
            id: true,
            filename: true,
            mediaType: true,
          },
        },
      },
      orderBy: [
        {
          resourceId: "asc",
        },
        {
          entitlementId: "asc",
        },
      ],
    });

    const unique = new Map<string, BuyerDigitalResource>();

    for (const grant of grants) {
      if (grant.resource.id !== grant.resourceId || unique.has(grant.resourceId)) {
        continue;
      }

      unique.set(
        grant.resourceId,
        Object.freeze({
          resourceId: grant.resource.id,
          filename: grant.resource.filename,
          mediaType: grant.resource.mediaType,
        }),
      );
    }

    return Object.freeze([...unique.values()]);
  }
}
