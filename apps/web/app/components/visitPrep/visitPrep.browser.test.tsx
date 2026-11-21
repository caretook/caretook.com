import type { Fixture } from "../../../test/fixtures";

import { buildNoteDoc, NOTE_FRAGMENT, toBase64 } from "@caretook/data/schema";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../test/found";
import * as Y from "yjs";
import { renderWithDevice } from "../../../test/device";
import { at, fx, hoursAgo, newId, TEST_GROUP, TEST_USER } from "../../../test/fixtures";
import * as entryRoute from "../../routes/app/groups/entry/route";
import * as providerRoute from "../../routes/app/groups/provider/route";
import * as plannerRoute from "../../routes/app/groups/planner/route";

// Visit prep on the test device: "Prepare for this visit" on an upcoming
// appointment's page, "Prepare for a visit" on a provider's page (their next
// appointment, or an offer to add one), and Prepare in the Planner's ⋯; the
// sheet (the window since the last visit, an editable start, the preview,
// empty sections left out), Insert offline (queued for upload), a rerun
// above the first, and another device typing at the same time. The section's
// wording is visitPrep.test.ts's; the Yjs merge is noteYjs.test.ts's.

const GROUP = TEST_GROUP.id;
const entryPath = (id: string) => `/app/groups/${GROUP}/entries/${id}`;
const ROUTES = [
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
  { path: "/app/groups/:groupId/providers/:providerId", module: providerRoute },
  { path: "/app/groups/:groupId/planner", module: plannerRoute },
];

const DAY_H = 24;
const ahead = (hours: number) => at(new Date(Date.now() + hours * 3_600_000));

const LARK = fx.provider({ name: "Dr. Mira Lark" });
const ORTIZ = fx.provider({ name: "Dr. Ben Ortiz", specialty: "Cardiology" });
const LAST = fx.event({ title: "Checkup with Dr. Lark", occurredAt: hoursAgo(20 * DAY_H) });
const CANCELLED = fx.event({
  title: "Follow-up",
  occurredAt: hoursAgo(5 * DAY_H),
  cancelledAt: hoursAgo(6 * DAY_H),
});
const APPT = fx.event({
  title: "Visit with Dr. Lark",
  occurredAt: ahead(3 * DAY_H),
  text: "Bring the pill box",
});
const PAST_EVENT = fx.event({ title: "Fell in the hallway", occurredAt: hoursAgo(10 * DAY_H) });
/** Lisinopril at 8:00 every day; two days ago's was refused, the rest never logged (missed). */
const LISINOPRIL = fx.medication();
const REFUSED = fx.dose({
  medicationId: LISINOPRIL.id,
  status: "refused",
  scheduledFor: "08:00",
  occurredAt: hoursAgo(2 * DAY_H),
});

const world = () => [
  fx.person({ name: "Ria Patel", role: "viewer" }),
  LARK,
  ORTIZ,
  LAST,
  fx.link(LAST.id, LARK.id),
  CANCELLED,
  fx.link(CANCELLED.id, LARK.id),
  APPT,
  fx.link(APPT.id, LARK.id),
  PAST_EVENT,
  fx.symptom({ name: "Dizziness", severity: 6, occurredAt: hoursAgo(3 * DAY_H) }),
  // Before the last visit: not in the section.
  fx.symptom({ name: "Cough", severity: 2, occurredAt: hoursAgo(25 * DAY_H) }),
  fx.vital({ readings: [{ type: "heartRate", value: 78 }], occurredAt: hoursAgo(2 * DAY_H) }),
  LISINOPRIL,
  REFUSED,
];

const open = (url: string, options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: ROUTES, url, fixtures: world(), ...options });

