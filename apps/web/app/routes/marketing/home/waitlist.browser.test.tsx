import { HONEYPOT_FIELD, MIN_FORM_MS } from "@caretook/data/schema";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { apiCalls } from "../../../../test/api";
import { fixClock } from "../../../../test/found";
import { openMarketing } from "../marketingWorld";
import { waitlistSource } from "../sections/forms";
import { homeContent } from "./content";

// Home's waitlist band on one device (moved down from marketing.spec.mjs):
// what a submit sends (the fields, the page and its UTM parameters, the
// honeypot and the time on the page), the polite thanks in place of the form,
// and a field error linked to its field. What the server does with it (one
// entry per email in any case, nothing stored for a honeypot or a too-fast
// submit, the rate limit) is packages/api/src/marketing/publicForms.int.test.ts's;
// one real join through the server stays in the browser check.

const copy = homeContent.waitlist.form;
const JOIN = "public.waitlist.join";

const band = () => document.getElementById(homeContent.waitlist.id);

/** Set a field as typing would, through the native setter: the honeypot is out of reach of a click. */
const setField = (name: string, value: string) => {
  const input = band()?.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!input) throw new Error(`no ${name} field`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

/** An oRPC input-validation refusal, as the server sends one. */
const invalid = (issues: { path: string[]; message: string }[]) =>
  Response.json(
    {
      json: {
        defined: false,
        code: "BAD_REQUEST",
        status: 400,
        message: "Input validation failed",
        data: { issues },
      },
      meta: [],
    },
    { status: 400 },
  );

describe("the waitlist band", () => {
  test("joining sends what was typed with the page, the empty honeypot and the time on the page, then thanks politely", async () => {
    fixClock();
    const calls = apiCalls();
    const { screen } = await openMarketing("/", { api: calls.record({ [JOIN]: () => ({ ok: true }) }) });
    await userEvent.fill(screen.getByLabelText(copy.email.label), "robin+wl@example.com");
    await userEvent.fill(screen.getByLabelText(copy.firstName.label, { exact: false }), "Robin");
    await userEvent.selectOptions(screen.getByLabelText(copy.caringFor.label, { exact: false }), "parent");
    await userEvent.fill(screen.getByLabelText(copy.heardFrom.label, { exact: false }), "A friend");
    vi.setSystemTime(Date.now() + MIN_FORM_MS + 500);
    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    const thanks = screen.getByRole("status");
    await expect.element(thanks.getByText(copy.thanks.heading)).toBeVisible();
    await expect.element(thanks).toHaveAttribute("aria-live", "polite");
    expect(band()?.querySelector("form"), "the thanks replaces the form").toBeNull();
    const [sent, ...more] = calls.of(JOIN) as Record<string, unknown>[];
    expect(more).toHaveLength(0);
    expect(sent).toMatchObject({
      email: "robin+wl@example.com",
      firstName: "Robin",
      caringFor: "parent",
      heardFrom: "A friend",
      source: waitlistSource(window.location.pathname, window.location.search),
      [HONEYPOT_FIELD]: "",
    });
    expect(sent?.elapsedMs).toBeGreaterThanOrEqual(MIN_FORM_MS);
  });

  test("a filled honeypot and a fast submit go to the server as they are, for it to judge, and are thanked", async () => {
    const calls = apiCalls();
    const { screen } = await openMarketing("/", { api: calls.record({ [JOIN]: () => ({ ok: true }) }) });
    await userEvent.fill(screen.getByLabelText(copy.email.label), "bot+wl@example.com");
    setField(HONEYPOT_FIELD, "https://spam.example");
    await userEvent.click(screen.getByRole("button", { name: copy.submit }));
    await expect.element(screen.getByRole("status").getByText(copy.thanks.heading)).toBeVisible();
    const [sent] = calls.of(JOIN) as Record<string, unknown>[];
    expect(sent).toMatchObject({ [HONEYPOT_FIELD]: "https://spam.example" });
    expect(sent?.elapsedMs).toBeLessThan(MIN_FORM_MS);
  });

  test("a field error is linked to its labelled field, which gets focus, under the form's alert", async () => {
    const message = "Enter an email address like name@example.com.";
    const { screen } = await openMarketing("/", {
      api: { [JOIN]: () => invalid([{ path: ["email"], message }]) },
    });
    const email = screen.getByLabelText(copy.email.label);
    await userEvent.fill(email, "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    await expect.element(screen.getByText(message)).toBeVisible();
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
    await expect.element(email).toHaveAccessibleDescription(message);
    await expect.element(email).toHaveFocus();
    await expect.element(screen.getByRole("alert")).toBeVisible();
  });
});
