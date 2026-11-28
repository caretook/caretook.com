import type { DeviceRoute } from "../../../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { symptomTypeId } from "@caretook/data/schema";
import { at, fx, symptomType, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import * as entryRoute from "../entry/route";
import { chips as withChips } from "../providers/providerWorld";
import * as editSheet from "./edit/route";
import * as newDose from "./new-dose/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { rowWith, TIMELINE_URL } from "./timelineWorld";

// Quick entry on the timeline, on the test device (offline throughout): the
// box and its cards, alternatives, Remove, Edit into the usual sheets, Save
// (every card in one local transaction, queued for upload), blocked and
// unusual values, the user's units, viewers, and the runner refusing a
// batch whole.

const METFORMIN = fx.medication({ name: "Metformin", strength: "500 mg", dose: "1 tablet" });
const ACETAMINOPHEN = fx.medication({
  name: "Acetaminophen",
  strength: "500 mg",
  dose: "2 tablets",
  schedule: { type: "asNeeded", maxPerDay: 4 },
});
const LEE = fx.provider({ name: "Dr. Sandra Lee" });

/** Stands in for the entry page. */
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
      { path: "/app/groups/:groupId/timeline/:entryId/edit", module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: { default: EntryProbe } },
];

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    fixtures: [
      METFORMIN,
      ACETAMINOPHEN,
      LEE,
      fx.note({ occurredAt: at(new Date(Date.now() - 3_600_000)), text: "Older note" }),
    ],
    ...options,
  });

const box = () => page.getByRole("textbox", { name: "What happened?" });
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-quick-card]")];
const cardKinds = () => cards().map((c) => c.dataset.quickCard);
const cardWith = (text: string) => cards().find((c) => c.textContent?.includes(text))!;
const saveButton = () => document.querySelector<HTMLButtonElement>("[data-quick-entry] button[type=submit]");
/** What the box says: "Saved 3 entries" (on its Undo line) or a refusal. */
const status = () =>
  document.querySelector("[data-quick-entry] [data-pass-undo-label]")?.textContent ||
  (document.querySelector("[data-quick-status]")?.textContent ?? "");
/** Type a line and wait for its cards (with `kinds`, until they read as those: names match once the group's medications and providers have loaded). */
const type = async (text: string, kinds?: string[]) => {
  await userEvent.fill(box(), text);
  await waitUntil(() => (kinds ? cardKinds().join() === kinds.join() : cards().length > 0), "the cards");
};

afterEach(() => {
  clearUndo();
  localStorage.removeItem(`caretook:settings:${TEST_USER.id}`);
});

describe("a bare number at the strength with a usual dose of several units (B-662)", () => {
  const LINE = "gave acetaminophen 500";
  const doses = (device: Awaited<ReturnType<typeof open>>) =>
    device.query<{ details: string }>("SELECT details FROM timeline_entry WHERE kind = 'dose'");

  test("the caretaker is asked, nothing saves until they choose, and the chosen amount is recorded", async () => {
    const device = await open();
    await type(LINE, ["dose"]);
    await waitUntil(() => !!cards()[0]?.querySelector("[data-quick-blocking]"), "the question");
    await expect
      .poll(() => cards()[0]?.querySelector("[data-quick-blocking]")?.textContent)
      .toContain("Choose the amount");
    expect(saveButton()?.disabled).toBe(true);
    expect(await doses(device)).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "2 tablets", exact: true }));
    await waitUntil(() => !cards()[0]?.querySelector("[data-quick-blocking]"), "the choice");
    await expect.poll(() => cards()[0]?.textContent).toContain("Given 2 tablets");
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 entry");

    const saved = await doses(device);
    expect(saved).toHaveLength(1);
    expect(JSON.parse(saved[0]?.details ?? "null")).toMatchObject({
      medicationId: ACETAMINOPHEN.id,
      amount: "2 tablets",
    });
  });

  test("Edit opens the Dose sheet with the amount empty", async () => {
    await open();
    await type(LINE, ["dose"]);
    await waitUntil(() => !!cards()[0]?.querySelector("[data-quick-blocking]"), "the question");
    await userEvent.click(page.getByRole("button", { name: `Edit "${LINE}"` }));
    await expect.element(page.getByRole("textbox", { name: /Amount/ })).toHaveValue("");
  });
});

