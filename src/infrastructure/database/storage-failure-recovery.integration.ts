import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  resolve,
} from "node:path";

import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createProtectedDownloadHandler,
} from "../../app/api/buyer-access/resources/[resourceId]/handler";
import {
  buyerAccessCookieName,
} from "../../app/api/buyer-access/http";
import {
  AuthorizeDigitalResource,
} from "../../modules/entitlements/application/authorize-digital-resource";
import {
  PrepareProtectedDelivery,
  RecordProtectedDeliveryOutcome,
} from "../../modules/entitlements/application/protected-digital-delivery";
import {
  ValidateBuyerSession,
} from "../../modules/entitlements/application/validate-buyer-session";
import {
  HmacBuyerSession,
} from "../security/hmac-buyer-session";
import {
  LocalPrivateFileStorage,
} from "../storage/local-private-file-storage";
import {
  createDatabaseClient,
} from "./client";
import {
  PrismaBuyerAccessCredentialRepository,
} from "./prisma-buyer-access-credential-repository";
import {
  PrismaDigitalDeliveryAuditRepository,
} from "./prisma-digital-delivery-audit-repository";
import {
  PrismaResourceAuthorizationRepository,
} from "./prisma-resource-authorization-repository";

const SESSION_SECRET =
  "p11-c64-http-mysql-recovery-session-secret-minimum-32-bytes";

type Fixture = {
  customerId: string;
  productId: string;
  offerId: string;
  orderId: string;
  orderItemId: string;
  entitlementId: string;
  resourceId: string;
  credentialId: string;
  storageKey: string;
};

let db:
  ReturnType<typeof createDatabaseClient>;

let fixture:
  Fixture | null = null;

const temporaryRoots =
  new Set<string>();

function guardedTestUrl(): string {
  const raw =
    process.env.TEST_DATABASE_URL;

  if (
    process.env.APP_ENV !== "test" ||
    !raw
  ) {
    throw new Error(
      "P11 C6.4 recovery requires APP_ENV=test and TEST_DATABASE_URL",
    );
  }

  const url =
    new URL(raw);

  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    ![
      "/lessenc_test",
      "/lessenc_test_rebuild",
    ].includes(url.pathname) ||
    !url.username
  ) {
    throw new Error(
      "P11 C6.4 recovery refused a non-isolated P06 test database",
    );
  }

  return raw;
}

async function createFixture(): Promise<void> {
  const customerId =
    randomUUID();

  const productId =
    randomUUID();

  const offerId =
    randomUUID();

  const orderId =
    randomUUID();

  const orderItemId =
    randomUUID();

  const entitlementId =
    randomUUID();

  const resourceId =
    randomUUID();

  const credentialId =
    randomUUID();

  const storageKey =
    `resources/${resourceId}/v1.pdf`;

  fixture = {
    customerId,
    productId,
    offerId,
    orderId,
    orderItemId,
    entitlementId,
    resourceId,
    credentialId,
    storageKey,
  };

  await db.customer.create({
    data: {
      id: customerId,
      email:
        `${customerId}@example.invalid`,
    },
  });

  await db.product.create({
    data: {
      id: productId,
      name:
        `P11 C6.4 ${productId}`,
      status: "ACTIVE",
    },
  });

  await db.offer.create({
    data: {
      id: offerId,
      productId,
      priceMinor: 2990,
      currency: "BRL",
      isActive: true,
    },
  });

  await db.order.create({
    data: {
      id: orderId,
      customerId,
      status: "PAID",
      totalMinor: 2990,
      currency: "BRL",
      paidAt:
        new Date(
          "2026-09-13T14:00:00.000Z",
        ),
    },
  });

  await db.orderItem.create({
    data: {
      id: orderItemId,
      orderId,
      productId,
      offerId,
      productNameSnapshot:
        `P11 C6.4 ${productId}`,
      unitPriceMinor: 2990,
      quantity: 1,
      totalMinor: 2990,
      currency: "BRL",
    },
  });

  await db.entitlement.create({
    data: {
      id: entitlementId,
      orderItemId,
      status: "ACTIVE",
      activatedAt:
        new Date(
          "2026-09-13T14:00:01.000Z",
        ),
    },
  });

  await db.digitalResource.create({
    data: {
      id: resourceId,
      logicalKey:
        `p11-c64-${resourceId}`,
      version: 1,
      storageKey,
      filename:
        "lessenc-recovery.pdf",
      mediaType:
        "application/pdf",
      status: "ACTIVE",
    },
  });

  await db.productDigitalResource.create({
    data: {
      productId,
      resourceId,
    },
  });

  await db.entitlementDigitalResource.create({
    data: {
      entitlementId,
      resourceId,
    },
  });

  await db.buyerAccessCredential.create({
    data: {
      id: credentialId,
      orderId,
      secretHash:
        createHash("sha256")
          .update(
            `p11-c64-${credentialId}`,
          )
          .digest("hex"),
      status: "ACTIVE",
      activeOrderKey:
        orderId,
    },
  });
}

