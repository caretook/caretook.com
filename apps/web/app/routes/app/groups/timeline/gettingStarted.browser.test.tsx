import type { DeviceOptions } from "../../../../../test/device";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as timeline from "./route";

// The setup card on the timeline: by role, ticking itself off from synced
// data, dismissed for good, and the invite card back once it's gone.

const ROUTE = { path: "/app/groups/:groupId/timeline", module: timeline };
const URL = `/app/groups/${TEST_GROUP.id}/timeline`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const joined = (createdAt: string, role: "owner" | "admin" | "caretaker" | "viewer" = "owner") =>
  fx.member({ userId: TEST_USER.id, role, createdAt });
const open = (member: ReturnType<typeof joined>, options: Partial<DeviceOptions> = {}) =>
  renderWithDevice({ route: ROUTE, url: URL, role: null, fixtures: [member], ...options });
const card = () => document.querySelector("[data-setup-card]");
const inviteHook = () => document.querySelector("[data-invite-card]");
const step = (id: string) => document.querySelector(`[data-setup-step="${id}"]`);
const heading = () => page.getByRole("heading", { name: "Timeline", level: 1 });

beforeEach(() => localStorage.clear());

describe("the setup card", () => {
  test("a new owner sees the steps, with the invite step keeping the invite hook", async () => {
    await open(joined(hoursAgo(1)));
    await expect.poll(card).not.toBeNull();
    for (const id of ["profile", "medication", "entry", "invite", "connect"])
      expect(step(id), id).not.toBeNull();
    expect(inviteHook()).toBe(step("invite"));
  });

  test("a caretaker gets no invite step", async () => {
    await open(joined(hoursAgo(1), "caretaker"));
    await expect.poll(card).not.toBeNull();
    expect(step("invite")).toBeNull();
    expect(step("connect")).toBeNull();
  });

  test("a viewer sees no checklist", async () => {
    await open(joined(hoursAgo(1), "viewer"));
    await expect.element(heading()).toBeVisible();
    expect(card()).toBeNull();
  });

  test("an entry arriving ticks its step, live", async () => {
    const device = await open(joined(hoursAgo(1)));
    await expect.poll(card).not.toBeNull();
    expect(step("entry")?.hasAttribute("data-done")).toBe(false);
    await device.sync([fx.note({ text: "Slept well after lunch." })]);
    await device.settle();
    await expect.poll(() => step("entry")?.hasAttribute("data-done")).toBe(true);
    expect(card()?.textContent).toContain("1 of 4 done");
  });

  test("a medication ticks its step, but the change written with it isn't a first entry", async () => {
    const medication = fx.medication({ name: "Lisinopril" });
    const device = await open(joined(hoursAgo(1)));
    await expect.poll(card).not.toBeNull();
    await device.sync([
      medication,
      fx.medicationChange({ medicationId: medication.row.id, change: "started" }),
    ]);
    await device.settle();
    await expect.poll(() => step("medication")?.hasAttribute("data-done")).toBe(true);
    expect(step("entry")?.hasAttribute("data-done")).toBe(false);
  });

  test("recording no known allergies ticks the profile step", async () => {
    await open(joined(hoursAgo(1)), {
      bareDevice: true,
      fixtures: [fx.group(), fx.recipient({ noKnownAllergiesAt: hoursAgo(1) }), joined(hoursAgo(1))],
    });
    await expect.poll(() => step("profile")?.hasAttribute("data-done")).toBe(true);
  });

  test("finishing every counted step hides the card", async () => {
    const medication = fx.medication({ name: "Lisinopril" });
    await open(joined(hoursAgo(1), "caretaker"), {
      bareDevice: true,
      fixtures: [
        fx.group(),
        fx.recipient({ noKnownConditionsAt: hoursAgo(1) }),
        joined(hoursAgo(1), "caretaker"),
        medication,
        fx.note({ text: "Walked to the garden." }),
      ],
    });
    await expect.element(heading()).toBeVisible();
    expect(card()).toBeNull();
  });

  test("dismissing hides it, brings the invite card back and survives a reload", async () => {
    const member = joined(hoursAgo(1));
    const first = await open(member);
    await expect.poll(card).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Dismiss setup" }));
    await expect.poll(card).toBeNull();
    await expect.poll(inviteHook).not.toBeNull();
    expect(inviteHook()).not.toBe(step("invite"));
    await first.screen.unmount();

    await open(member);
    await expect.element(heading()).toBeVisible();
    await expect.poll(inviteHook).not.toBeNull();
    expect(card()).toBeNull();
  });

  test("a member past 14 days sees none, and the invite card instead", async () => {
    await open(joined(hoursAgo(24 * 14 + 1)));
    await expect.element(heading()).toBeVisible();
    await expect.poll(inviteHook).not.toBeNull();
    expect(card()).toBeNull();
  });
});
