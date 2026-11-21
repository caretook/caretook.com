import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as newDose from "./new-dose/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { TIMELINE_URL, waitUntil } from "./timelineWorld";

// Simple mode's tiles (assistant slice 6), on the test device and offline:
// which four show for each of the group's choices (learned from use, the
// fixed set, four picked), their labels about the recipient, the first-run
// link to choose them, and each tile's simple sheet saving an entry locally. The choices
// themselves are group settings Details' (simpleTiles.browser.test.tsx);
// learnedTiles and the labels have unit tests (lib/assistant/simpleTiles.test.ts).

/** Stands in for the note page a note tile opens. */
function EntryProbe() {
  return <h1>Entry page</h1>;
}

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [
      { path: "/app/groups/:groupId/timeline/new/dose", module: newDose },
      { path: "/app/groups/:groupId/timeline/new/:kind", module: newSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: { default: EntryProbe } },
];

const METFORMIN = fx.medication({ name: "Metformin", strength: "500 mg", dose: "1 tablet" });

const open = ({
  role = "caretaker",
  simpleTiles = null,
  pronouns = "she/her",
  entries = [],
}: {
  role?: GroupRole;
  simpleTiles?: object | null;
  pronouns?: string | null;
  entries?: ReturnType<typeof fx.note>[];
} = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    role: null,
    fixtures: [
      fx.member({ userId: TEST_USER.id, role, simpleMode: 1 }),
      fx.group({ simpleTiles: simpleTiles ? JSON.stringify(simpleTiles) : null }),
      fx.recipient({ pronouns }),
      METFORMIN,
      ...entries,
    ],
  });

const tiles = () => [...document.querySelectorAll<HTMLAnchorElement>("[data-tile]")];
const tileLabels = () => tiles().map((t) => t.textContent?.trim());
const hint = () => document.querySelector("[data-tiles-hint]")?.textContent?.trim() ?? null;
/** The tiles, once the recipient's pronouns have loaded (labels use their name until then). */
const ready = () =>
  waitUntil(() => tiles().length === 4 && !tileLabels().join().includes("June"), 4000, "the tiles");
const queuedEntries = async (device: Awaited<ReturnType<typeof open>>) =>
  (await device.queued()).filter((w) => w.type === "timeline_entry");

const FIXED = ["How she feels", "Blood pressure", "Her medicines", "A note about her day"];

