import type { AuthUser } from "@caretook/data";

import {
  CONNECTOR_LINK_INVALID_TEXT,
  connectorAuthServerMetadata,
  getAuth,
  getAuthUser,
  withConnectorAuthorizePage,
} from "@caretook/auth";
import { assistantRequestService, careGroupService, connectorGrantService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { loadConnectPage, submitConnectPage } from "./connect";
import { protectedResourceMetadata } from "./discovery";
import {
  authForm,
  authorize,
  authRequest,
  connectForm,
  enablePasswordSignIn,
  exchangeCode,
  pkce,
  redirectOf,
  registerClient,
  signInCookies,
  TEST_ORIGIN,
  TEST_REDIRECT_URI,
} from "./testing";

// The OAuth dance in process against the app's Better Auth instance: what
// Claude's or ChatGPT's server and the member's browser do, step by step.
// Each test makes its own member, group and client.

/** A member who can sign in, owning a group whose owner turned Assistants on. */
const member = async (label = "connect") => {
  const owner = await createUser(label);
  await enablePasswordSignIn(owner.user.id);
  const { group } = await createGroup(owner);
  ok(
    await careGroupService.update(owner.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  return { ...owner, email: owner.user.email, group };
};

/** Signed in, sent to /connect: the consent page's search and the member's session. */
const atConsent = async (email: string, scope?: string) => {
  const client = await registerClient();
  const { verifier, challenge } = pkce();
  const cookies = await signInCookies(email);
  const page = await authorize(client.client_id, { challenge, cookies, ...(scope ? { scope } : {}) });
  const authUser = (await getAuthUser(cookies)) as AuthUser;
  return { client, verifier, cookies, page, authUser, search: page.search.slice(1) };
};

const consentTo = async (at: Awaited<ReturnType<typeof atConsent>>, fields: Record<string, string>) =>
  submitConnectPage({
    authUser: at.authUser,
    search: at.search,
    headers: at.cookies,
    form: connectForm(fields),
  });

const errorOf = (outcome: unknown) =>
  outcome && typeof outcome === "object" && "error" in outcome ? String(outcome.error) : null;

const codeFrom = (outcome: unknown) => {
  if (!outcome || typeof outcome !== "object" || !("redirect" in outcome))
    throw new Error(JSON.stringify(outcome));
  const url = new URL(String(outcome.redirect));
  expect(url.origin + url.pathname).toBe(TEST_REDIRECT_URI);
  return url.searchParams.get("code") ?? "";
};

describe("the OAuth dance", () => {
  it("registers a public client: no secret, our scopes", async () => {
    const client = await registerClient("Claude");
    expect(client).toMatchObject({ client_name: "Claude", scope: "group:read group:write offline_access" });
    expect(client).not.toHaveProperty("client_secret");
  });

  it("sends a signed-out member to /connect, which sends them to sign in", async () => {
    const client = await registerClient();
    const page = await authorize(client.client_id, { challenge: pkce().challenge });
    expect(page.pathname).toBe("/connect");
    expect(page.searchParams.get("client_id")).toBe(client.client_id);
    expect(page.searchParams.get("sig")).toBeTruthy();
  });

  it("refuses a plain (non-S256) PKCE challenge", async () => {
    const client = await registerClient();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: TEST_REDIRECT_URI,
      code_challenge: "plain-challenge-plain-challenge-plain-challenge-00",
      code_challenge_method: "plain",
    });
    const res = await authRequest(`/oauth2/authorize?${params}`);
    const location = await redirectOf(res);
    expect(location.searchParams.get("error")).toBe("invalid_request");
  });

  it("shows the consent page: the client, its redirect host and the groups that allow assistants", async () => {
    const m = await member();
    const { group: offGroup } = await createGroup(m); // the switch stays off
    const at = await atConsent(m.email);
    const page = ok(await loadConnectPage(at.authUser, at.search));
    expect(page).toEqual({
      state: "consent",
      client: { name: "Test Claude", redirectHost: "assistant.example.com" },
      groups: [
        {
          id: m.group.id,
          name: "Test Family",
          recipientName: "Pat Example",
          role: "owner",
          scopes: ["read", "readWrite"],
        },
      ],
      offGroups: [],
    });
    expect(JSON.stringify(page)).not.toContain(offGroup.id);
  });

  it("with no group allowing assistants, lists the groups with the switch off and the member's last ask", async () => {
    const asker = await createUser("connect-off");
    await enablePasswordSignIn(asker.user.id);
    const { group: owned } = await createGroup(asker); // theirs, switch off
    const other = await createUser("connect-off-owner");
    const { group: theirs } = await createGroup(other, [{ user: asker.user, role: "caretaker" }]);
    const asked = ok(await assistantRequestService.request(asker.ctx, theirs.id));
    const at = await atConsent(asker.user.email);
    const page = ok(await loadConnectPage(at.authUser, at.search));
    if (page.state !== "consent") throw new Error(page.state);
    expect(page.groups).toEqual([]);
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    expect([...page.offGroups].sort(byId)).toEqual(
      [
        { id: owned.id, name: "Test Family", recipientName: "Pat Example", role: "owner", askedAt: null },
        {
          id: theirs.id,
          name: "Test Family",
          recipientName: "Pat Example",
          role: "caretaker",
          askedAt: new Date(asked.request.requestedAt).toISOString(),
        },
      ].sort(byId),
    );
  });

  it("refuses a consent page whose query was tampered with", async () => {
    const m = await member();
    const at = await atConsent(m.email);
    const tampered = at.search.replace(
      /redirect_uri=[^&]+/,
      `redirect_uri=${encodeURIComponent("https://evil.example.com/cb")}`,
    );
    expect(ok(await loadConnectPage(at.authUser, tampered))).toEqual({ state: "invalid" });
    expect(
      errorOf(
        await consentTo({ ...at, search: tampered }, { groupId: m.group.id, scope: "read", consent: "on" }),
      ),
    ).toMatch(/expired/);
  });

  it("needs the consent ticked, and Cancel connects nothing", async () => {
    const m = await member();
    const at = await atConsent(m.email);
    expect(errorOf(await consentTo(at, { groupId: m.group.id, scope: "read" }))).toMatch(/Tick/);
    const cancelled = await consentTo(at, { intent: "cancel" });
    expect("redirect" in cancelled && new URL(cancelled.redirect).searchParams.get("error")).toBe(
      "access_denied",
    );
    expect(cancelled).not.toHaveProperty("connected");
    expect(ok(await connectorGrantService.listMine(m.ctx))).toEqual([]);
  });

  it("says what was connected where, for the success step, beside the client's redirect", async () => {
    const m = await member();
    const at = await atConsent(m.email);
    const outcome = await consentTo(at, {
      groupId: m.group.id,
      scope: "read",
      consent: "on",
      intent: "connect",
    });
    expect(codeFrom(outcome)).toBeTruthy();
    expect(outcome).toMatchObject({ connected: { groupName: m.group.name, clientName: "Test Claude" } });
  });

  it("exchanges the code with PKCE (a wrong verifier is refused), refreshes and revokes", async () => {
    const m = await member();
    const at = await atConsent(m.email);
    const code = codeFrom(
      await consentTo(at, { groupId: m.group.id, scope: "readWrite", consent: "on", intent: "connect" }),
    );

    const [grant] = ok(await connectorGrantService.listMine(m.ctx));
    expect(grant).toMatchObject({
      groupId: m.group.id,
      scope: "readWrite",
      clientName: "Test Claude",
      redirectHost: "assistant.example.com",
    });

    const wrong = await exchangeCode(at.client.client_id, code, pkce().verifier);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ error: "invalid_grant" });

    const res = await exchangeCode(at.client.client_id, code, at.verifier);
    expect(res.status).toBe(200);
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      scope: string;
      expires_in: number;
    };
    expect(tokens).toMatchObject({ scope: "group:read group:write offline_access", expires_in: 3600 });

    const refreshed = await authForm("/oauth2/token", {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: at.client.client_id,
    });
    expect(refreshed.status).toBe(200);
    const next = (await refreshed.json()) as { access_token: string; refresh_token: string };
    expect(next.refresh_token).not.toBe(tokens.refresh_token);

    // The rotated refresh token stops working.
    const replay = await authForm("/oauth2/token", {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: at.client.client_id,
    });
    expect(replay.status).not.toBe(200);

    // A code works once.
    expect((await exchangeCode(at.client.client_id, code, at.verifier)).status).not.toBe(200);

    // Revocation (a fresh connection: the replay above ended the last one's family).
    const again = await atConsent(m.email);
    const code2 = codeFrom(await consentTo(again, { groupId: m.group.id, scope: "read", consent: "on" }));
    const second = (await (await exchangeCode(again.client.client_id, code2, again.verifier)).json()) as {
      refresh_token: string;
      scope: string;
    };
    expect(second.scope).toBe("group:read offline_access");
    const revoked = await authForm("/oauth2/revoke", {
      token: second.refresh_token,
      token_type_hint: "refresh_token",
      client_id: again.client.client_id,
    });
    expect(revoked.status).toBe(200);
    const afterRevoke = await authForm("/oauth2/token", {
      grant_type: "refresh_token",
      refresh_token: second.refresh_token,
      client_id: again.client.client_id,
    });
    expect(afterRevoke.status).not.toBe(200);
  });

  it("asks again after a disconnect, instead of reusing the old consent", async () => {
    const m = await member();
    const at = await atConsent(m.email);
    codeFrom(await consentTo(at, { groupId: m.group.id, scope: "read", consent: "on" }));
    const [grant] = ok(await connectorGrantService.listMine(m.ctx));
    ok(await connectorGrantService.revoke(m.ctx, grant!.id));

    const page = await authorize(at.client.client_id, { challenge: pkce().challenge, cookies: at.cookies });
    expect(page.pathname).toBe("/connect");
  });

  it("serves both metadata documents", async () => {
    const as = (await (
      await connectorAuthServerMetadata(new Request(`${TEST_ORIGIN}/.well-known/oauth-authorization-server`))
    ).json()) as { issuer: string; token_endpoint_auth_methods_supported: string[] };
    expect(as).toMatchObject({
      issuer: `${TEST_ORIGIN}/api/auth`,
      authorization_endpoint: `${TEST_ORIGIN}/api/auth/oauth2/authorize`,
      token_endpoint: `${TEST_ORIGIN}/api/auth/oauth2/token`,
      registration_endpoint: `${TEST_ORIGIN}/api/auth/oauth2/register`,
      revocation_endpoint: `${TEST_ORIGIN}/api/auth/oauth2/revoke`,
      scopes_supported: ["group:read", "group:write", "offline_access"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
    });
    expect(as.token_endpoint_auth_methods_supported).toContain("none");

    expect(protectedResourceMetadata(TEST_ORIGIN)).toEqual({
      resource: `${TEST_ORIGIN}/mcp`,
      authorization_servers: [as.issuer],
      scopes_supported: ["group:read", "group:write", "offline_access"],
      bearer_methods_supported: ["header"],
      resource_name: "Caretook",
    });
  });

  it("keeps the client admin endpoints off", async () => {
    const m = await member();
    const cookies = await signInCookies(m.email);
    for (const path of [
      "/oauth2/create-client",
      "/oauth2/get-clients",
      "/oauth2/get-consents",
      "/oauth2/userinfo",
    ]) {
      const res = await authRequest(path, {
        method: path.includes("create") ? "POST" : "GET",
        headers: cookies,
      });
      expect(res.status, path).toBe(404);
    }
  });
});

