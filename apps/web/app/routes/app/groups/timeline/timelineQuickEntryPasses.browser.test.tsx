import type { DeviceRoute } from "../../../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, medicationPass, TEST_GROUP, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { DEFAULT_UNITS } from "@caretook/data/schema";
import { QuickEntryBox } from "~/components/quick-entry";
import { clearUndo } from "~/lib/medications/passUndo";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import { dayInZone, timeInZone } from "~/lib/core/zonedDay";
import * as newDose from "./new-dose/route";
import * as timeline from "./route";
import { TIMELINE_URL, waitUntil } from "./timelineWorld";

// Passes in quick entry, on the test device (offline throughout): "gave
// evening meds" and "gave meds" carried out as Given all (one round, the
// pass's open medications only), the due pass as one tap in the box's
// suggestions popover, and
// Undo after any Save removing the whole line. Times are relative to now in
// the recipient's zone, so the pass is due whatever the clock.

/** Ten minutes ago by the recipient's clock (just after midnight, midnight itself): a pass then is due now. */
const dueTime = () => {
  const now = new Date();
  const earlier = new Date(now.getTime() - 10 * 60_000);
  return dayInZone(earlier, TEST_TIME_ZONE) === dayInZone(now, TEST_TIME_ZONE)
    ? timeInZone(earlier, TEST_TIME_ZONE)
    : "00:00";
};

const EVENING_TIME = dueTime();
const EVENING = medicationPass({ name: "Evening", time: EVENING_TIME, sortOrder: 1 });
/** A pass with nothing in it: never due. */
const NOON = medicationPass({ name: "Noon", time: "12:00", sortOrder: 0 });
const LISINOPRIL = fx.medication({
  name: "Lisinopril",
  strength: "10 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ passId: EVENING.id }] },
});
const METFORMIN = fx.medication({
  name: "Metformin",
  strength: "500 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ passId: EVENING.id, amount: "2 tablets" }] },
});
/** Due too, but at a time of its own: Given all for Evening leaves it alone. */
const METOPROLOL = fx.medication({
  name: "Metoprolol",
  strength: "25 mg",
  schedule: { type: "scheduled", slots: [{ time: dueTime() }] },
});

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [{ path: "/app/groups/:groupId/timeline/new/dose", module: newDose }],
  },
];

const open = () =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    fixtures: [EVENING, NOON, LISINOPRIL, METFORMIN, METOPROLOL],
  });

const box = () => page.getByRole("textbox", { name: "What happened?" });
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-quick-card]")];
const saveButton = () => document.querySelector<HTMLButtonElement>("[data-quick-entry] button[type=submit]")!;
const undoLabel = () =>
  document.querySelector("[data-quick-entry] [data-pass-undo-label]")?.textContent ?? "";
const undoButton = () =>
  document.querySelector<HTMLButtonElement>("[data-quick-entry] [data-pass-undo-button]");
const dueChips = () => [...document.querySelectorAll<HTMLButtonElement>('[data-quick-row="due"] button')];
const PASS_DUE = "Suggestions, a pass is due";
const suggestButton = () => page.getByRole("button", { name: /^Suggestions/ });
/** The empty box's Suggestions button, named for a due pass. */
const passDueButton = () => page.getByRole("button", { name: PASS_DUE, exact: true });
const suggestions = () => page.getByRole("dialog", { name: "Suggestions" });

type DoseRow = { id: string; details: string; deleted_at: string | null; kind: string };
const entries = (device: Awaited<ReturnType<typeof open>>) =>
  device.query<DoseRow>("SELECT id, kind, details, deleted_at FROM timeline_entry ORDER BY kind, id");
const live = async (device: Awaited<ReturnType<typeof open>>) =>
  (await entries(device)).filter((r) => !r.deleted_at);

/** Type a line and wait until its cards say `text` (the passes load a moment after the box). */
const typeUntil = async (line: string, text: string) => {
  await userEvent.fill(box(), line);
  await waitUntil(() => cards().some((c) => c.textContent?.includes(text)), 4000, `a card with "${text}"`);
};

afterEach(() => clearUndo());

describe("passes in the box", () => {
  test("'gave evening meds' logs the pass's open medications as Given all does, in one round, queued", async () => {
    const device = await open();
    await typeUntil("gave evening meds", "Evening medications");
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.dataset.quickCard).toBe("dose");
    expect(cards()[0]!.textContent).toContain("Given all · 2 medications");
    await userEvent.click(saveButton());
    await expect.poll(undoLabel).toBe("Saved 2 entries");

    const doses = await live(device);
    const details = doses.map((d) => JSON.parse(d.details) as Record<string, unknown>);
    expect(details.map((d) => d.medicationId).sort()).toEqual([LISINOPRIL.id, METFORMIN.id].sort());
    expect(details.every((d) => d.passId === EVENING.id && d.status === "given")).toBe(true);
    expect(details.every((d) => d.scheduledFor === EVENING_TIME)).toBe(true);
    expect(new Set(details.map((d) => d.passLogId)).size).toBe(1);
    expect(details.find((d) => d.medicationId === METFORMIN.id)?.amount).toBe("2 tablets");
    const queued = (await device.queued()).filter((w) => w.type === "timeline_entry");
    expect(queued.map((w) => w.op)).toEqual(["PUT", "PUT"]);
  });

  test("'gave meds' picks the pass that's due", async () => {
    const device = await open();
    await typeUntil("gave meds", "Evening medications");
    await userEvent.click(saveButton());
    await expect.poll(undoLabel).toBe("Saved 2 entries");
    expect(await live(device)).toHaveLength(2);
  });

  test("Undo after a Save removes the whole line: the vital, the pass's doses and the note", async () => {
    const device = await open();
    await typeUntil("bp 120/80, gave evening meds, slept well after lunch", "Evening medications");
    expect(cards().map((c) => c.dataset.quickCard)).toEqual(["vital", "dose", "note"]);
    await userEvent.click(saveButton());
    await expect.poll(undoLabel).toBe("Saved 4 entries");
    expect(await live(device)).toHaveLength(4);

    await userEvent.click(undoButton()!);
    await expect.poll(async () => (await live(device)).length).toBe(0);
    expect((await entries(device)).filter((r) => r.deleted_at)).toHaveLength(4);
    await expect.poll(undoLabel).toBe("");
    // The pass is due again: the button says so.
    await expect.element(passDueButton()).toBeVisible();
  });

  test("Undo is offered for about 10 s only in the box, not on the Today card's medications row", async () => {
    await open();
    await typeUntil("gave evening meds", "Evening medications");
    await userEvent.click(saveButton());
    await expect.poll(undoLabel).toBe("Saved 2 entries");
    const strip = document.querySelector('[data-today-row="medications"]');
    expect(strip?.querySelector("[data-pass-undo-label]") ?? null).toBeNull();
    expect(
      document.querySelector("[data-quick-entry] [data-pass-undo]")?.closest("[role=status]"),
    ).toBeTruthy();
  });
});

