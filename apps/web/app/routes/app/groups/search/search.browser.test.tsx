import type { DeviceOptions, DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { useNavigate, useParams } from "react-router";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, newId, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { TIMELINE_ROUTES } from "../timeline/timelineWorld";
import * as search from "./route";

// The search page on the test device (from search.mjs, slices 3 to 5 and
// care-periods 6): the header's magnifier on every group screen, the field
// focused, sections in order (providers, medications, entries) with a polite
// count, each result opening what it is (Back, or closing a sheet, coming
// back to the same results), "See all N in timeline", "Show all", past
// providers and stopped medications marked, no matches, another group, a
// viewer; highlights and snippets; recent searches and the tips line; and
// the care period choice. The device is offline throughout, so every test
// here is also "search works offline". The ranking and the sections are
// searchResults.test.ts's, the marks and snippets searchHighlight.test.ts's,
// the recent list recentSearches.test.ts's.

const G = TEST_GROUP.id;
const searchUrl = (query = "") => `/app/groups/${G}/search${query}`;

/** Stands in for a provider's or medication's page: says which, and has Back. */
function PageProbe({ what }: { what: string }) {
  const params = useParams();
  const navigate = useNavigate();
  return (
    <main>
      <h1>
        {what} page {params.providerId ?? params.medicationId}
      </h1>
      <button type="button" onClick={() => void navigate(-1)}>
        Go back
      </button>
    </main>
  );
}
const ProviderProbe = () => <PageProbe what="Provider" />;
const MedicationProbe = () => <PageProbe what="Medication" />;

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/search", module: search },
  ...TIMELINE_ROUTES,
  { path: "/app/groups/:groupId/providers/:providerId", module: { default: ProviderProbe } },
  { path: "/app/groups/:groupId/medications/:medicationId", module: { default: MedicationProbe } },
];

// --- The world: fictional rows this file controls ----------------------------

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const lark = fx.provider({ name: "Dr. Mira Lark" });
const pastProvider = fx.provider({ name: "Dr. Ivo Brandt", status: "past" });
const notedProvider = fx.provider({ name: "Dr. Kim Ochoa" });
const lisinopril = fx.medication({ name: "Lisinopril" });
const metformin = fx.medication({ name: "Metformin", strength: "500 mg" });
const oxybutynin = fx.medication({ name: "Oxybutynin", status: "discontinued" });
const notedMedication = fx.medication({ name: "Vitamin D", strength: "1000 IU" });
const visit = fx.event({ title: "Cardiology checkup", occurredAt: hoursAgo(5), text: "Bring the list." });
const knee = fx.symptom({ name: "Knee pain", occurredAt: hoursAgo(3), createdBy: SAM.id });
const LONG =
  "A long quiet morning with tea and the radio. ".repeat(4) + "Then the plumber came by to fix the step.";
const deepNote = fx.note({ occurredAt: hoursAgo(2), text: LONG });
const doses = [1, 2, 3].map((d) => fx.dose({ medicationId: lisinopril.id, occurredAt: hoursAgo(24 * d) }));
/** Eight entries with "garden" in their text: more than a section shows. */
const gardens = Array.from({ length: 8 }, (_, i) =>
  fx.note({ occurredAt: hoursAgo(30 + i), text: `Sat in the garden, day ${i}` }),
);

const OTHER = { group: newId(), recipient: newId() };
const otherGroup = [
  fx.group({ id: OTHER.group, name: "Okafor Family" }),
  fx.recipient({ id: OTHER.recipient, groupId: OTHER.group, name: "Lou Okafor", preferredName: null }),
  fx.member({ userId: TEST_USER.id, groupId: OTHER.group, role: "owner" }),
  fx.medication({ groupId: OTHER.group, recipientId: OTHER.recipient, name: "Tamsulosin" }),
];

const world = (): Fixture[] => [
  SAM,
  lark,
  pastProvider,
  notedProvider,
  fx.document({
    ownerId: notedProvider.id,
    subject: "provider",
    text: "Parking is behind the building. Ask for plumber parking at the desk.",
  }),
  lisinopril,
  metformin,
  oxybutynin,
  notedMedication,
  fx.document({
    ownerId: notedMedication.id,
    subject: "medication",
    text: "Take with the plumber's tea in the morning, never on an empty stomach.",
  }),
  visit,
  fx.link(visit.id, lark.id),
  knee,
  deepNote,
  ...doses,
  ...gardens,
  ...otherGroup,
];

