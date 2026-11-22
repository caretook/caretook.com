import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { QUICK_ENTRY_PLACEHOLDER } from "~/components/quick-entry/quickEntryCopy";
import { forgetRecentLines, recentLines, recordLine } from "~/lib/assistant/recentLines";
import { addDays, dayInZone, timeInZone, zonedInstant } from "~/lib/core/zonedDay";
import * as timeline from "./route";
import { rowWith, TIMELINE_URL } from "./timelineWorld";
import { waitUntil } from "../../../../../test/found";

// Quick entry's suggestions on the timeline, on the test device (offline
// throughout, so they all work offline): name autocomplete floating under
// the field while typing; your recent lines and what the group usually logs
// around now, behind the Sparkles button in the empty box; and the static
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
const suggestButton = () => page.getByRole("button", { name: /^Suggestions/ });
const suggestions = () => page.getByRole("dialog", { name: "Suggestions" });
/** Open the empty box's suggestions (the button shows once there's something to suggest). */
const openSuggestions = async () => {
  await expect.element(suggestButton()).toBeVisible();
  await userEvent.click(suggestButton());
  await expect.element(suggestions()).toBeVisible();
};
const cardsTop = () => document.querySelector("[data-quick-cards]")?.getBoundingClientRect().top;
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

  test("the placeholder is one static prompt, unchanged as time passes", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await open();
    await expect.element(box()).toBeVisible();
    expect(placeholder()).toBe(QUICK_ENTRY_PLACEHOLDER);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(placeholder()).toBe(QUICK_ENTRY_PLACEHOLDER);
  });

  test("at 320px the box and the Suggestions button stay inside the container", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    await open();
    await expect.element(suggestButton()).toBeVisible();
    const container = field().closest("[data-quick-entry]") as HTMLElement;
    const prev = container.style.width;
    container.style.width = "320px";
    try {
      const right = container.getBoundingClientRect().right;
      const button = suggestButton().element().getBoundingClientRect();
      const box = field().getBoundingClientRect();
      expect(box.right).toBeLessThanOrEqual(right);
      // Inside the field's border.
      expect(button.right).toBeLessThanOrEqual(box.right);
      expect(button.top).toBeGreaterThanOrEqual(box.top);
      expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth);
    } finally {
      container.style.width = prev;
    }
  });
});

describe("the suggestions button", () => {
  test("the empty box has no chips under it; Suggestions opens them, and a chip fills the box and closes it", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    await open([bpDaysAgo(1, -20), bpDaysAgo(2, 15), bpDaysAgo(4, 40)]);
    await expect.element(suggestButton()).toBeVisible();
    expect(suggestButton().element().getAttribute("aria-label")).toBe("Suggestions");
    const section = document.querySelector("[data-quick-entry]")!;
    expect(section.querySelector("[data-quick-suggestions]")).toBeNull();
    expect(section.querySelectorAll("ul button")).toHaveLength(0);

    await userEvent.click(suggestButton());
    await expect.element(suggestions()).toBeVisible();
    await waitUntil(() => chipLabels(usual()).includes("bp"), "the usual chips");
    expect(chipLabels(recent())).toEqual(["pain 4 left knee"]);
    const rows = [...suggestions().element().querySelectorAll("[data-quick-row]")];
    expect(rows.map((r) => r.getAttribute("data-quick-row"))).toEqual(["usual", "recent"]);

    await userEvent.click(recent().getByRole("button", { name: "pain 4 left knee" }));
    await expect.element(box()).toHaveValue("pain 4 left knee");
    await expect.element(suggestions()).not.toBeInTheDocument();
    await waitUntil(() => document.activeElement === field(), "focus in the box");
  });

  test("no button with nothing to suggest, or while the box has text, and no help ?", async () => {
    await open();
    await expect.element(box()).toBeVisible();
    expect(suggestButton().query()).toBeNull();
    expect(page.getByRole("button", { name: "How quick entry works" }).query()).toBeNull();
  });

  test("it goes while typing and comes back once the box is empty", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    await open();
    await expect.element(suggestButton()).toBeVisible();
    await userEvent.fill(box(), "bp");
    await waitUntil(() => !suggestButton().query(), "the button to go");
    await userEvent.fill(box(), "");
    await expect.element(suggestButton()).toBeVisible();
  });
});

