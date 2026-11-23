import type { DeviceRoute } from "../../../../test/device";

import {
  ATTESTATION_TEXT,
  CONSENT_TEXT,
  LEGAL_REQUIRED_MESSAGE,
  SHARED_WITH_MEMBERS,
} from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { apiCalls, refusal } from "../../../../test/api";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import * as invite from "./route";

// `/invite/:token` (invites.mjs's screen steps 5 to 8, 10 and 11, on the test
// device): what each invite state says (and that an unusable one names
// nobody), the sign-up form (an email invite's address locked, a link's open
// and undeclinable), the consent form, the wrong-account view and Decline.
// The server's side (a token's state after resend, revoke and expiry, the
// account `invite.signUp` makes, consent recorded, the member joined) is
// packages/api/src/invites.int.test.ts's and joinRequests.int.test.ts's; the
// emails and the whole sign-up through to the synced timeline are
// invites.mjs's steps 5 and 10.

const TOKEN = "tok-AbC123_xyz";
const PATH = `/invite/${TOKEN}`;
const stubPage = (title: string) => ({
  default: () => (
    <main>
      <h1>{title}</h1>
    </main>
  ),
});
const ROUTES: DeviceRoute[] = [
  { path: "/invite/:token", module: invite },
  { path: "/verify-email", module: stubPage("Confirm your email") },
  { path: "/sign-in", module: stubPage("Sign in") },
  { path: "/app", id: "home", module: stubPage("Your care groups") },
];

const emailInvite = {
  state: "usable",
  kind: "email",
  role: "caretaker",
  email: "avery.invited@example.com",
  groupName: "Grandma Pat",
  inviterName: "Sam Okafor",
  expiresAt: "2026-11-27T12:00:00Z",
} as const;
const linkInvite = { ...emailInvite, kind: "link", role: "viewer", email: null } as const;

type Api = Record<string, (input: unknown) => unknown>;
const signedIn = (email: string): Api => ({
  "/api/auth/get-session": () => ({ user: { email, name: "Someone" }, session: {} }),
});

const open = (api: Api) => renderWithDevice({ route: ROUTES, url: PATH, role: null, api });
const heading = () => page.getByRole("heading", { level: 1 });
const field = (label: string) => page.getByLabelText(label, { exact: true });
const legalBox = () => page.getByRole("checkbox", { name: /18 or older/ });
const form = (name: string) => document.querySelector<HTMLFormElement>(`[data-invite-form="${name}"]`);

const fillSignUp = async (password = "a long fictional passphrase", confirm = password) => {
  await userEvent.fill(field("Your name"), "Avery Invited");
  await userEvent.fill(field("Password"), password);
  await userEvent.fill(field("Password again"), confirm);
  await userEvent.click(legalBox());
};

