/* global AbortSignal, fetch */

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { assertLoopbackOnly } from "./p17-capsule-network.mjs";
import { readdirSync } from "node:fs";

assert.equal(process.getuid(), 17017);
assert.equal(process.version, "v24.21.0");
assert.equal(execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(), "11.19.1");
assertLoopbackOnly({
  interfaces: readdirSync("/sys/class/net"),
  ipv4: readFileSync("/proc/net/route", "utf8"),
  ipv6: readFileSync("/proc/net/ipv6_route", "utf8"),
  resolver: readFileSync("/etc/resolv.conf", "utf8"),
});
assert.throws(() => writeFileSync("/workspace/p17-readonly-probe", "probe", { flag: "wx" }));

const server = createServer((_request, response) => {
  response.setHeader("content-type", "text/plain");
  response.end("p17-local-only");
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(3100, "127.0.0.1", resolve);
});
let browser;
try {
  assert.equal(server.address().address, "127.0.0.1");
  assert.equal(await (await fetch("http://127.0.0.1:3100")).text(), "p17-local-only");
  await assert.rejects(fetch("http://192.0.2.1", { signal: AbortSignal.timeout(2000) }));
  browser = await chromium.launch({ headless: true });
  assert.equal(browser.version(), "153.0.8010.12");
  const page = await browser.newPage({ serviceWorkers: "block" });
  await page.goto("http://127.0.0.1:3100");
  assert.equal(await page.locator("body").innerText(), "p17-local-only");
  await assert.rejects(page.goto("http://192.0.2.1", { timeout: 2000 }));
  process.stdout.write(
    JSON.stringify({
      result: "PASS",
      uid: process.getuid(),
      node: process.version,
      npm: "11.19.1",
      chromium: browser.version(),
      loopbackNode: true,
      loopbackChromium: true,
      nodeEgressBlocked: true,
      chromiumEgressBlocked: true,
      applicationRootReadOnly: true,
      browserSandbox: "PLAYWRIGHT_DEFAULT",
      providerAccessed: false,
    }) + "\n",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
