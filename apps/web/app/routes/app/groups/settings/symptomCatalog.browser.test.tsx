import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsIndex from "./index/route";
import * as settingsLayout from "./layout/route";
import * as symptomsPage from "./symptoms/route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, symptomType, TEST_GROUP } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { NEEDS_CONNECTION } from "./groupSettings";

// The Symptoms page in group settings (symptom-catalog-2 slice 5): the
// group's symptoms A to Z with a live count of the live entries using each,
// then an Archived section; a merged symptom (a tombstone) isn't listed.
// Writers archive and unarchive through the API (the test's `api`
// handlers), and the row moves once the change syncs back; a viewer sees the
// lists only; offline, a tap says it needs a connection. Who may is
// groupSettings.test.ts's `symptomCatalogAccess`; what the server decides is
// syncSymptomTypes.int.test.ts's. Owners delete a symptom into another
// active one (symptom-catalog-3 slice 4): the dialog names both and how many
// entries move, `replace` runs online, and the row leaves once its tombstone
// syncs back.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: settingsLayout,
    children: [
      { path: BASE, id: "group-settings-index", module: settingsIndex },
      { path: `${BASE}/symptoms`, module: symptomsPage },
    ],
  },
];
const SETTINGS = `/app/groups/${TEST_GROUP.id}/settings`;
const SYMPTOMS = `${SETTINGS}/symptoms`;

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const NAUSEA = symptomType("Nausea");
const KNEE = symptomType("Sore knee");
const DIZZY = symptomType("Dizziness", { archivedAt: minutesAgo(60) });
const MERGED = symptomType("Head ache", { replacedById: symptomType("Headache").id });
const fixtures = [
  NAUSEA,
  KNEE,
  DIZZY,
  MERGED,
  fx.symptom({ occurredAt: minutesAgo(10), name: "Nausea", severity: 4 }),
  fx.symptom({ occurredAt: minutesAgo(20), name: "Nausea", severity: 2 }),
  // A deleted entry isn't counted.
  fx.symptom({ occurredAt: minutesAgo(30), name: "Nausea", deletedAt: minutesAgo(1) }),
  fx.symptom({ occurredAt: minutesAgo(40), name: "Dizziness", severity: 5 }),
];

const open = (
  role: GroupRole = "caretaker",
  api?: Record<string, (input: unknown) => unknown>,
  url = SYMPTOMS,
) => renderWithDevice({ route: ROUTES, url, role, fixtures, api });

const LIST = (which: "active" | "archived") =>
  document.querySelector<HTMLElement>(`main [data-symptom-list="${which}"]`);
const listed = (which: "active" | "archived") =>
  [...(LIST(which)?.querySelectorAll("[data-symptom-row]") ?? [])].map((r) =>
    [
      r.querySelector("[data-symptom-name]")?.textContent?.trim(),
      r.querySelector("[data-symptom-entries]")?.textContent?.trim(),
    ].join(" · "),
  );
const buttonsIn = (el: Element | null) => el?.querySelectorAll("button").length ?? 0;
const DIALOG = () => document.querySelector<HTMLDialogElement>("dialog[open]");

// A second spelling to delete into "Nausea", with two live entries.
const NAUSEOUS = symptomType("Nauseous");
const NAUSEOUS_ENTRIES = [
  { id: crypto.randomUUID(), occurredAt: minutesAgo(15), severity: 3 },
  { id: crypto.randomUUID(), occurredAt: minutesAgo(25), severity: 1 },
];
const nauseousEntries = (name: string) => NAUSEOUS_ENTRIES.map((v) => fx.symptom({ ...v, name }));
const openWithNauseous = (role: GroupRole, api?: Record<string, (input: unknown) => unknown>) =>
  renderWithDevice({
    route: ROUTES,
    url: SYMPTOMS,
    role,
    fixtures: [...fixtures, NAUSEOUS, ...nauseousEntries("Nauseous")],
    api,
  });

/** Opens Delete on "Nauseous" and picks "Nausea" to take its place. */
const deleteNauseousIntoNausea = async () => {
  await found(() => LIST("active"));
  await userEvent.click(page.getByRole("button", { name: "Delete Nauseous" }));
  await found(DIALOG);
  const confirm = page.getByRole("button", { name: "Delete symptom" });
  await expect.element(confirm).toBeDisabled();
  expect([...(DIALOG()?.querySelectorAll("option") ?? [])].map((o) => o.textContent)).toEqual([
    "Choose a symptom",
    "Nausea",
    "Sore knee",
  ]);
  await userEvent.selectOptions(page.getByRole("combobox", { name: "Replace with" }), "Nausea");
  return confirm;
};

