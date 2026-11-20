import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";
import {
  BLOOD_DRAW,
  CARDIOLOGY,
  DENTIST,
  EYES_NEW,
  EYES_OLD,
  fixClock,
  HEARING,
  HOSPICE,
  laTime,
  listed,
  NURSE,
  openUpcoming,
  PAST_NOTE,
  PAST_URL,
  PODIATRY,
  REFILL,
  RIDE,
  rowOf,
  SAM,
  THERAPY,
  UPCOMING_LIVE,
  UPCOMING_URL,
} from "./upcomingWorld";

// Upcoming and its Past tab on the test device (from upcoming.mjs): the
// section in the tab bar and the header, the list (order, days, Now, all
// day, ranges, cancelled and rescheduled, the reminder note, call and map),
// Add appointment and Add reminder, the kind and author filters in the URL,
// the Past tab (newest first, cancelled ones, paging), items leaving as
// their time passes, today's due doses, the viewer and a non-member. The
// device never connects, so every test here is also "offline, from the
// device's copy". The rules themselves (timing, order, labels, filters,
// actions) are the pure modules' unit tests; this is what's on the screen.

const MINUTE = 60_000;
const TAB_BAR = 'nav.dock[aria-label="Group sections"]';
const HEADER_NAV = '[data-region="sections"] nav[aria-label="Group sections"]';
const sectionLinks = (nav: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>(`${nav} a`)].map((a) => [
    a.textContent?.trim(),
    a.getAttribute("aria-current"),
  ]);
const chip = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('main nav[aria-label="Show items"] a')].find(
    (a) => a.textContent?.trim() === label,
  );
const tab = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('main nav[aria-label="Upcoming or past"] a')].find(
    (a) => a.textContent?.trim() === label,
  )!;

beforeEach(() => fixClock());
afterEach(() => {
  vi.useRealTimers();
});

describe("the section", () => {
  // Later sections (Tasks) follow Upcoming, so find it by name.
  const upcomingLink = (nav: string) => sectionLinks(nav).find(([name]) => name === "Upcoming");
  test("at 420 the tab bar lists Upcoming after Medications, current on its page; at 1280 the header's link is current; on Past the section is still Upcoming", async () => {
    await openUpcoming({ frame: true });
    await expect
      .poll(() => sectionLinks(TAB_BAR).slice(0, 4))
      .toEqual([
        ["Timeline", null],
        ["Providers", null],
        ["Medications", null],
        ["Upcoming", "page"],
      ]);
    await page.viewport(1280, 900);
    await expect.poll(() => upcomingLink(HEADER_NAV)).toEqual(["Upcoming", "page"]);
    await page.viewport(420, 900);

    await userEvent.click(tab("Past"));
    await expect.element(page.getByText("Hearing test")).toBeInTheDocument();
    expect(upcomingLink(TAB_BAR)).toEqual(["Upcoming", "true"]);
  });
});