async function cleanupFixture(): Promise<void> {
  if (!fixture) {
    return;
  }

  await db.digitalDeliveryEvent.deleteMany({
    where: {
      OR: [
        {
          entitlementId:
            fixture.entitlementId,
        },
        {
          buyerAccessCredentialId:
            fixture.credentialId,
        },
      ],
    },
  });

  await db.buyerAccessCredential.deleteMany({
    where: {
      orderId:
        fixture.orderId,
    },
  });

  await db.entitlementDigitalResource.deleteMany({
    where: {
      entitlementId:
        fixture.entitlementId,
    },
  });

  await db.productDigitalResource.deleteMany({
    where: {
      productId:
        fixture.productId,
    },
  });

  await db.entitlement.deleteMany({
    where: {
      id:
        fixture.entitlementId,
    },
  });

  await db.digitalResource.deleteMany({
    where: {
      id:
        fixture.resourceId,
    },
  });

  await db.orderItem.deleteMany({
    where: {
      id:
        fixture.orderItemId,
    },
  });

  await db.order.deleteMany({
    where: {
      id:
        fixture.orderId,
    },
  });

  await db.offer.deleteMany({
    where: {
      id:
        fixture.offerId,
    },
  });

  await db.product.deleteMany({
    where: {
      id:
        fixture.productId,
    },
  });

  await db.customer.deleteMany({
    where: {
      id:
        fixture.customerId,
    },
  });

  fixture = null;
}

async function cleanupTemporaryRoots(): Promise<void> {
  for (const root of temporaryRoots) {
    await rm(
      root,
      {
        recursive: true,
        force: true,
      },
    );
  }

  temporaryRoots.clear();
}

async function temporaryRoot(
  prefix: string,
): Promise<string> {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        prefix,
      ),
    );

  temporaryRoots.add(root);

  return root;
}

function currentFixture(): Fixture {
  if (!fixture) {
    throw new Error(
      "P11 C6.4 fixture unavailable",
    );
  }

  return fixture;
}

function sessionToken(): string {
  const current =
    currentFixture();

  const sessions =
    new HmacBuyerSession(
      SESSION_SECRET,
    );

  return sessions.issue({
    customerId:
      current.customerId,
    orderId:
      current.orderId,
    credentialId:
      current.credentialId,
  });
}

function downloadRequest(
  token: string,
): NextRequest {
  const current =
    currentFixture();

  const cookieName =
    buyerAccessCookieName(
      "local",
    );

  const headers =
    new Headers();

  headers.set(
    "cookie",
    `${cookieName}=${token}`,
  );

  return new NextRequest(
    `http://localhost/api/buyer-access/resources/${current.resourceId}`,
    {
      method: "GET",
      headers,
    },
  );
}

function createHandler(
  storage: LocalPrivateFileStorage,
) {
  const credentialRepository =
    new PrismaBuyerAccessCredentialRepository(
      db,
    );

  const sessionService =
    new HmacBuyerSession(
      SESSION_SECRET,
    );

  const validateSession =
    new ValidateBuyerSession(
      credentialRepository,
      sessionService,
    );

  const resourceRepository =
    new PrismaResourceAuthorizationRepository(
      db,
    );

  const authorize =
    new AuthorizeDigitalResource(
      resourceRepository,
    );

  const audit =
    new PrismaDigitalDeliveryAuditRepository(
      db,
    );

  const prepareDelivery =
    new PrepareProtectedDelivery(
      authorize,
      storage,
      audit,
    );

  const recordOutcome =
    new RecordProtectedDeliveryOutcome(
      audit,
    );

  return createProtectedDownloadHandler({
    validateSession,
    prepareDelivery,
    recordOutcome,
    appEnv: "local",
  });
}