const open = (query = "", options: Partial<DeviceOptions> = {}) =>
  renderWithDevice({ route: ROUTES, url: searchUrl(query), fixtures: world(), search: true, ...options });

// --- DOM helpers (search.mjs's selectors) ------------------------------------

const field = () => document.querySelector<HTMLInputElement>("[data-search-page] [data-search-field]")!;
const statusLine = () => document.querySelector<HTMLElement>("[data-search-status]");
const sections = () =>
  [...document.querySelectorAll<HTMLElement>("[data-search-page] section[data-section]")].map(
    (s) => s.dataset.section,
  );
const resultIds = (type: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-result="${type}"]`)].map((li) => li.dataset.resultId);
const total = (type: string) =>
  Number(document.querySelector(`section[data-section="${type}"] h2 span:last-child`)?.textContent);
const result = (type: string, id: string) =>
  document.querySelector<HTMLElement>(`[data-result="${type}"][data-result-id="${id}"]`);
const recent = () =>
  [...document.querySelectorAll<HTMLElement>("[data-recent-search]")].map((a) => a.dataset.recentSearch);
const tips = () => !!document.querySelector("[data-search-tips]");
const stored = () =>
  JSON.parse(localStorage.getItem(`caretook:recentSearches:${TEST_USER.id}`) ?? "[]") as string[];

/** The results are for `text`, and the index is ready. */
const showing = async (text: string) => {
  await expect
    .poll(() => statusLine()?.dataset.for === text && !statusLine()!.textContent.startsWith("Preparing"))
    .toBe(true);
};
/** Type into the page's field (replacing what's there) and wait for its results. */
const searchFor = async (text: string) => {
  await userEvent.fill(field(), text);
  await showing(text);
};

// --- The page ----------------------------------------------------------------

describe("the header's magnifier", () => {
  test("it opens the search page with the field focused", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: `/app/groups/${G}/timeline`,
      fixtures: world(),
      search: true,
      frame: true,
    });
    await userEvent.click(device.screen.getByRole("link", { name: "Search this care group" }));
    await expect.poll(() => device.location()).toBe(searchUrl());
    await expect.poll(() => document.activeElement === field()).toBe(true);
  });

  test.each([420, 1280])(
    "at %i it shows on every group screen, in a one-row header, and never outside a group",
    async (width) => {
      const paths = ["timeline", "providers", "medications", "upcoming", "settings", `entries/${visit.id}`];
      for (const path of width === 420 ? paths : paths.slice(0, 2)) {
        const device = await renderWithDevice({
          element: <main>screen</main>,
          url: `/app/groups/${G}/${path}`,
          frame: true,
          width,
        });
        const link = device.screen.getByRole("link", { name: "Search this care group" });
        await expect.element(link, { message: path }).toBeVisible();
        expect(link.element().getAttribute("href")).toBe(searchUrl());
        expect(document.querySelector("header")!.getBoundingClientRect().height).toBeLessThanOrEqual(64);
        await device.screen.unmount();
      }
      const device = await renderWithDevice({
        element: <main>settings</main>,
        url: "/app/settings",
        frame: true,
      });
      await expect.element(device.screen.getByRole("button", { name: /Account menu for/ })).toBeVisible();
      expect(document.querySelector('header [data-region="search"]')).toBeNull();
    },
  );
});

describe("results", () => {
  test("medications before entries, a polite count; a medication opens its page, and Back comes back to the same results", async () => {
    const device = await open();
    await searchFor("lisinopril");
    expect(sections()).toEqual(["medication", "entry"]);
    expect(resultIds("medication")).toEqual([lisinopril.id]);
    expect(statusLine()!.getAttribute("role")).toBe("status");
    await expect.poll(() => statusLine()?.textContent).toMatch(/medication/);
    expect(device.location()).toBe(searchUrl("?q=lisinopril"));
    const before = resultIds("entry");

    await userEvent.click(result("medication", lisinopril.id)!.querySelector("a")!);
    await expect.poll(() => device.location()).toBe(`/app/groups/${G}/medications/${lisinopril.id}`);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await showing("lisinopril");
    expect(field().value).toBe("lisinopril");
    expect(resultIds("medication")).toEqual([lisinopril.id]);
    expect(resultIds("entry")).toEqual(before);

    const timelineLink = document.querySelector("[data-see-timeline]")!;
    expect(timelineLink.getAttribute("href")).toBe(`/app/groups/${G}/timeline?q=lisinopril`);
    expect(timelineLink.textContent).toBe(`See all ${total("entry")} in timeline`);
  });

  test("providers first; a past provider is marked Past and opens its page; a stopped medication is marked", async () => {
    const device = await open();
    await searchFor('"ivo brandt"');
    expect(sections()[0]).toBe("provider");
    const past = result("provider", pastProvider.id)!;
    expect(past.hasAttribute("data-past")).toBe(true);
    expect(past.querySelector("[data-marker]")?.textContent).toBe("Past");
    await userEvent.click(past.querySelector("a")!);
    await expect.poll(() => device.location()).toBe(`/app/groups/${G}/providers/${pastProvider.id}`);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await showing('"ivo brandt"');

    await searchFor("oxybutynin");
    const stopped = result("medication", oxybutynin.id)!;
    expect(stopped.hasAttribute("data-stopped")).toBe(true);
    expect(stopped.querySelector("[data-marker]")?.textContent).toBe("Discontinued");
  });

  test("a writer's symptom opens its edit sheet, and closing it comes back; an event opens its page", async () => {
    const device = await open();
    await searchFor("knee");
    const row = result("entry", knee.id)!;
    expect(row.dataset.opens).toBe("sheet");
    await userEvent.click(row.querySelector("a")!);
    await expect.poll(() => device.location()).toMatch(new RegExp(`/timeline/${knee.id}/edit`));
    await expect.element(device.screen.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => device.location()).toBe(searchUrl("?q=knee"));
    await showing("knee");
    expect(field().value).toBe("knee");

    await searchFor("cardiology");
    const event = result("entry", visit.id)!;
    expect(event.dataset.opens).toBe("page");
    await userEvent.click(event.querySelector("a")!);
    await expect.poll(() => device.location()).toBe(`/app/groups/${G}/entries/${visit.id}`);
  });

  test('a broad search shows five entries and how many more; "Show all" shows the rest; nothing matched says so', async () => {
    const device = await open();
    await searchFor("garden");
    expect(resultIds("entry").length).toBe(5);
    expect(total("entry")).toBe(8);
    await userEvent.click(await found(() => document.querySelector('[data-show-all="entry"]')));
    await expect.poll(() => device.location()).toBe(searchUrl("?q=garden&all=entry"));
    await expect.poll(() => resultIds("entry").length).toBe(8);

    await searchFor("zzqx");
    expect(sections()).toEqual([]);
    await expect.poll(() => statusLine()?.textContent).toMatch(/^No matches for/);
  });

  test("another group finds none of this group's medications or doses, but its own", async () => {
    await open("", { url: `/app/groups/${OTHER.group}/search?q=lisinopril` });
    await showing("lisinopril");
    expect(sections()).toEqual([]);
    await searchFor("tamsulosin");
    expect(resultIds("medication").length).toBe(1);
  });

  test("a viewer finds the symptom, which opens nothing, and medications", async () => {
    await open("?q=knee", { role: "viewer" });
    await showing("knee");
    expect(result("entry", knee.id)?.dataset.opens).toBe("none");
    expect(result("entry", knee.id)!.querySelector("a")).toBeNull();
    await searchFor("lisinopril");
    expect(resultIds("medication")).toEqual([lisinopril.id]);
  });
});

describe("highlights and snippets", () => {
  test("an entry's match is marked, a note matched deep in its text gets a snippet, a provider and a medication matched only in their notes show a line from them", async () => {
    await open("?q=plumber");
    await expect.poll(sections).toEqual(["provider", "medication", "entry"]);
    const note = result("entry", deepNote.id)!;
    const snippet = note.querySelector("[data-snippet]")!;
    expect(snippet.querySelector("mark")?.textContent).toBe("plumber");
    expect(snippet.textContent.startsWith("…")).toBe(true);

    const provider = result("provider", notedProvider.id)!.querySelector("[data-snippet]")!;
    expect(provider.querySelector("mark")?.textContent).toBe("plumber");
    expect(provider.textContent).toContain("Ask for");
    const medication = result("medication", notedMedication.id)!.querySelector("[data-snippet]")!;
    expect(medication.querySelector("mark")?.textContent).toMatch(/^plumber/);
    expect(medication.textContent).toContain("Take with");

    await searchFor("knee");
    const marks = [...result("entry", knee.id)!.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toEqual(["Knee"]);
  });
});

describe("recent searches", () => {
  test("the empty page has the tips line; a search is saved when the field is left or a result opened, not while typing; newest first, and one tap runs one", async () => {
    const device = await open();
    expect(tips()).toBe(true);
    expect(recent()).toEqual([]);

    await searchFor("lisinopril");
    expect({ tips: tips(), recent: recent(), stored: stored() }).toEqual({
      tips: false,
      recent: [],
      stored: [],
    });
    field().blur();
    expect(stored()).toEqual(["lisinopril"]);

    // Opening a result saves its search too (the field may not have been left).
    field().focus();
    await searchFor("metformin");
    await userEvent.click(result("medication", metformin.id)!.querySelector("a")!);
    await expect.poll(() => device.location()).toBe(`/app/groups/${G}/medications/${metformin.id}`);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await showing("metformin");
    await searchFor("");
    await expect.poll(recent).toEqual(["metformin", "lisinopril"]);
    expect(tips()).toBe(true);

    await userEvent.click(await found(() => document.querySelector('[data-recent-search="lisinopril"]')));
    await showing("lisinopril");
    expect(field().value).toBe("lisinopril");
    expect(resultIds("medication")).toEqual([lisinopril.id]);
    expect(stored()).toEqual(["lisinopril", "metformin"]);
  });

  test("five at most, without repeats (case ignored, the newest spelling kept)", async () => {
    await open();
    for (const q of ["knee", "lisinopril", "Lisinopril", "walk", "pharmacy", "blood"]) {
      await searchFor(q);
      field().blur();
      field().focus();
    }
    expect(stored()).toEqual(["blood", "pharmacy", "walk", "Lisinopril", "knee"]);
  });
});

describe("within a care period", () => {
  const place = fx.provider({ name: "Oak Hills Rehab", type: "practice", specialty: null });
  const dayMs = 86_400_000;
  const rehabStart = Date.now() - 20 * dayMs;
  const homeStart = Date.now() - 10 * dayMs;
  const hospital = fx.period({ type: "hospital", startedAt: at(new Date(Date.now() - 30 * dayMs)) });
  const rehab = fx.period({ type: "rehab", startedAt: at(new Date(rehabStart)), placeProviderId: place.id });
  const home = fx.period({ type: "home", startedAt: at(new Date(homeStart)) });
  const tagged = {
    before: fx.symptom({ name: "Ankle before", occurredAt: at(new Date(rehabStart - 2 * 60_000)) }),
    inrehab: fx.symptom({ name: "Ankle inrehab", occurredAt: at(new Date(rehabStart + 2 * dayMs)) }),
    edge: fx.symptom({ name: "Ankle edge", occurredAt: at(new Date(homeStart)) }),
    now: fx.symptom({ name: "Ankle now", occurredAt: at(new Date(Date.now() - 3 * 60_000)) }),
    visit: fx.event({ title: "Ankle visit", occurredAt: at(new Date(Date.now() + 2 * dayMs)) }),
  };
  const periods = [place, hospital, rehab, home, ...Object.values(tagged)];
  const select = () => document.querySelector<HTMLSelectElement>("[data-search-period]")!;
  const sorted = (ids: (string | undefined)[]) => [...ids].sort().join(",");

  test("any time, then the periods newest first; one narrows to the matches within its dates, kept in the URL and through a reload; the current one's run up to now", async () => {
    const device = await open("?q=ankle", { fixtures: [world(), periods] });
    await showing("ankle");
    expect(resultIds("entry").length).toBe(5);
    const options = [...select().options].map((o) => [o.value, o.textContent]);
    expect(options[0]).toEqual(["", "Any time"]);
    expect(options[1]![0]).toBe(home.id);
    expect(options.find(([v]) => v === rehab.id)![1]).toMatch(
      /^Rehab at Oak Hills Rehab · \w{3} \d+ – \w{3} \d+$/,
    );

    await userEvent.selectOptions(select(), rehab.id);
    await expect.poll(() => sorted(resultIds("entry"))).toBe(tagged.inrehab.id);
    expect(device.location()).toBe(searchUrl(`?q=ankle&period=${rehab.id}`));
    expect(document.querySelector("[data-see-timeline]")!.getAttribute("href")).toContain(
      `period=${rehab.id}`,
    );
    await device.screen.unmount();

    await open(`?q=ankle&period=${rehab.id}`, { fixtures: [world(), periods] });
    await expect.poll(() => sorted(resultIds("entry"))).toBe(tagged.inrehab.id);
    expect(select().value).toBe(rehab.id);
    await userEvent.selectOptions(select(), home.id);
    await expect.poll(() => sorted(resultIds("entry"))).toBe(sorted([tagged.edge.id, tagged.now.id]));
    await userEvent.selectOptions(select(), "");
    await expect.poll(() => resultIds("entry").length).toBe(5);
  });
});