describe("the list", () => {
  test("soonest first, a section per day: Now (in progress, until its end), Today, Tomorrow, then dates; all day first in its day; a range with an end", async () => {
    await openUpcoming();
    const rows = listed();
    expect(rows.map((r) => r.id)).toEqual([
      NURSE.id,
      THERAPY.id,
      CARDIOLOGY.id,
      REFILL.id,
      HOSPICE.id,
      RIDE.id,
      DENTIST.id,
      EYES_OLD.id,
      EYES_NEW.id,
    ]);
    expect([...new Set(rows.map((r) => r.heading))]).toEqual([
      "Now",
      "Today",
      "Tomorrow",
      "Friday, Nov 20",
      "Saturday, Nov 21",
      "Monday, Nov 23",
      "Tuesday, Nov 24",
    ]);
    expect(rowOf(NURSE.id)!.when).toBe("Now · until 10:45 AM");
    expect(rowOf(THERAPY.id)!.when).toBe("2:00 PM");
    expect(rowOf(CARDIOLOGY.id)!.when).toBe("10:30 AM–11:15 AM");
    expect(rowOf(HOSPICE.id)!.when).toBe("All day");
  });

  test("cancelled items are struck through and labelled; a rescheduled one names its new day and links to it", async () => {
    await openUpcoming();
    const dentist = rowOf(DENTIST.id)!;
    expect(dentist).toMatchObject({ cancelled: true, struck: true });
    expect(dentist.text).toContain("Cancelled");
    const old = rowOf(EYES_OLD.id)!;
    expect(old).toMatchObject({ cancelled: true, struck: true });
    const moved = document.querySelector(`[data-upcoming-item="${EYES_OLD.id}"] [data-rescheduled-to]`)!;
    expect(moved.textContent).toBe("Rescheduled to Tue, Nov 24");
    expect(moved.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/entries/${EYES_NEW.id}`);
    expect(rowOf(EYES_NEW.id)!.cancelled).toBe(false);
    expect(
      listed()
        .filter((r) => !r.cancelled)
        .map((r) => r.id),
    ).toEqual(UPCOMING_LIVE.map((e) => e.id));
  });

  test("the reminder note is listed with the appointments as a note, and opens its page", async () => {
    await openUpcoming();
    const refill = rowOf(REFILL.id)!;
    expect(refill.kindLink).toBe("Show only notes");
    expect(refill.open).toBe(`/app/groups/${TEST_GROUP.id}/entries/${REFILL.id}`);
    expect(rowOf(CARDIOLOGY.id)!.kindLink).toBe("Show only events");
  });

  test("call and map on a row with a provider and a place; a call alone with only a phone; nothing on a row with neither", async () => {
    await openUpcoming();
    const cardiology = rowOf(CARDIOLOGY.id)!.actions;
    expect(cardiology.map((a) => a.kind)).toEqual(["call", "map"]);
    expect(cardiology[0]!.href).toBe("tel:5550103300");
    expect(cardiology[0]!.label).toMatch(/^Call Dr\. Ana Tran/);
    expect(cardiology[1]!.href).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=48%20Harbor/,
    );
    expect(rowOf(THERAPY.id)!.actions).toEqual([
      expect.objectContaining({ kind: "call", href: "tel:+15550105500" }),
    ]);
    expect(rowOf(RIDE.id)!.actions).toEqual([]);
  });

  test("an item leaves Upcoming once its end (in progress) or its start passes, without a reload", async () => {
    const device = await openUpcoming();
    const mounted = document.querySelector("main[data-upcoming]");
    expect(rowOf(NURSE.id)!.heading).toBe("Now");
    // 10:46: the visit has ended.
    await vi.advanceTimersByTimeAsync(46 * MINUTE);
    await device.settle();
    await expect.poll(() => rowOf(NURSE.id)).toBeUndefined();
    expect(rowOf(THERAPY.id)!.heading).toBe("Today");
    // 2:01 PM: therapy has started (no end: it's past).
    await vi.advanceTimersByTimeAsync(4 * 60 * MINUTE - 45 * MINUTE);
    await device.settle();
    await expect.poll(() => rowOf(THERAPY.id)).toBeUndefined();
    expect(listed()[0]!.id).toBe(CARDIOLOGY.id);
    expect(document.querySelector("main[data-upcoming]")).toBe(mounted);
  });
});

describe("adding", () => {
  test("a writer gets Add appointment and Add reminder, drafts that pick the time first; Add appointment opens one", async () => {
    const device = await openUpcoming({ role: "caretaker" });
    const links = [...document.querySelectorAll("main [data-upcoming-add] a")].map((a) => [
      a.textContent?.trim(),
      a.getAttribute("href"),
    ]);
    const base = `/app/groups/${TEST_GROUP.id}/entries/new`;
    expect(links).toEqual([
      ["Add appointment", `${base}?kind=event&when=pick`],
      ["Add reminder", `${base}?kind=note&when=pick`],
    ]);
    await userEvent.click(page.getByRole("link", { name: "Add appointment" }));
    await expect.poll(() => device.location()).toBe(`${base}?kind=event&when=pick`);
  });

  test("a viewer sees Upcoming, with no Add appointment or Add reminder", async () => {
    await openUpcoming({ role: "viewer" });
    expect(listed().map((r) => r.id)).toContain(CARDIOLOGY.id);
    expect(document.querySelector("main [data-upcoming-add]")).toBeNull();
  });
});

describe("filters", () => {
  test("the Appointments chip shows only events, in the URL, and survives a reload", async () => {
    const device = await openUpcoming();
    expect(chip("All")!.getAttribute("aria-current")).toBe("true");
    await userEvent.click(chip("Appointments")!);
    await expect.poll(() => device.location()).toBe(`${UPCOMING_URL}?kind=event`);
    await expect.poll(() => listed().some((r) => r.id === REFILL.id)).toBe(false);
    expect(listed().every((r) => r.kindLink === "Show only events")).toBe(true);
    // A reload: the screen opened at that URL.
    await device.screen.unmount();
    await openUpcoming({ url: device.location() });
    expect(chip("Appointments")!.getAttribute("aria-current")).toBe("true");
    const rows = listed();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kindLink === "Show only events")).toBe(true);
  });

  test("an author's initials show only their items, with a chip naming them that clears it", async () => {
    const device = await openUpcoming();
    await userEvent.click(
      document.querySelector(`[data-upcoming-item="${THERAPY.id}"] [data-author="${SAM.id}"]`)!,
    );
    await expect.poll(() => device.location()).toBe(`${UPCOMING_URL}?author=${SAM.id}`);
    await expect.poll(() => listed().map((r) => r.id)).toEqual([THERAPY.id, HOSPICE.id, RIDE.id]);
    const by = page.getByRole("link", { name: "By Sam Okafor: clear this filter" });
    await expect.element(by).toHaveAttribute("aria-current", "true");
    await userEvent.click(by);
    await expect.poll(() => device.location()).toBe(UPCOMING_URL);
    await expect.poll(() => listed().length).toBe(9);
  });
});

describe("the Past tab", () => {
  test("from Upcoming's tab: past events only, newest first, cancelled ones included, no notes; the Past tab current", async () => {
    const device = await openUpcoming();
    await userEvent.click(tab("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.element(page.getByText("Hearing test")).toBeInTheDocument();
    expect(tab("Past").getAttribute("aria-current")).toBe("page");
    expect(tab("Upcoming").getAttribute("aria-current")).toBeNull();
    const rows = listed();
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual([BLOOD_DRAW.id, HEARING.id, PODIATRY.id]);
    expect(rowOf(HEARING.id)).toMatchObject({ cancelled: true, struck: true });
    expect(rowOf(PODIATRY.id)!.cancelled).toBe(true);
    expect(rows.find((r) => r.id === PAST_NOTE.id)).toBeUndefined();
    expect(new Set(rows.map((r) => r.kindLink))).toEqual(new Set(["Show only events"]));
    const days = [...new Set(rows.map((r) => r.day))];
    expect(days).toEqual([...days].sort().reverse());
  });

  test("one page first; scrolling to the end loads the older ones, then says so", async () => {
    await openUpcoming({ url: PAST_URL });
    const first = listed().length;
    expect(first).toBeLessThan(33);
    for (let i = 0; i < 20 && listed().length < 33; i++) {
      document.querySelector("[data-older-entries]")?.scrollIntoView({ block: "end" });
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(listed()).toHaveLength(33);
    expect(listed().at(-1)!.text).toContain("Older visit 29");
    await expect
      .poll(() => document.querySelector("[data-older-entries]")?.textContent)
      .toContain("That's the first event");
  });
});

describe("a non-member", () => {
  test("another group's Upcoming is Not found, with nothing of it", async () => {
    await openUpcoming({ role: null });
    await expect.element(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    expect(document.body.textContent).not.toContain("Cardiology");
  });
});

describe("today's due doses", () => {
  // At 10:00: a slot at 9:57 (due) and one at 10:20 (later), with an event at 10:10 between them.
  const DONEPEZIL = fx.medication({
    name: "Donepezil",
    strength: "5 mg",
    schedule: { type: "scheduled", slots: [{ time: "09:57" }, { time: "10:20" }] },
  });
  const BETWEEN = fx.event({ title: "Between doses", occurredAt: laTime(0, 10, 10) });
  const DUE = `${DONEPEZIL.id}@09:57`;
  const LATER = `${DONEPEZIL.id}@10:20`;
  const doseRow = (key: string) => document.querySelector<HTMLElement>(`main [data-upcoming-dose="${key}"]`);
  const today = () => {
    const day = [...document.querySelectorAll("main [data-upcoming-list] [data-day]")].find(
      (d) => d.querySelector("h3")?.textContent?.trim() === "Today",
    )!;
    return [...day.querySelectorAll<HTMLElement>("li[data-upcoming-dose], li[data-upcoming-item]")].map(
      (li) => li.dataset.upcomingDose ?? li.dataset.upcomingItem,
    );
  };
  const doses = [DONEPEZIL, BETWEEN];

  test("they show under Today in time order around an event between them; the due one says Due, the later one nothing, both named", async () => {
    await openUpcoming({ extra: doses });
    expect(today()).toEqual([DUE, BETWEEN.id, LATER, THERAPY.id]);
    const due = doseRow(DUE)!;
    const later = doseRow(LATER)!;
    expect(due.dataset.slotState).toBe("due");
    expect(due.querySelector("[data-dose-state]")?.textContent).toBe("Due");
    expect(later.dataset.slotState).toBe("upcoming");
    expect(later.querySelector("[data-dose-state]")).toBeNull();
    for (const row of [due, later]) expect(row.textContent).toContain("Donepezil 5 mg dose");
    expect(due.querySelector("a")?.getAttribute("aria-label")).toMatch(/^Log .* dose, due$/);
  });

  test("a viewer sees the doses, with no link", async () => {
    await openUpcoming({ extra: doses, role: "viewer" });
    expect(doseRow(DUE)).not.toBeNull();
    expect(doseRow(LATER)).not.toBeNull();
    expect(doseRow(DUE)!.querySelectorAll("a")).toHaveLength(0);
    expect(doseRow(LATER)!.querySelectorAll("a")).toHaveLength(0);
  });

  test("a kind filter hides them", async () => {
    await openUpcoming({ extra: doses, url: `${UPCOMING_URL}?kind=event` });
    expect(listed().length).toBeGreaterThan(0);
    expect(document.querySelector("main [data-upcoming-dose]")).toBeNull();
  });

  test("the due one opens the Dose sheet on its medication and slot; logging it comes back to Upcoming without it, the later one kept, one dose queued", async () => {
    const device = await openUpcoming({ extra: doses });
    await userEvent.click(doseRow(DUE)!.querySelector("a")!);
    await expect.poll(() => device.location()).toMatch(/\/timeline\/new\/dose\?/);
    const search = new URLSearchParams(device.location().split("?")[1]);
    expect(search.get("slot")).toBe("09:57");
    expect(device.location()).toContain(DONEPEZIL.id);
    const sheet = page.getByRole("dialog");
    await expect
      .poll(
        () =>
          sheet.element().querySelector<HTMLInputElement>(`input[name="medicationId"][value="${DUE}"]`)
            ?.checked,
      )
      .toBe(true);
    const submits = sheet.element().querySelectorAll<HTMLButtonElement>("button[type=submit]");
    await userEvent.click(submits[submits.length - 1]!);
    await expect.poll(() => device.location(), { timeout: 5000 }).toBe(UPCOMING_URL);
    await device.settle();
    await expect.poll(() => doseRow(DUE)).toBeNull();
    expect(doseRow(LATER)).not.toBeNull();
    const queued = (await device.queued()).filter((w) => w.type === "timeline_entry");
    expect(queued).toHaveLength(1);
    expect(queued[0]!.data).toMatchObject({ kind: "dose" });
    expect(JSON.parse(queued[0]!.data!.details as string)).toMatchObject({
      medicationId: DONEPEZIL.id,
      scheduledFor: "09:57",
    });
  });
});
