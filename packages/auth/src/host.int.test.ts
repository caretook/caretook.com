import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuth } from ".";

// What Better Auth trusts about a request's source (hosting slice 8): the
// native app's Origin only with NATIVE_APP_ORIGINS=1, and its limits keyed on
// CLIENT_IP_HEADER when set. Env is read when an instance is made.

const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;

const signIn = (headers: Record<string, string>) =>
  new Request("http://localhost:5173/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": randomIp(), ...headers },
    body: JSON.stringify({
      email: `nobody-${crypto.randomUUID()}@example.com`,
      password: "not-the-password",
    }),
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the native app's Origin", () => {
  it("is refused with NATIVE_APP_ORIGINS unset", async () => {
    vi.stubEnv("NATIVE_APP_ORIGINS", "");
    const auth = createAuth({ originCheck: true });
    const response = await auth.handler(signIn({ origin: "capacitor://localhost" }));
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("INVALID_ORIGIN");
  });

  it("is accepted with NATIVE_APP_ORIGINS=1 (the sign-in itself then fails as a wrong password)", async () => {
    vi.stubEnv("NATIVE_APP_ORIGINS", "1");
    const auth = createAuth({ originCheck: true });
    for (const origin of ["capacitor://localhost", "https://localhost"]) {
      const response = await auth.handler(signIn({ origin }));
      expect(response.status, origin).toBe(401);
    }
    // Any other origin still isn't.
    expect((await auth.handler(signIn({ origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("the client IP Better Auth's limits key on", () => {
  it("is CLIENT_IP_HEADER's when set: a fresh x-forwarded-for per request doesn't escape the limit", async () => {
    vi.stubEnv("CLIENT_IP_HEADER", "X-Vercel-Forwarded-For");
    const auth = createAuth({ rateLimitEnabled: true });
    const ip = randomIp();
    // Sign-in allows 3 per 10 s per address; each request spoofs its own x-forwarded-for.
    const statuses = [];
    for (let i = 0; i < 4; i++)
      statuses.push((await auth.handler(signIn({ "x-vercel-forwarded-for": `${ip}, 10.0.0.1` }))).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
