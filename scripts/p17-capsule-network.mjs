import { readFileSync, readdirSync } from "node:fs";
import process from "node:process";

// Linux procfs is available in both pinned bases; no iproute2 installation is needed.
export function assertLoopbackOnly({ interfaces, ipv4, ipv6, resolver }) {
  if (interfaces.length !== 1 || interfaces[0] !== "lo") {
    throw new Error("P17_CAPSULE_NON_LOOPBACK_INTERFACE_PRESENT");
  }
  for (const line of ipv4.trim().split("\n").slice(1)) {
    const columns = line.trim().split(/\s+/u);
    if (columns[1] === "00000000" && columns[7] === "00000000") {
      throw new Error("P17_CAPSULE_IPV4_DEFAULT_ROUTE_PRESENT");
    }
  }
  for (const line of ipv6.trim().split("\n")) {
    const columns = line.trim().split(/\s+/u);
    // Kernel's unreachable ::/0 sentinel (RTF_REJECT) is not a usable route.
    const flags = Number.parseInt(columns[8] ?? "0", 16);
    if (columns[0] === "0".repeat(32) && columns[1] === "00" && !(flags & 0x200)) {
      throw new Error("P17_CAPSULE_IPV6_DEFAULT_ROUTE_PRESENT");
    }
  }
  for (const match of resolver.matchAll(/^\s*nameserver\s+(\S+)/gmu)) {
    if (!["127.0.0.1", "127.0.0.11", "::1"].includes(match[1])) {
      throw new Error("P17_CAPSULE_EXTERNAL_DNS_PRESENT");
    }
  }
}

if (process.argv[1]?.endsWith("p17-capsule-network.mjs")) {
  assertLoopbackOnly({
    interfaces: readdirSync("/sys/class/net"),
    ipv4: readFileSync("/proc/net/route", "utf8"),
    ipv6: readFileSync("/proc/net/ipv6_route", "utf8"),
    resolver: readFileSync("/etc/resolv.conf", "utf8"),
  });
  process.stdout.write("P17_CAPSULE_LOOPBACK_ONLY_PASS\n");
}
