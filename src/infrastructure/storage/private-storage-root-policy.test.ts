import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertPrivateStorageRootIsPrivate,
  PrivateStorageRootPolicyError,
} from "./private-storage-root-policy";

const APP_ROOT = resolve("C5-policy-test-app");

describe("P11 private storage root policy", () => {
  it("accepts a private storage root outside public/static application roots", () => {
    expect(() =>
      assertPrivateStorageRootIsPrivate(resolve(APP_ROOT, "private-storage"), APP_ROOT),
    ).not.toThrow();
  });

  it("rejects the application public root itself", () => {
    expect(() => assertPrivateStorageRootIsPrivate(resolve(APP_ROOT, "public"), APP_ROOT)).toThrow(
      PrivateStorageRootPolicyError,
    );
  });

  it("rejects storage nested under public", () => {
    expect(() =>
      assertPrivateStorageRootIsPrivate(resolve(APP_ROOT, "public", "private", "ebooks"), APP_ROOT),
    ).toThrow(PrivateStorageRootPolicyError);
  });

  it("rejects storage nested under a static application root", () => {
    expect(() =>
      assertPrivateStorageRootIsPrivate(resolve(APP_ROOT, "static", "downloads"), APP_ROOT),
    ).toThrow(PrivateStorageRootPolicyError);
  });

  it("rejects storage nested under Next.js generated static assets", () => {
    expect(() =>
      assertPrivateStorageRootIsPrivate(resolve(APP_ROOT, ".next", "static", "private"), APP_ROOT),
    ).toThrow(PrivateStorageRootPolicyError);
  });
});
