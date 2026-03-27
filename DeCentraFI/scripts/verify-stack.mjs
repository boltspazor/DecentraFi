#!/usr/bin/env node
/**
 * Quick connectivity check: backend (and optionally DB via /api/health).
 * Run when backend is up: node scripts/verify-stack.mjs
 */
import http from "node:http";

const API = process.env.API_BASE || "http://127.0.0.1:3001";

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function main() {
  const results = [];
  try {
    const h = await get(`${API}/health`);
    results.push(["GET /health", h.status === 200 ? "ok" : `HTTP ${h.status}`]);
  } catch (e) {
    results.push(["GET /health", `fail: ${e.message}`]);
  }
  try {
    const h = await get(`${API}/api/health`);
    const ok = h.status === 200;
    const db = ok && h.body.includes("connected") ? "connected" : "check response";
    results.push(["GET /api/health", ok ? `ok (${db})` : `HTTP ${h.status}`]);
  } catch (e) {
    results.push(["GET /api/health", `fail: ${e.message}`]);
  }

  const width = Math.max(...results.map(([a]) => a.length));
  for (const [name, status] of results) {
    console.log(`${name.padEnd(width)}  ${status}`);
  }
  const allOk = results.every(([, s]) => s.startsWith("ok"));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