describe("symptoms and the group's catalog (symptom-catalog)", () => {
  const CATALOG = [symptomType("Nausea"), symptomType("Knee pain")];
  const typeId = (name: string) => symptomTypeId(TEST_GROUP.id, name);
  const openWithCatalog = () => open({ fixtures: [METFORMIN, ...CATALOG] });
  const gate = () => document.querySelector<HTMLElement>("[data-quick-card] [data-symptom-gate]");
  const symptomDefault = () =>
    document.querySelector<HTMLElement>("[data-quick-card] [data-symptom-default]");
  const defaultChoices = () =>
    [...(symptomDefault()?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim() ?? "");
  const saved = (device: Awaited<ReturnType<typeof open>>) =>
    device.query<{ name: string; symptom_type_id: string | null }>(
      `SELECT json_extract(details, '$.name') AS name, symptom_type_id FROM timeline_entry
        WHERE kind = 'symptom' AND deleted_at IS NULL`,
    );
  const catalogNames = async (device: Awaited<ReturnType<typeof open>>) =>
    (await device.query<{ name: string }>("SELECT name FROM symptom_type ORDER BY name_key")).map(
      (r) => r.name,
    );
  const queuedTypes = async (device: Awaited<ReturnType<typeof open>>) =>
    (await device.queued()).filter((w) => w.type === "symptom_type").map((w) => [w.op, w.data?.name]);

  test("an exact match takes the catalog's name and saves with no question", async () => {
    const device = await openWithCatalog();
    await type("KNEE   pain 4", ["symptom"]);
    await waitUntil(() => cardWith("Knee pain 4"), "the catalog's spelling");
    expect(gate()).toBeNull();
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await saved(device)).toEqual([{ name: "Knee pain", symptom_type_id: typeId("Knee pain") }]);
    expect(await catalogNames(device)).toEqual(["Knee pain", "Nausea"]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("a similar name saves as the closest one on Enter, unasked (symptom-catalog-2)", async () => {
    const device = await openWithCatalog();
    await type("knee pian 4", ["symptom"]);
    await expect.poll(() => symptomDefault()?.textContent).toContain("Saves as Knee pain");
    expect(defaultChoices()).toEqual(["Add “Knee pian” as new"]);
    expect(cardWith("Knee pain 4")).toBeTruthy();
    // No question: the box keeps focus and Save is open.
    expect(gate()).toBeNull();
    await expect.element(box()).toHaveFocus();
    expect(saveButton()?.disabled).toBe(false);

    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await saved(device)).toEqual([{ name: "Knee pain", symptom_type_id: typeId("Knee pain") }]);
    expect(await catalogNames(device)).toEqual(["Knee pain", "Nausea"]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test('"Add … as new" then Enter saves the name as typed, its catalog row in the same write', async () => {
    const device = await openWithCatalog();
    await type("knee pian 4", ["symptom"]);
    await userEvent.click(page.getByRole("button", { name: "Add “Knee pian” as new" }));
    await expect.poll(symptomDefault).toBeNull();
    expect(cardWith("Knee pian 4")).toBeTruthy();
    await userEvent.click(box());
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await saved(device)).toEqual([{ name: "Knee pian", symptom_type_id: typeId("Knee pian") }]);
    expect(await catalogNames(device)).toEqual(["Knee pain", "Knee pian", "Nausea"]);
    expect(await queuedTypes(device)).toEqual([["PUT", "Knee pian"]]);
  });

  test("tapping another similar name uses it", async () => {
    const device = await open({
      fixtures: [METFORMIN, symptomType("Lower back pain"), symptomType("Back pain")],
    });
    await type("back pain lower 3", ["symptom"]);
    await expect.poll(() => symptomDefault()?.textContent).toContain("Saves as Lower back pain");
    expect(defaultChoices()).toEqual(["Use Back pain", "Add “Back pain lower” as new"]);
    await userEvent.click(page.getByRole("button", { name: "Use Back pain" }));
    await expect.poll(symptomDefault).toBeNull();
    expect(cardWith("Back pain 3")).toBeTruthy();
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await saved(device)).toEqual([{ name: "Back pain", symptom_type_id: typeId("Back pain") }]);
    expect(await queuedTypes(device)).toEqual([]);
  });

  test("a name like nothing in the catalog saves at once, adding its row", async () => {
    const device = await openWithCatalog();
    await type("hiccups 2", ["symptom"]);
    expect(gate()).toBeNull();
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await saved(device)).toEqual([{ name: "Hiccups", symptom_type_id: typeId("Hiccups") }]);
    expect(await catalogNames(device)).toEqual(["Hiccups", "Knee pain", "Nausea"]);
  });
});

describe("the box and its cards", () => {
  test("a vital, a dose and a symptom: three cards, saved together, offline, on the timeline and queued for upload", async () => {
    const device = await open();
    await expect.element(box()).toBeVisible();
    await type("bp 130/85 hr 72, gave metformin, pain 4 left knee", ["vital", "dose", "symptom"]);
    expect(cardWith("BP 130/85").textContent).toContain("HR 72 bpm");
    expect(cardWith("Metformin 500 mg").textContent).toContain("Given 1 tablet");
    expect(cardWith("Pain 4").textContent).toContain("left knee");
    expect(saveButton()?.textContent).toBe("Save all 3");

    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 3 entries");
    expect(cards()).toEqual([]);
    await expect.element(box()).toHaveValue("");

    const saved = await device.query<{
      kind: string;
      details: string;
      body: string | null;
      created_by: string;
    }>(
      "SELECT kind, details, body, created_by FROM timeline_entry WHERE kind IN ('vital', 'dose', 'symptom') ORDER BY kind",
    );
    expect(saved.map((r) => r.kind)).toEqual(["dose", "symptom", "vital"]);
    expect(JSON.parse(saved[0]?.details ?? "null")).toMatchObject({
      medicationId: METFORMIN.id,
      status: "given",
      amount: "1 tablet",
    });
    expect(JSON.parse(saved[1]?.details ?? "null")).toEqual({ name: "Pain", severity: 4 });
    expect(saved[1]?.body).toBe("left knee");
    expect(JSON.parse(saved[2]?.details ?? "null")).toEqual({
      readings: [
        { type: "bloodPressure", systolic: 130, diastolic: 85 },
        { type: "heartRate", value: 72 },
      ],
    });
    expect(saved.every((r) => r.created_by === TEST_USER.id)).toBe(true);

    const queued = (await device.queued()).filter((w) => w.type === "timeline_entry");
    expect(queued.map((w) => w.op)).toEqual(["PUT", "PUT", "PUT"]);

    await waitUntil(() => !!rowWith("BP 130/85"), "the vital row");
    expect(rowWith("Pain")).toBeTruthy();
  });

  test("a note saves with its text as its document; an event with a provider opens as a draft", async () => {
    const device = await open();
    await type("Ann visited and brought soup");
    // "and" splits it: two cards, both notes.
    expect(cardKinds()).toEqual(["note", "note"]);
    await userEvent.fill(box(), "n: Ann visited and brought soup, appt dr lee tomorrow 2pm");
    await waitUntil(() => cards().length === 1);
    expect(cardKinds()).toEqual(["note"]);

    // Changed (quick-entry): a provider event isn't written here; it opens on the new-event page to finish.
    await userEvent.fill(box(), "appt dr lee tomorrow 2pm");
    await waitUntil(() => !!cards()[0]?.textContent?.includes("with Dr. Sandra Lee"), "the provider");
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(`/app/groups/${TEST_GROUP.id}/entries/new?kind=event`);
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'event'")).toEqual([]);
  });

  test("a note beside a vital is saved and stays on the timeline", async () => {
    const device = await open();
    await userEvent.fill(box(), "bp 120/80, n: Grandma had a good day");
    await waitUntil(() => cardKinds().join() === "vital,note");
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 2 entries");
    expect(device.location()).toBe(TIMELINE_URL);
    await waitUntil(() => !!rowWith("Grandma had a good day"), "the note's preview on the timeline");
  });

  test("an alternative chip switches a card's kind; Remove drops one card and keeps the rest", async () => {
    const device = await open();
    await type("bp 120/80, dizzy");
    expect(cardKinds()).toEqual(["vital", "symptom"]);
    const chips = page.getByRole("list", { name: 'Other ways to save "dizzy"' });
    await userEvent.click(chips.getByRole("button", { name: "Make it a note" }));
    await waitUntil(() => cardKinds().join() === "vital,note");
    expect(
      page
        .getByRole("list", { name: 'Other ways to save "dizzy"' })
        .getByRole("button", { name: "Make it a symptom" })
        .query(),
    ).toBeTruthy();

    await userEvent.click(page.getByRole("button", { name: 'Remove "bp 120/80"' }));
    await waitUntil(() => cardKinds().join() === "note");
    expect(saveButton()?.textContent).toBe("Save");
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toMatch(/\/entries\//);
    const kinds = await device.query<{ kind: string }>(
      "SELECT kind FROM timeline_entry WHERE created_at > ? ORDER BY kind",
      [at(new Date(Date.now() - 60_000))],
    );
    expect(kinds.map((k) => k.kind)).toEqual(["note"]);
  });

  test("a hard-limit value or a future time blocks that card's Save with its message; an unusual value warns but saves", async () => {
    const device = await open();
    await type("bp 1300/85");
    expect(cardWith("BP").querySelector("[data-quick-blocking]")?.textContent).toBe(
      "Systolic (top): enter a whole number from 40 to 300 mmHg.",
    );
    expect(saveButton()?.disabled).toBe(true);

    await userEvent.fill(box(), "bp 120/80 tomorrow");
    await waitUntil(() => !!cards()[0]?.querySelector("[data-quick-blocking]"));
    expect(cards()[0]?.querySelector("[data-quick-blocking]")?.textContent).toBe("Can't be in the future");
    expect(saveButton()?.disabled).toBe(true);

    await userEvent.fill(box(), "hr 140");
    await waitUntil(() => !!cards()[0]?.querySelector("[data-quick-notice]"));
    expect(cards()[0]?.querySelector("[data-quick-notice]")?.textContent).toBe(
      "Heart rate: that's unusual. Double-check it before saving.",
    );
    expect(saveButton()?.disabled).toBe(false);
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'vital'")).toHaveLength(1);
  });

  test("the user's units are used, and an explicit unit wins", async () => {
    localStorage.setItem(
      `caretook:settings:${TEST_USER.id}`,
      JSON.stringify({ units: { temperature: "c" } }),
    );
    const device = await open();
    await type("temp 37.5");
    expect(cards()[0]?.querySelector("[data-quick-title]")?.textContent).toBe("Temp 37.5 °C");
    await userEvent.fill(box(), "temp 99.5f");
    await waitUntil(() => cards()[0]?.querySelector("[data-quick-title]")?.textContent === "Temp 37.5 °C");
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 1 entry");
    const [row] = await device.query<{ details: string }>(
      "SELECT details FROM timeline_entry WHERE kind = 'vital'",
    );
    const value = (JSON.parse(row!.details) as { readings: { value: number }[] }).readings[0]!.value;
    expect(value).toBeCloseTo(37.5, 2);
  });

  test("names: the box and cards are named, and the cards announced politely once typing settles", async () => {
    await open();
    await type("gave metformin, pain 4", ["dose", "symptom"]);
    expect(page.getByRole("list", { name: "To save" }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: 'Edit "gave metformin"' }).query()).toBeTruthy();
    expect(page.getByRole("button", { name: 'Remove "pain 4"' }).query()).toBeTruthy();
    const live = document.querySelector("[data-quick-announce]")!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    await expect.poll(() => live.textContent).toBe("2 cards: Dose, Metformin 500 mg; Symptom, Pain 4");
    expect(document.querySelector("[data-quick-status]")?.getAttribute("role")).toBe("status");
  });

  test("viewers get no box", async () => {
    await open({ role: "viewer" });
    await waitUntil(() => !!rowWith("Older note"), "the timeline");
    expect(document.querySelector("[data-quick-entry]")).toBeNull();
  });
});

describe("the box never gets stuck", () => {
  const clearButton = () => page.getByRole("button", { name: "Clear", exact: true });

  test("remove a card, delete the text, type the line again: the card and Save are back and Enter saves", async () => {
    const device = await open();
    await type("bp 120/80", ["vital"]);
    await userEvent.click(page.getByRole("button", { name: 'Remove "bp 120/80"' }));
    await waitUntil(() => cards().length === 0, "the card to go");
    await userEvent.fill(box(), "");
    await expect.element(box()).toHaveValue("");

    await type("bp 120/80", ["vital"]);
    expect(saveButton()?.textContent).toBe("Save");
    await userEvent.click(box());
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'vital'")).toHaveLength(1);
  });

  test("with two parts, removing the second and editing the first keeps the second removed", async () => {
    await open();
    await type("bp 120/80, dizzy", ["vital", "symptom"]);
    await userEvent.click(page.getByRole("button", { name: 'Remove "dizzy"' }));
    await waitUntil(() => cardKinds().join() === "vital", "the second card to go");

    await userEvent.fill(box(), "bp 130/85, dizzy");
    await waitUntil(() => !!cards()[0]?.textContent?.includes("BP 130/85"), "the first card to change");
    expect(cardKinds()).toEqual(["vital"]);
  });

  test("with the only card removed and the text still there, Clear is shown and empties the box", async () => {
    await open();
    await expect.element(clearButton()).not.toBeInTheDocument();
    await type("bp 120/80", ["vital"]);
    await userEvent.click(page.getByRole("button", { name: 'Remove "bp 120/80"' }));
    await waitUntil(() => cards().length === 0, "the card to go");
    expect(saveButton()).toBeNull();

    await userEvent.click(clearButton());
    await expect.element(box()).toHaveValue("");
    await expect.element(clearButton()).not.toBeInTheDocument();
  });
});

describe("Edit", () => {
  test("a vital opens the vitals sheet filled in, and the card leaves the box", async () => {
    await open();
    await type("bp 130/85 hr 72 after lunch, pain 4");
    await userEvent.click(page.getByRole("button", { name: 'Edit "bp 130/85 hr 72 after lunch"' }));
    const dialog = page.getByRole("dialog", { name: "Add to the timeline" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole("spinbutton", { name: /Systolic/ })).toHaveValue(130);
    await expect.element(dialog.getByRole("spinbutton", { name: /Diastolic/ })).toHaveValue(85);
    await expect.element(dialog.getByRole("spinbutton", { name: /Heart rate/ })).toHaveValue(72);
    await expect
      .element(dialog.getByRole("textbox", { name: "Notes", exact: true }))
      .toHaveValue("after lunch");
    expect(cardKinds()).toEqual(["symptom"]);
  });

  test("a symptom opens the symptom sheet filled in", async () => {
    await open();
    await type("nausea 3/10 after breakfast");
    await userEvent.click(page.getByRole("button", { name: 'Edit "nausea 3/10 after breakfast"' }));
    const dialog = page.getByRole("dialog", { name: "Add to the timeline" });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole("combobox", { name: "Symptom" })).toHaveValue("Nausea");
    await expect
      .element(dialog.getByRole("textbox", { name: "Notes", exact: true }))
      .toHaveValue("after breakfast");
  });

  test("a dose opens the Dose sheet on its medication, with its status, amount and note", async () => {
    const device = await open();
    await type("refused 1 tablet acetaminophen spat it out", ["dose"]);
    await userEvent.click(page.getByRole("button", { name: /^Edit / }));
    const dialog = page.getByRole("dialog", { name: "Log a dose" });
    await expect.element(dialog).toBeVisible();
    await expect.poll(() => device.location()).toContain(`medication=${ACETAMINOPHEN.id}`);
    await expect.element(dialog.getByRole("radio", { name: "Refused" })).toBeChecked();
    await expect
      .element(dialog.getByRole("textbox", { name: "Amount", exact: true }))
      .toHaveValue("1 tablet");
    await expect
      .element(dialog.getByRole("textbox", { name: "Note", exact: true }))
      .toHaveValue("spat it out");
  });

  test("a note is saved and opens on its page, where it's written", async () => {
    const device = await open();
    await type("n: Called the pharmacy about the refill");
    await userEvent.click(page.getByRole("button", { name: /^Edit / }));
    await expect.element(page.getByRole("heading", { name: "Entry page" })).toBeVisible();
    const [note] = await device.query<{ id: string }>(
      "SELECT e.id FROM timeline_entry e JOIN note_update u ON u.document_id = e.id WHERE e.kind = 'note'",
    );
    expect(device.location()).toBe(`/app/groups/${TEST_GROUP.id}/entries/${note!.id}`);
  });
});

describe("open after save", () => {
  test("saving a lone note navigates to the new entry's page", async () => {
    const device = await open();
    await type("n: slept well", ["note"]);
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("heading", { name: "Entry page" })).toBeVisible();
    const [note] = await device.query<{ id: string }>(
      "SELECT id FROM timeline_entry WHERE kind = 'note' AND created_at > ?",
      [at(new Date(Date.now() - 60_000))],
    );
    expect(device.location()).toBe(`/app/groups/${TEST_GROUP.id}/entries/${note!.id}`);
  });

  test("saving a vital with a note stays on the timeline", async () => {
    const device = await open();
    await type("bp 120/80, n: tired", ["vital", "note"]);
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 2 entries");
    expect(device.location()).toBe(TIMELINE_URL);
  });
});

describe("the runner", () => {
  test("a refused action refuses the whole batch and leaves nothing", async () => {
    const device = await open();
    const before = await device.query("SELECT id FROM timeline_entry");
    const now = new Date().toISOString();
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "logVital", readings: [{ type: "heartRate", value: 70 }], occurredAt: now },
      { type: "logDose", medicationId: crypto.randomUUID(), status: "given", occurredAt: now },
    ]);
    expect(result).toMatchObject({
      ok: false,
      index: 1,
      error: "That medication is gone. It may have been deleted.",
    });
    expect(await device.query("SELECT id FROM timeline_entry")).toHaveLength(before.length);
    expect(await device.queued()).toEqual([]);

    const future = await runActions(device.db, TEST_GROUP.id, [
      { type: "logSymptom", name: "Pain", occurredAt: new Date(Date.now() + 3_600_000).toISOString() },
    ]);
    expect(future).toMatchObject({
      ok: false,
      index: 0,
      issues: [{ path: "occurredAt", message: "Can't be in the future" }],
    });
  });

  test("a medication deleted on another device while typing: the card reads the line again without it", async () => {
    const device = await open();
    await type("bp 120/80, gave metformin", ["vital", "dose"]);
    await device.sync([{ ...METFORMIN, row: { ...METFORMIN.row, deleted_at: at() }, with: [] }]);
    await waitUntil(() => cardKinds().join() === "vital,note", "the dose card to become a note");
    await userEvent.click(await found(saveButton));
    await expect.poll(status).toBe("Saved 2 entries");
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'dose'")).toEqual([]);
  });

  test("a viewer's batch is refused", async () => {
    const device = await open({ role: "viewer" });
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "addNote", text: "Hello", occurredAt: new Date().toISOString() },
    ]);
    expect(result).toMatchObject({ ok: false, index: null });
  });

  test("returns the new entries' ids, in order", async () => {
    const device = await open();
    const now = new Date().toISOString();
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "addNote", text: "One", occurredAt: now },
      { type: "logSymptom", name: "Tired", occurredAt: now },
    ]);
    expect(result.ok).toBe(true);
    const ids = result.ok ? result.ids : [];
    const rows = await device.query<{ id: string; kind: string }>(
      `SELECT id, kind FROM timeline_entry WHERE id IN (?, ?)`,
      ids,
    );
    expect(ids.map((id) => rows.find((r) => r.id === id)?.kind)).toEqual(["note", "symptom"]);
    // The entry is queued before its document and the document's text; a
    // new symptom name's catalog row before its entry (symptom-catalog).
    expect((await device.queued()).map((w) => w.type)).toEqual([
      "timeline_entry",
      "note_document",
      "note_update",
      "symptom_type",
      "timeline_entry",
    ]);
  });
});