describe("the due pass as one tap", () => {
  test("the button says a pass is due; Due now is the popover's first row, and one tap is Given all, with Undo in the box", async () => {
    const device = await open();
    await expect.element(passDueButton()).toBeVisible();
    expect(passDueButton().element().querySelector("[data-quick-due-dot]")).not.toBeNull();
    await userEvent.click(passDueButton());
    await expect.element(suggestions()).toBeVisible();
    expect(dueChips()).toHaveLength(1);
    expect(dueChips()[0]!.textContent).toBe("Give evening meds (2)");
    // First: before the other rows of chips.
    const first = suggestions().element().querySelector("[data-quick-row]");
    expect(first?.getAttribute("data-quick-row")).toBe("due");

    await userEvent.click(dueChips()[0]!);
    await expect.element(suggestions()).not.toBeInTheDocument();
    await expect.poll(undoLabel).toBe("Evening logged");
    expect(document.querySelector("[data-quick-entry] [data-pass-undo]")).not.toBeNull();
    await expect.poll(async () => (await live(device)).length).toBe(2);
    // Nothing left in it, and nothing else to suggest: the button goes.
    await waitUntil(() => !suggestButton().query(), 4000, "the button to go");

    await userEvent.click(undoButton()!);
    await expect.poll(async () => (await live(device)).length).toBe(0);
    await expect.element(passDueButton()).toBeVisible();
  });

  test("not while typing", async () => {
    await open();
    await expect.element(passDueButton()).toBeVisible();
    await userEvent.fill(box(), "bp");
    await waitUntil(() => !suggestButton().query(), 4000, "the button to hide");
  });

  test("pass names are completed while typing", async () => {
    await open();
    await userEvent.fill(box(), "gave eve");
    const names = page.getByRole("list", { name: "Matching names" });
    await expect.element(names.getByRole("button", { name: "Evening" })).toBeVisible();
  });
});

describe("the runner", () => {
  test("a pass with nothing left to give refuses the whole batch, naming it", async () => {
    const device = await open();
    const now = new Date().toISOString();
    const first = await runActions(device.db, TEST_GROUP.id, [
      { type: "givePass", passId: EVENING.id, occurredAt: now },
    ]);
    expect(first.ok && first.byAction.map((ids) => ids.length)).toEqual([2]);
    const again = await runActions(device.db, TEST_GROUP.id, [
      { type: "addNote", text: "Round done", occurredAt: now },
      { type: "givePass", passId: EVENING.id, occurredAt: now },
    ]);
    expect(again).toMatchObject({ ok: false, index: 1, error: "Nothing is left to give in Evening." });
    const empty = await runActions(device.db, TEST_GROUP.id, [
      { type: "givePass", passId: NOON.id, occurredAt: now },
    ]);
    expect(empty).toMatchObject({ ok: false, index: 0, error: "Noon has no medications." });
    expect((await live(device)).map((r) => r.kind)).toEqual(["dose", "dose"]);
  });
});

describe("the due-pass chip", () => {
  test("a box with passChips off (simple mode, whose Upcoming block has Given all) offers none; the default box does", async () => {
    function Boxes() {
      return (
        <>
          <div data-boxes="plain">
            <QuickEntryBox groupId={TEST_GROUP.id} units={DEFAULT_UNITS} passChips={false} />
          </div>
          <div data-boxes="full">
            <QuickEntryBox groupId={TEST_GROUP.id} units={DEFAULT_UNITS} />
          </div>
        </>
      );
    }
    await renderWithDevice({
      route: [{ path: "/app/groups/:groupId/timeline", module: { default: Boxes } }],
      url: TIMELINE_URL,
      fixtures: [EVENING, NOON, LISINOPRIL, METFORMIN, METOPROLOL],
    });
    const button = (which: string) =>
      document.querySelector(`[data-boxes="${which}"] [data-quick-entry] button[aria-label^="Suggestions"]`);
    await waitUntil(() => !!button("full"), 4000, "the Suggestions button in the default box");
    expect(button("full")!.getAttribute("aria-label")).toBe(PASS_DUE);
    // Nothing else to suggest, and the due pass isn't offered: no button.
    expect(button("plain")).toBeNull();
  });
});
