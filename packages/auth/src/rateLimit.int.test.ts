import { describe, expect, it } from "vitest";
import { createAuth } from ".";

// Better Auth's limits on the database store (hosting PRD, slice 3): two
// instances stand for two serverless instances, and share one count.

const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;

const getSession = (ip: string) =>
  new Request("http://localhost:5173/api/auth/get-session", { headers: { "x-forwarded-for": ip } });

describe("Better Auth's rate limit", () => {
  it("counts get-session across instances: the 101st in 10 s is a 429 with x-retry-after", async () => {
    const instances = [createAuth({ rateLimitEnabled: true }), createAuth({ rateLimitEnabled: true })];
    const ip = randomIp();

    const first = await Promise.all(
      Array.from({ length: 100 }, (_, i) => instances[i % 2]!.handler(getSession(ip))),
    );
    expect(first.map((r) => r.status).filter((s) => s === 429)).toEqual([]);

    const refused = await instances[1]!.handler(getSession(ip));
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("x-retry-after"))).toBeGreaterThan(0);

    // Another address has its own count.
    expect((await instances[0]!.handler(getSession(randomIp()))).status).not.toBe(429);
  });
});