describe("a note that mentions a provider (quick-entry slice 2)", () => {
  /** The timeline and the real entry page, so the note's mention and With row show. */
  const WITH_ENTRY: DeviceRoute[] = [
    ROUTES[0]!,
    { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
  ];
  const mentionChips = () =>
    [...document.querySelectorAll<HTMLElement>(".ProseMirror [data-mention]")].map((m) => ({
      id: m.dataset.mention!,
      text: m.textContent.trim(),
    }));

  test("'called dr lee about refill' saves a note mentioning Dr. Lee, linked in its With row", async () => {
    const device = await open({ route: WITH_ENTRY });
    await type("called dr lee about refill", ["note"]);
    // The mention reads once the group's providers have loaded.
    await waitUntil(() => !!cardWith("called @Dr. Sandra Lee about refill"), "the mention");
    expect(cardWith("called @Dr. Sandra Lee about refill").textContent).toContain("with Dr. Sandra Lee");

    await userEvent.click(await found(saveButton));
    // One note: its entry page opens.
    await waitUntil(() => mentionChips().length === 1, "the mention chip");
    expect(mentionChips()).toEqual([{ id: LEE.id, text: "Dr. Sandra Lee" }]);
    expect(document.querySelector(".ProseMirror")?.textContent).toBe("called Dr. Sandra Lee about refill");
    await waitUntil(() => withChips().length === 1, "the With chip");
    expect(withChips()[0]).toMatchObject({ id: LEE.id, text: "Dr. Sandra Lee" });

    const [note] = await device.query<{ id: string }>(
      "SELECT id FROM timeline_entry WHERE kind = 'note' AND id IN (SELECT entry_id FROM timeline_entry_provider)",
    );
    expect(note).toBeTruthy();
    const links = await device.query<{ provider_id: string }>(
      "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?",
      [note!.id],
    );
    expect(links.map((l) => l.provider_id)).toEqual([LEE.id]);
  });

  test("a provider that's gone refuses the note whole", async () => {
    const device = await open();
    const before = await device.query("SELECT id FROM timeline_entry");
    const result = await runActions(device.db, TEST_GROUP.id, [
      {
        type: "addNote",
        text: "Called",
        occurredAt: new Date().toISOString(),
        providerIds: [crypto.randomUUID()],
      },
    ]);
    expect(result).toMatchObject({
      ok: false,
      index: 0,
      error: "That provider is gone. It may have been deleted.",
    });
    expect(await device.query("SELECT id FROM timeline_entry")).toHaveLength(before.length);
  });
});

describe("provider events open a prefilled draft (quick-entry slice 3)", () => {
  const ADDRESS = "400 Example Ave, Springfield";
  const ALVAREZ = fx.provider({ name: "Dr. Elena Alvarez", address: ADDRESS });
  const NEW_EVENT = `/app/groups/${TEST_GROUP.id}/entries/new?kind=event`;
  const WITH_ENTRY_PAGE: DeviceRoute[] = [
    ROUTES[0]!,
    { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
  ];
  const openWithPage = () =>
    renderWithDevice({ route: WITH_ENTRY_PAGE, url: TIMELINE_URL, fixtures: [METFORMIN, LEE, ALVAREZ] });
  type Device = Awaited<ReturnType<typeof openWithPage>>;
  const TITLE = () => document.querySelector<HTMLInputElement>("main header input");
  const HEADER_TIME = () => document.querySelector<HTMLTimeElement>("main header time");
  const PLACE = () => document.querySelector<HTMLInputElement>('main [data-region="place"] input');
  const chipNames = () =>
    [...document.querySelectorAll('main header [data-region="with"] li[data-chip]')].map((li) =>
      li.textContent.trim(),
    );
  const backToTimeline = () =>
    [...document.querySelectorAll<HTMLAnchorElement>("main a")].find((a) =>
      a.textContent?.includes("Timeline"),
    );
  const events = (device: Device) =>
    device.query<{ id: string; title: string; all_day: number; place: string | null }>(
      "SELECT id, title, all_day, place FROM timeline_entry WHERE kind = 'event' AND deleted_at IS NULL",
    );
  const linksOf = async (device: Device, entryId: string) =>
    (
      await device.query<{ provider_id: string }>(
        "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?",
        [entryId],
      )
    ).map((r) => r.provider_id);
  const undoButton = () =>
    document.querySelector<HTMLButtonElement>("[data-quick-entry] [data-pass-undo-button]");

  test('"Dr. Elena Alvarez on the 25th": the card says it opens to finish; Save opens the new-event page filled in, writing nothing', async () => {
    const device = await openWithPage();
    await type("Dr. Elena Alvarez on the 25th", ["event"]);
    await waitUntil(
      () => !!cardWith("Dr. Elena Alvarez").querySelector("[data-quick-opens-draft]"),
      "the draft line",
    );
    expect(cardWith("Dr. Elena Alvarez").querySelector("[data-quick-opens-draft]")?.textContent).toMatch(
      /^Opens to finish · Dr\. Elena Alvarez · .*25/,
    );
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(NEW_EVENT);
    await expect.poll(() => TITLE()?.value).toBe("Dr. Elena Alvarez");
    await expect.poll(() => HEADER_TIME()?.textContent ?? "").toMatch(/25.*All day|All day.*25/);
    await expect.poll(chipNames).toEqual(["Dr. Elena Alvarez"]);
    await expect.poll(() => PLACE()?.value).toBe(ADDRESS);
    expect(await events(device)).toEqual([]);
    expect(await device.queued()).toEqual([]);

    // Back leaves no entry, and no Undo: nothing was written.
    await userEvent.click(await found(backToTimeline));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.element(box()).toHaveValue("");
    expect(status()).toBe("");
    expect(await events(device)).toEqual([]);

    // Saving on the page writes one event linked to the provider.
    await type("Dr. Elena Alvarez on the 25th", ["event"]);
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(NEW_EVENT);
    await userEvent.click(await found(() => document.querySelector<HTMLElement>(".ProseMirror")));
    await userEvent.keyboard("Questions about the new pills");
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    const saved = await events(device);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: "Dr. Elena Alvarez", all_day: 1, place: ADDRESS });
    await expect.poll(() => linksOf(device, saved[0]!.id)).toEqual([ALVAREZ.id]);
  });

  test('"bp 130/85, Dr. Lee friday 2pm": saves the BP with Undo on the box\'s line, then opens the draft; Undo removes the BP', async () => {
    const device = await openWithPage();
    await type("bp 130/85, Dr. Lee friday 2pm", ["vital", "event"]);
    expect(cardWith("BP 130/85").querySelector("[data-quick-opens-draft]")).toBeNull();
    await waitUntil(() => !!cardWith("Dr. Sandra Lee").querySelector("[data-quick-opens-draft]"));
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(NEW_EVENT);
    await expect.poll(chipNames).toEqual(["Dr. Sandra Lee"]);
    const vitals = () =>
      device.query<{ id: string; deleted_at: string | null }>(
        "SELECT id, deleted_at FROM timeline_entry WHERE kind = 'vital'",
      );
    expect((await vitals()).map((v) => v.deleted_at)).toEqual([null]);
    expect(await events(device)).toEqual([]);

    await userEvent.click(await found(backToTimeline));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.poll(status).toBe("Saved 1 entry");
    await userEvent.click(await found(undoButton));
    await expect.poll(async () => (await vitals())[0]?.deleted_at ?? null).not.toBeNull();
    expect(await events(device)).toEqual([]);
  });

  test("a second provider event in the line is written directly, with its provider; only the first opens", async () => {
    const device = await openWithPage();
    await type("Dr. Lee friday 2pm, Alvarez tomorrow 3pm", ["event", "event"]);
    await waitUntil(() => !!cardWith("Dr. Sandra Lee").querySelector("[data-quick-opens-draft]"));
    expect(cardWith("Dr. Elena Alvarez").querySelector("[data-quick-opens-draft]")).toBeNull();
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(NEW_EVENT);
    await expect.poll(chipNames).toEqual(["Dr. Sandra Lee"]);
    const saved = await events(device);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.title).toBe("Dr. Elena Alvarez");
    expect(await linksOf(device, saved[0]?.id ?? "")).toEqual([ALVAREZ.id]);
    const docs = await device.query("SELECT id FROM note_document WHERE id = ?", [saved[0]!.id]);
    expect(docs).toHaveLength(1);
  });

  test("Edit on a provider event opens its draft too, writing nothing", async () => {
    const device = await openWithPage();
    await type("Alvarez tomorrow 3pm", ["event"]);
    // It opens as a draft once the group's providers have loaded; before that it's a plain event.
    await waitUntil(
      () => !!cardWith("Dr. Elena Alvarez")?.querySelector("[data-quick-opens-draft]"),
      "the draft line",
    );
    await userEvent.click(page.getByRole("button", { name: 'Edit "Alvarez tomorrow 3pm"' }));
    await expect.poll(() => device.location()).toBe(NEW_EVENT);
    await expect.poll(() => TITLE()?.value).toBe("Dr. Elena Alvarez");
    expect(await events(device)).toEqual([]);
  });
});

