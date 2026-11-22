import { describe, expect, test } from "vitest";
import { cdp, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
import { at, fx, medicationPass, newId, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { frames, openTimeline, rowWith, rows, SAM, setView, waitUntil, world } from "./timelineWorld";

// What sits around the Today card on the test device (from phase2.mjs: pass
// logs; from live-notes.mjs: the Live now banner and the live dot, as another
// device's edits arrive by sync). The wording is the pure modules' (liveNow);
// this is what's on the screen. The card itself is todayCard.browser.test.tsx's.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));

describe("pass logs", () => {
  const morning = medicationPass({ name: "Morning", time: "08:00" });
  const lisinopril = fx.medication({ name: "Lisinopril" });
  const metformin = fx.medication({ name: "Metformin", strength: "500 mg" });
  const logId = newId();
  const roundDose = (medicationId: string, status: "given" | "refused") =>
    fx.dose({
      medicationId,
      status,
      occurredAt: minutesAgo(2),
      details: JSON.stringify({
        medicationId,
        status,
        amount: "1 tablet",
        passId: morning.id,
        passLogId: logId,
      }),
    });
  const round = () => [
    world(),
    morning,
    lisinopril,
    metformin,
    roundDose(lisinopril.id, "given"),
    roundDose(metformin.id, "refused"),
  ];
  const row = () => document.querySelector<HTMLElement>(`main [data-pass-log="${logId}"]`);
  const text = () => row()?.querySelector("[data-pass-log-text]")?.textContent;
  const tagged = () =>
    [...document.querySelectorAll("main ol > li")].filter(
      (li) => li.querySelector(`[data-pass-log="${logId}"]`) || li.matches(`[data-pass-log="${logId}"]`),
    ).length;

  test("a round logged together is one row, with its pass sheet link; the toggle lists each medication; one card too", async () => {
    await openTimeline({ fixtures: round() });
    await waitUntil(() => text() === "Morning: 1 given, 1 refused", 4000, "the pass row");
    expect(tagged()).toBe(1);
    await expect.poll(() => row()?.querySelector('a[aria-label^="Edit Morning log"]')).toBeTruthy();
    await userEvent.click(row()!.querySelector("[data-pass-log-toggle]")!);
    await waitUntil(() => !row()!.querySelector<HTMLElement>("[data-pass-log-doses]")!.hidden);
    await expect.poll(() => row()?.querySelectorAll("[data-pass-log-doses] li").length).toBe(2);
    await setView("Cards");
    await waitUntil(() => text() === "Morning: 1 given, 1 refused");
    expect(tagged()).toBe(1);
  });

  test("viewer: the pass row with its toggle, and no pass sheet", async () => {
    await openTimeline({ role: "viewer", fixtures: round() });
    await waitUntil(() => text() === "Morning: 1 given, 1 refused", 4000, "the pass row");
    await expect.poll(() => row()?.querySelector("[data-pass-log-toggle]")).toBeTruthy();
    await expect.poll(() => row()?.querySelector("a[aria-label^='Edit']")).toBeNull();
  });
});

describe("Live now and the live dot", () => {
  const BANNER = () => document.querySelector<HTMLElement>('main section[aria-label="Live now"]');
  const bannerId = () => BANNER()?.dataset.liveBanner ?? null;
  const dotOf = (title: string) => rowWith(title)?.querySelector<HTMLElement>("[data-live-dot]") ?? null;
  const announcements: string[] = [];
  const watchStatus = () => {
    announcements.length = 0;
    const el =
      BANNER()?.previousElementSibling ??
      document.querySelector('main p[role="status"]:not([data-search-status])')!;
    new MutationObserver(() => el.textContent && announcements.push(el.textContent)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    if (el.textContent) announcements.push(el.textContent);
  };
  /** A note and its document, last edited by `by` at `when`. */
  const written = (title: string, by: string, when: string, kind: "note" | "event" = "note") => {
    const entry = fx[kind]({ title, occurredAt: minutesAgo(50), createdBy: by });
    return {
      entry,
      doc: fx.document({ ownerId: entry.id, text: `${title} text`, editedBy: by, editedAt: when }),
    };
  };

  test("another member writing: the banner, the dot on that row only, its label, taps through it, the pulse, still under reduced motion", async () => {
    const idle = written("Idle note", SAM.id, minutesAgo(60));
    const device = await openTimeline({ fixtures: [world(), idle.entry, idle.doc] });
    await waitUntil(() => rows().length > 0);
    expect(BANNER()).toBeNull();
    expect(dotOf("Idle note")).toBeNull();
    watchStatus();

    const live = written("Morning notes", SAM.id, at());
    await device.sync([live.entry, live.doc]);
    await device.settle();
    expect(bannerId()).toBe(live.entry.id);
    await expect
      .poll(() => BANNER()?.innerText.replace(/\s+/g, " ").trim())
      .toMatch(/^Sam Okafor is writing · Morning notes .*Join$/);
    expect(dotOf("Morning notes")!.textContent).toBe("Being written now by Sam Okafor");
    expect(dotOf("Idle note")).toBeNull();
    const li = rowWith("Morning notes")!;
    li.scrollIntoView({ block: "center" });
    const r = dotOf("Morning notes")!.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    expect(hit?.matches('a[aria-label^="Open "]') && hit.closest("li") === li).toBe(true);
    const ping = () => getComputedStyle(dotOf("Morning notes")!.firstElementChild!);
    expect(ping().animationName).toBe("ping");
    await devtools().send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    try {
      await frames();
      expect(ping().display).toBe("none");
    } finally {
      await devtools().send("Emulation.setEmulatedMedia", { features: [] });
    }

    // More edits to the same document: announced once.
    await device.sync(
      fx.document({
        ownerId: live.entry.id,
        text: "Morning notes text, more",
        editedBy: SAM.id,
        editedAt: at(),
      }),
    );
    await device.settle();
    expect(announcements.filter((a) => a.endsWith(": Morning notes"))).toEqual([
      "Sam Okafor is writing: Morning notes",
    ]);
  });

  test("a viewer sees it too; two documents: the most recent leads with +N more, both rows dotted, cards too; Join opens it in one tap", async () => {
    const first = written("Lunch", SAM.id, at(new Date(Date.now() - 30_000)));
    const second = written("PT visit", SAM.id, at(), "event");
    const device = await openTimeline({
      role: "viewer",
      fixtures: [world(), first.entry, first.doc, second.entry, second.doc],
    });
    await waitUntil(() => bannerId() === second.entry.id, 4000, "the banner");
    await expect.poll(() => BANNER()?.innerText.replace(/\s+/g, " ")).toMatch(/· \+1 more/);
    expect(!!dotOf("Lunch") && !!dotOf("PT visit")).toBe(true);
    await setView("Cards");
    expect(dotOf("PT visit")).toBeTruthy();
    await userEvent.click(await found(() => BANNER()?.querySelector("a")));
    await expect
      .poll(() => device.location())
      .toBe(`/app/groups/${TEST_GROUP.id}/entries/${second.entry.id}`);
  });

  test("the writer's own typing shows no banner or dot", async () => {
    const mine = written("My note", TEST_USER.id, at());
    await openTimeline({ fixtures: [world(), mine.entry, mine.doc] });
    await waitUntil(() => !!rowWith("My note"));
    await new Promise((r) => setTimeout(r, 300));
    expect(dotOf("My note")).toBeNull();
    expect(bannerId()).toBeNull();
  });

  test(
    "expiry: shown while inside the 2-minute window, then gone on the timer with no new rows, and no longer announced",
    { timeout: 40_000 },
    async () => {
      // Last edited 1 min 50 s ago: inside the window now, past it within 10 s.
      const fading = written("Fading note", SAM.id, at(new Date(Date.now() - 110_000)));
      await openTimeline({ fixtures: [world(), fading.entry, fading.doc] });
      await waitUntil(() => bannerId() === fading.entry.id && !!dotOf("Fading note"), 4000, "the banner");
      const shownAt = Date.now();
      await waitUntil(() => !BANNER() && !dotOf("Fading note"), 30_000, "the banner and dot to go");
      expect(Date.now() - shownAt).toBeGreaterThan(5000);
      expect(
        document.querySelector('main p[role="status"]:not([data-search-status])')?.textContent ?? "",
      ).toBe("");
      expect(rowWith("Fading note")?.textContent).toContain("Fading note text");
    },
  );
});
