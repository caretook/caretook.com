import type { Fixture } from "../../../../../test/fixtures";

import { conditionChangeId } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, condition, conditionChangeEntry, fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import {
  addCondition,
  removeCondition,
  resolveCondition,
  updateCondition,
} from "~/lib/profiles/conditions.sync";
import {
  chip,
  chips,
  closeFilters,
  iconOf,
  openFilters,
  openOf,
  openTimeline,
  rowKinds,
  rows,
  rowWith,
  setView,
  TIMELINE_URL,
  chooseEasyMode,
} from "./timelineWorld";
import { found, waitUntil } from "../../../../../test/found";

// Condition changes on the timeline (conditions slice 2), on the test
// device: rows and cards say what changed ("Added Type 2 diabetes", "Since:
// 2015 → 2014", "Resolved Hip fracture") behind the Condition change icon;
// the Filter sheet's kind shows only them; a change opens nothing and its ⋯
// is Delete only; a write on this device puts its change entry in the same
// transaction, after the condition, under the id the server derives; and
// easy mode's "Remove my last entry" never offers one. Wording is
// conditionChange.test.ts's.

const DIABETES = condition({ name: "Type 2 diabetes", sinceYear: 2014, note: "Diet-controlled" });
const HIP = condition({ name: "Hip fracture", status: "resolved" });

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));

const changes = (): Fixture[] => [
  DIABETES,
  HIP,
  conditionChangeEntry({
    conditionId: DIABETES.id,
    conditionName: "Type 2 diabetes",
    occurredAt: minutesAgo(50),
    details: {
      after: { name: "Type 2 diabetes", status: "active", sinceYear: 2015, note: "Diet-controlled" },
    },
  }),
  conditionChangeEntry({
    conditionId: DIABETES.id,
    conditionName: "Type 2 diabetes",
    change: "changed",
    occurredAt: minutesAgo(40),
    details: {
      fields: ["since"],
      before: { sinceYear: 2015, sinceMonth: null },
      after: { sinceYear: 2014, sinceMonth: null },
    },
  }),
  conditionChangeEntry({
    conditionId: HIP.id,
    conditionName: "Hip fracture",
    change: "resolved",
    occurredAt: minutesAgo(30),
  }),
  fx.symptom({ name: "Headache", occurredAt: minutesAgo(20) }),
];

const open = (query = "", options: Parameters<typeof openTimeline>[0] = {}) =>
  openTimeline({ query, role: "caretaker", fixtures: changes(), ...options });

const texts = () =>
  rows()
    .filter((li) => li.querySelector("[data-condition-entry]"))
    .map((li) =>
      [...li.querySelectorAll("[data-condition-entry], [data-condition-change]")]
        .map((p) => p.textContent?.trim())
        .join(" | "),
    );

const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());

