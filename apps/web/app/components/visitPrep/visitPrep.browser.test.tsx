import type { Fixture } from "../../../test/fixtures";

import { buildNoteDoc, NOTE_FRAGMENT, toBase64 } from "@caretook/data/schema";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../test/found";
import { getByCss } from "../../../test/locators";
import * as Y from "yjs";
import { renderWithDevice } from "../../../test/device";
import { at, fx, hoursAgo, newId, TEST_GROUP, TEST_USER } from "../../../test/fixtures";
import * as entryRoute from "../../routes/app/groups/entry/route";
import * as providerRoute from "../../routes/app/groups/provider/route";
import * as plannerRoute from "../../routes/app/groups/planner/route";
import { loadVisitPrepData } from "../../lib/appointments/visitPrep.sync";
import { resolveUnits } from "@caretook/data/schema";

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
const SHEET = () => document.querySelector("[data-visit-prep-sheet]");
const PREVIEW = () => document.querySelector("[data-visit-prep-preview]")?.textContent ?? "";
const EDITOR = () => document.querySelector(".ProseMirror");
const PREPARE = () => getByCss("[data-prepare-visit]");
/** The first button (in an open dialog, with `within`) whose text is `text`. */
const button = (text: string, within = "") =>
  getByCss(`${within} button`.trim())
    .filter({ hasText: new RegExp(`^${text}$`) })
    .first();
const menuItem = (text: string) => page.getByRole("menuitem", { name: text, exact: true });
const actionsOf = (id: string) => getByCss(`[data-upcoming-item="${id}"] button[aria-label^="Actions for"]`);
const GRID = () => document.querySelector("[role=grid]");
/** In the open calendar, pick the day `days` from today (as entry.browser.test.tsx does). */
const pickDayAhead = async (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const heading = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  await waitUntil(() => GRID(), "the calendar");
  const calHeading = () => GRID()?.closest("[role=dialog]")?.querySelector("h2")?.textContent.trim();
  if (calHeading() !== heading)
    await userEvent.click(
      await found(() => GRID()?.closest("[role=dialog]")?.querySelector('[aria-label="Next month"]')),
    );
  await waitUntil(() => calHeading() === heading);
  const cell = await found(() =>
    [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
      (c) => c.textContent?.trim() === String(d.getDate()) && !c.hasAttribute("data-outside-month"),
    ),
  );
  await userEvent.click(cell);
  await waitUntil(() => !GRID(), "the calendar to close");
};
const previewReady = () => waitUntil(() => PREVIEW().includes("Since your last visit"), "the preview");
const editorLines = () =>
  [...(EDITOR()?.querySelectorAll("h2, h3, p") ?? [])].map((el) => el.textContent ?? "");
const insert = async () => {
  await userEvent.click(button("Insert into the notes"));
  await waitUntil(() => !SHEET(), "the sheet to close");
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

describe("the loader", () => {
  test("returns the change entries from the window's start to now, a deleted one included", async () => {
    const inWindow = fx.medicationChange({
      medicationId: LISINOPRIL.id,
      change: "changed",
      occurredAt: hoursAgo(5 * DAY_H),
    });
    const deleted = fx.medicationChange({
      medicationId: LISINOPRIL.id,
      change: "changed",
      occurredAt: hoursAgo(4 * DAY_H),
      deletedAt: hoursAgo(DAY_H),
    });
    const longBefore = fx.medicationChange({
      medicationId: LISINOPRIL.id,
      change: "changed",
      occurredAt: hoursAgo(40 * DAY_H),
    });
    const device = await open(entryPath(APPT.id), {
      role: "caretaker",
      fixtures: [...world(), inWindow, deleted, longBefore],
    });
    const now = new Date();
    const data = await loadVisitPrepData(device.db, {
      groupId: GROUP,
      appointmentId: APPT.id,
      window: {
        from: new Date(now.getTime() - 10 * DAY_H * 3_600_000).toISOString(),
        to: now.toISOString(),
        lastVisit: null,
      },
      units: resolveUnits(null),
      now,
    });
    const ids = data.changes?.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([inWindow.id, deleted.id]));
    expect(ids).not.toContain(longBefore.id);
    // The section's own entries still leave the deleted one out.
    expect(data.entries.map((e) => e.id)).not.toContain(deleted.id);
  });
});

