import { describe, expect, it } from "vitest";
import { CONNECTOR_TOO_MANY_TEXT, withConnectorAuthorizePage } from "./connectorAuthorize";

// The wrapper's choices with a stand-in handler; the plugin's real answers
// are in packages/api/src/connectors/oauth.int.test.ts.
const ORIGIN = "https://caretook.example";
const NAVIGATE = { accept: "text/html", "sec-fetch-mode": "navigate" };
const tooMany = () => Promise.resolve(Response.json({ message: "Too many requests." }, { status: 429 }));
const toErrorPage = () =>
  Promise.resolve(new Response(null, { status: 302, headers: { location: `${ORIGIN}/api/auth/error?x=1` } }));

const run = (handler: () => Promise<Response>, path: string, headers: Record<string, string>) =>
  withConnectorAuthorizePage(handler)(new Request(`${ORIGIN}/api/auth${path}`, { headers }));

describe("withConnectorAuthorizePage", () => {
  it("shows a page for the rate limit on an authorize navigation", async () => {
    const res = await run(tooMany, "/oauth2/authorize?client_id=c", NAVIGATE);
    expect(res.status).toBe(429);
    expect(await res.text()).toContain(CONNECTOR_TOO_MANY_TEXT);
  });

  it("passes fetches, JSON requests and other paths through", async () => {
    const fetched = await run(toErrorPage, "/oauth2/authorize", { "sec-fetch-mode": "cors", accept: "*/*" });
    expect(fetched.status).toBe(302);
    expect((await run(tooMany, "/oauth2/authorize", { accept: "application/json" })).status).toBe(429);
    expect((await run(tooMany, "/oauth2/authorize", {})).headers.get("content-type")).toContain("json");
    expect((await run(toErrorPage, "/sign-in/email", NAVIGATE)).status).toBe(302);
  });
});
