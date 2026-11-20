import type { VitalReading } from "@caretook/data/schema";

import { describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

/** Chrome DevTools, for media emulation (Vitest types the session loosely). */
const devtools = () => cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
import { at, fx, medicationPass, newId, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import {
  chip,
  frames,
  openTimeline,
  rowWith,
  rows,
  SAM,
  setView,
  TIMELINE_URL,
  waitUntil,
  world,
} from "./timelineWorld";

// The strips above the timeline on the test device (from phase2.mjs: the
// Next strip, the latest vitals line, the medication strip and pass logs;
// from live-notes.mjs: the Live now banner and the live dot, as another
// device's edits arrive by sync). The wording is the pure modules' (liveNow,
// upcomingLabels, medicationStrip); this is what's on the screen.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const inHours = (h: number) => at(new Date(Date.now() + h * 3_600_000));

const width = async (w: number) => {
  await page.viewport(w, 900);
  await frames();
};

describe("the Next strip", () => {
  test("no future note or event is in the history; the strip names a live one ahead, +N more, and Show upcoming, above the list", async () => {
    const ahead = [
      fx.event({ title: "Cardiology follow-up", occurredAt: inHours(26) }),
      fx.event({ title: "Dentist", occurredAt: inHours(50) }),
      fx.note({ title: "Call the pharmacy", occurredAt: inHours(30) }),
      fx.event({ title: "Cancelled visit", occurredAt: inHours(3), cancelledAt: minutesAgo(5) }),
    ];
    await openTimeline({ fixtures: [world(), ahead] });
    await waitUntil(() => rows().length > 0);
    const history = document.querySelector('main section[aria-labelledby="timeline-heading"]')!;
    expect(ahead.filter((e) => history.querySelector(`a[href$="/entries/${e.id}"]`))).toEqual([]);
    await waitUntil(
      () => !!document.querySelector("main [data-next-strip] [data-next]"),
      4000,
      "the Next strip",
    );
    const strip = document.querySelector("main [data-next-strip]")!;
    const link = strip.querySelector<HTMLElement>("[data-next]")!;
    expect(link.dataset.next).toBe(ahead[0]!.id); // the cancelled one is never next
    expect(link.textContent).toMatch(/^Next: .+ · .+ · \+\d+ more$/);
    expect(strip.querySelector("[data-upcoming-toggle]")?.textContent?.trim()).toBe("Show upcoming");
    expect(
      strip.compareDocumentPosition(document.querySelector("main ol")!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("the latest vitals line", () => {
  const readings: VitalReading[] = [
    { type: "temperature", value: 37.1 },
    { type: "spo2", value: 97 },
    { type: "weight", value: 61.2 },
    { type: "respiratoryRate", value: 16 },
    { type: "bloodGlucose", value: 104 },
  ];
  const vitals = () => [
    world(),
    ...readings.map((r, i) => fx.vital({ readings: [r], occurredAt: minutesAgo(40 + i * 10) })),
    fx.event({ title: "Eye exam", occurredAt: inHours(30) }),
    fx.event({ title: "Haircut", occurredAt: inHours(54) }),
  ];
  const strip = () => document.querySelector<HTMLElement>('section[aria-labelledby="latest-vitals"]')!;
  const toggle = () => strip().querySelector<HTMLButtonElement>("button[aria-expanded]")!;
  const measure = () => {
    const s = strip();
    const ul = s.querySelector("ul")!;
    const b = toggle();
    const sr = s.getBoundingClientRect();
    const ur = ul.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const lis = [...ul.children];
    return {
      height: sr.height,
      lines: new Set(lis.map((li) => Math.round(li.getBoundingClientRect().top))).size,
      started: lis.filter((li) => li.getBoundingClientRect().left < ur.right - 24).length,
      whole: lis.filter((li) => li.getBoundingClientRect().right <= ur.right + 0.5).length,
      count: lis.length,
      times: lis.map((li) => li.querySelector("time")!.dateTime),
      readings: lis
        .map((li) => `${li.querySelector("span")!.textContent}@${li.querySelector("time")!.dateTime}`)
        .join("|"),
      buttonClear:
        br.right <= sr.right + 0.5 &&
        (br.left >= ur.right - 0.5 || br.bottom <= ur.top + 0.5) &&
        b.contains(document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2)),
      controls: !!document.getElementById(b.getAttribute("aria-controls")!)?.contains(lis[0]!),
      name: b.textContent?.trim(),
    };
  };

  // Hidden below `sm` (phones), so its narrowest is 640.
  test("at 640: one 32 px line led by the icon, at most 4 readings newest first, All vitals never clipped", async () => {
    await openTimeline({ fixtures: vitals(), width: 640 });
    await waitUntil(() => !!strip());
    const m = measure();
    expect(m.lines).toBe(1);
    expect(Math.abs(m.height - 32)).toBeLessThan(1);
    expect(m.buttonClear).toBe(true);
    expect(m.started).toBeGreaterThanOrEqual(2);
    expect(m.count).toBeGreaterThanOrEqual(1);
    expect(m.count).toBeLessThanOrEqual(4);
    expect(m.times.every((t, i) => i === 0 || m.times[i - 1]! >= t)).toBe(true);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(m.name).toBe("All vitals");
    expect(m.controls).toBe(true);
    const h = strip().querySelector("h2")!;
    expect(h.textContent?.trim()).toBe("Latest vitals");
    expect(h.querySelector("svg[aria-hidden]")).toBeTruthy();
    const visibleText = [...h.childNodes].some((n) =>
      n.nodeType === 3
        ? !!n.textContent?.trim()
        : (n as Element).tagName !== "svg" && (n as Element).getBoundingClientRect().width > 1,
    );
    expect(visibleText).toBe(false);
  });

  test("at 1280: one line of the same height with more readings; from 1280 the vitals and Next strips match, centred, wider than the column", async () => {
    await openTimeline({ fixtures: vitals(), width: 640 });
    await waitUntil(() => !!strip());
    const phone = measure();
    await width(1280);
    const wide = measure();
    expect(wide.lines).toBe(1);
    expect(wide.height).toBe(phone.height);
    expect(wide.buttonClear).toBe(true);
    expect(wide.whole).toBeGreaterThanOrEqual(3);
    for (const w of [1280, 1920]) {
      await width(w);
      const pageWidth = document.documentElement.clientWidth;
      const one = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          height: r.height,
          ok:
            r.width > 1024 &&
            r.width < pageWidth - 32 &&
            Math.abs(Math.round(r.left + r.width / 2 - pageWidth / 2)) <= 1,
          look: [
            cs.borderTopWidth,
            cs.borderTopColor,
            cs.borderRadius,
            cs.backgroundColor,
            cs.fontSize,
            cs.paddingLeft,
          ].join(" "),
        };
      };
      const v = one(strip());
      const n = one(document.querySelector("main [data-next-strip]"));
      expect({ w, v: v?.ok, n: n?.ok, height: v?.height === n?.height, look: v?.look === n?.look }).toEqual({
        w,
        v: true,
        n: true,
        height: true,
        look: true,
      });
    }
  });

  test("the kind filter leaves it alone; Enter expands every type; a tap collapses it; the next visit starts collapsed", async () => {
    const device = await openTimeline({ fixtures: vitals(), width: 640 });
    await waitUntil(() => !!strip());
    const phone = measure();
    await userEvent.click(chip("Notes"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    expect(measure().readings).toBe(phone.readings);

    toggle().focus();
    await userEvent.keyboard("{Enter}");
    await waitUntil(() => toggle().getAttribute("aria-expanded") === "true");
    const open = measure();
    expect(open.whole).toBe(open.count);
    expect(open.count).toBeGreaterThan(phone.count);
    expect(open.lines).toBeGreaterThan(1);
    expect(open.readings.startsWith(phone.readings)).toBe(true);
    expect(open.buttonClear).toBe(true);

    await userEvent.click(toggle());
    await waitUntil(() => toggle().getAttribute("aria-expanded") === "false");
    expect(measure().lines).toBe(1);
    expect(measure().height).toBe(phone.height);

    await userEvent.click(toggle());
    await waitUntil(() => toggle().getAttribute("aria-expanded") === "true");
    await device.screen.unmount();
    await openTimeline({ fixtures: vitals(), width: 640 });
    await waitUntil(() => !!strip());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(measure().lines).toBe(1);
  });
});

describe("the medication strip", () => {
  const read = () => {
    const s = document.querySelector<HTMLElement>("main [data-med-strip]");
    if (!s) return null;
    const r = s.getBoundingClientRect();
    const pageWidth = document.documentElement.clientWidth;
    return {
      state: s.dataset.stripState,
      height: r.height,
      wide:
        r.width > 1024 &&
        r.width < pageWidth - 32 &&
        Math.abs(Math.round(r.left + r.width / 2 - pageWidth / 2)) <= 1,
      givenAll: !!s.querySelector("[data-strip-given-all]"),
      controls: s.querySelectorAll("a, button").length,
      text: s.textContent?.trim() ?? "",
    };
  };
  // Three times a day, so something is always next or due whatever the clock.
  const meds = () => [
    world(),
    fx.medication({
      schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "14:00" }, { time: "20:00" }] },
    }),
  ];

  test.each(["owner", "viewer"] as const)(
    "%s: one line at 420, with Given all only for a writer while a pass is due",
    async (role) => {
      await openTimeline({ role, fixtures: meds() });
      await waitUntil(() => !!read(), 4000, "the medication strip");
      const s = read()!;
      expect(s.height).toBeGreaterThan(0);
      expect(s.height).toBeLessThanOrEqual(34);
      expect(s.text).toMatch(/^(Next|Due|Overdue): .+ · /);
      if (role === "viewer") expect(s.controls).toBe(0);
      else expect(s.givenAll).toBe(s.state === "due" || s.state === "overdue");
    },
  );

  test("1280: one line, wider than the column, narrower than the page, centred", async () => {
    await openTimeline({ width: 1280, fixtures: meds() });
    await waitUntil(() => !!read(), 4000, "the medication strip");
    expect(read()!.height).toBeLessThanOrEqual(34);
    expect(read()!.wide).toBe(true);
  });
});

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
    expect(row()!.querySelector('a[aria-label^="Edit Morning log"]')).toBeTruthy();
    await userEvent.click(row()!.querySelector("[data-pass-log-toggle]")!);
    await waitUntil(() => !row()!.querySelector<HTMLElement>("[data-pass-log-doses]")!.hidden);
    expect(row()!.querySelectorAll("[data-pass-log-doses] li").length).toBe(2);
    await setView("Cards");
    await waitUntil(() => text() === "Morning: 1 given, 1 refused");
    expect(tagged()).toBe(1);
  });

  test("viewer: the pass row with its toggle, and no pass sheet", async () => {
    await openTimeline({ role: "viewer", fixtures: round() });
    await waitUntil(() => text() === "Morning: 1 given, 1 refused", 4000, "the pass row");
    expect(row()!.querySelector("[data-pass-log-toggle]")).toBeTruthy();
    expect(row()!.querySelector("a[aria-label^='Edit']")).toBeNull();
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
    await waitUntil(
      () => bannerId() === live.entry.id && !!dotOf("Morning notes"),
      4000,
      "the banner and dot",
    );
    expect(BANNER()!.innerText.replace(/\s+/g, " ").trim()).toMatch(
      /^Sam Okafor is writing · Morning notes .*Join$/,
    );
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
    await new Promise((r) => setTimeout(r, 300));
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
    expect(BANNER()!.innerText.replace(/\s+/g, " ")).toMatch(/· \+1 more/);
    expect(!!dotOf("Lunch") && !!dotOf("PT visit")).toBe(true);
    await setView("Cards");
    expect(dotOf("PT visit")).toBeTruthy();
    await userEvent.click(BANNER()!.querySelector("a")!);
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