describe("on the appointment's page", () => {
  test("Prepare opens the sheet from the last visit; the preview leaves out empty sections; Insert (offline) puts it on top and queues it", async () => {
    const device = await open(entryPath(APPT.id), { role: "caretaker" });
    await waitUntil(() => EDITOR()?.textContent?.includes("Bring the pill box"));
    await userEvent.click(PREPARE());
    await waitUntil(SHEET, "the sheet");
    expect(document.querySelector("[role=dialog] h2, [role=dialog] [slot=title]")?.textContent).toBe(
      "Prepare for Visit with Dr. Lark",
    );
    await previewReady();
    await expect
      .element(getByCss("[data-visit-window]"))
      .toMatchTextContent(/^From the last visit: Checkup with Dr\. Lark, /);
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
    await waitUntil(() => editorLines()[0]?.startsWith("Since your last visit · "), "the section");
    const lines = editorLines();
    expect(lines).toContain("Symptoms");
    expect(lines.at(-1)).toBe("Bring the pill box");
    await expect.poll(() => EDITOR()?.querySelector("h2")?.textContent).toMatch(/^Since your last visit · /);
    // Offline: it waits in the upload queue, like typing.
    const queued = await device.queued();
    expect(queued.filter((w) => w.type === "note_update" && w.data?.document_id === APPT.id).length).toBe(1);
  });

  test("a rerun goes above, dated as updated; what anyone typed, here or on another device at the same time, is kept", async () => {
    const device = await open(entryPath(APPT.id), { role: "caretaker" });
    await waitUntil(() => EDITOR()?.textContent?.includes("Bring the pill box"));
    await userEvent.click(PREPARE());
    await previewReady();
    await insert();
    await waitUntil(() => editorLines()[0]?.startsWith("Since your last visit"));

    // Sam's device typed into the notes as they were before the first insert.
    const stored = (
      await device.query<{ snapshot: string }>("SELECT snapshot FROM note_document WHERE id = ?", [APPT.id])
    )[0];
    const theirs = typedElsewhere(APPT.id, buildNoteDoc(stored?.snapshot ?? ""), "Ask about the dizziness");

    await userEvent.click(PREPARE());
    await previewReady();
    expect(PREVIEW()).toMatch(/Since your last visit · .* \(updated [A-Z][a-z]{2} \d+\)/);
    // It arrives while the sheet is open.
    await device.sync(theirs);
    await waitUntil(() => editorLines().includes("Ask about the dizziness"), "their typing");
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
      await userEvent.click(PREPARE());
      await previewReady();
      expect(PREVIEW()).not.toContain("Cough");
      const segment = (type: string) => getByCss(`[data-visit-prep-sheet] [data-type="${type}"]`);
      const startDay = () => [segment("month").element().textContent, segment("day").element().textContent];
      expect(startDay()).toEqual(["10", "31"]);
      (await segment("month").findElement()).focus();
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(startDay).toEqual(["9", "30"]);
      await waitUntil(() => PREVIEW().includes("Cough"), "the longer window");
    } finally {
      vi.useRealTimers();
    }
  });

  describe("asking before losing a moved start (B-603)", () => {
    const asked = () => document.querySelector("dialog[open]") !== null;
    const close = () => userEvent.click(page.getByRole("button", { name: "Close" }));
    const moveStart = async () => {
      const month = getByCss('[data-visit-prep-sheet] [data-type="month"]');
      const before = month.element().textContent;
      (await month.findElement()).focus();
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => month.element().textContent).not.toBe(before);
    };
    const openPrep = async () => {
      await open(entryPath(APPT.id), { role: "caretaker" });
      await userEvent.click(PREPARE());
      await previewReady();
    };

    test("a moved start asks, and Discard closes", async () => {
      await openPrep();
      await moveStart();
      await close();
      await expect.poll(asked).toBe(true);
      await userEvent.click(page.getByRole("button", { name: "Discard" }));
      await expect.poll(SHEET).toBeNull();
    });

    test("an unchanged start closes without asking", async () => {
      await openPrep();
      await close();
      await expect.poll(SHEET).toBeNull();
      expect(asked()).toBe(false);
    });

    test("Insert after moving the start closes without asking", async () => {
      await openPrep();
      await moveStart();
      await waitUntil(() => PREVIEW().includes("Since your last visit"), "the moved preview");
      await insert();
      expect(asked()).toBe(false);
    });
  });

  test("no Prepare for a viewer", async () => {
    const device = await open(entryPath(APPT.id), { role: "viewer" });
    await waitUntil(() => EDITOR()?.textContent?.includes("Bring the pill box"));
    await device.settle();
    await expect.element(PREPARE()).not.toBeInTheDocument();
  });

  test("no Prepare on a past or cancelled event", async () => {
    const future = fx.event({ title: "Called off", occurredAt: ahead(DAY_H), cancelledAt: hoursAgo(1) });
    const device = await open(entryPath(LAST.id), { role: "caretaker", fixtures: [world(), future] });
    await waitUntil(EDITOR);
    await device.settle();
    await expect.element(PREPARE()).not.toBeInTheDocument();
    await device.screen.unmount();
    const again = await open(entryPath(future.id), { role: "caretaker", fixtures: [world(), future] });
    await waitUntil(EDITOR);
    await again.settle();
    await expect.element(PREPARE()).not.toBeInTheDocument();
  });
});

