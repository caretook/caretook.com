import type { DeviceRoute } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { apiCalls, refusal } from "../../../../test/api";
import { renderWithDevice } from "../../../../test/device";
import { CLOSED_CODE } from "./joinPage";
import * as join from "./route";

// `/join/:code` (groups.mjs steps 1, 1b and 3, on the test device): a code
// that can't be used says so plainly with no form; offline it offers Try
// again; signed in it points at New care group; signed out it's the
// two-step form whose one `accessCode.signUp` call carries the account and
// the group, then the confirmation email and /verify-email. A refusal opens
// the step it's about. The server's side (the account, group and
// redemption in one go, refused codes creating nothing, an existing
// address answered like a new one and emailed) is
// packages/api/src/groups.int.test.ts's; the whole sign-up through the
// emailed link to the new group's timeline is invites.mjs's step 13.

const CODE = "CARE-DEMO-0001";
const ROUTES: DeviceRoute[] = [
  { path: "/join/:code", module: join },
  {
    path: "/verify-email",
    module: {
      default: () => (
        <main>
          <h1>Confirm your email</h1>
        </main>
      ),
    },
  },
];

const open = (api: Record<string, (input: unknown) => unknown>, code = CODE) =>
  renderWithDevice({ route: ROUTES, url: `/join/${code}`, role: null, api });

const usable = { "accessCode.preview": () => ({ state: "usable", code: CODE }) };
const heading = () => page.getByRole("heading", { level: 1 });
const field = (label: string) => page.getByLabelText(label, { exact: true });

/** Fill the account step and press Continue. */
const fillAccount = async (email = "rose.example@example.com", password = "a long fictional passphrase") => {
  await userEvent.fill(field("Your name"), "Rose Example");
  await userEvent.fill(field("Email"), email);
  await userEvent.fill(field("Password"), password);
  await userEvent.fill(field("Password again"), password);
  await userEvent.click(page.getByRole("button", { name: "Continue" }));
};

describe("/join/:code", () => {
  test("a code that can't be used says why, plainly, with no form and a Sign in link", async () => {
    for (const state of ["expired", "revoked", "usedUp", "notFound", "unavailable"] as const) {
      const device = await open({ "accessCode.preview": () => ({ state }) }, "CARE-ZZZZ-ZZZZ");
      await expect.element(heading()).toHaveTextContent(CLOSED_CODE[state].title);
      expect(document.querySelector<HTMLElement>("[data-code-state]")?.dataset.codeState).toBe(state);
      expect(document.querySelector("[data-join-form]")).toBeNull();
      await expect.element(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
      await device.screen.unmount();
    }
  });

  test("a code the server calls malformed is not valid", async () => {
    await open({ "accessCode.preview": () => refusal("accessCodeService:invalid") }, "hello");
    await expect.element(heading()).toHaveTextContent(CLOSED_CODE.notFound.title);
  });

  test("offline, it says it couldn't reach Caretook and offers Try again", async () => {
    await open({});
    await expect.element(page.getByText(/Couldn't reach Caretook/)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Try again" }))
      .toHaveAttribute("href", `/join/${CODE}`);
  });

  test("signed in, it says no code is needed and links to New care group", async () => {
    await open({
      ...usable,
      "/api/auth/get-session": () => ({ user: { email: "pat@example.com" }, session: {} }),
    });
    await expect.element(heading()).toHaveTextContent("You already have an account");
    await expect.element(page.getByText("pat@example.com")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "New care group" }))
      .toHaveAttribute("href", "/app/groups/new");
  });

  test("two steps: the account, then who you care for; one signUp call, the confirmation email, then /verify-email", async () => {
    const calls = apiCalls();
    const device = await open(
      calls.record({
        ...usable,
        "accessCode.signUp": () => ({ email: "rose.example@example.com" }),
        "/api/auth/send-verification-email": () => ({ status: true }),
      }),
    );
    await expect.element(heading()).toHaveTextContent("Start a care group");
    expect(document.querySelector<HTMLElement>("[data-join-form]")?.dataset.joinForm).toBe("account");

    // Continue checks the account step's fields first.
    await userEvent.click(page.getByRole("button", { name: "Continue" }));
    await expect.element(heading()).toHaveTextContent("Start a care group");

    await fillAccount();
    await expect.element(heading()).toHaveTextContent("Who do you care for?");
    await userEvent.fill(field("Their name"), "Rose Example");
    await userEvent.fill(field("What you call them"), "Nana");
    await expect.element(field("Group name")).toHaveAttribute("placeholder", "Nana's care");

    // Back keeps what was typed.
    await userEvent.click(page.getByRole("button", { name: "Back" }));
    await expect.element(field("Email")).toHaveValue("rose.example@example.com");
    await userEvent.click(page.getByRole("button", { name: "Continue" }));

    await userEvent.click(page.getByRole("button", { name: "Create care group" }));
    await expect.poll(device.location).toBe("/verify-email?email=rose.example%40example.com");
    expect(calls.of("accessCode.signUp")).toEqual([
      {
        code: CODE,
        name: "Rose Example",
        email: "rose.example@example.com",
        password: "a long fictional passphrase",
        group: {
          recipientName: "Rose Example",
          preferredName: "Nana",
          groupName: "",
          timeZone: "America/Los_Angeles",
        },
      },
    ]);
    // The confirmation link goes on to /app, which opens the only group.
    expect(calls.of("/api/auth/send-verification-email")).toEqual([
      { email: "rose.example@example.com", callbackURL: "/app" },
    ]);
  });

  test("passwords that don't match are refused on the account step, before any call", async () => {
    const calls = apiCalls();
    await open(calls.record({ ...usable, "accessCode.signUp": () => ({ email: "x@example.com" }) }));
    await userEvent.fill(field("Your name"), "Rose Example");
    await userEvent.fill(field("Email"), "rose.example@example.com");
    await userEvent.fill(field("Password"), "a long fictional passphrase");
    await userEvent.fill(field("Password again"), "a different passphrase");
    await userEvent.click(page.getByRole("button", { name: "Continue" }));
    await userEvent.fill(field("Their name"), "Rose Example");
    await userEvent.click(page.getByRole("button", { name: "Create care group" }));
    await expect.element(heading()).toHaveTextContent("Start a care group");
    await expect.element(page.getByRole("alert").first()).toBeVisible();
    expect(calls.of("accessCode.signUp")).toEqual([]);
  });

  test("a code used up meanwhile is refused with the server's message, and the form stays", async () => {
    const device = await open({
      ...usable,
      "accessCode.signUp": () => refusal("accessCodeService:unusable"),
    });
    await fillAccount();
    await userEvent.fill(field("Their name"), "Rose Example");
    await userEvent.click(page.getByRole("button", { name: "Create care group" }));
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("This access code can't be used any more");
    expect(device.location()).toBe(`/join/${CODE}`);
    await expect.element(field("Their name")).toHaveValue("Rose Example");
  });

  test("offline at Create, it says so and keeps the form", async () => {
    const device = await open({ ...usable });
    await fillAccount();
    await userEvent.fill(field("Their name"), "Rose Example");
    await userEvent.click(page.getByRole("button", { name: "Create care group" }));
    await expect.element(page.getByText(/Couldn't reach Caretook/)).toBeVisible();
    expect(device.location()).toBe(`/join/${CODE}`);
  });
});
