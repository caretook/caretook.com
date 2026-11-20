import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { PLACEHOLDER_MS } from "~/components/quick-entry/useRotatingPlaceholder";
import { forgetRecentLines, recentLines, recordLine } from "~/lib/assistant/recentLines";
import { addDays, dayInZone, timeInZone, zonedInstant } from "~/lib/core/zonedDay";
import * as timeline from "./route";
import { rowWith, TIMELINE_URL, waitUntil } from "./timelineWorld";

// Quick entry's suggestions on the timeline, on the test device (offline
// throughout, so they all work offline): name autocomplete while typing,
// your recent lines, what the group usually logs around now, and the rotating
// placeholder. Every chip only fills the box; Save is still yours.

const METFORMIN = fx.medication({ name: "Metformin", strength: "500 mg", dose: "1 tablet" });
const METOPROLOL = fx.medication({ name: "Metoprolol", strength: "25 mg", dose: "1 tablet" });
const LEE = fx.provider({ name: "Dr. Sandra Lee" });

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/timeline", module: timeline }];

/** This time of day `n` days ago by the recipient's clock, `minutes` later (earlier when negative). */
const daysAgoNow = (n: number, minutes = 0) => {
  const now = new Date();
  const day = addDays(dayInZone(now, TEST_TIME_ZONE), -n);
  const instant = zonedInstant(day, timeInZone(now, TEST_TIME_ZONE), TEST_TIME_ZONE);
  return new Date(instant.getTime() + minutes * 60_000);
};
const bpDaysAgo = (n: number, minutes = 0) =>
  fx.vital({
    occurredAt: at(daysAgoNow(n, minutes)),
    readings: [{ type: "bloodPressure", systolic: 128, diastolic: 82 }],
  });

const open = (extra: Fixture[] = []) =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    fixtures: [METFORMIN, METOPROLOL, LEE, fx.note({ text: "Older note" }), ...extra],
  });

const box = () => page.getByRole("textbox", { name: "What happened?" });
const field = () => box().element() as HTMLTextAreaElement;
const names = () => page.getByRole("list", { name: "Matching names" });
const recent = () => page.getByRole("list", { name: "Your recent lines" });
const usual = () => page.getByRole("list", { name: "Usual around now" });
const chipLabels = (list: ReturnType<typeof names>) =>
  [...(list.query()?.querySelectorAll("button") ?? [])].map((b) => b.textContent);
const cardKinds = () =>
  [...document.querySelectorAll<HTMLElement>("[data-quick-card]")].map((c) => c.dataset.quickCard);
/** What the box says: "Saved 3 entries" (on its Undo line) or a refusal. */
const status = () =>
  document.querySelector("[data-quick-entry] [data-pass-undo-label]")?.textContent ||
  (document.querySelector("[data-quick-status]")?.textContent ?? "");
const entryCount = async (device: Awaited<ReturnType<typeof open>>) =>
  (await device.query("SELECT id FROM timeline_entry")).length;

afterEach(() => {
  forgetRecentLines();
  clearUndo();
});

describe("the placeholder", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const placeholder = () => field().placeholder;

  test("there's no tips paragraph, and the description holds the rules", async () => {
    await open();
    await expect.element(box()).toBeVisible();
    expect(document.querySelector("[data-quick-tips]")).toBeNull();
    const described = field()
      .getAttribute("aria-describedby")!
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    expect(described).toContain("Commas separate entries");
    expect(described).toContain("“n:”");
  });

  test("it rotates through the examples while the box is empty and unfocused", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await open();
    await expect.element(box()).toBeVisible();
    expect(placeholder()).toBe("bp 130/85 hr 72");
    await vi.advanceTimersByTimeAsync(PLACEHOLDER_MS);
    await expect.poll(placeholder).toBe("gave metformin");
    await vi.advanceTimersByTimeAsync(PLACEHOLDER_MS);
    await expect.poll(placeholder).toBe("pain 4 left knee");

    // Focus stops it.
    field().focus();
    await vi.advanceTimersByTimeAsync(PLACEHOLDER_MS * 3);
    await expect.poll(placeholder).toBe("bp 130/85 hr 72");
  });

  test("under reduced motion it shows the first example and stays", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((q) =>
      q.includes("prefers-reduced-motion") ? { ...real(q), matches: true } : real(q),
    );
    await open();
    await expect.element(box()).toBeVisible();
    await vi.advanceTimersByTimeAsync(PLACEHOLDER_MS * 3);
    expect(placeholder()).toBe("bp 130/85 hr 72");
  });
});

describe("name autocomplete", () => {
  test("a partial medication name offers the matches; picking one completes the word", async () => {
    const device = await open();
    // Names load a moment after mount (live queries).
    await userEvent.fill(box(), "bp 120/80, gave met");
    await waitUntil(() => chipLabels(names()).length === 2, 4000, "the medication names");
    expect(chipLabels(names())).toEqual(["Metformin", "Metoprolol"]);

    await userEvent.click(names().getByRole("button", { name: "Metformin" }));
    await expect.element(box()).toHaveValue("bp 120/80, gave Metformin ");
    await waitUntil(() => document.activeElement === field(), 2000, "focus back in the box");
    expect(field().selectionStart).toBe(field().value.length);
    expect(names().query()).toBeNull();
    await waitUntil(() => cardKinds().join() === "vital,dose", 4000, "the cards");
    // Picking never saves.
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'dose'")).toHaveLength(0);
  });

  test("a partial provider name, with the title typed before it, completes to the full name", async () => {
    await open();
    await userEvent.fill(box(), "appt dr le");
    await waitUntil(() => chipLabels(names()).includes("Dr. Sandra Lee"), 4000, "the provider name");
    await userEvent.click(names().getByRole("button", { name: "Dr. Sandra Lee" }));
    await expect.element(box()).toHaveValue("appt Dr. Sandra Lee ");
  });

  test("nothing for a word that matches no name, or a name typed in full", async () => {
    await open();
    await userEvent.fill(box(), "gave met");
    await waitUntil(() => chipLabels(names()).length > 0, 4000, "the names");
    await userEvent.fill(box(), "gave metformin");
    await waitUntil(() => !names().query(), 4000, "no names");
    await userEvent.fill(box(), "pain 4 left knee");
    await waitUntil(() => cardKinds().length > 0);
    expect(names().query()).toBeNull();
  });
});