describe("name autocomplete", () => {
  test("a partial medication name offers the matches; picking one completes the word", async () => {
    const device = await open();
    // Names load a moment after mount (live queries).
    await userEvent.fill(box(), "bp 120/80, gave met");
    await waitUntil(() => chipLabels(names()).length === 2, "the medication names");
    expect(chipLabels(names())).toEqual(["Metformin", "Metoprolol"]);

    await userEvent.click(names().getByRole("button", { name: "Metformin" }));
    await expect.element(box()).toHaveValue("bp 120/80, gave Metformin ");
    await waitUntil(() => document.activeElement === field(), "focus back in the box");
    expect(field().selectionStart).toBe(field().value.length);
    expect(names().query()).toBeNull();
    await waitUntil(() => cardKinds().join() === "vital,dose", "the cards");
    // Picking never saves.
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'dose'")).toHaveLength(0);
  });

  test("a partial provider name, with the title typed before it, completes to the full name", async () => {
    await open();
    await userEvent.fill(box(), "appt dr le");
    await waitUntil(() => chipLabels(names()).includes("Dr. Sandra Lee"), "the provider name");
    await userEvent.click(names().getByRole("button", { name: "Dr. Sandra Lee" }));
    await expect.element(box()).toHaveValue("appt Dr. Sandra Lee ");
  });

  test("the names float under the field: the cards don't move, Escape hides them, and a name still completes", async () => {
    await open();
    await userEvent.fill(box(), "gave met");
    await waitUntil(() => cardKinds().length > 0, "the cards");
    await waitUntil(() => chipLabels(names()).length === 2, "the medication names");
    const shown = cardsTop();
    // Over the cards, not above them in the flow.
    const overlay = document.querySelector("[data-quick-completions]")!.getBoundingClientRect();
    expect(overlay.top).toBeGreaterThanOrEqual(field().getBoundingClientRect().bottom);
    expect(overlay.bottom).toBeGreaterThan(shown!);

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !names().query(), "the names to hide");
    expect(cardsTop()).toBe(shown);
    expect(document.activeElement).toBe(field());

    // Back once the text changes.
    await userEvent.keyboard("f");
    await waitUntil(() => chipLabels(names()).join() === "Metformin", "Metformin");
    expect(cardsTop()).toBe(shown);
    await userEvent.click(names().getByRole("button", { name: "Metformin" }));
    await expect.element(box()).toHaveValue("gave Metformin ");
    await waitUntil(() => document.activeElement === field(), "focus back in the box");
  });

  test("leaving the field hides the names", async () => {
    await open();
    await userEvent.fill(box(), "gave met");
    await waitUntil(() => chipLabels(names()).length === 2, "the medication names");
    field().blur();
    await waitUntil(() => !names().query(), "the names to hide");
    field().focus();
    await waitUntil(() => chipLabels(names()).length === 2, "the names again");
  });

  test("nothing for a word that matches no name, or a name typed in full", async () => {
    await open();
    await userEvent.fill(box(), "gave met");
    await waitUntil(() => chipLabels(names()).length > 0, "the names");
    await userEvent.fill(box(), "gave metformin");
    await waitUntil(() => !names().query(), "no names");
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
    await waitUntil(() => cardKinds().join() === "symptom", "the card");
    // Typing alone records nothing.
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual([]);
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual(["pain 4 left knee"]);
    await openSuggestions();
    await expect.element(recent()).toBeVisible();
    expect(chipLabels(recent())).toEqual(["pain 4 left knee"]);
  });

  test("on the next visit they're chips, newest first, that fill the box and never save", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "gave metformin");
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    recordLine("someone-else", TEST_GROUP.id, "not mine");
    const device = await open();
    await openSuggestions();
    await expect.element(recent()).toBeVisible();
    // Lines are read against the group's medications, which load a moment after the box.
    await waitUntil(() => chipLabels(recent()).length === 2, "both chips");
    expect(chipLabels(recent())).toEqual(["pain 4 left knee", "gave metformin"]);
    const before = await entryCount(device);

    await userEvent.click(recent().getByRole("button", { name: "gave metformin" }));
    await expect.element(box()).toHaveValue("gave metformin");
    await waitUntil(() => document.activeElement === field(), "focus in the box");
    await waitUntil(() => cardKinds().length > 0, "the cards");
    expect(suggestions().query()).toBeNull();
    expect(recent().query()).toBeNull();
    expect(status()).toBe("");
    expect(await entryCount(device)).toBe(before);
  });

  test("a saved vital is remembered by its keys; a chip fills them with the cursor after, and notes never appear", async () => {
    await open();
    await userEvent.fill(box(), "bp 130/85 hr 72");
    await waitUntil(() => cardKinds().join() === "vital", "the card");
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual(["bp hr "]);

    await userEvent.fill(box(), "bp 120/80, n: slept well");
    await waitUntil(() => cardKinds().join() === "vital,note", "the cards");
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 2 entries");
    expect(recentLines(TEST_USER.id, TEST_GROUP.id)).toEqual(["bp ", "bp hr "]);

    await openSuggestions();
    await userEvent.click(recent().getByRole("button", { name: "bp" }));
    await expect.element(box()).toHaveValue("bp ");
    await waitUntil(() => document.activeElement === field(), "focus in the box");
    expect(field().selectionStart).toBe(3);
  });

  test("notes and full vital values stored earlier are reduced as they're read", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "n: slept well");
    recordLine(TEST_USER.id, TEST_GROUP.id, "pain 4 left knee");
    recordLine(TEST_USER.id, TEST_GROUP.id, "bp 120/80");
    await open();
    await openSuggestions();
    await expect.element(recent()).toBeVisible();
    expect(chipLabels(recent())).toEqual(["bp ", "pain 4 left knee"]);
  });

  test("gone once forgotten (sign-out's wipe), and with nothing left, the button too", async () => {
    recordLine(TEST_USER.id, TEST_GROUP.id, "bp 120/80");
    await open();
    await expect.element(suggestButton()).toBeVisible();
    forgetRecentLines();
    await waitUntil(() => !suggestButton().query(), "the button to go");
  });
});