describe("kind chips", () => {
  test("'fell' shows Symptom with Event and Note one tap away; Make it a note saves a note", async () => {
    const device = await open();
    await type("fell", ["symptom"]);
    const card = () => cards()[0]!;
    expect(card().querySelector("[data-quick-kind]")?.textContent).toBe("Symptom");
    const choices = page.getByRole("list", { name: 'Other ways to save "fell"' });
    expect(choices.getByRole("button", { name: "Make it an event" }).query()).toBeTruthy();
    // Reachable by Tab, in order, from the card's first control.
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('ul[aria-label^="Other ways"] button')];
    expect(buttons.map((b) => b.textContent).sort()).toEqual(["Make it a note", "Make it an event"]);
    await userEvent.click(choices.getByRole("button", { name: "Make it a note" }));
    await waitUntil(() => cardKinds().join() === "note");
    expect(cards()[0]?.querySelector("[data-quick-kind]")?.textContent).toBe("Note");
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toMatch(/\/entries\//);
    const kinds = await device.query<{ kind: string }>(
      "SELECT kind FROM timeline_entry WHERE created_at > ? ORDER BY kind",
      [at(new Date(Date.now() - 60_000))],
    );
    expect(kinds.map((k) => k.kind)).toEqual(["note"]);
  });
});

