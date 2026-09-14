import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  resolve,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { LocalPrivateFileStorage } from "../../../infrastructure/storage/local-private-file-storage";
import type { BuyerSubject } from "./buyer-session";
import {
  PrepareProtectedDelivery,
  RecordProtectedDeliveryOutcome,
  type DigitalDeliveryAuditRecord,
} from "./protected-digital-delivery";

const SUBJECT: BuyerSubject = Object.freeze({
  customerId:
    "11111111-1111-4111-8111-111111111111",
  orderId:
    "22222222-2222-4222-8222-222222222222",
  credentialId:
    "33333333-3333-4333-8333-333333333333",
});

const AUTHORIZED = Object.freeze({
  entitlementId:
    "44444444-4444-4444-8444-444444444444",
  resourceId:
    "55555555-5555-4555-8555-555555555555",
  buyerAccessCredentialId:
    SUBJECT.credentialId,
  storageKey:
    "resources/recovery/v1.pdf",
  filename:
    "recovery.pdf",
  mediaType:
    "application/pdf",
});

const roots =
  new Set<string>();

async function temporaryRoot(): Promise<string> {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "lessenc-p11-c64-recovery-",
      ),
    );

  roots.add(root);

  return root;
}

async function writeResource(
  root: string,
  content = "recovered-pdf",
): Promise<void> {
  const path =
    resolve(
      root,
      AUTHORIZED.storageKey,
    );

  await mkdir(
    dirname(path),
    {
      recursive: true,
    },
  );

  await writeFile(
    path,
    content,
  );
}

function auditFixture() {
  const records:
    DigitalDeliveryAuditRecord[] =
    [];

  return {
    records,
    repository: {
      record: vi.fn(
        async (
          record: DigitalDeliveryAuditRecord,
        ) => {
          records.push(
            Object.freeze({
              ...record,
            }),
          );
        },
      ),
    },
  };
}

async function consumeDeliveryBody(
  body: AsyncIterable<Uint8Array>,
): Promise<number> {
  let bytes = 0;

  for await (const chunk of body) {
    bytes += chunk.byteLength;
  }

  return bytes;
}

function authorizer() {
  return {
    execute: vi.fn().mockResolvedValue(
      AUTHORIZED,
    ),
  };
}

afterEach(async () => {
  for (const root of roots) {
    await rm(
      root,
      {
        recursive: true,
        force: true,
      },
    );
  }

  roots.clear();
});

describe("P11 C6.4 storage failure recovery", () => {
  it("recovers on a later request after a missing authorized object is restored", async () => {
    const root =
      await temporaryRoot();

    const storage =
      new LocalPrivateFileStorage(root);

    const audit =
      auditFixture();

    const service =
      new PrepareProtectedDelivery(
        authorizer(),
        storage,
        audit.repository,
      );

    await expect(
      service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      ),
    ).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    expect(audit.records).toHaveLength(1);

    expect(audit.records[0]).toMatchObject({
      outcome: "FAILED",
      failureCode: "RESOURCE_NOT_FOUND",
    });

    await writeResource(root);

    const delivery =
      await service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      );

    const outcome =
      new RecordProtectedDeliveryOutcome(
        audit.repository,
      );

    const deliveredBytes =
      await consumeDeliveryBody(
        delivery.body,
      );

    expect(deliveredBytes).toBeGreaterThan(0);

    await outcome.succeeded(
      delivery,
    );

    expect(audit.records).toHaveLength(2);

    expect(
      audit.records.map(
        (record) => ({
          outcome: record.outcome,
          failureCode: record.failureCode,
        }),
      ),
    ).toEqual([
      {
        outcome: "FAILED",
        failureCode: "RESOURCE_NOT_FOUND",
      },
      {
        outcome: "SUCCEEDED",
        failureCode: null,
      },
    ]);
  });

  it("recovers with the same storage adapter after a previously unavailable root is restored", async () => {
    const parent =
      await temporaryRoot();

    const root =
      join(
        parent,
        "missing-root",
      );

    const storage =
      new LocalPrivateFileStorage(root);

    const audit =
      auditFixture();

    const service =
      new PrepareProtectedDelivery(
        authorizer(),
        storage,
        audit.repository,
      );

    await expect(
      service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      ),
    ).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    expect(audit.records[0]).toMatchObject({
      outcome: "FAILED",
      failureCode: "STORAGE_ROOT_UNAVAILABLE",
    });

    await mkdir(
      root,
      {
        recursive: true,
      },
    );

    await writeResource(root);

    const delivery =
      await service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      );

    const deliveredBytes =
      await consumeDeliveryBody(
        delivery.body,
      );

    expect(deliveredBytes).toBeGreaterThan(0);

    await new RecordProtectedDeliveryOutcome(
      audit.repository,
    ).succeeded(
      delivery,
    );

    expect(
      audit.records.map(
        (record) => record.outcome,
      ),
    ).toEqual([
      "FAILED",
      "SUCCEEDED",
    ]);
  });

  it("normalizes an unexpected storage outage and permits a later clean request", async () => {
    let unavailable =
      true;

    const audit =
      auditFixture();

    const storage = {
      stat: vi.fn(
        async () => {
          if (unavailable) {
            throw new Error(
              "simulated-disk-outage",
            );
          }

          return {
            sizeBytes: 13,
          };
        },
      ),

      open: vi.fn(
        async () => ({
          async *[Symbol.asyncIterator]() {
            yield new Uint8Array([
              1,
              2,
              3,
            ]);
          },
        }),
      ),
    };

    const service =
      new PrepareProtectedDelivery(
        authorizer(),
        storage,
        audit.repository,
      );

    await expect(
      service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      ),
    ).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    expect(audit.records[0]).toMatchObject({
      outcome: "FAILED",
      failureCode: "STORAGE_UNAVAILABLE",
    });

    unavailable =
      false;

    const delivery =
      await service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      );

    expect(
      delivery.resourceId,
    ).toBe(
      AUTHORIZED.resourceId,
    );

    expect(storage.stat).toHaveBeenCalledTimes(2);
    expect(storage.open).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite a failed delivery event when a later attempt succeeds", async () => {
    const root =
      await temporaryRoot();

    const storage =
      new LocalPrivateFileStorage(root);

    const audit =
      auditFixture();

    const service =
      new PrepareProtectedDelivery(
        authorizer(),
        storage,
        audit.repository,
      );

    await expect(
      service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      ),
    ).rejects.toThrow(
      "DELIVERY_UNAVAILABLE",
    );

    const firstRecord =
      audit.records[0];

    await writeResource(
      root,
      "second-attempt",
    );

    const delivery =
      await service.execute(
        SUBJECT,
        AUTHORIZED.resourceId,
      );

    const deliveredBytes =
      await consumeDeliveryBody(
        delivery.body,
      );

    expect(deliveredBytes).toBeGreaterThan(0);

    await new RecordProtectedDeliveryOutcome(
      audit.repository,
    ).succeeded(
      delivery,
    );

    expect(firstRecord).toEqual(
      audit.records[0],
    );

    expect(audit.records).toHaveLength(2);

    expect(audit.records[0]?.outcome).toBe(
      "FAILED",
    );

    expect(audit.records[1]?.outcome).toBe(
      "SUCCEEDED",
    );
  });
});