describe("condition changes on the timeline", () => {
  test("rows say what changed, behind the Condition change icon; cards say the same", async () => {
    await open();
    await expect
      .poll(texts)
      .toEqual([
        "Resolved Hip fracture",
        "Changed Type 2 diabetes | Since: 2015 → 2014",
        "Added Type 2 diabetes | Since 2015 · Diet-controlled",
      ]);
    const row = rowWith("Resolved Hip fracture")!;
    expect(row.querySelector(".sr-only")?.textContent).toBe("Condition change: ");
    expect(iconOf(row).getAttribute("aria-label")).toBe("Show only condition changes");
    expect(iconOf(row).querySelector("svg")).not.toBeNull();

    await setView("Full");
    await expect.poll(texts).toContain("Changed Type 2 diabetes | Since: 2015 → 2014");
  });

  test("the Filter sheet's Condition changes lists only them; the kind icon filters too", async () => {
    const device = await open();
    await expect.poll(() => rows().length).toBeGreaterThan(0);
    await openFilters();
    expect(chips().map((a) => a.textContent?.trim())).toContain("Condition changes");
    await userEvent.click(chip("Condition changes"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=conditionChange`);
    await closeFilters();
    await device.settle();
    expect(rowKinds()).toBe("Condition change: ");
    expect(texts()).toHaveLength(3);
    await device.screen.unmount();

    const again = await open();
    await expect.poll(() => rowWith("Resolved Hip fracture")).toBeTruthy();
    await userEvent.click(await found(() => iconOf(rowWith("Resolved Hip fracture")!)));
    await expect.poll(() => again.location()).toBe(`${TIMELINE_URL}?kind=conditionChange`);
  });

  test("a change opens nothing and its ⋯ is Tags and Delete", async () => {
    await open("?kind=conditionChange");
    await expect.poll(() => rowWith("Resolved Hip fracture")).toBeTruthy();
    const row = () => rowWith("Resolved Hip fracture");
    expect(openOf(await found(row))).toBeNull();
    await userEvent.click(await found(() => row()?.querySelector('button[aria-label^="Actions for"]')));
    await expect.poll(menuItems).toEqual(["Tags", "Delete"]);
  });

  test("a viewer sees the rows, with no ⋯", async () => {
    await open("?kind=conditionChange", { role: "viewer" });
    await expect.poll(texts).toHaveLength(3);
    expect(rowWith("Resolved Hip fracture")?.querySelector('button[aria-label^="Actions for"]')).toBeNull();
  });
});

describe("a condition written on this device", () => {
  test("adds, edits, resolves and reactivates with one entry each, queued after the condition, under the derived id; a no-op and a delete add none", async () => {
    const device = await open("?kind=conditionChange", { fixtures: [] });
    const added = await addCondition(device.db, TEST_GROUP.id, { name: "Asthma", sinceYear: 2020 });
    expect(added.ok).toBe(true);
    const id = added.ok ? added.id : "";
    await expect.poll(texts).toEqual(["Added Asthma | Since 2020"]);

    expect((await updateCondition(device.db, id, { sinceYear: 2019, sinceMonth: 4 })).ok).toBe(true);
    expect((await updateCondition(device.db, id, { sinceYear: 2019, sinceMonth: 4 })).ok).toBe(true);
    expect((await resolveCondition(device.db, id)).ok).toBe(true);
    expect((await removeCondition(device.db, id)).ok).toBe(true);
    await expect
      .poll(texts)
      .toEqual(["Resolved Asthma", "Changed Asthma | Since: 2020 → April 2019", "Added Asthma | Since 2020"]);

    const queued = await device.queued();
    expect(queued.map((w) => [w.op, w.type])).toEqual([
      ["PUT", "recipient_condition"],
      ["PUT", "timeline_entry"],
      ["PATCH", "recipient_condition"],
      ["PUT", "timeline_entry"],
      ["PATCH", "recipient_condition"],
      ["PUT", "timeline_entry"],
      ["PATCH", "recipient_condition"],
    ]);
    // Each entry's id is the condition's and the save's time, as the server derives it.
    for (const i of [0, 2, 4]) {
      const updatedAt = queued[i]!.data!.updated_at as string;
      expect(queued[i + 1]?.id).toBe(conditionChangeId(id, updatedAt));
      expect(queued[i + 1]?.data).toMatchObject({ kind: "conditionChange", occurred_at: updatedAt });
    }
  });
});

describe("easy mode", () => {
  test("Remove my last entry never offers a condition change", async () => {
    const membership = fx.member({ userId: TEST_USER.id, role: "caretaker" });
    chooseEasyMode();
    const mine = fx.symptom({ name: "Dizzy", occurredAt: minutesAgo(20), createdAt: minutesAgo(20) });
    const device = await openTimeline({ role: null, fixtures: [membership, mine] });
    await waitUntil(() => !!document.querySelector("[data-easy-timeline]"), "the easy view");
    expect((await addCondition(device.db, TEST_GROUP.id, { name: "Gout" })).ok).toBe(true);
    await device.settle();

    await userEvent.click(page.getByRole("button", { name: "Remove my last entry" }));
    const dialogText = () => document.querySelector("dialog[open]")?.textContent ?? "";
    await expect.poll(dialogText).toContain("Symptom: Dizzy.");
  });
});
