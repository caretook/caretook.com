import type { SyncDb } from "~/lib/sync";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Locator } from "vitest/browser";

import { page, userEvent } from "vitest/browser";
import { fixClock, found } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { fx } from "../../../../../test/fixtures";
import { cancelEvent, rescheduleEvent, uncancelEvent } from "~/lib/appointments/appointments.sync";
import {
  BLOOD_DRAW,
  CARDIOLOGY,
  DENTIST,
  entryUrl,
  EYES_NEW,
  EYES_OLD,
  fromNow,
  HEARING,
  item,
  itemEl,
  ME,
  laTime,
  menuItem,
  menuItems,
  dialogButton,
  NOW,
  openPlanner,
  rowActions,
  rowOf,
  SAM,
  TIMELINE_URL,
  TRAN,
} from "./plannerWorld";

// Cancelling, undoing and rescheduling events on the test device (from
// upcoming.mjs's cancel and reschedule steps): from Upcoming's ⋯, a
// timeline row's ⋯ and the entry page's; the banner on the entry page; the
// reschedule sheet (keep the old one or just move); and the one local
// transaction a reschedule is. Every write is local (the device never
// connects): what's on the screen, what's stored and what's queued for
// upload. Who cancelled is the server's (appointments.int.test.ts); the
// reschedule reaching another device is roundtrip.mjs's step 6a; the rules
// (keep by default, can reschedule) are eventReschedule.test.ts's.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ACTIONS = 'button[aria-label^="Actions for"]';
const ENTRY_MENU = 'main header [data-region="actions"] button[aria-label^="Actions for"]';
const BANNER = () => document.querySelector<HTMLElement>("main [data-cancelled-banner]");
const SHEET = () => document.querySelector<HTMLFormElement>("[data-reschedule-sheet]");
const KEEP = () => SHEET()?.querySelector<HTMLInputElement>("[data-keep-old]") ?? null;
const EDITOR = () => document.querySelector<HTMLElement>(".ProseMirror");

/** A timeline row (or card), by its entry's open link. */
const timelineRow = (id: string) =>
  [...document.querySelectorAll<HTMLElement>("main li")].find((li) =>
    li.querySelector(`a[href$="/entries/${id}"]`),
  );
/** A timeline row's ⋯ button. */
const timelineActions = (id: string) => getByCss(`main li:has(a[href$="/entries/${id}"]) ${ACTIONS}`);
/** Whether a row is marked, labelled and struck through as cancelled. */
const cancelledState = (li: Element | null | undefined) =>
  li && {
    marked: li.hasAttribute("data-cancelled"),
    label: !!li.querySelector("[data-cancelled-label]")?.textContent?.includes("Cancelled"),
    struck: [...li.querySelectorAll("div")].some((d) =>
      getComputedStyle(d).textDecorationLine.includes("line-through"),
    ),
  };
const CANCELLED = { marked: true, label: true, struck: true };

/** Open the ⋯ menu in `scope` and wait for its items. */
const openMenu = async (button: Locator) => {
  await userEvent.click(button);
  await expect.poll(() => menuItems().length).toBeGreaterThan(0);
  return menuItems();
};
/** Pick Cancel event from the open menu, type `reason` (if any) and confirm. */
const confirmCancel = async (reason?: string) => {
  await userEvent.click(menuItem("Cancel event"));
  await expect.element(getByCss("dialog[open] [data-cancel-reason]")).toBeInTheDocument();
  if (reason) await userEvent.fill(getByCss("dialog[open] [data-cancel-reason]"), reason);
  await userEvent.click(dialogButton("Cancel event"));
  await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
};
/** Pick Reschedule from the open menu and wait for the sheet. */
const openSheet = async () => {
  await userEvent.click(menuItem("Reschedule"));
  await expect.poll(KEEP).not.toBeNull();
};
/** Move the sheet's day `days` later, set Keep, and save. */
const rescheduleBy = async (days: number, keep: boolean) => {
  (await found(() => SHEET()?.querySelector<HTMLElement>('[data-type="day"]'))).focus();
  for (let i = 0; i < days; i++) await userEvent.keyboard("{ArrowUp}");
  if ((await found(KEEP)).checked !== keep) await userEvent.click(await found(KEEP));
  await userEvent.click(
    await found(() => SHEET()?.querySelector<HTMLButtonElement>('button[type="submit"]')),
  );
  await expect.poll(SHEET).toBeNull();
};