// --- DOM helpers ---------------------------------------------------------------
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const SHEET = () => $("[data-visit-prep-sheet]");
const PREVIEW = () => $("[data-visit-prep-preview]")?.textContent ?? "";
const EDITOR = () => $(".ProseMirror");
const PREPARE = () => $<HTMLButtonElement>("[data-prepare-visit]");
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text);
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitUntil = async (test: () => boolean, ms = 8000, what = "condition") => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return;
    await pause(25);
  }
  throw new Error(`timed out waiting for ${what}`);
};
const waitFor = async <T,>(get: () => T | null) => {
  await waitUntil(() => !!get(), 8000);
  return get();
};
const GRID = () => $("[role=grid]");
/** In the open calendar, pick the day `days` from today (as entry.browser.test.tsx does). */
const pickDayAhead = async (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const heading = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  await waitUntil(() => !!GRID(), 4000, "the calendar");
  const calHeading = () => GRID()!.closest("[role=dialog]")!.querySelector("h2")!.textContent.trim();
  if (calHeading() !== heading)
    await userEvent.click(
      await found(() => GRID()?.closest("[role=dialog]")?.querySelector('[aria-label="Next month"]')),
    );
  await waitUntil(() => calHeading() === heading);
  const cell = [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
    (c) => c.textContent?.trim() === String(d.getDate()) && !c.hasAttribute("data-outside-month"),
  )!;
  await userEvent.click(cell);
  await waitUntil(() => !GRID(), 3000, "the calendar to close");
};
const previewReady = () => waitUntil(() => PREVIEW().includes("Since your last visit"), 8000, "the preview");
const editorLines = () =>
  [...(EDITOR()?.querySelectorAll("h2, h3, p") ?? [])].map((el) => el.textContent ?? "");
const insert = async () => {
  await userEvent.click(button("Insert into the notes")!);
  await waitUntil(() => !SHEET(), 4000, "the sheet to close");
};

/** Another device's typing in a document, as a note_update row arriving by sync (built on what it had). */
const typedElsewhere = (documentId: string, snapshotText: Y.Doc, words: string): Fixture => {
  const doc = buildNoteDoc(toBase64(Y.encodeStateAsUpdate(snapshotText)));
  const before = Y.encodeStateVector(doc);
  const root = doc.getXmlFragment(NOTE_FRAGMENT);
  const p = new Y.XmlElement("paragraph");
  root.insert(root.length, [p]);
  const t = new Y.XmlText();
  p.insert(0, [t]);
  t.insert(0, words);
  const id = newId();
  return {
    table: "note_update",
    id,
    row: {
      id,
      group_id: GROUP,
      document_id: documentId,
      data: toBase64(Y.encodeStateAsUpdate(doc, before)),
      created_at: at(),
      created_by: TEST_USER.id,
    },
  };
};