describe("go to a day", () => {
  const goCard = () => document.querySelector<HTMLElement>("[data-quick-goto]");
  const goButton = () => page.getByRole("button", { name: "Go", exact: true });
  const recentLines = () => localStorage.getItem(`caretook:recentLines:${TEST_USER.id}:${TEST_GROUP.id}`);
  const entryCount = async (device: Awaited<ReturnType<typeof open>>) =>
    (await device.query<{ n: number }>("SELECT count(*) AS n FROM timeline_entry"))[0]?.n;

  test("the card goes to the day, writes nothing, records no line and clears the box", async () => {
    const device = await open();
    const before = await entryCount(device);
    const recentBefore = recentLines();
    await userEvent.fill(box(), "go to Jun 1");
    await expect.poll(() => goCard()?.dataset.quickGoto).toBe("2027-06-01");
    expect(cards()).toEqual([]);

    await userEvent.click(goButton());
    await expect.poll(device.location).toBe(`${TIMELINE_URL}?day=2027-06-01`);
    await expect.element(box()).toHaveValue("");
    await device.settle();
    expect(await entryCount(device)).toBe(before);
    expect(await device.queued()).toEqual([]);
    expect(recentLines()).toBe(recentBefore);
  });

  test("Enter goes too", async () => {
    const device = await open();
    await userEvent.fill(box(), "show yesterday");
    await expect.poll(() => goCard()?.dataset.quickGoto).toBe("2027-06-08");
    await userEvent.keyboard("{Enter}");
    await expect.poll(device.location).toBe(`${TIMELINE_URL}?day=2027-06-08`);
  });

  test("a day ahead is blocked: no navigation and nothing saved", async () => {
    const device = await open();
    const before = await entryCount(device);
    await userEvent.fill(box(), "go to tomorrow");
    await expect.poll(() => goCard()?.textContent).toContain("The timeline ends today.");
    await expect.element(goButton()).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    await device.settle();
    expect(device.location()).toBe(TIMELINE_URL);
    await expect.element(box()).toHaveValue("go to tomorrow");
    expect(await entryCount(device)).toBe(before);
  });

  test("a line that only mentions going somewhere keeps its save cards", async () => {
    await open();
    await userEvent.fill(box(), "go to PT tomorrow");
    await waitUntil(() => cards().length > 0, "the cards");
    expect(goCard()).toBeNull();
    expect(saveButton()?.textContent).toContain("Save");
  });
});