describe("recent lines", () => {
  test("a saved line is recorded for this user and group, and offered once the box is empty", async () => {
    await open();
    expect(recent().query()).toBeNull();
    await userEvent.fill(box(), "pain 4 left knee");
    await waitUntil(() => cardKinds().join() === "symptom", 4000, "the card");
    // Typing alone records nothing.
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual([]);
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual(["pain 4 left knee"]);
    await expect.element(recent()).toBeVisible();
    expect(chipLabels(recent())).toEqual(["pain 4 left knee"]);
  });

  test("on the next visit they're chips, newest first, that fill the box and never save", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "gave metformin");
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    recordLine("someone-else", TEST_GROUP.id, "not mine");
    const device = await open();
    await expect.element(recent()).toBeVisible();
    // Lines are read against the group's medications, which load a moment after the box.
    await waitUntil(() => chipLabels(recent()).length === 2, 4000, "both chips");
    expect(chipLabels(recent())).toEqual(["pain 4 left knee", "gave metformin"]);
    const before = await entryCount(device);

    await userEvent.click(recent().getByRole("button", { name: "gave metformin" }));
    await expect.element(box()).toHaveValue("gave metformin");
    await waitUntil(() => document.activeElement === field(), 2000, "focus in the box");
    await waitUntil(() => cardKinds().length > 0, 4000, "the cards");
    expect(recent().query()).toBeNull();
    expect(status()).toBe("");
    expect(await entryCount(device)).toBe(before);
  });

  test("a saved vital is remembered by its keys; a chip fills them with the cursor after, and notes never appear", async () => {
    await open();
    await userEvent.fill(box(), "bp 130/85 hr 72");
    await waitUntil(() => cardKinds().join() === "vital", 4000, "the card");
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual(["bp hr "]);

    await userEvent.fill(box(), "bp 120/80, n: slept well");
    await waitUntil(() => cardKinds().join() === "vital,note", 4000, "the cards");
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 2 entries");
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual(["bp ", "bp hr "]);

    await userEvent.click(recent().getByRole("button", { name: "bp" }));
    await expect.element(box()).toHaveValue("bp ");
    await waitUntil(() => document.activeElement === field(), 2000, "focus in the box");
    expect(field().selectionStart).toBe(3);
  });

  test("notes and full vital values stored earlier are reduced as they're read", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "n: slept well");
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    recordLine(TEST_USER.id, TEST_GROUP.id, "bp 120/80");
    await open();
    await expect.element(recent()).toBeVisible();
    expect(chipLabels(recent())).toEqual(["bp ", "pain 4 left knee"]);
  });

  test("gone once forgotten (sign-out's wipe)", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "bp 120/80");
    await open();
    await expect.element(recent()).toBeVisible();
    forgetRecentLines();
    await waitUntil(() => !recent().query(), 2000, "the chips to go");
  });
});

describe("usual around now", () => {
  test("blood pressures around this time on 3 recent days give a bp chip that fills the box and waits for numbers", async () => {
    const device = await open([bpDaysAgo(1, -20), bpDaysAgo(2, 15), bpDaysAgo(4, 40)]);
    await waitUntil(() => chipLabels(usual()).includes("bp"), 4000, "the bp chip");
    expect(chipLabels(usual())).toEqual(["bp"]);
    const before = await entryCount(device);

    await userEvent.click(usual().getByRole("button", { name: "bp" }));
    await expect.element(box()).toHaveValue("bp ");
    await waitUntil(() => document.activeElement === field(), 2000, "focus in the box");
    expect(status()).toBe("");
    expect(await entryCount(device)).toBe(before);

    await userEvent.keyboard("120/80");
    await expect.element(box()).toHaveValue("bp 120/80");
    await waitUntil(() => cardKinds().join() === "vital", 4000, "the vital card");
    expect(await entryCount(device)).toBe(before);
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    await waitUntil(() => !!rowWith("BP 120/80"), 4000, "the row");
  });

  test("two days, or readings far from this hour, give no chip (notes on three days do)", async () => {
    const notes = [1, 2, 3].map((n) =>
      fx.note({ occurredAt: at(daysAgoNow(n, 5)), text: `Morning note ${n}` }),
    );
    await open([bpDaysAgo(1), bpDaysAgo(2), bpDaysAgo(3, 180), bpDaysAgo(5, -150), ...notes]);
    await waitUntil(() => chipLabels(usual()).length > 0, 4000, "the usual chips");
    expect(chipLabels(usual())).toEqual(["note"]);
    await userEvent.click(usual().getByRole("button", { name: "note" }));
    await expect.element(box()).toHaveValue("n: ");
  });
});