describe("on the appointment's page", () => {
  test("Prepare opens the sheet from the last visit; the preview leaves out empty sections; Insert (offline) puts it on top and queues it", async () => {
    const device = await open(entryPath(APPT.id), { role: "caretaker" });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Bring the pill box"));
    await userEvent.click(await found(PREPARE));
    await waitUntil(() => !!SHEET(), 4000, "the sheet");
    expect(document.querySelector("[role=dialog] h2, [role=dialog] [slot=title]")?.textContent).toBe(
      "Prepare for Visit with Dr. Lark",
    );
    await previewReady();
    expect($("[data-visit-window]")!.textContent).toMatch(/^From the last visit: Checkup with Dr\. Lark, /);
    const preview = PREVIEW();
    for (const text of [
      "Dizziness: once, worst 6/10, new",
      "Heart rate: 1 reading, 78 bpm, average 78 bpm",
      "Fell in the hallway",
      "Lisinopril 10 mg · 1 tablet",
      "Missed doses",
    ])
      expect(preview).toContain(text);
    // The window's missed-dose count (the slot rules of what's due, over the window).
    expect(preview).toMatch(/Lisinopril 10 mg: \d+ missed, 1 refused \(of \d+\)/);
    // The cancelled visit, the last visit itself, and what came before it are left out; so is an empty section.
    for (const text of ["Cough", "Follow-up", "Checkup", "Hospital and other stays", "Medication changes"])
      expect(preview).not.toContain(text);

    await insert();
    await waitUntil(
      () => editorLines()[0]?.startsWith("Since your last visit · ") ?? false,
      4000,
      "the section",
    );
    const lines = editorLines();
    expect(lines).toContain("Symptoms");
    expect(lines.at(-1)).toBe("Bring the pill box");
    expect(EDITOR()!.querySelector("h2")!.textContent).toMatch(/^Since your last visit · /);
    // Offline: it waits in the upload queue, like typing.
    const queued = await device.queued();
    expect(queued.filter((w) => w.type === "note_update" && w.data?.document_id === APPT.id).length).toBe(1);
  });

  test("a rerun goes above, dated as updated; what anyone typed, here or on another device at the same time, is kept", async () => {
    const device = await open(entryPath(APPT.id), { role: "caretaker" });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Bring the pill box"));
    await userEvent.click(await found(PREPARE));
    await previewReady();
    await insert();
    await waitUntil(() => editorLines()[0]?.startsWith("Since your last visit") ?? false);

    // Sam's device typed into the notes as they were before the first insert.
    const stored = (
      await device.query<{ snapshot: string }>("SELECT snapshot FROM note_document WHERE id = ?", [APPT.id])
    )[0]!;
    const theirs = typedElsewhere(APPT.id, buildNoteDoc(stored.snapshot), "Ask about the dizziness");

    await userEvent.click(await found(PREPARE));
    await previewReady();
    expect(PREVIEW()).toMatch(/Since your last visit · .* \(updated [A-Z][a-z]{2} \d+\)/);
    // It arrives while the sheet is open.
    await device.sync(theirs);
    await waitUntil(() => editorLines().includes("Ask about the dizziness"), 4000, "their typing");
    await insert();
    await waitUntil(() => editorLines().filter((l) => l.startsWith("Since your last visit")).length === 2);
    const lines = editorLines();
    expect(lines[0]).toMatch(/\(updated /);
    const second = lines.findIndex((l, i) => i > 0 && l.startsWith("Since your last visit"));
    expect(lines[second]).not.toMatch(/\(updated /);
    expect(lines).toContain("Bring the pill box");
    expect(lines).toContain("Ask about the dizziness");
    expect(lines.indexOf("Bring the pill box")).toBeGreaterThan(second);
  });

  test("the start can move back: a month from the 31st is the 30th, and what came before the last visit joins the preview", async () => {
    // A fixed clock (Date alone; timers stay real), so the last visit is always on the 31st (B-134).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-20T20:00:00Z"), shouldAdvanceTime: true });
    try {
      const last = fx.event({
        title: "Checkup with Dr. Lark",
        occurredAt: at(new Date("2026-10-31T17:00:00Z")),
      });
      const appt = fx.event({
        title: "Visit with Dr. Lark",
        occurredAt: at(new Date("2026-11-23T17:00:00Z")),
      });
      const cough = fx.symptom({
        name: "Cough",
        severity: 2,
        occurredAt: at(new Date("2026-10-10T17:00:00Z")),
      });
      const fixtures = [LARK, last, fx.link(last.id, LARK.id), appt, fx.link(appt.id, LARK.id), cough];
      await renderWithDevice({ route: ROUTES, url: entryPath(appt.id), fixtures, role: "caretaker" });
      await userEvent.click((await waitFor(PREPARE))!);
      await waitUntil(() => PREVIEW().includes("Since your last visit"), 8000, "the preview");
      expect(PREVIEW()).not.toContain("Cough");
      const segment = (type: string) => $<HTMLElement>(`[data-visit-prep-sheet] [data-type="${type}"]`)!;
      expect([segment("month").textContent, segment("day").textContent]).toEqual(["10", "31"]);
      segment("month").focus();
      await userEvent.keyboard("{ArrowDown}");
      await expect
        .poll(() => [segment("month").textContent, segment("day").textContent])
        .toEqual(["9", "30"]);
      await waitUntil(() => PREVIEW().includes("Cough"), 8000, "the longer window");
    } finally {
      vi.useRealTimers();
    }
  });

  test("no Prepare for a viewer", async () => {
    await open(entryPath(APPT.id), { role: "viewer" });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Bring the pill box"));
    await pause(200);
    expect(PREPARE()).toBeNull();
  });

  test("no Prepare on a past or cancelled event", async () => {
    const future = fx.event({ title: "Called off", occurredAt: ahead(DAY_H), cancelledAt: hoursAgo(1) });
    const device = await open(entryPath(LAST.id), { role: "caretaker", fixtures: [world(), future] });
    await waitUntil(() => !!EDITOR());
    await pause(200);
    expect(PREPARE()).toBeNull();
    await device.screen.unmount();
    await open(entryPath(future.id), { role: "caretaker", fixtures: [world(), future] });
    await waitUntil(() => !!EDITOR());
    await pause(200);
    expect(PREPARE()).toBeNull();
  });
});

describe("on a provider's page", () => {
  test("Prepare for a visit opens the sheet for their next appointment, then its page", async () => {
    const device = await open(`/app/groups/${GROUP}/providers/${LARK.id}`, { role: "caretaker" });
    await waitUntil(() => !!$("[data-next-visit]"), 4000, "the next visit");
    expect($("[data-next-visit]")!.textContent).toMatch(/^Next: Visit with Dr\. Lark, /);
    await userEvent.click(await found(PREPARE));
    await previewReady();
    await insert();
    await expect.poll(() => device.location()).toBe(entryPath(APPT.id));
    await waitUntil(
      () => editorLines()[0]?.startsWith("Since your last visit") ?? false,
      8000,
      "the section",
    );
  });

  test("with nothing coming up, it offers to add an appointment with them, day first, linked once it's saved", async () => {
    const device = await open(`/app/groups/${GROUP}/providers/${ORTIZ.id}`, { role: "caretaker" });
    await userEvent.click((await waitFor(PREPARE))!);
    await waitUntil(() => !!document.querySelector("dialog[open]"), 4000, "the offer");
    expect(document.querySelector("dialog[open]")!.textContent).toContain(
      "No visit with Dr. Ben Ortiz coming up",
    );
    await userEvent.click(
      [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")].find(
        (b) => b.textContent?.trim() === "Add an appointment",
      )!,
    );
    await expect
      .poll(() => device.location())
      .toBe(`/app/groups/${GROUP}/entries/new?kind=event&when=pick&provider=${ORTIZ.id}`);
    // The calendar is open first; picking a day (then Done) saves the appointment with Dr. Ortiz.
    await pickDayAhead(3);
    await userEvent.click(button("Done")!);
    await expect.poll(() => device.location(), { timeout: 4000 }).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    const id = device.location().split("/").at(-1)!;
    await expect
      .poll(async () =>
        (
          await device.query<{ provider_id: string }>(
            "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?",
            [id],
          )
        ).map((r) => r.provider_id),
      )
      .toEqual([ORTIZ.id]);
    // Now it's an upcoming appointment with them: ready to prepare.
    await waitUntil(() => !!PREPARE(), 4000, "Prepare on the new appointment");
  });

  test("a viewer gets no Prepare", async () => {
    await open(`/app/groups/${GROUP}/providers/${LARK.id}`, { role: "viewer" });
    await waitUntil(() => !!$("[data-provider-name]"));
    await pause(200);
    expect(PREPARE()).toBeNull();
  });
});

describe("in the Planner", () => {
  test("an appointment's ⋯ has Prepare, which opens the sheet, then the appointment", async () => {
    const device = await open(`/app/groups/${GROUP}/planner`, { role: "caretaker" });
    const actions = () =>
      $<HTMLButtonElement>(`[data-upcoming-item="${APPT.id}"] button[aria-label^="Actions for"]`);
    await userEvent.click((await waitFor(actions))!);
    await waitUntil(() => !!menuItem("Prepare for this visit"), 4000, "the menu");
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).toEqual([
      "Prepare for this visit",
      "Reschedule",
      "Cancel event",
      "Remind me",
      "Print",
      "Delete",
    ]);
    await userEvent.click(menuItem("Prepare for this visit")!);
    await previewReady();
    await insert();
    await expect.poll(() => device.location()).toBe(entryPath(APPT.id));
  });

  test("a viewer's ⋯ is Remind me and Print", async () => {
    await open(`/app/groups/${GROUP}/planner`, { role: "viewer" });
    const actions = () =>
      $<HTMLButtonElement>(`[data-upcoming-item="${APPT.id}"] button[aria-label^="Actions for"]`);
    await userEvent.click((await waitFor(actions))!);
    await waitUntil(() => !!menuItem("Print"), 4000, "the menu");
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).toEqual([
      "Remind me",
      "Print",
    ]);
  });
});