describe("an invite that can't be used", () => {
  const CLOSED = {
    notFound: "This invitation isn't valid",
    expired: "This invitation has expired",
    revoked: "This invitation was withdrawn",
    usedUp: "This invitation has been used up",
    accepted: "This invitation was already accepted",
    declined: "This invitation was declined",
    unavailable: "Not available right now",
  } as const;

  test("each state says why in its own words, with no form", async () => {
    for (const [state, title] of Object.entries(CLOSED)) {
      const device = await open({ "invite.preview": () => ({ state }) });
      await expect.element(heading()).toHaveTextContent(title);
      expect(document.querySelector<HTMLElement>("[data-invite-state]")?.dataset.inviteState).toBe(state);
      expect(document.querySelector("[data-invite-form]")).toBeNull();
      expect(document.querySelector("main")?.textContent).not.toMatch(/Grandma|Sam Okafor|example\.com/);
      await expect.element(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
      await device.screen.unmount();
    }
  });

  test("a token the server calls malformed is not valid", async () => {
    await open({
      "invite.preview": () =>
        Response.json(
          { json: { defined: false, code: "BAD_REQUEST", status: 400, message: "Bad", data: {} }, meta: [] },
          { status: 400 },
        ),
    });
    await expect.element(heading()).toHaveTextContent("This invitation isn't valid");
  });

  test("signed in, the link goes to Caretook instead", async () => {
    await open({ "invite.preview": () => ({ state: "expired" }), ...signedIn("a@example.com") });
    await expect.element(page.getByRole("link", { name: "Go to Caretook" })).toHaveAttribute("href", "/app");
  });

  test("offline, it says it couldn't reach Caretook and offers Try again", async () => {
    await open({});
    await expect.element(page.getByText(/Couldn't reach Caretook/)).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", PATH);
  });
});

describe("an email invite, signed out", () => {
  test("names the group, the inviter and the role, with the invite's address locked", async () => {
    await open({ "invite.preview": () => emailInvite });
    await expect.element(heading()).toHaveTextContent("Join Grandma Pat's care group");
    await expect.element(page.getByText("Sam Okafor invited you to join as a caretaker.")).toBeVisible();
    await expect.element(page.getByText(/read and add to everything the group shares/)).toBeVisible();
    const email = field("Email");
    await expect.element(email).toHaveValue("avery.invited@example.com");
    await expect.element(email).toHaveAttribute("readonly");
    await expect
      .element(page.getByRole("link", { name: "Sign in" }))
      .toHaveAttribute("href", `/sign-in?redirectTo=${encodeURIComponent(PATH)}`);
    expect(form("decline")).not.toBeNull();
  });

  test("a viewer's invite says they can read only", async () => {
    await open({ "invite.preview": () => ({ ...emailInvite, role: "viewer" }) });
    await expect.element(page.getByText("Sam Okafor invited you to join as a viewer.")).toBeVisible();
    await expect.element(page.getByText(/but not add to it/)).toBeVisible();
  });

  test("an invite without a group name or inviter still reads plainly", async () => {
    await open({ "invite.preview": () => ({ ...emailInvite, groupName: null, inviterName: null }) });
    await expect.element(heading()).toHaveTextContent("Join a care group");
    await expect.element(page.getByText("Someone invited you to join as a caretaker.")).toBeVisible();
  });

  test("Create account makes the account through invite.signUp, signs in, and comes back to the invite", async () => {
    const calls = apiCalls();
    const device = await open(
      calls.record({
        "invite.preview": () => emailInvite,
        "invite.signUp": () => ({ verified: true }),
        "/api/auth/sign-in/email": () => ({ user: { email: emailInvite.email } }),
      }),
    );
    await fillSignUp();
    await userEvent.click(page.getByRole("button", { name: "Create account" }));
    await expect.poll(() => calls.of("/api/auth/sign-in/email").length).toBe(1);
    expect(calls.of("invite.signUp")).toEqual([
      {
        token: TOKEN,
        name: "Avery Invited",
        email: "avery.invited@example.com",
        password: "a long fictional passphrase",
        legal: true,
      },
    ]);
    expect(calls.of("/api/auth/sign-in/email")).toEqual([
      { email: "avery.invited@example.com", password: "a long fictional passphrase" },
    ]);
    expect(device.location()).toBe(PATH);
  });

  test("passwords that don't match are refused before any call", async () => {
    const calls = apiCalls();
    await open(calls.record({ "invite.preview": () => emailInvite, "invite.signUp": () => ({}) }));
    await fillSignUp("a long fictional passphrase", "a different passphrase");
    await userEvent.click(page.getByRole("button", { name: "Create account" }));
    await expect.element(page.getByRole("alert")).toBeVisible();
    expect(calls.of("invite.signUp")).toEqual([]);
  });

  test("a refusal from the server is shown on the form, which keeps what was typed", async () => {
    await open({
      "invite.preview": () => emailInvite,
      "invite.signUp": () => refusal("careGroupInviteService:unusable"),
    });
    await fillSignUp();
    await userEvent.click(page.getByRole("button", { name: "Create account" }));
    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect.element(field("Your name")).toHaveValue("Avery Invited");
  });

  test("the box is required, and its links open in a new tab, keeping what was typed", async () => {
    const calls = apiCalls();
    await open(calls.record({ "invite.preview": () => emailInvite, "invite.signUp": () => ({}) }));
    await userEvent.fill(field("Your name"), "Avery Invited");
    await userEvent.fill(field("Password"), "a long fictional passphrase");
    await userEvent.fill(field("Password again"), "a long fictional passphrase");
    await expect.element(legalBox()).not.toBeChecked();
    expect(document.querySelector<HTMLInputElement>("[data-legal-box]")?.validity.valueMissing).toBe(true);
    await userEvent.click(page.getByRole("button", { name: "Create account" }));
    expect(calls.of("invite.signUp")).toEqual([]);
    for (const [name, href] of [
      ["Terms", "/terms"],
      ["Privacy Policy", "/privacy"],
      ["Consumer Health Data Privacy Policy", "/health-data-privacy"],
    ] as const) {
      const link = page.getByRole("link", { name, exact: true });
      await expect.element(link).toHaveAttribute("href", href);
      await expect.element(link).toHaveAttribute("target", "_blank");
    }
    await expect.element(field("Your name")).toHaveValue("Avery Invited");
  });

  test("Decline tells the server and says so, with nothing left to do", async () => {
    const calls = apiCalls();
    await open(calls.record({ "invite.preview": () => emailInvite, "invite.decline": () => ({}) }));
    await userEvent.click(page.getByRole("button", { name: "Decline invitation" }));
    await expect.element(heading()).toHaveTextContent("Invitation declined");
    expect(calls.of("invite.decline")).toEqual([{ token: TOKEN }]);
    expect(document.querySelector("[data-invite-form]")).toBeNull();
  });
});

describe("a link invite, signed out", () => {
  test("takes any address, and has no Decline", async () => {
    await open({ "invite.preview": () => linkInvite });
    await expect.element(heading()).toHaveTextContent("Join Grandma Pat's care group");
    await expect.element(page.getByText("Sam Okafor invited you to join as a viewer.")).toBeVisible();
    await expect.element(field("Email")).toHaveValue("");
    await expect.element(field("Email")).not.toHaveAttribute("readonly");
    await expect.element(page.getByText("We'll email you a link to confirm it.")).toBeVisible();
    expect(form("decline")).toBeNull();
  });

  test("an account that isn't confirmed yet waits at /verify-email, with the invite as where to go on", async () => {
    const calls = apiCalls();
    const device = await open(
      calls.record({
        "invite.preview": () => linkInvite,
        "invite.signUp": () => ({ verified: false }),
        "/api/auth/send-verification-email": () => ({ status: true }),
      }),
    );
    await userEvent.fill(field("Email"), "joiner@example.com");
    await fillSignUp();
    await userEvent.click(page.getByRole("button", { name: "Create account" }));
    await expect.poll(device.location).toMatch(/^\/verify-email\?email=joiner%40example\.com/);
    expect(device.location()).toContain(encodeURIComponent(PATH));
    expect(calls.of("/api/auth/send-verification-email")).toEqual([
      { email: "joiner@example.com", callbackURL: PATH },
    ]);
    expect(calls.of("/api/auth/sign-in/email")).toEqual([]);
  });
});

describe("the consent form", () => {
  test("an email invite: what the group shares, the inviter's confirmation and the consent, then Join", async () => {
    await open({ "invite.preview": () => emailInvite, ...signedIn("Avery.Invited@example.com") });
    await expect.element(heading()).toHaveTextContent("Join Grandma Pat's care group");
    const consent = form("accept")!;
    expect(consent.textContent).toContain("Grandma Pat's care group shares:");
    for (const item of SHARED_WITH_MEMBERS) expect(consent.textContent).toContain(item);
    expect(consent.textContent).toContain(ATTESTATION_TEXT);
    await expect.element(page.getByLabelText(CONSENT_TEXT)).not.toBeChecked();
    await expect.element(page.getByRole("button", { name: "Join the care group" })).toBeVisible();
    expect(form("signUp")).toBeNull();
    expect(form("decline")).not.toBeNull();
  });

  test("a link: it says a request waits for approval, and the button asks", async () => {
    await open({ "invite.preview": () => linkInvite, ...signedIn("anyone@example.com") });
    await expect.element(page.getByRole("button", { name: "Ask to join" })).toBeVisible();
    const accept = await found(() => form("accept"));
    expect(accept.textContent).toContain("approves each request");
    expect(accept.textContent).not.toContain(ATTESTATION_TEXT);
    expect(form("decline")).toBeNull();
  });

  test("asking through a link goes home, with the consent sent", async () => {
    const calls = apiCalls();
    const device = await open(
      calls.record({
        "invite.preview": () => linkInvite,
        "invite.accept": () => ({ groupId: "g", status: "requested" }),
        ...signedIn("anyone@example.com"),
      }),
    );
    await userEvent.click(page.getByLabelText(CONSENT_TEXT));
    await userEvent.click(page.getByRole("button", { name: "Ask to join" }));
    await expect.poll(device.location).toBe("/app");
    expect(calls.of("invite.accept")).toEqual([{ token: TOKEN, consent: true }]);
  });

  test("an account with a current acceptance isn't shown the legal box", async () => {
    await open({
      "invite.preview": () => emailInvite,
      "invite.legalNeeded": () => ({ needed: false }),
      ...signedIn(emailInvite.email),
    });
    await found(() => form("accept"));
    expect(document.querySelector("[data-legal-box]")).toBeNull();
  });

  test.each([
    ["an email invite", emailInvite, "Join the care group"],
    ["a link", linkInvite, "Ask to join"],
  ] as const)("%s: an account without one must tick the box, and it's sent", async (_, preview, button) => {
    const calls = apiCalls();
    const device = await open(
      calls.record({
        "invite.preview": () => preview,
        "invite.legalNeeded": () => ({ needed: true }),
        "invite.accept": () => ({ groupId: "g", status: "requested" }),
        ...signedIn(emailInvite.email),
      }),
    );
    await expect.element(legalBox()).not.toBeChecked();
    await userEvent.click(page.getByLabelText(CONSENT_TEXT));
    await userEvent.click(page.getByRole("button", { name: button }));
    expect(calls.of("invite.accept")).toEqual([]);
    await userEvent.click(legalBox());
    await userEvent.click(page.getByRole("button", { name: button }));
    await expect.poll(device.location).toBe("/app");
    expect(calls.of("invite.accept")).toEqual([{ token: TOKEN, consent: true, legal: true }]);
  });

  test("a server that still asks brings the box up, keeping the consent tick", async () => {
    const calls = apiCalls();
    let refused = false;
    const device = await open(
      calls.record({
        "invite.preview": () => linkInvite,
        "invite.legalNeeded": () => ({ needed: false }),
        "invite.accept": () => {
          if (refused) return { groupId: "g", status: "requested" };
          refused = true;
          return refusal("careGroupInviteService:legalRequired");
        },
        ...signedIn("anyone@example.com"),
      }),
    );
    await userEvent.click(page.getByLabelText(CONSENT_TEXT));
    await userEvent.click(page.getByRole("button", { name: "Ask to join" }));
    await expect.element(legalBox()).toBeVisible();
    await expect.element(page.getByText(LEGAL_REQUIRED_MESSAGE)).toBeVisible();
    await expect.element(page.getByLabelText(CONSENT_TEXT)).toBeChecked();
    await userEvent.click(legalBox());
    await userEvent.click(page.getByRole("button", { name: "Ask to join" }));
    await expect.poll(device.location).toBe("/app");
    expect(calls.of("invite.accept").at(-1)).toEqual({ token: TOKEN, consent: true, legal: true });
  });

  test("a refusal is shown on the form", async () => {
    await open({
      "invite.preview": () => emailInvite,
      "invite.accept": () => refusal("careGroupInviteService:unusable"),
      ...signedIn(emailInvite.email),
    });
    await userEvent.click(page.getByLabelText(CONSENT_TEXT));
    await userEvent.click(page.getByRole("button", { name: "Join the care group" }));
    await expect.element(page.getByRole("alert")).toBeVisible();
  });

  test("a session that ended meanwhile goes to sign-in and back to the invite", async () => {
    const device = await open({
      "invite.preview": () => emailInvite,
      "invite.accept": () =>
        Response.json(
          { json: { defined: false, code: "UNAUTHORIZED", status: 401, message: "No", data: {} }, meta: [] },
          { status: 401 },
        ),
      ...signedIn(emailInvite.email),
    });
    await userEvent.click(page.getByLabelText(CONSENT_TEXT));
    await userEvent.click(page.getByRole("button", { name: "Join the care group" }));
    await expect.poll(device.location).toBe(`/sign-in?redirectTo=${encodeURIComponent(PATH)}`);
  });

  test("Decline from the consent form says so", async () => {
    await open({
      "invite.preview": () => emailInvite,
      "invite.decline": () => ({}),
      ...signedIn(emailInvite.email),
    });
    await userEvent.click(page.getByRole("button", { name: "Decline invitation" }));
    await expect.element(heading()).toHaveTextContent("Invitation declined");
  });
});

describe("an email invite, signed in as someone else", () => {
  test("says it's for another address, offers no Join, and signs out back to the invite", async () => {
    await open({ "invite.preview": () => emailInvite, ...signedIn("existing@example.com") });
    await expect.element(heading()).toHaveTextContent("This invitation is for another email address");
    await expect.element(page.getByText("existing@example.com")).toBeVisible();
    expect(document.querySelector("[data-invite-form]")).toBeNull();
    const signOut = page.getByRole("button", { name: "Sign out" }).element().closest("form")!;
    expect(signOut.getAttribute("action")).toBe("/sign-out");
    expect(signOut.querySelector<HTMLInputElement>('input[name="redirectTo"]')?.value).toBe(PATH);
  });

  test("a link is for anyone: no wrong-account view", async () => {
    await open({ "invite.preview": () => linkInvite, ...signedIn("existing@example.com") });
    expect(form("accept")).not.toBeNull();
  });
});
