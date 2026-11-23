import type { TimelineEntryKind } from "@caretook/data/schema";
import type { KindChip } from "~/lib/timeline/entryDisplay";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderWithDevice } from "../../../../../test/device";
import { rgba } from "../../../../../test/contrast";
import { at, condition, conditionChangeEntry, fx } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { accentClass } from "~/components/ui";
import { KIND_META, TODO_CHIP } from "~/lib/timeline/entryDisplay";
import * as timeline from "./route";
import { iconOf, openTimeline, rowOf, TIMELINE_URL } from "./timelineWorld";

// The entry-type colours as painted: a timeline day with one entry of every
// kind, and quick entry's cards. Each chip paints its kind's accent, never a
// status colour, and keeps its icon and name.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const MEDICATION = fx.medication({ name: "Metformin", strength: "500 mg", dose: "1 tablet" });
const HIP = condition({ name: "Hip fracture" });

const EVERY_KIND = [
  MEDICATION,
  HIP,
  fx.note({ occurredAt: minutesAgo(5), text: "A quiet morning" }),
  fx.symptom({ occurredAt: minutesAgo(10), name: "Dizzy" }),
  fx.event({ occurredAt: minutesAgo(15), title: "Clinic visit", text: "Went well." }),
  fx.vital({ occurredAt: minutesAgo(20), readings: [{ type: "heartRate", value: 66 }] } as never),
  fx.dose({ occurredAt: minutesAgo(25), medicationId: MEDICATION.id }),
  fx.medicationChange({ occurredAt: minutesAgo(30), medicationId: MEDICATION.id }),
  conditionChangeEntry({ occurredAt: minutesAgo(35), conditionId: HIP.id, conditionName: "Hip fracture" }),
];

const KINDS = Object.keys(KIND_META) as TimelineEntryKind[];
const STATUSES = ["bg-warning", "bg-error", "bg-success", "bg-info"];

const fill = (el: Element) => rgba(getComputedStyle(el).backgroundColor);

/** What a class paints, from a probe beside the screen. */
const painted = (classes: string) => {
  const probe = document.createElement("span");
  probe.className = classes;
  document.body.append(probe);
  const colour = fill(probe);
  probe.remove();
  return colour;
};

describe("entry colours", () => {
  test.each(["light", "dark"] as const)("a day with every kind, in %s", async (theme) => {
    await openTimeline({ fixtures: EVERY_KIND, theme });
    for (const kind of KINDS) {
      const { label, plural, accent, look } = KIND_META[kind];
      const row = await found(() => rowOf(label));
      const link = iconOf(row);
      expect(link.getAttribute("aria-label"), kind).toBe(`Show only ${plural.toLowerCase()}`);
      const chip = link.querySelector("[data-icon-chip]")!;
      expect(chip.querySelector("svg"), kind).not.toBeNull();
      expect(fill(chip), kind).toEqual(painted(accentClass(accent, look)));
      for (const status of STATUSES) expect(fill(chip), `${kind} / ${status}`).not.toEqual(painted(status));
    }
  });
});

describe("quick entry's cards", () => {
  test("a card per kind takes its accent, and the to-do is soft orange", async () => {
    await renderWithDevice({
      route: { path: "/app/groups/:groupId/timeline", module: timeline },
      url: TIMELINE_URL,
      fixtures: [MEDICATION],
    });
    const box = page.getByRole("textbox", { name: "What happened?" });
    const expectCards = async (expected: Record<string, KindChip>) => {
      for (const [kind, { accent, look }] of Object.entries(expected)) {
        const chip = await found(() =>
          document.querySelector(`[data-quick-card="${kind}"] [data-icon-chip]`),
        );
        expect(fill(chip), kind).toEqual(painted(accentClass(accent, look)));
      }
    };
    // `n:` and `e:` keep the rest of their line, so each closes a line of its own.
    await userEvent.fill(box, "bp 120/80, gave metformin, pain 4, todo: call the pharmacy, n: slept well");
    await expectCards({
      vital: KIND_META.vital,
      dose: KIND_META.dose,
      symptom: KIND_META.symptom,
      todo: TODO_CHIP,
      note: KIND_META.note,
    });
    const todo = await found(() => document.querySelector('[data-quick-card="todo"] [data-icon-chip]'));
    expect(fill(todo)).toEqual(painted(accentClass("orange", "soft")));
    await userEvent.fill(box, "e: Clinic visit");
    await expectCards({ event: KIND_META.event });
  });
});