type Stored = {
  id: string;
  title: string | null;
  occurred_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  rescheduled_to: string | null;
  deleted_at: string | null;
};
/** The stored row (soft-deleted ones too); throws if there's none. */
const stored = async (db: SyncDb, id: string) => {
  const [row] = await db.powersync.getAll<Stored>("SELECT * FROM timeline_entry WHERE id = ?", [id]);
  if (!row) throw new Error(`no timeline_entry ${id}`);
  return row;
};
const ms = (local: string | null) => (local ? Date.parse(local.replace(" ", "T")) : NaN);

beforeEach(() => fixClock(NOW));
afterEach(() => {
  vi.useRealTimers();
});

describe("cancel and undo", () => {
  test("from Upcoming's ⋯ with a reason: struck through and labelled at once, stored with the reason, one PATCH queued", async () => {
    const device = await openPlanner({ role: "caretaker" });
    const items = await openMenu(rowActions(CARDIOLOGY.id));
    expect(items).toEqual([
      "Prepare for this visit",
      "Reschedule",
      "Cancel event",
      "Remind me",
      "Print",
      "Delete",
    ]);
    await confirmCancel("Office called, doctor out sick");
    await device.settle();
    await expect.poll(() => cancelledState(itemEl(CARDIOLOGY.id))).toEqual(CANCELLED);
    const row = await stored(device.db, CARDIOLOGY.id);
    expect(row.cancelled_at).not.toBeNull();
    expect(row.cancel_reason).toBe("Office called, doctor out sick");
    const queued = await device.queued();
    expect(queued).toEqual([
      expect.objectContaining({ op: "PATCH", type: "timeline_entry", id: CARDIOLOGY.id }),
    ]);
    expect(queued[0]?.data).toMatchObject({ cancel_reason: "Office called, doctor out sick" });
  });

  test("a past event from a timeline row's ⋯, without a reason: struck through and labelled", async () => {
    const device = await openPlanner({ url: TIMELINE_URL });
    await expect.poll(() => !!timelineRow(BLOOD_DRAW.id)).toBe(true);
    await openMenu(timelineActions(BLOOD_DRAW.id));
    await confirmCancel();
    await device.settle();
    await expect.poll(() => cancelledState(timelineRow(BLOOD_DRAW.id))).toEqual(CANCELLED);
    const row = await stored(device.db, BLOOD_DRAW.id);
    expect(row.cancelled_at).not.toBeNull();
    expect(row.cancel_reason).toBeNull();
  });

  test("Undo cancel from a row's ⋯: the label and the line go", async () => {
    const device = await openPlanner({ url: TIMELINE_URL });
    await expect.poll(() => cancelledState(timelineRow(HEARING.id))).toEqual(CANCELLED);
    await openMenu(timelineActions(HEARING.id));
    await userEvent.click(menuItem("Undo cancel"));
    await device.settle();
    await expect
      .poll(() => cancelledState(timelineRow(HEARING.id)))
      .toEqual({ marked: false, label: false, struck: false });
    expect((await stored(device.db, HEARING.id)).cancelled_at).toBeNull();
  });

  test("a viewer sees cancelled ones labelled on Upcoming and the timeline, and their device refuses a cancel or an undo", async () => {
    const device = await openPlanner({ role: "viewer" });
    expect(rowOf(DENTIST.id)).toMatchObject({ cancelled: true, struck: true });
    expect((await uncancelEvent(device.db, DENTIST.id)).ok).toBe(false);
    expect((await cancelEvent(device.db, CARDIOLOGY.id, "no")).ok).toBe(false);
    expect(await device.queued()).toEqual([]);
    await device.screen.unmount();

    await openPlanner({ url: TIMELINE_URL, role: "viewer" });
    await expect.poll(() => cancelledState(timelineRow(HEARING.id))).toEqual(CANCELLED);
  });

  describe("the entry page's banner", () => {
    const CALLED_OFF = fx.event({
      title: "Audiology",
      occurredAt: laTime(4, 9),
      cancelledAt: fromNow(-30 * MINUTE),
      cancelledBy: SAM.id,
      cancelReason: "Office called, doctor out sick",
    });

    test("the reason, who and when, for everyone; Undo for the writer, not the viewer", async () => {
      const viewer = await openPlanner({
        url: entryUrl(CALLED_OFF.id),
        extra: [CALLED_OFF],
        role: "viewer",
      });
      await expect
        .poll(() => BANNER()?.querySelector("[data-cancelled-by]")?.textContent)
        .toBe("Cancelled by Sam Okafor · Today, 9:30 AM");
      await expect
        .poll(() => BANNER()?.querySelector("[data-cancel-reason]")?.textContent)
        .toBe("Office called, doctor out sick");
      expect(page.getByRole("button", { name: "Undo cancel" }).query()).toBeNull();
      await viewer.screen.unmount();

      await openPlanner({ url: entryUrl(CALLED_OFF.id), extra: [CALLED_OFF], role: "caretaker" });
      await expect.element(page.getByRole("button", { name: "Undo cancel" })).toBeVisible();
    });

    test("Undo cancel restores it: the banner goes, stored and queued", async () => {
      const device = await openPlanner({ url: entryUrl(CALLED_OFF.id), extra: [CALLED_OFF] });
      await userEvent.click(page.getByRole("button", { name: "Undo cancel" }));
      await device.settle();
      await expect.poll(BANNER).toBeNull();
      const row = await stored(device.db, CALLED_OFF.id);
      expect([row.cancelled_at, row.cancel_reason]).toEqual([null, null]);
      expect(await device.queued()).toEqual([
        expect.objectContaining({ op: "PATCH", type: "timeline_entry", id: CALLED_OFF.id }),
      ]);
    });

    test("Cancel from the page's ⋯ (offline): the banner at once, queued for upload", async () => {
      const device = await openPlanner({ url: entryUrl(CARDIOLOGY.id) });
      await expect.poll(() => !!document.querySelector(ENTRY_MENU)).toBe(true);
      const items = await openMenu(getByCss(ENTRY_MENU));
      expect(items).toEqual(["Reschedule", "Cancel event", "Remind me", "Print", "Delete"]);
      await confirmCancel();
      await device.settle();
      await expect.poll(BANNER).not.toBeNull();
      expect(await device.queued()).toEqual([
        expect.objectContaining({ op: "PATCH", type: "timeline_entry", id: CARDIOLOGY.id }),
      ]);
    });
  });
});