describe("the row", () => {
  test("two by two at phone width, each a 44 px target at least", async () => {
    await open();
    await ready();
    const tops = tiles().map((t) => t.getBoundingClientRect().top);
    expect(new Set(tops).size).toBe(2);
    expect(tops.filter((top) => top === tops[0])).toHaveLength(2);
    for (const t of tiles()) expect(t.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});

describe("which tiles", () => {
  test("a new group's are learned: the fixed set until something is logged, and a member sees no hint or link", async () => {
    await open();
    await ready();
    expect(tileLabels()).toEqual(FIXED);
    expect(hint()).toBeNull();
    expect(page.getByRole("link", { name: "Choose the tiles" }).elements()).toHaveLength(0);
  });

  test("learned from the last 30 days: the most-logged first, padded with the fixed set", async () => {
    const sugar = (h: number) =>
      fx.vital({ readings: [{ type: "bloodGlucose", value: 120 }], occurredAt: hoursAgo(h) });
    await open({
      pronouns: null,
      entries: [sugar(2), sugar(5), sugar(30), fx.symptom({ occurredAt: hoursAgo(3) }), sugar(24 * 40)],
    });
    await waitUntil(() => tileLabels()[0] === "Blood sugar", 4000, "the learned tiles");
    // Without pronouns, the labels use the recipient's name.
    expect(tileLabels()).toEqual([
      "Blood sugar",
      "How Grandma June feels",
      "Blood pressure",
      "Grandma June's medicines",
    ]);
  });

  test("an owner gets only the way to choose them, with no hint text", async () => {
    await open({ role: "owner" });
    await ready();
    await expect
      .element(page.getByRole("link", { name: "Choose the tiles" }))
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/settings/details`);
    expect(hint()).toBe("Choose the tiles");
  });

  test("the fixed set, or four picked, and no hint once someone has chosen", async () => {
    const device = await open({ simpleTiles: { mode: "fixed" } });
    await ready();
    expect(tileLabels()).toEqual(FIXED);
    expect(hint()).toBeNull();

    // Another device picks four; the tiles follow without a reload.
    await device.sync(
      fx.group({
        simpleTiles: JSON.stringify({
          mode: "custom",
          tiles: [
            { kind: "vital", vitalType: "bloodGlucose" },
            { kind: "dose" },
            { kind: "vital", vitalType: "weight" },
            { kind: "symptom" },
          ],
        }),
      }),
    );
    await waitUntil(() => tileLabels()[0] === "Blood sugar", 4000, "the picked tiles");
    expect(tileLabels()).toEqual(["Blood sugar", "Her medicines", "Weight", "How she feels"]);
  });
});

describe("each tile's sheet saves an entry, offline", () => {
  test("How she feels: the 0–10 face scale, saved as a symptom named Feeling", async () => {
    const device = await open();
    await ready();
    await userEvent.click(page.getByRole("link", { name: "How she feels" }));
    const sheet = page.getByRole("dialog", { name: "How she feels" });
    await expect.element(sheet).toBeVisible();
    // The scale, its numbers and words, and nothing else to pick.
    const scale = sheet.getByRole("radiogroup", { name: "How she feels" });
    expect(scale.getByRole("radio").elements()).toHaveLength(11);
    expect(sheet.getByRole("button", { name: /^Vitals|^Symptom$/ }).elements()).toHaveLength(0);
    expect(sheet.getByRole("textbox", { name: "Notes (optional)" }).elements()).toHaveLength(0);
    // The radio itself is hidden under its face; a tap lands on the face.
    await userEvent.click(scale.getByRole("radio", { name: "4, unwell" }), { force: true });
    await expect.element(scale.getByRole("radio", { name: "4, unwell" })).toBeChecked();
    await userEvent.click(sheet.getByRole("button", { name: "Add to timeline" }));

    await expect.poll(async () => (await queuedEntries(device)).length).toBe(1);
    const [saved] = await queuedEntries(device);
    expect(saved!.data).toMatchObject({ kind: "symptom" });
    expect(JSON.parse(saved!.data!.details as string)).toEqual({ name: "Feeling", severity: 4 });
    await waitUntil(() => !document.querySelector('[role="dialog"]'), 4000, "the sheet to close");
  });

  test("a vital: only that type's fields, saved as a vital", async () => {
    const device = await open();
    await ready();
    await userEvent.click(page.getByRole("link", { name: "Blood pressure" }));
    const sheet = page.getByRole("dialog", { name: "Blood pressure" });
    await expect.element(sheet).toBeVisible();
    expect(sheet.getByRole("button", { name: "+ Add a reading" }).elements()).toHaveLength(0);
    await userEvent.fill(sheet.getByRole("spinbutton", { name: /Systolic/ }), "128");
    await userEvent.fill(sheet.getByRole("spinbutton", { name: /Diastolic/ }), "82");
    await userEvent.click(sheet.getByRole("button", { name: "Add to timeline" }));

    await expect.poll(async () => (await queuedEntries(device)).length).toBe(1);
    const [saved] = await queuedEntries(device);
    expect(JSON.parse(saved!.data!.details as string)).toEqual({
      readings: [{ type: "bloodPressure", systolic: 128, diastolic: 82 }],
    });
  });

  test("her medicines: the Dose sheet, saved as a dose", async () => {
    const device = await open();
    await ready();
    await userEvent.click(page.getByRole("link", { name: "Her medicines" }));
    const sheet = page.getByRole("dialog", { name: "Log a dose" });
    await expect.element(sheet).toBeVisible();
    await userEvent.click(sheet.getByRole("button", { name: /^Log (dose|anyway)$/ }));
    await expect.poll(async () => (await queuedEntries(device)).length).toBe(1);
    const [saved] = await queuedEntries(device);
    expect(saved!.data).toMatchObject({ kind: "dose" });
    expect(JSON.parse(saved!.data!.details as string)).toMatchObject({ medicationId: METFORMIN.id });
  });

  test("a note: opens a new note's page", async () => {
    await open();
    await ready();
    await expect
      .element(page.getByRole("link", { name: "A note about her day" }))
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/entries/new?kind=note`);
  });
});
