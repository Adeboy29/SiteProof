import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3101",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
try {
  await new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(
      () => reject(Error("Server readiness timed out")),
      20000,
    );
    server.stdout.on("data", (chunk) => {
      text += chunk;
      if (text.includes("Ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("error", reject);
  });
  for (const path of ["/", "/home", "/auth/password"]) {
    const r = await fetch("http://127.0.0.1:3101" + path);
    assert.equal(r.status, 200, path);
    const html = await r.text();
    assert.match(html, /SiteProof|password/);
    if (path === "/") assert.match(html, /Run Intelligent Contract/);
    console.log("PASS HTTP " + path);
  }
  const r = await fetch("http://127.0.0.1:3101/api/workspace");
  assert.equal(r.status, 503);
  console.log("PASS unconfigured API fails closed");
  const connection = await fetch("http://127.0.0.1:3101/api/assess");
  assert.equal(connection.status, 200);
  const state = await connection.json();
  assert.equal(typeof state.ready, "boolean");
  console.log("PASS simple contract connection endpoint; ready=" + state.ready);
  const crossOrigin = await fetch("http://127.0.0.1:3101/api/assess", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(crossOrigin.status, 403);
  console.log("PASS cross-origin execution rejected");
} finally {
  server.kill();
}
