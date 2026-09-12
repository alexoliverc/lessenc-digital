import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { type ProductStatus as StoredProductStatus } from "../../generated/prisma/enums";
import { type CatalogRepository } from "../../modules/catalog/application/resolve-purchasable-offer";
import { type CatalogOffer, type ProductStatus } from "../../modules/catalog/domain/catalog";
import { ApplicationError } from "../../shared/application-error";
import { assertNever } from "../../shared/assert-never";
import { Money } from "../../shared/money";

function mapProductStatus(status: StoredProductStatus): ProductStatus {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "ACTIVE":
      return "ACTIVE";
    case "INACTIVE":
      return "INACTIVE";
    case "ARCHIVED":
      return "ARCHIVED";
    default:
      return assertNever(status);
  }
}

function logPersistenceUnavailable(prismaCode?: string): void {
  const diagnostic =
    prismaCode === undefined
      ? {
          event: "catalog.read.failed",
          code: "PERSISTENCE_UNAVAILABLE",
        }
      : {
          event: "catalog.read.failed",
          code: "PERSISTENCE_UNAVAILABLE",
          prismaCode,
        };

  console.error(JSON.stringify(diagnostic));
}

function isKnownUnavailableRequestError(error: Prisma.PrismaClientKnownRequestError): boolean {
  // P2024 = timed out while obtaining a connection from the connection pool.
  // Keep the classification deliberately narrow in P07.
  return error.code === "P2024";
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly database: PrismaClient) {}

  async findOffer(offerId: string): Promise<CatalogOffer | null> {
    try {
      const row = await this.database.$transaction(
        (transaction) =>
          transaction.offer.findUnique({
            where: { id: offerId },
            include: { product: true },
          }),
        { isolationLevel: "RepeatableRead" },
      );

      if (!row) return null;

      return Object.freeze({
        product: Object.freeze({
          id: row.product.id,
          name: row.product.name,
          description: row.product.description,
          status: mapProductStatus(row.product.status),
        }),
        offer: Object.freeze({
          id: row.id,
          productId: row.productId,
          price: Money.of(row.priceMinor, row.currency),
          isActive: row.isActive,
        }),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientInitializationError) {
        logPersistenceUnavailable();
        throw new ApplicationError("PERSISTENCE_UNAVAILABLE", "catalog-read");
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        isKnownUnavailableRequestError(error)
      ) {
        logPersistenceUnavailable(error.code);
        throw new ApplicationError("PERSISTENCE_UNAVAILABLE", "catalog-read");
      }

      throw error;
    }
  }
}