describe("on a provider's page", () => {
  test("Prepare for a visit opens the sheet for their next appointment, then its page", async () => {
    const device = await open(`/app/groups/${GROUP}/providers/${LARK.id}`, { role: "caretaker" });
    await expect.element(getByCss("[data-next-visit]")).toMatchTextContent(/^Next: Visit with Dr\. Lark, /);
    await userEvent.click(PREPARE());
    await previewReady();
    await insert();
    await expect.poll(() => device.location()).toBe(entryPath(APPT.id));
    await waitUntil(() => editorLines()[0]?.startsWith("Since your last visit"), "the section");
  });

  test("with nothing coming up, it offers to add an appointment with them, day first, linked once it's saved", async () => {
    const device = await open(`/app/groups/${GROUP}/providers/${ORTIZ.id}`, { role: "caretaker" });
    await userEvent.click(PREPARE());
    await expect
      .element(getByCss("dialog[open]"))
      .toMatchTextContent(/No visit with Dr\. Ben Ortiz coming up/);
    await userEvent.click(button("Add an event", "dialog[open]"));
    await expect
      .poll(() => device.location())
      .toBe(`/app/groups/${GROUP}/entries/new?kind=event&when=pick&provider=${ORTIZ.id}`);
    // The calendar is open first; picking a day closes the picker and saves the appointment with Dr. Ortiz.
    await pickDayAhead(3);
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
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
    await expect.element(PREPARE()).toBeInTheDocument();
  });

  test("a viewer gets no Prepare", async () => {
    const device = await open(`/app/groups/${GROUP}/providers/${LARK.id}`, { role: "viewer" });
    await expect.element(getByCss("[data-provider-name]")).toBeInTheDocument();
    await device.settle();
    await expect.element(PREPARE()).not.toBeInTheDocument();
  });
});

describe("in the Planner", () => {
  test("an appointment's ⋯ has Prepare, which opens the sheet, then the appointment", async () => {
    const device = await open(`/app/groups/${GROUP}/planner`, { role: "caretaker" });
    await userEvent.click(actionsOf(APPT.id));
    await expect.element(menuItem("Prepare for this visit")).toBeInTheDocument();
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).toEqual([
      "Prepare for this visit",
      "Reschedule",
      "Cancel event",
      "Remind me",
      "Print",
      "Delete",
    ]);
    await userEvent.click(menuItem("Prepare for this visit"));
    await previewReady();
    await insert();
    await expect.poll(() => device.location()).toBe(entryPath(APPT.id));
  });

  test("a viewer's ⋯ is Remind me and Print", async () => {
    await open(`/app/groups/${GROUP}/planner`, { role: "viewer" });
    await userEvent.click(actionsOf(APPT.id));
    await expect.element(menuItem("Print")).toBeInTheDocument();
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).toEqual([
      "Remind me",
      "Print",
    ]);
  });
});
