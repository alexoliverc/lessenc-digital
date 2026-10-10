import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLoopbackOnly } from "./p17-capsule-network.mjs";

const isolated = {
  interfaces: ["lo"],
  ipv4: "Iface Destination Gateway Flags RefCnt Use Metric Mask\n",
  ipv6: `${"0".repeat(32)} 00 ${"0".repeat(32)} 00 ${"0".repeat(32)} ffffffff 00000001 00000000 00200200 lo\n`,
  resolver: "nameserver 127.0.0.1\n",
};
test("accepts loopback with the kernel unreachable IPv6 sentinel", () => {
  assert.doesNotThrow(() => assertLoopbackOnly(isolated));
});
test("rejects another interface, IPv4/IPv6 default routes and external DNS", () => {
  for (const change of [
    { interfaces: ["lo", "eth0"] },
    { ipv4: `${isolated.ipv4}lo 00000000 00000000 0001 0 0 0 00000000\n` },
    { ipv6: isolated.ipv6.replace("00200200", "00000001") },
    { resolver: "nameserver 8.8.8.8\n" },
  ])
    assert.throws(() => assertLoopbackOnly({ ...isolated, ...change }));
});