// B-188: claude.ai's browser window, sent to authorize. The shape is the MCP
// client's (scope from our metadata, offline_access with prompt=consent, the
// resource, PKCE), loaded as a page from another site, through the same
// wrapper as /api/auth.
describe("an assistant's browser at authorize", () => {
  const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
  const handle = withConnectorAuthorizePage((request) => getAuth().handler(request));
  const NAVIGATION = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
    "sec-fetch-site": "cross-site",
  };

  const authorizeParams = (clientId: string, redirectUri = CLAUDE_CALLBACK) =>
    new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
      state: "claude-state",
      scope: "group:read group:write offline_access",
      prompt: "consent",
      resource: `${TEST_ORIGIN}/mcp`,
    });

  const visit = (params: URLSearchParams, headers: Record<string, string> = NAVIGATION, cookies?: Headers) =>
    handle(
      new Request(`${TEST_ORIGIN}/api/auth/oauth2/authorize?${params}`, {
        headers: { ...headers, ...(cookies ? { cookie: cookies.get("cookie") ?? "" } : {}) },
      }),
    );

  const expectConnectPage = (res: Response, clientId: string) => {
    expect(res.status).toBe(302);
    const page = new URL(res.headers.get("location") ?? "", TEST_ORIGIN);
    expect(page.pathname).toBe("/connect");
    expect(page.searchParams.get("client_id")).toBe(clientId);
    expect(page.searchParams.get("redirect_uri")).toBe(CLAUDE_CALLBACK);
    expect(page.searchParams.get("sig")).toBeTruthy();
  };

  it("goes to /connect, signed out and signed in", async () => {
    const m = await member("claude-nav");
    const client = await registerClient("Claude", CLAUDE_CALLBACK);
    expectConnectPage(await visit(authorizeParams(client.client_id)), client.client_id);
    const cookies = await signInCookies(m.email);
    expectConnectPage(await visit(authorizeParams(client.client_id), NAVIGATION, cookies), client.client_id);
  });

  it("shows a page for a client it doesn't know; JSON still answers JSON", async () => {
    const params = authorizeParams("a-client-from-before-a-reset");
    const res = await visit(params);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain(CONNECTOR_LINK_INVALID_TEXT);

    const json = await visit(params, { accept: "application/json" });
    expect(json.headers.get("content-type")).toContain("application/json");
    const body = (await json.json()) as { url: string };
    expect(new URL(body.url).searchParams.get("error")).toBe("invalid_client");
  });

  it("shows the page for a redirect the client never registered", async () => {
    const client = await registerClient("Claude", CLAUDE_CALLBACK);
    const res = await visit(authorizeParams(client.client_id, "https://claude.ai/somewhere-else"));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(CONNECTOR_LINK_INVALID_TEXT);
  });

  it("leaves errors it can return to the client alone", async () => {
    const client = await registerClient("Claude", CLAUDE_CALLBACK);
    const params = authorizeParams(client.client_id);
    params.set("scope", "openid");
    const res = await visit(params);
    expect(res.status).toBe(302);
    const back = new URL(res.headers.get("location") ?? "");
    expect(back.origin + back.pathname).toBe(CLAUDE_CALLBACK);
    expect(back.searchParams.get("error")).toBe("invalid_scope");
  });
});
