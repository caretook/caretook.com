import { describe, expect, test } from "vitest";
import { at, entryTodo, fx, todo, TEST_USER } from "../../../../../test/fixtures";
import { waitUntil } from "../../../../../test/found";
import { chooseEasyMode, openTimeline, rowWith, rows, setView } from "./timelineWorld";

// The open-todo mark (planner-3): a note or event linking open todos says
// "1 todo" or "2 todos" on its row and card, as text, from one live group
// query. A ticked todo stops counting; easy mode shows no mark.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const NOTE = fx.note({ occurredAt: minutesAgo(5), text: "Pharmacy said the refill is late" });
const EVENT = fx.event({ occurredAt: minutesAgo(30), title: "Eye exam" });
const PLAIN = fx.note({ occurredAt: minutesAgo(45), text: "Quiet afternoon" });
const SYMPTOM = fx.symptom({ occurredAt: minutesAgo(50), name: "Sore knee" });
const CALL_FIELDS = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a01", title: "Call the pharmacy" };
const DROPS_FIELDS = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a02", title: "Buy eye drops" };
const CALL = todo(CALL_FIELDS);
const PICKUP = todo({ title: "Pick up the refill" });
const DROPS = todo(DROPS_FIELDS);
const DONE = todo({ title: "Book the exam", doneAt: minutesAgo(60), doneBy: TEST_USER.id });
const fixtures = [
  NOTE,
  EVENT,
  PLAIN,
  SYMPTOM,
  CALL,
  PICKUP,
  DROPS,
  DONE,
  entryTodo(NOTE.id, CALL.id),
  entryTodo(NOTE.id, PICKUP.id),
  entryTodo(EVENT.id, DROPS.id),
  entryTodo(EVENT.id, DONE.id),
  // No kind check in the table: a symptom's link shows nothing.
  entryTodo(SYMPTOM.id, CALL.id),
];

const markOf = (text: string) => rowWith(text)?.querySelector<HTMLElement>("[data-open-todos]") ?? null;

describe("the open-todo mark", () => {
  test("rows: on a note and an event with open todos, as text; not on others; gone once ticked", async () => {
    const device = await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 4, "four rows");
    await waitUntil(() => !!markOf("Pharmacy said"), "the note's mark");
    expect(markOf("Pharmacy said")?.textContent).toBe("2 todos");
    // The done todo doesn't count.
    expect(markOf("Eye exam")?.textContent).toBe("1 todo");
    expect(markOf("Quiet afternoon")).toBeNull();
    expect(markOf("Sore knee")).toBeNull();
    // Text, not an icon's label: the icon is hidden from screen readers.
    expect(markOf("Eye exam")?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    // Ticked on another device: the event's mark goes, the note's counts down.
    await device.sync(todo({ ...DROPS_FIELDS, doneAt: minutesAgo(1), doneBy: TEST_USER.id }));
    await device.settle();
    await waitUntil(() => !markOf("Eye exam"), "the event's mark gone");
    await device.sync(todo({ ...CALL_FIELDS, doneAt: minutesAgo(1), doneBy: TEST_USER.id }));
    await device.settle();
    await waitUntil(() => markOf("Pharmacy said")?.textContent === "1 todo", "the note's mark at 1");
  });

  test("cards: the mark too", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 4, "four rows");
    await setView("Full");
    await waitUntil(() => markOf("Eye exam")?.textContent === "1 todo", "the card's mark");
    expect(markOf("Pharmacy said")?.textContent).toBe("2 todos");
  });

  test("easy mode: no mark", async () => {
    chooseEasyMode();
    await openTimeline({ fixtures });
    await waitUntil(() => !!document.querySelector("[data-easy-list]"), "the easy view");
    await waitUntil(() => !!rowWith("Eye exam"), "the event's row");
    expect(document.querySelector("[data-open-todos]")).toBeNull();
  });
});