describe("usual around now", () => {
  test("blood pressures around this time on 3 recent days give a bp chip that fills the box and waits for numbers", async () => {
    const device = await open([bpDaysAgo(1, -20), bpDaysAgo(2, 15), bpDaysAgo(4, 40)]);
    await openSuggestions();
    await waitUntil(() => chipLabels(usual()).includes("bp"), "the bp chip");
    expect(chipLabels(usual())).toEqual(["bp"]);
    const before = await entryCount(device);

    await userEvent.click(usual().getByRole("button", { name: "bp" }));
    await expect.element(box()).toHaveValue("bp ");
    await waitUntil(() => document.activeElement === field(), "focus in the box");
    expect(status()).toBe("");
    expect(await entryCount(device)).toBe(before);

    await userEvent.keyboard("120/80");
    await expect.element(box()).toHaveValue("bp 120/80");
    await waitUntil(() => cardKinds().join() === "vital", "the vital card");
    expect(await entryCount(device)).toBe(before);
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe("Saved 1 entry");
    await waitUntil(() => !!rowWith("BP 120/80"), "the row");
  });

  test("two days, or readings far from this hour, give no chip (notes on three days do)", async () => {
    const notes = [1, 2, 3].map((n) =>
      fx.note({ occurredAt: at(daysAgoNow(n, 5)), text: `Morning note ${n}` }),
    );
    await open([bpDaysAgo(1), bpDaysAgo(2), bpDaysAgo(3, 180), bpDaysAgo(5, -150), ...notes]);
    await openSuggestions();
    await waitUntil(() => chipLabels(usual()).length > 0, "the usual chips");
    expect(chipLabels(usual())).toEqual(["note"]);
    await userEvent.click(usual().getByRole("button", { name: "note" }));
    await expect.element(box()).toHaveValue("n: ");
  });
});
