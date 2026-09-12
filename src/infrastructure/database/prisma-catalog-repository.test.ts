import { describe, expect, it, vi } from "vitest";

import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { PrismaCatalogRepository } from "./prisma-catalog-repository";

function databaseThrowing(error: unknown): PrismaClient {
  return {
    $transaction: async () => {
      throw error;
    },
  } as unknown as PrismaClient;
}

function initializationError(): Prisma.PrismaClientInitializationError {
  const error = Object.create(
    Prisma.PrismaClientInitializationError.prototype,
  ) as Prisma.PrismaClientInitializationError;

  Object.assign(error, {
    name: "PrismaClientInitializationError",
    message: "sensitive database URL and credentials",
    clientVersion: "7.10.0",
    errorCode: "P1001",
  });

  return error;
}

describe("Catalog persistence error boundary", () => {
  it("translates initialization failures without exposing raw diagnostics", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(
        new PrismaCatalogRepository(databaseThrowing(initializationError())).findOffer("offer"),
      ).rejects.toMatchObject({
        code: "PERSISTENCE_UNAVAILABLE",
        message: "Catalog data is temporarily unavailable",
        context: { operation: "catalog-read" },
      });

      expect(diagnostic).toHaveBeenCalledExactlyOnceWith(
        '{"event":"catalog.read.failed","code":"PERSISTENCE_UNAVAILABLE"}',
      );

      expect(diagnostic.mock.calls.flat().join(" ")).not.toContain("credentials");
    } finally {
      diagnostic.mockRestore();
    }
  });

  it("translates P2024 pool timeout and logs only the safe Prisma code", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const error = new Prisma.PrismaClientKnownRequestError(
      "sensitive SQL, database URL and credentials",
      {
        code: "P2024",
        clientVersion: "7.10.0",
      },
    );

    try {
      await expect(
        new PrismaCatalogRepository(databaseThrowing(error)).findOffer("offer"),
      ).rejects.toMatchObject({
        code: "PERSISTENCE_UNAVAILABLE",
        context: { operation: "catalog-read" },
      });

      expect(diagnostic).toHaveBeenCalledExactlyOnceWith(
        '{"event":"catalog.read.failed","code":"PERSISTENCE_UNAVAILABLE","prismaCode":"P2024"}',
      );

      const logged = diagnostic.mock.calls.flat().join(" ");

      expect(logged).not.toContain("sensitive SQL");
      expect(logged).not.toContain("database URL");
      expect(logged).not.toContain("credentials");
    } finally {
      diagnostic.mockRestore();
    }
  });

  it("does not misclassify other known Prisma request failures as unavailability", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const error = new Prisma.PrismaClientKnownRequestError("sensitive unique constraint details", {
      code: "P2002",
      clientVersion: "7.10.0",
    });

    try {
      await expect(
        new PrismaCatalogRepository(databaseThrowing(error)).findOffer("offer"),
      ).rejects.toBe(error);

      expect(diagnostic).not.toHaveBeenCalled();
    } finally {
      diagnostic.mockRestore();
    }
  });

  it("does not turn programming defects into business rejections", async () => {
    const defect = new TypeError("defect");

    await expect(
      new PrismaCatalogRepository(databaseThrowing(defect)).findOffer("offer"),
    ).rejects.toBe(defect);
  });
});
