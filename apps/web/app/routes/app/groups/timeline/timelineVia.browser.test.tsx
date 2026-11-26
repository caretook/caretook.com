import { describe, expect, test } from "vitest";
import { at, fx } from "../../../../../test/fixtures";
import { openTimeline, rowWith, rows, SAM, setView } from "./timelineWorld";
import { waitUntil } from "../../../../../test/found";

// The "via" tag (connectors): an entry a member added through their own AI
// assistant says so on its row and its card ("via Claude", `data-via`), and
// an entry without one has none. The server sets `via`; the device only shows it.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const VIA_NOTE = fx.note({ occurredAt: minutesAgo(5), text: "Walked to the mailbox", via: "Claude" });
const VIA_VITAL = fx.vital({
  occurredAt: minutesAgo(8),
  createdBy: SAM.id,
  readings: [{ type: "heartRate", value: 71 }],
  via: "Claude",
});
const PLAIN = fx.symptom({ occurredAt: minutesAgo(12), name: "Sore knee" });
const fixtures = [SAM, VIA_NOTE, VIA_VITAL, PLAIN];

const tagOf = (text: string) => rowWith(text)?.querySelector<HTMLElement>("[data-via]") ?? null;

describe("the via tag", () => {
  test("rows: on entries added through an assistant, and not on others", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 3, "three rows");
    expect(tagOf("Walked to the mailbox")?.textContent).toBe("via Claude");
    expect(tagOf("Walked to the mailbox")?.dataset.via).toBe("Claude");
    expect(tagOf("71")?.textContent).toBe("via Claude");
    expect(tagOf("Sore knee")).toBeNull();
    // Still the member's entry: the author chip is unchanged.
    expect(rowWith("71")?.querySelector("a[data-author]")?.getAttribute("data-author")).toBe(SAM.id);
  });

  test("cards: beside the author, and not on others", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 3, "three rows");
    await setView("Full");
    await waitUntil(() => !!tagOf("Walked to the mailbox"), "the card's tag");
    const card = rowWith("Walked to the mailbox")!;
    expect(card.querySelector("[data-via]")?.textContent).toBe("via Claude");
    // In the footer, after who wrote it.
    expect(card.querySelector("a[data-author] ~ [data-via]")).not.toBeNull();
    expect(tagOf("Sore knee")).toBeNull();
  });
});
