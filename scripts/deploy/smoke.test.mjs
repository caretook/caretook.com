// pnpm deploy:smoke (hosting slice 5): the CLI around smoke(), run as the
// deploy Action runs it, against a local server standing in for a deploy.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLI = fileURLToPath(new URL("./smoke.mjs", import.meta.url));

let cronStatus = 401;
const server = createServer((req, res) => {
  const secure = {
    "strict-transport-security": "max-age=63072000",
    "content-security-policy": "frame-ancestors 'none'",
    "x-frame-options": "DENY",
    "x-robots-tag": "noindex",
  };
  if (req.url === "/") return res.writeHead(200, secure).end("<html></html>");
  if (req.url === "/api/auth/jwks") return res.writeHead(200).end(JSON.stringify({ keys: [{ kid: "k" }] }));
  if (req.url === "/rpc/me/get")
    return res.writeHead(401).end(JSON.stringify({ json: { code: "UNAUTHORIZED" } }));
  if (req.url === "/api/cron/outbox") return res.writeHead(cronStatus).end();
  if (req.url === "/mcp")
    return res.writeHead(401, { "www-authenticate": 'Bearer resource_metadata="x"' }).end();
  if (req.url === "/probes/liveness") return res.writeHead(200).end("{}");
  res.writeHead(404).end();
});
let origin;

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

// Async (not spawnSync): the server answering the CLI runs in this process.
const run = (args, env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { PATH: process.env.PATH, ...env } });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (status) => resolve({ status, out }));
  });

describe("pnpm deploy:smoke", () => {
  it("prints a table and exits 0 when the deploy serves", async () => {
    cronStatus = 401;
    const res = await run(["staging"], { APP_URL: origin, POWERSYNC_URL: origin });
    expect(res.out).toMatch(/✓ home/);
    expect(res.out).toMatch(/✓ noindex/);
    expect(res.status).toBe(0);
  });

  it("exits 1 naming the failed check", async () => {
    cronStatus = 200;
    const res = await run(["production"], { APP_URL: origin, POWERSYNC_URL: origin });
    expect(res.status).toBe(1);
    expect(res.out).toMatch(/✗ cron-locked/);
    expect(res.out).not.toMatch(/noindex/);
  });

  it("refuses an unknown target or a missing POWERSYNC_URL", async () => {
    expect((await run(["prod"], { APP_URL: origin, POWERSYNC_URL: origin })).status).toBe(2);
    expect((await run(["staging"], { APP_URL: origin })).status).toBe(2);
  });
});
