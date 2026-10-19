import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import process from "node:process";
import { URL } from "node:url";

const HOST = "127.0.0.1";
const PORT = 3101;
const APP_ORIGIN = "http://127.0.0.1:3100";
const DOWNLOAD_BYTES = 2_000_000;
const MAX_UPLOAD_BYTES = 500_000;
const payload = Buffer.alloc(DOWNLOAD_BYTES, 0x50);

function commonHeaders() {
  return {
    "Access-Control-Allow-Origin": APP_ORIGIN,
    "Cache-Control": "no-store, private",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    ...commonHeaders(),
    "Content-Type": "application/json",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

export function createPerformanceCalibrationServer() {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

    if (request.headers.origin !== APP_ORIGIN) {
      sendJson(response, 403, { state: "DENIED" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/calibration/rtt") {
      response.writeHead(204, commonHeaders());
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/calibration/download") {
      response.writeHead(200, {
        ...commonHeaders(),
        "Content-Type": "application/octet-stream",
        "Content-Length": String(payload.byteLength),
      });
      response.end(payload);
      return;
    }

    if (request.method === "POST" && url.pathname === "/calibration/upload") {
      let receivedBytes = 0;
      let rejected = false;
      request.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_UPLOAD_BYTES) {
          rejected = true;
          request.destroy();
        }
      });
      request.on("end", () => {
        if (rejected || receivedBytes !== MAX_UPLOAD_BYTES) {
          sendJson(response, 400, { state: "INVALID" });
          return;
        }
        sendJson(response, 200, { receivedBytes });
      });
      return;
    }

    sendJson(response, 404, { state: "NOT_FOUND" });
  });
}

export const PERFORMANCE_CALIBRATION_SERVER = Object.freeze({
  host: HOST,
  port: PORT,
  appOrigin: APP_ORIGIN,
  downloadBytes: DOWNLOAD_BYTES,
  uploadBytes: MAX_UPLOAD_BYTES,
  executable: false,
  activation: "FUTURE_OWNER_AUTHORIZATION_REQUIRED",
});

if (process.argv[1]?.endsWith("p17-performance-calibration-server.mjs")) {
  process.stderr.write("P17_PERFORMANCE_CALIBRATION_SERVER_NOT_AUTHORIZED\n");
  process.exitCode = 1;
}