describe("the card's reading is a button that saves (B-676)", () => {
  const cardButton = (card: HTMLElement) => card.querySelector<HTMLButtonElement>("[data-quick-save-card]")!;

  test("clicking a card's reading saves the whole line as Enter does, and its name says what it adds", async () => {
    const device = await open();
    await type("bp 130/85, gave metformin", ["vital", "dose"]);
    const dose = page.getByRole("button", { name: "Add all 2, with Dose: Metformin 500 mg", exact: true });
    await expect.element(dose).toBeEnabled();
    await expect
      .element(page.getByRole("button", { name: "Add all 2, with Vital: BP 130/85 mmHg", exact: true }))
      .toBeVisible();

    await userEvent.click(dose);
    await expect.poll(status).toBe("Saved 2 entries");
    expect(cards()).toEqual([]);
    const kinds = await device.query<{ kind: string }>(
      "SELECT kind FROM timeline_entry WHERE kind IN ('vital', 'dose') ORDER BY kind",
    );
    expect(kinds.map((k) => k.kind)).toEqual(["dose", "vital"]);
    expect(device.location()).toBe(TIMELINE_URL);
  });

  test("a lone card's button is named Add and opens what it saved, as Enter does", async () => {
    const device = await open();
    await type("n: Grandma had a good day", ["note"]);
    await userEvent.click(
      page.getByRole("button", { name: "Add Note: Grandma had a good day", exact: true }),
    );
    await expect.poll(() => device.location()).toMatch(/\/entries\//);
  });

  test("a blocked card's button is disabled; Remove, Edit and the chips sit outside it and still work", async () => {
    const device = await open();
    await type("bp 1300/85, dizzy", ["vital", "symptom"]);
    const blocked = cardWith("BP");
    await waitUntil(() => !!blocked.querySelector("[data-quick-blocking]"), "the block");
    // Save waits for every card, so both readings' buttons wait.
    expect(cardButton(blocked).disabled).toBe(true);
    expect(cardButton(cardWith("Dizzy")).disabled).toBe(true);

    // None of the card's other buttons is inside its reading.
    for (const card of cards()) expect(cardButton(card).querySelector("button, a, [role=button]")).toBeNull();

    // The chips only switch the reading.
    const chips = page.getByRole("list", { name: 'Other ways to save "dizzy"' });
    await userEvent.click(chips.getByRole("button", { name: "Make it a note" }));
    await waitUntil(() => cardKinds().join() === "vital,note");
    expect(
      await device.query("SELECT id FROM timeline_entry WHERE kind = 'note' AND body = 'dizzy'"),
    ).toEqual([]);

    // Remove drops the blocked card; the other's button now saves.
    await userEvent.click(page.getByRole("button", { name: 'Remove "bp 1300/85"' }));
    await waitUntil(() => cardKinds().join() === "note");
    await expect.poll(() => cards().map((c) => cardButton(c).disabled)).toEqual([false]);

    // Edit is its own button: a note's Edit saves it and opens its page.
    await userEvent.click(page.getByRole("button", { name: 'Edit "dizzy"' }));
    await expect.poll(() => device.location()).toMatch(/\/entries\//);
  });
});
