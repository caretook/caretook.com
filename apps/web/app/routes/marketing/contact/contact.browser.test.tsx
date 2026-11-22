import { HONEYPOT_FIELD, MIN_FORM_MS } from "@caretook/data/schema";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { apiCalls } from "../../../../test/api";
import { fixClock } from "../../../../test/found";
import { openMarketing } from "../marketingWorld";
import { content } from "./content";

// The contact page's form on one device (moved down from marketing.spec.mjs):
// every field a person can reach has a label (the honeypot is out of the tab
// order), and a submit sends the message with the guard, then thanks politely.
// Storing it and mailing SUPPORT_EMAIL (flagged for privacy) are
// packages/api/src/marketing/publicForms.int.test.ts's; one real send through
// the server, to the dev mailbox, stays in the browser check.

const copy = content.form;
const SEND = "public.contact.send";

describe("the contact form", () => {
  test("every field a person can reach has a label; the honeypot is out of the tab order", async () => {
    const { screen } = await openMarketing("/contact");
    await expect.element(screen.getByRole("form")).toBeVisible();
    const form = screen.getByRole("form").element();
    const reachable = [...form.querySelectorAll<HTMLInputElement>("input, select, textarea")].filter(
      (el) => el.tabIndex !== -1,
    );
    expect(reachable.map((el) => el.name)).toEqual(["name", "email", "topic", "message"]);
    for (const el of reachable) expect(el.labels?.[0]?.textContent?.trim(), el.name).toBeTruthy();
    expect(form.querySelector<HTMLInputElement>(`[name="${HONEYPOT_FIELD}"]`)?.tabIndex).toBe(-1);
  });

  test("sending passes the message and the guard, then thanks politely in place of the form", async () => {
    fixClock();
    const calls = apiCalls();
    const { screen } = await openMarketing("/contact", {
      api: calls.record({ [SEND]: () => ({ ok: true }) }),
    });
    await userEvent.fill(screen.getByLabelText(copy.name.label), "Robin Example");
    await userEvent.fill(screen.getByLabelText(copy.email.label), "robin+contact@example.com");
    await userEvent.selectOptions(screen.getByLabelText(copy.topic.label), "privacy");
    await userEvent.fill(screen.getByLabelText(copy.message.label), "Please delete my data.");
    vi.setSystemTime(Date.now() + MIN_FORM_MS + 500);
    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    const thanks = screen.getByRole("status");
    await expect.element(thanks.getByText(copy.thanks.heading)).toBeVisible();
    await expect.element(thanks).toHaveAttribute("aria-live", "polite");
    await expect.element(screen.getByRole("form")).not.toBeInTheDocument();
    const [sent, ...more] = calls.of(SEND) as Record<string, unknown>[];
    expect(more).toHaveLength(0);
    expect(sent).toMatchObject({
      name: "Robin Example",
      email: "robin+contact@example.com",
      topic: "privacy",
      message: "Please delete my data.",
      [HONEYPOT_FIELD]: "",
    });
    expect(sent?.elapsedMs).toBeGreaterThanOrEqual(MIN_FORM_MS);
  });
});