describe("reschedule", () => {
  const NEURO = fx.event({
    title: "Neurology consult",
    occurredAt: laTime(2, 11),
    endsAt: laTime(2, 11, 45),
    text: "Bring the cuff log",
  });
  const NOTED_OLD = fx.event({
    title: "Eye doctor",
    occurredAt: EYES_OLD.row.occurred_at as string,
    cancelledAt: fromNow(-2 * DAY),
    rescheduledTo: EYES_NEW.id,
    id: EYES_OLD.id,
    text: "Ask about the drops",
  });

  test("an upcoming event's sheet starts with Keep on; keeping the old one opens the new event 3 days later, as long, with its title, provider and notes; the old one cancelled, linking to it; one transaction queued", async () => {
    const device = await openPlanner({ extra: [NEURO, fx.link(NEURO.id, TRAN.id)] });
    await openMenu(rowActions(NEURO.id));
    await openSheet();
    await expect.poll(() => KEEP()?.checked).toBe(true);
    await rescheduleBy(3, true);
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    const fresh = device.location().split("/").at(-1)!;
    expect(fresh).not.toBe(NEURO.id);
    await expect.poll(() => EDITOR()?.textContent).toContain("Bring the cuff log");

    const [old, made] = [await stored(device.db, NEURO.id), await stored(device.db, fresh)];
    expect(made.title).toBe("Neurology consult");
    expect(made.cancelled_at).toBeNull();
    expect(ms(made.occurred_at) - ms(NEURO.row.occurred_at as string)).toBe(3 * DAY);
    expect(ms(made.ends_at) - ms(NEURO.row.ends_at as string)).toBe(3 * DAY);
    expect(old.cancelled_at).not.toBeNull();
    expect(old.rescheduled_to).toBe(fresh);
    const links = await device.query<{ provider_id: string }>(
      "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?",
      [fresh],
    );
    expect(links).toEqual([{ provider_id: TRAN.id }]);
    // One local transaction, each row before what points at it: the new
    // event, its document and notes, its link, then the old one cancelled.
    const queued = (await device.queued()).map((w) => `${w.op} ${w.type}`);
    expect(queued.slice(0, 5)).toEqual([
      "PUT timeline_entry",
      "PUT note_document",
      "PUT note_update",
      "PUT timeline_entry_provider",
      "PATCH timeline_entry",
    ]);
  });

  test("the old one's page: Rescheduled to its day, linking to the new one, its notes read-only as earlier notes; Upcoming's ⋯ for it offers no Reschedule", async () => {
    const device = await openPlanner({ url: entryUrl(EYES_OLD.id), extra: [NOTED_OLD] });
    const link = () => BANNER()?.querySelector<HTMLAnchorElement>(`[data-rescheduled-to="${EYES_NEW.id}"] a`);
    await expect.poll(() => link()?.textContent).toBe("Rescheduled to Tue, Nov 24");
    await expect.poll(() => link()?.getAttribute("href")).toBe(entryUrl(EYES_NEW.id));
    await expect.poll(() => EDITOR()?.textContent).toContain("Ask about the drops");
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable")).toBe("false");
    expect(document.querySelector("[data-earlier-notes]")).not.toBeNull();
    await device.screen.unmount();

    await openPlanner({ extra: [NOTED_OLD] });
    expect(await openMenu(rowActions(EYES_OLD.id))).toEqual(["Undo cancel", "Print", "Delete"]);
    await userEvent.keyboard("{Escape}");
  });

  test("deleting the new event leaves the old one cancelled, with no link", async () => {
    const device = await openPlanner();
    await openMenu(rowActions(EYES_NEW.id));
    await userEvent.click(menuItem("Delete"));
    await expect.element(dialogButton("Delete")).toBeInTheDocument();
    await userEvent.click(dialogButton("Delete"));
    await device.settle();
    await expect.poll(() => itemEl(EYES_NEW.id)).toBeNull();
    expect(rowOf(EYES_OLD.id)).toMatchObject({ cancelled: true, struck: true });
    await expect.element(item(EYES_OLD.id).getByCss("[data-rescheduled-to]")).not.toBeInTheDocument();
    const old = await stored(device.db, EYES_OLD.id);
    expect(old.cancelled_at).not.toBeNull();
    expect(old.rescheduled_to).toBeNull();
    expect((await stored(device.db, EYES_NEW.id)).deleted_at).not.toBeNull();
  });

  test("just move, from the entry page: the same event a day later, its link kept, not cancelled, no new event; the sheet closes there", async () => {
    const device = await openPlanner({ url: entryUrl(CARDIOLOGY.id) });
    const before = await device.query<{ n: number }>("SELECT count(*) AS n FROM timeline_entry");
    await expect.poll(() => !!document.querySelector(ENTRY_MENU)).toBe(true);
    await openMenu(getByCss(ENTRY_MENU));
    await openSheet();
    await rescheduleBy(1, false);
    await device.settle();
    expect(device.location()).toBe(entryUrl(CARDIOLOGY.id));
    const row = await stored(device.db, CARDIOLOGY.id);
    expect(ms(row.occurred_at) - ms(CARDIOLOGY.row.occurred_at as string)).toBe(DAY);
    expect(row.cancelled_at).toBeNull();
    expect(await device.query("SELECT count(*) AS n FROM timeline_entry")).toEqual(before);
    expect(
      await device.query("SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?", [
        CARDIOLOGY.id,
      ]),
    ).toEqual([{ provider_id: TRAN.id }]);
  });

  test("a past event's sheet, from a timeline row, starts with Keep off", async () => {
    await openPlanner({ url: TIMELINE_URL });
    await expect.poll(() => !!timelineRow(BLOOD_DRAW.id)).toBe(true);
    await openMenu(timelineActions(BLOOD_DRAW.id));
    await openSheet();
    await expect.poll(() => KEEP()?.checked).toBe(false);
    await userEvent.keyboard("{Escape}");
    await expect.poll(SHEET).toBeNull();
  });

  test("a viewer's device refuses a reschedule", async () => {
    const device = await openPlanner({ role: "viewer" });
    const res = await rescheduleEvent(device.db, CARDIOLOGY.id, {
      occurredAt: new Date(NOW.getTime() + 9 * DAY).toISOString(),
      endsAt: null,
      allDay: false,
      keepOldAsCancelled: true,
    });
    expect(res.ok).toBe(false);
    expect(await device.queued()).toEqual([]);
  });

  test("one local transaction: a failure inside it leaves no new rows, nothing queued, and the old event as it was", async () => {
    const device = await openPlanner({ extra: [NEURO, fx.link(NEURO.id, TRAN.id)] });
    const db = device.db;
    const count = async () =>
      (
        await db.powersync.getAll(
          "SELECT (SELECT count(*) FROM timeline_entry) AS e, (SELECT count(*) FROM note_document) AS d, (SELECT count(*) FROM note_update) AS u, (SELECT count(*) FROM timeline_entry_provider) AS l, (SELECT count(*) FROM ps_crud) AS q",
        )
      )[0];
    const before = await count();
    const wrap = <T extends object>(target: T, override: Record<string, unknown>): T =>
      new Proxy(target, {
        get: (t, k) => {
          if (typeof k === "string" && k in override) return override[k];
          const v: unknown = Reflect.get(t, k);
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
        },
      });
    const drizzle = wrap(db.drizzle, {
      transaction: (fn: (tx: unknown) => Promise<unknown>) =>
        db.drizzle.transaction((tx) =>
          fn(
            wrap(tx, {
              update: () => {
                throw new Error("injected");
              },
            }),
          ),
        ),
    });
    await expect(
      rescheduleEvent({ ...db, drizzle }, NEURO.id, {
        occurredAt: new Date(NOW.getTime() + 8 * DAY).toISOString(),
        endsAt: null,
        allDay: false,
        keepOldAsCancelled: true,
      }),
    ).rejects.toThrow("injected");
    expect(await count()).toEqual(before);
    const old = await stored(db, NEURO.id);
    expect([old.cancelled_at, old.rescheduled_to]).toEqual([null, null]);
  });
});