describe("the Symptoms page", () => {
  test('the settings list shows "Symptoms", and it opens the page', async () => {
    const device = await open("owner", undefined, SETTINGS);
    const item = await found(() => document.querySelector<HTMLElement>('[data-settings-item="symptoms"]'));
    expect(item.textContent).toContain("Symptoms");
    await userEvent.click(item);
    await expect.poll(device.location).toBe(SYMPTOMS);
    await expect.element(page.getByRole("heading", { level: 1, name: "Symptoms" })).toBeVisible();
  });

  test("lists the active symptoms A to Z with live counts, then Archived; no merged symptom", async () => {
    const device = await open("viewer");
    await found(() => LIST("active"));
    expect(listed("active")).toEqual(["Nausea · 2 entries", "Sore knee · 0 entries"]);
    expect(listed("archived")).toEqual(["Dizziness · 1 entry"]);
    await expect.element(page.getByRole("heading", { name: "Archived" })).toBeVisible();
    expect(document.querySelector(`[data-symptom-row="${MERGED.id}"]`)).toBeNull();

    // Another device logs one: the count follows.
    await device.sync([fx.symptom({ occurredAt: minutesAgo(5), name: "Sore knee" })]);
    await device.settle();
    await expect.poll(() => listed("active")).toEqual(["Nausea · 2 entries", "Sore knee · 1 entry"]);
  });

  test("a caretaker archives one: it moves to Archived after sync, and Unarchive moves it back", async () => {
    const calls = apiCalls();
    const device = await open(
      "caretaker",
      calls.record({
        "timeline.symptomTypes.archive": () => ({ ...NAUSEA.row, archived_at: new Date().toISOString() }),
        "timeline.symptomTypes.unarchive": () => ({ ...NAUSEA.row, archived_at: null }),
      }),
    );
    await found(() => LIST("active"));

    await userEvent.click(page.getByRole("button", { name: "Archive Nausea" }));
    await expect
      .poll(() => calls.of("timeline.symptomTypes.archive"))
      .toEqual([{ groupId: TEST_GROUP.id, id: NAUSEA.id }]);
    await device.sync([symptomType("Nausea", { archivedAt: minutesAgo(0) })]);
    await device.settle();
    await expect.poll(() => listed("active")).toEqual(["Sore knee · 0 entries"]);
    expect(listed("archived")).toEqual(["Dizziness · 1 entry", "Nausea · 2 entries"]);

    await userEvent.click(page.getByRole("button", { name: "Unarchive Nausea" }));
    await expect
      .poll(() => calls.of("timeline.symptomTypes.unarchive"))
      .toEqual([{ groupId: TEST_GROUP.id, id: NAUSEA.id }]);
    await device.sync([symptomType("Nausea", { archivedAt: null })]);
    await device.settle();
    await expect.poll(() => listed("active")).toEqual(["Nausea · 2 entries", "Sore knee · 0 entries"]);
    expect(listed("archived")).toEqual(["Dizziness · 1 entry"]);
  });

  test("a viewer sees the lists with no controls", async () => {
    await open("viewer");
    await found(() => LIST("active"));
    expect(buttonsIn(LIST("active"))).toBe(0);
    expect(buttonsIn(LIST("archived"))).toBe(0);
  });

  test("offline, a tap says it needs a connection and nothing moves", async () => {
    await open("caretaker");
    await found(() => LIST("active"));
    await userEvent.click(page.getByRole("button", { name: "Archive Nausea" }));
    const row = LIST("active")!.querySelector(`[data-symptom-row="${NAUSEA.id}"]`)!;
    await expect.poll(() => row.textContent).toContain(NEEDS_CONNECTION);
    expect(listed("active")).toEqual(["Nausea · 2 entries", "Sore knee · 0 entries"]);
  });
});

describe("deleting a symptom", () => {
  test('an owner deletes "Nauseous" into "Nausea": the count moves, and the row leaves after sync', async () => {
    const calls = apiCalls();
    const device = await openWithNauseous(
      "owner",
      calls.record({ "timeline.symptomTypes.replace": () => ({ moved: 2 }) }),
    );
    expect(listed("active")).toEqual(["Nausea · 2 entries", "Nauseous · 2 entries", "Sore knee · 0 entries"]);

    const confirm = await deleteNauseousIntoNausea();
    expect(DIALOG()?.textContent).toContain("Delete “Nauseous”?");
    expect(DIALOG()?.textContent).toContain("The 2 entries logged as “Nauseous” move to “Nausea”");
    await userEvent.click(confirm);
    await expect
      .poll(() => calls.of("timeline.symptomTypes.replace"))
      .toEqual([{ groupId: TEST_GROUP.id, id: NAUSEOUS.id, replacementId: NAUSEA.id }]);
    await expect.poll(DIALOG).toBeNull();

    // The server's change syncs back: a tombstone, and its entries on "Nausea".
    await device.sync([symptomType("Nauseous", { replacedById: NAUSEA.id }), ...nauseousEntries("Nausea")]);
    await device.settle();
    await expect.poll(() => listed("active")).toEqual(["Nausea · 4 entries", "Sore knee · 0 entries"]);
  });

  test("a caretaker sees no Delete", async () => {
    await openWithNauseous("caretaker");
    await found(() => LIST("active"));
    expect(page.getByRole("button", { name: "Archive Nauseous" }).query()).not.toBeNull();
    expect(document.querySelector("[data-symptom-delete]")).toBeNull();
  });

  test("offline, the dialog says it needs a connection and nothing moves", async () => {
    await openWithNauseous("owner");
    const confirm = await deleteNauseousIntoNausea();
    await userEvent.click(confirm);
    await expect.poll(() => DIALOG()?.textContent).toContain(NEEDS_CONNECTION);
    expect(listed("active")).toEqual(["Nausea · 2 entries", "Nauseous · 2 entries", "Sore knee · 0 entries"]);
  });
});