async function writeAuthorizedResource(
  root: string,
  content: string,
): Promise<void> {
  const current =
    currentFixture();

  const physicalPath =
    resolve(
      root,
      current.storageKey,
    );

  await mkdir(
    dirname(physicalPath),
    {
      recursive: true,
    },
  );

  await writeFile(
    physicalPath,
    content,
  );
}

async function commercialRightSnapshot() {
  const current =
    currentFixture();

  const order =
    await db.order.findUniqueOrThrow({
      where: {
        id: current.orderId,
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        totalMinor: true,
        currency: true,
        paidAt: true,
      },
    });

  const entitlement =
    await db.entitlement.findUniqueOrThrow({
      where: {
        id: current.entitlementId,
      },
      select: {
        id: true,
        orderItemId: true,
        status: true,
        activatedAt: true,
        revokedAt: true,
      },
    });

  const credential =
    await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: current.credentialId,
      },
      select: {
        id: true,
        orderId: true,
        secretHash: true,
        status: true,
        activeOrderKey: true,
        revokedAt: true,
      },
    });

  const grant =
    await db.entitlementDigitalResource.findFirstOrThrow({
      where: {
        entitlementId:
          current.entitlementId,
        resourceId:
          current.resourceId,
      },
      select: {
        entitlementId: true,
        resourceId: true,
      },
    });

  return {
    order,
    entitlement,
    credential,
    grant,
  };
}

async function deliveryEvents() {
  const current =
    currentFixture();

  return db.digitalDeliveryEvent.findMany({
    where: {
      entitlementId:
        current.entitlementId,
      resourceId:
        current.resourceId,
      buyerAccessCredentialId:
        current.credentialId,
    },
    select: {
      id: true,
      entitlementId: true,
      resourceId: true,
      buyerAccessCredentialId: true,
      outcome: true,
      failureCode: true,
      createdAt: true,
    },
  });
}

async function expectFailureResponse(
  response: Response,
): Promise<void> {
  expect(response.status).toBe(503);

  expect(
    response.headers.get(
      "cache-control",
    ),
  ).toContain("no-store");

  const body =
    await response.json();

  expect(body).toEqual({
    error:
      "SERVICE_UNAVAILABLE",
  });

  const serialized =
    JSON.stringify(body);

  const current =
    currentFixture();

  expect(serialized).not.toContain(
    current.resourceId,
  );

  expect(serialized).not.toContain(
    current.entitlementId,
  );

  expect(serialized).not.toContain(
    current.storageKey,
  );
}

async function expectSuccessfulResponse(
  response: Response,
  expectedContent: string,
): Promise<void> {
  expect(response.status).toBe(200);

  expect(
    response.headers.get(
      "accept-ranges",
    ),
  ).toBe("none");

  expect(
    response.headers.get(
      "content-type",
    ),
  ).toContain(
    "application/pdf",
  );

  const bytes =
    await response.arrayBuffer();

  expect(
    Buffer.from(bytes).toString(
      "utf8",
    ),
  ).toBe(
    expectedContent,
  );
}

function expectAppendOnlyRecovery(
  before:
    Awaited<
      ReturnType<
        typeof deliveryEvents
      >
    >[number],
  after:
    Awaited<
      ReturnType<
        typeof deliveryEvents
      >
    >,
): void {
  expect(after).toHaveLength(2);

  const preserved =
    after.find(
      (event) =>
        event.id === before.id,
    );

  expect(preserved).toEqual(
    before,
  );

  const succeeded =
    after.find(
      (event) =>
        event.outcome ===
        "SUCCEEDED",
    );

  expect(succeeded).toBeDefined();

  expect(
    succeeded?.failureCode,
  ).toBeNull();

  expect(
    succeeded?.id,
  ).not.toBe(
    before.id,
  );
}