describe("a refused delete", () => {
  const ALERT = () => document.querySelector("main [role=alert]")?.textContent ?? null;
  /** Between the confirm opening and Delete: this device's member loses write access (a role change synced in). */
  const demote = (db: SyncDb) =>
    db.powersync.execute("UPDATE care_group_member SET role = 'viewer' WHERE user_id = ?", [ME]);

  test("from Upcoming's ⋯: the refusal is shown and the entry stays listed", async () => {
    const device = await openPlanner();
    await openMenu(rowActions(CARDIOLOGY.id));
    await userEvent.click(menuItem("Delete"));
    await expect.element(dialogButton("Delete")).toBeInTheDocument();
    await demote(device.db);
    await userEvent.click(dialogButton("Delete"));
    await expect.poll(ALERT).toBe("You don't have permission to do that.");
    await device.settle();
    expect(itemEl(CARDIOLOGY.id)).not.toBeNull();
    expect((await stored(device.db, CARDIOLOGY.id)).deleted_at).toBeNull();
  });

  test("from a timeline row's ⋯ (useEntryRemoval): the refusal is shown and the entry stays listed", async () => {
    const device = await openPlanner({ url: TIMELINE_URL });
    await expect.poll(() => !!timelineRow(BLOOD_DRAW.id)).toBe(true);
    await openMenu(timelineActions(BLOOD_DRAW.id));
    await userEvent.click(menuItem("Delete"));
    await expect.element(dialogButton("Delete")).toBeInTheDocument();
    await demote(device.db);
    await userEvent.click(dialogButton("Delete"));
    await expect.poll(ALERT).toBe("You don't have permission to do that.");
    await device.settle();
    expect(timelineRow(BLOOD_DRAW.id)).toBeTruthy();
    expect((await stored(device.db, BLOOD_DRAW.id)).deleted_at).toBeNull();
  });
});