describe(
  "P11 C6.4 HTTP/MySQL storage failure recovery",
  () => {
    beforeAll(async () => {
      db =
        createDatabaseClient(
          guardedTestUrl(),
        );

      await db.$connect();
    });

    beforeEach(
      createFixture,
    );

    afterEach(async () => {
      await cleanupFixture();

      await cleanupTemporaryRoots();
    });

    afterAll(async () => {
      await db?.$disconnect();
    });

    it(
      "persists RESOURCE_NOT_FOUND, returns 503, then succeeds on a later request after the object is restored",
      async () => {
        const root =
          await temporaryRoot(
            "lessenc-p11-c64-http-object-",
          );

        const storage =
          new LocalPrivateFileStorage(
            root,
          );

        const handler =
          createHandler(
            storage,
          );

        const token =
          sessionToken();

        const commercialBefore =
          await commercialRightSnapshot();

        const failedResponse =
          await handler(
            downloadRequest(
              token,
            ),
            currentFixture()
              .resourceId,
          );

        await expectFailureResponse(
          failedResponse,
        );

        const afterFailure =
          await deliveryEvents();

        expect(
          afterFailure,
        ).toHaveLength(1);

        expect(
          afterFailure[0],
        ).toMatchObject({
          outcome: "FAILED",
          failureCode:
            "RESOURCE_NOT_FOUND",
        });

        const failedEvent =
          afterFailure[0];

        if (!failedEvent) {
          throw new Error(
            "failed delivery audit event missing",
          );
        }

        expect(
          await commercialRightSnapshot(),
        ).toEqual(
          commercialBefore,
        );

        const expectedContent =
          "lessenc-c64-restored-object";

        await writeAuthorizedResource(
          root,
          expectedContent,
        );

        const recoveredResponse =
          await handler(
            downloadRequest(
              token,
            ),
            currentFixture()
              .resourceId,
          );

        await expectSuccessfulResponse(
          recoveredResponse,
          expectedContent,
        );

        const afterRecovery =
          await deliveryEvents();

        expectAppendOnlyRecovery(
          failedEvent,
          afterRecovery,
        );

        expect(
          await commercialRightSnapshot(),
        ).toEqual(
          commercialBefore,
        );
      },
    );

    it(
      "persists STORAGE_ROOT_UNAVAILABLE, returns 503, then succeeds after the same storage root is restored",
      async () => {
        const parent =
          await temporaryRoot(
            "lessenc-p11-c64-http-root-parent-",
          );

        const missingRoot =
          join(
            parent,
            "private-storage",
          );

        const storage =
          new LocalPrivateFileStorage(
            missingRoot,
          );

        const handler =
          createHandler(
            storage,
          );

        const token =
          sessionToken();

        const commercialBefore =
          await commercialRightSnapshot();

        const failedResponse =
          await handler(
            downloadRequest(
              token,
            ),
            currentFixture()
              .resourceId,
          );

        await expectFailureResponse(
          failedResponse,
        );

        const afterFailure =
          await deliveryEvents();

        expect(
          afterFailure,
        ).toHaveLength(1);

        expect(
          afterFailure[0],
        ).toMatchObject({
          outcome: "FAILED",
          failureCode:
            "STORAGE_ROOT_UNAVAILABLE",
        });

        const failedEvent =
          afterFailure[0];

        if (!failedEvent) {
          throw new Error(
            "failed root audit event missing",
          );
        }

        expect(
          await commercialRightSnapshot(),
        ).toEqual(
          commercialBefore,
        );

        await mkdir(
          missingRoot,
          {
            recursive: true,
          },
        );

        const expectedContent =
          "lessenc-c64-restored-root";

        await writeAuthorizedResource(
          missingRoot,
          expectedContent,
        );

        const recoveredResponse =
          await handler(
            downloadRequest(
              token,
            ),
            currentFixture()
              .resourceId,
          );

        await expectSuccessfulResponse(
          recoveredResponse,
          expectedContent,
        );

        const afterRecovery =
          await deliveryEvents();

        expectAppendOnlyRecovery(
          failedEvent,
          afterRecovery,
        );

        expect(
          await commercialRightSnapshot(),
        ).toEqual(
          commercialBefore,
        );
      },
    );
  },
);