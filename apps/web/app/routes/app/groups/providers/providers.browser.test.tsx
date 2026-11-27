import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_USER } from "../../../../../test/fixtures";
import { pageHeader } from "../../../../../test/pageHeader";
import {
  ADD_PROVIDER,
  ALVAREZ,
  filterChips,
  chooseFilter,
  CURRENT_NAMES,
  directory,
  filterButton,
  FORM,
  GROUP,
  LINDQVIST,
  listNames,
  PATEL,
  PROVIDER_ROUTES,
  PROVIDERS_URL,
  SEARCH,
  SECOND_GROUP,
  secondGroup,
  SHEET,
  WESTSIDE,
} from "./providerWorld";

// The provider directory on the test device (providers.mjs's list steps):
// display order with past providers under their label, search and the type
// chips in the URL (so a reload keeps them), Condensed rows by default and
// Full (the fuller items) from View options, saved as `providersView`
// (B-909), each row as one target (Full rows with no contact links), nothing
// wider than a phone, a viewer's view-only list and
// sheet URLs, and a non-member's 404. The device is offline throughout, so
// all of it is the offline directory too. The order, matching and contact
// links are pure rules with unit tests (providerDirectory.test.ts,
// contactActions.test.ts); these cover the screen. A provider reaching
// another device is roundtrip.mjs's sync matrix (6b).

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: PROVIDER_ROUTES, url: PROVIDERS_URL, fixtures: directory(), ...options });

/** The viewer's saved layout, in the device's settings cache (as a sign-in leaves it). */
const withView = (providersView: "rows" | "cards") =>
  localStorage.setItem(`caretook:settings:${TEST_USER.id}`, JSON.stringify({ providersView }));
const openFull = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) => {
  withView("cards");
  return open(options);
};
const providerRows = () => [...document.querySelectorAll<HTMLElement>("main li[data-provider-id]")];
const rowOf = (id: string) => providerRows().find((row) => row.dataset.providerId === id)!;
const layout = () =>
  document.querySelector<HTMLElement>('main ul[aria-label="Current providers"]')?.dataset.view;

const params = (device: { location: () => string }) =>
  Object.fromEntries(new URLSearchParams(device.location().split("?")[1] ?? ""));

describe("the directory", () => {
  test("lists primary first, then current by name; past providers show below under their label, with no expand step", async () => {
    await open();
    await expect.poll(() => document.querySelector<HTMLElement>("main h1")?.textContent).toBe("Providers");
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
    await expect.poll(() => listNames("Past providers")).toEqual(["Dr. Alan Whitford"]);
    await expect.element(page.getByRole("heading", { name: "Past providers" })).toBeVisible();
    expect(page.getByRole("link", { name: /(Show|Hide) past/ }).query()).toBeNull();
  });

  test("a search matching only a past provider shows that provider, with no empty message", async () => {
    const device = await open();
    await userEvent.type(await found(SEARCH), "ortho");
    await expect.poll(() => listNames("Past providers")).toEqual(["Dr. Alan Whitford"]);
    await expect.poll(() => listNames("Current providers")).toEqual([]);
    await expect.poll(() => params(device).q).toBe("ortho");
    expect(document.querySelector("main [data-empty]")).toBeNull();
  });

  test("search by specialty filters as you type and goes in the URL; a reload (a fresh load of that URL) keeps the box and the list", async () => {
    const device = await open();
    await userEvent.type(await found(SEARCH), "cardio");
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Samuel Patel"]);
    await expect.poll(() => params(device).q).toBe("cardio");
    await expect.poll(() => listNames("Past providers")).toEqual([]);

    const url = device.location();
    await device.screen.unmount();
    await open({ url });
    await expect.poll(() => SEARCH()?.value).toBe("cardio");
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Samuel Patel"]);
  });

  test("a practice's name finds its clinicians too; choosing Clinicians in the Filter menu keeps the search (?q=westside&type=clinician), and survives a reload", async () => {
    const device = await open();
    await userEvent.type(await found(SEARCH), "westside");
    await expect
      .poll(() => listNames("Current providers"))
      .toEqual(["Dr. Elena Alvarez", "Westside Family Medicine"]);
    await expect.poll(() => params(device).q).toBe("westside");
    await chooseFilter("Clinicians");
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Elena Alvarez"]);
    await expect.poll(() => params(device)).toEqual({ q: "westside", type: "clinician" });
    await expect.poll(filterChips).toEqual(["Clinicians"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    await expect.poll(() => SEARCH()?.value).toBe("westside");

    const url = device.location();
    await device.screen.unmount();
    await open({ url });
    await expect.poll(() => SEARCH()?.value).toBe("westside");
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Elena Alvarez"]);
  });

  test("a type chosen right after typing keeps the search, without waiting for ?q= to reach the URL", async () => {
    const device = await open();
    await userEvent.type(await found(SEARCH), "westside");
    // The box writes ?q= a navigation behind the typing; the option's link must not depend on it.
    await chooseFilter("Clinicians");
    await expect.poll(() => params(device)).toEqual({ q: "westside", type: "clinician" });
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Elena Alvarez"]);
    await expect.poll(() => SEARCH()?.value).toBe("westside");
  });

  test("the search box and the Filter button share one row, with no type chip row above the directory; ✕ on the chip returns to All", async () => {
    const device = await open();
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
    expect(document.querySelector<HTMLElement>('main nav[aria-label="Show providers"]')).toBeNull();
    expect(document.querySelector<HTMLElement>('main nav[aria-label="Filters on"]')).toBeNull();
    expect(SEARCH()?.closest("form")?.parentElement).toBe(filterButton().element().parentElement);

    await chooseFilter("Pharmacies");
    await expect.poll(() => params(device)).toEqual({ type: "pharmacy" });
    await expect.poll(filterChips).toEqual(["Pharmacies"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");

    await userEvent.click(page.getByRole("link", { name: /Pharmacies/ }));
    await expect.poll(() => params(device)).toEqual({});
    await expect.poll(filterChips).toEqual([]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
  });

  test("a search that matches nothing says so", async () => {
    await open({ url: `${PROVIDERS_URL}?q=dentist` });
    await expect
      .poll(() => document.querySelector<HTMLElement>("main [data-empty]")?.textContent)
      .toBe("No providers match “dentist”.");
  });
});

describe("Condensed and Full (B-909)", () => {
  test("Condensed by default: one line each, the name, specialty and the main contact action; no type or practice line", async () => {
    await open();
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
    expect(layout()).toBe("rows");
    expect(providerRows().every((row) => row.hasAttribute("data-condensed"))).toBe(true);
    const patel = rowOf(PATEL.id);
    expect(patel.textContent).toContain("Cardiology");
    expect(patel.querySelector("p.text-sm")).toBeNull();
    // Patel's main action is calling his first number; the row's links are his page, then that.
    const links = [...patel.querySelectorAll("a")].map((a) => [
      a.getAttribute("href"),
      a.getAttribute("aria-label"),
    ]);
    expect(links).toEqual([
      [`${PROVIDERS_URL}/${PATEL.id}`, null],
      ["tel:5550103300", "Call Dr. Samuel Patel, office"],
    ]);
    // Each row has at most one contact action.
    for (const row of providerRows())
      expect(row.querySelectorAll("[data-contact-actions] a").length).toBeLessThanOrEqual(1);
  });

  test("choosing Full in View options switches to the fuller items and saves providersView, not the timeline's", async () => {
    const saved: unknown[] = [];
    await open({
      api: {
        "me.updatePreferences": (input) => {
          saved.push(input);
          return {};
        },
      },
    });
    await expect.poll(layout).toBe("rows");
    await userEvent.click(
      await found(() => document.querySelector<HTMLElement>('main button[aria-label="View options"]')),
    );
    const radios = await waitUntil(() => {
      const items = [...document.querySelectorAll<HTMLElement>("[role=menu] [role=menuitemradio]")];
      return items.length ? items : null;
    }, "the View options menu");
    expect(radios.map((r) => r.textContent?.trim())).toEqual(["Condensed", "Full"]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    await userEvent.click(await found(() => radios[1]));
    await expect.poll(layout).toBe("cards");
    expect(providerRows().some((row) => row.hasAttribute("data-condensed"))).toBe(false);
    expect(rowOf(PATEL.id).querySelector("p.text-sm")?.textContent).toBe("Clinician · Cardiology");
    await expect.poll(() => saved).toEqual([{ providersView: "cards" }]);
  });

  test("a saved Full opens as Full", async () => {
    await openFull();
    await expect.poll(layout).toBe("cards");
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
  });
});

describe("a row is one target (B-422)", () => {
  test("in Full, no row shows contact details or links: its only link is the provider's page", async () => {
    await openFull();
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
    const rows = [...document.querySelectorAll<HTMLElement>("main li[data-provider-id]")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect([...row.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
        `${PROVIDERS_URL}/${row.dataset.providerId}`,
      ]);
    }
    const alvarez = rows.find((row) => row.dataset.providerId === ALVAREZ.id)!;
    expect(alvarez.textContent).not.toContain("010-2200");
    expect(alvarez.textContent).not.toContain("e.alvarez@westsidefamily.example");
    const westside = rows.find((row) => row.dataset.providerId === WESTSIDE.id)!;
    expect(westside.textContent).not.toContain("1200 Westside Ave");
  });

  test.each([
    ["light", "rows"],
    ["dark", "rows"],
    ["light", "cards"],
    ["dark", "cards"],
  ] as const)("420 (%s, %s): rows truncate, with no horizontal overflow", async (theme, providersView) => {
    withView(providersView);
    await open({ theme });
    await expect.poll(layout).toBe(providersView);
    const page = document.documentElement;
    await expect.poll(() => page.scrollWidth - page.clientWidth).toBeLessThanOrEqual(0);
    await expect
      .poll(() =>
        [...document.querySelectorAll<HTMLElement>("main li[data-provider-id]")].filter(
          (li) => li.scrollWidth > li.clientWidth,
        ),
      )
      .toEqual([]);
  });

  test("a tap on a row (not only the name) opens the provider's page", async () => {
    const device = await openFull();
    const row = await found(() =>
      document.querySelector<HTMLElement>(`main li[data-provider-id="${PATEL.id}"] p.text-sm`),
    );
    await userEvent.click(row, { force: true });
    await expect.poll(() => device.location()).toBe(`${PROVIDERS_URL}/${PATEL.id}`);
    await expect.element(page.getByRole("heading", { level: 1, name: "Dr. Samuel Patel" })).toBeVisible();
  });
});

describe("who sees what", () => {
  test("a writer gets Add provider; a viewer sees the same list with no Add; the header is just “Providers” for both", async () => {
    const device = await open({ role: "caretaker" });
    await expect.poll(() => ADD_PROVIDER()?.getAttribute("aria-label")).toBe("Add provider");
    await expect
      .poll(() => pageHeader())
      .toEqual({ h1: "Providers", namesRecipient: false, viewerNote: false });
    await device.screen.unmount();

    await open({ role: "viewer" });
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
    await expect
      .poll(() => pageHeader())
      .toEqual({ h1: "Providers", namesRecipient: false, viewerNote: false });
    expect(ADD_PROVIDER()).toBeNull();
  });

  test("a viewer's …/providers/new and …/:id/edit are the list (search kept), with no form", async () => {
    const device = await open({ role: "viewer", url: `${PROVIDERS_URL}/new?type=pharmacy` });
    await expect.poll(() => device.location()).toBe(`${PROVIDERS_URL}?type=pharmacy`);
    expect(FORM()).toBeNull();
    await device.screen.unmount();

    const edit = await open({ role: "viewer", url: `${PROVIDERS_URL}/${PATEL.id}/edit` });
    await expect.poll(() => edit.location()).toBe(PROVIDERS_URL);
    await waitUntil(() => listNames("Current providers").length > 0);
    expect(FORM()).toBeNull();
    await expect.poll(() => listNames("Current providers")).toEqual(CURRENT_NAMES);
  });

  test("a non-member's …/providers?q=cardio is Not found, naming no one", async () => {
    await open({ role: null, url: `${PROVIDERS_URL}?q=cardio` });
    await expect.element(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    expect(
      /Moreno|Alvarez|Patel|Westside|Cornerstone|Maria/.test(
        document.querySelector<HTMLElement>("main")?.innerText ?? "",
      ),
    ).toBe(false);
  });
});

describe("importing from another group (B-48)", () => {
  // The second group's directory: its own Westside and Cornerstone (already
  // here by type and folded name), a practice that isn't here and its
  // clinician, and a clinician at its Westside (which maps to this group's).
  // A third group, where the user only views, can be a source too.
  const SECOND = SECOND_GROUP.id;
  const THEIR_WESTSIDE = fx.provider({
    groupId: SECOND,
    type: "practice",
    name: "westside  family medicine",
  });
  const THEIR_CORNERSTONE = fx.provider({ groupId: SECOND, type: "pharmacy", name: "Cornerstone Pharmacy" });
  const HARBOR = fx.provider({
    groupId: SECOND,
    type: "practice",
    name: "Harbor Clinic",
    specialty: "Geriatrics",
  });
  const OKAFOR = fx.provider({ groupId: SECOND, name: "Dr. Nia Okafor", practiceId: HARBOR.id });
  const RIVERA = fx.provider({ groupId: SECOND, name: "Dr. Ana Rivera", practiceId: THEIR_WESTSIDE.id });
  const LINDQVIST_NOTES = fx.document({
    ownerId: LINDQVIST.id,
    groupId: SECOND,
    subject: "provider",
    text: "Bring the hearing aids in their case.",
  });
  const THIRD = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b03", name: "Moreau Family" };
  const third = () => [
    fx.group({ id: THIRD.id, name: THIRD.name }),
    fx.recipient({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c03",
      groupId: THIRD.id,
      name: "Jules Moreau",
      preferredName: null,
    }),
    fx.member({ userId: TEST_USER.id, groupId: THIRD.id, role: "viewer" }),
    fx.provider({ groupId: THIRD.id, name: "Dr. Paul Moreau", specialty: "Podiatry" }),
  ];
  const world = () => [
    ...directory(),
    ...secondGroup(),
    THEIR_WESTSIDE,
    THEIR_CORNERSTONE,
    HARBOR,
    OKAFOR,
    RIVERA,
    LINDQVIST_NOTES,
  ];

  const IMPORT = () => document.querySelector<HTMLAnchorElement>("main [data-import-providers]");
  const rows = () =>
    [...document.querySelectorAll<HTMLElement>("[role=dialog] li[data-import-row]")].map((li) => ({
      name: li.querySelector("[data-import-name]")!.textContent.trim(),
      disabled: li.querySelector("input")!.disabled,
      here: li.textContent.includes("Already here"),
    }));
  const row = (name: string) =>
    [...document.querySelectorAll<HTMLLIElement>("[role=dialog] li[data-import-row]")].find(
      (li) => li.querySelector("[data-import-name]")?.textContent.trim() === name,
    )!;
  const tick = async (name: string) => userEvent.click(await found(() => row(name).querySelector("input")));
  const SUBMIT = () => document.querySelector<HTMLButtonElement>("[role=dialog] [data-import-submit]");
  const STATUS = () =>
    document.querySelector<HTMLElement>("[role=dialog] [data-import-status]")?.textContent ?? "";
  const NOTES_RULE = () =>
    document.querySelector<HTMLElement>("[role=dialog] [data-notes-rule]")?.textContent;
  const openSheet = async (options: Partial<Parameters<typeof open>[0]> = {}) => {
    const device = await open({ fixtures: world(), ...options });
    await userEvent.click(await found(IMPORT));
    await found(() => document.querySelector<HTMLElement>("[role=dialog] [data-import-sheet]"));
    return device;
  };

  test("the action is for writers who belong to another group; a viewer's or a one-group writer's URL is the list", async () => {
    let device = await open({ fixtures: world(), role: "caretaker" });
    await expect.poll(() => IMPORT()?.getAttribute("aria-label")).toBe("Import from another group");
    // Beside Add provider at 420, with no horizontal overflow.
    await expect
      .poll(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      .toBeLessThanOrEqual(0);
    await device.screen.unmount();

    device = await open();
    await expect.poll(ADD_PROVIDER).not.toBeNull();
    expect(IMPORT()).toBeNull();
    await device.screen.unmount();

    device = await open({ fixtures: world(), role: "viewer" });
    expect(IMPORT()).toBeNull();
    await device.screen.unmount();

    device = await open({ fixtures: world(), role: "viewer", url: `${PROVIDERS_URL}/import?q=west` });
    await expect.poll(() => device.location()).toBe(`${PROVIDERS_URL}?q=west`);
    expect(SHEET()).toBeNull();
    await device.screen.unmount();

    device = await open({ url: `${PROVIDERS_URL}/import` });
    await expect.poll(() => device.location()).toBe(PROVIDERS_URL);
  });

  test("the header: Import, icon only, just before the + (Add provider), each named by its label with no visible text, each opening its sheet", async () => {
    const device = await open({ fixtures: world(), role: "caretaker" });
    const header = await found(() => document.querySelector<HTMLElement>("main header"));
    const importLink = page.getByRole("link", { name: "Import from another group" });
    const addLink = page.getByRole("link", { name: "Add provider" });
    await expect.element(importLink).toHaveAttribute("title", "Import from another group");
    await expect.element(addLink).toHaveAttribute("title", "Add provider");
    expect([importLink, addLink].map((l) => l.element().textContent.trim())).toEqual(["", ""]);
    const controls = [...header.querySelectorAll("a, button")];
    expect(controls.slice(-2)).toEqual([importLink.element(), addLink.element()]);
    // The same size, side by side.
    const [i, a] = [importLink.element().getBoundingClientRect(), addLink.element().getBoundingClientRect()];
    expect([i.width, i.height]).toEqual([a.width, a.height]);

    await userEvent.click(importLink);
    await found(() => document.querySelector<HTMLElement>("[role=dialog] [data-import-sheet]"));
    expect(device.location()).toBe(`${PROVIDERS_URL}/import`);
    await device.screen.unmount();

    const again = await open({ fixtures: world(), role: "caretaker" });
    await userEvent.click(page.getByRole("link", { name: "Add provider" }));
    await found(FORM);
    expect(again.location()).toBe(`${PROVIDERS_URL}/new`);
  });

  test("pick a group, then its providers list in directory order; already here is disabled; the notes rule names the group", async () => {
    await openSheet({ fixtures: [...world(), ...third()] });
    expect(rows()).toEqual([]);
    await userEvent.click(page.getByRole("radio", { name: "Lou Lindqvist" }));
    await waitUntil(() => rows().length > 0, "the second group's providers");
    expect(rows()).toEqual([
      { name: "Dr. Grace Lindqvist", disabled: false, here: false },
      { name: "Cornerstone Pharmacy", disabled: true, here: true },
      { name: "Dr. Ana Rivera", disabled: false, here: false },
      { name: "Dr. Nia Okafor", disabled: false, here: false },
      { name: "Harbor Clinic", disabled: false, here: false },
      { name: "westside  family medicine", disabled: true, here: true },
    ]);
    await expect.poll(NOTES_RULE).toBe("Provider notes stay in Lou Lindqvist.");
    await expect.poll(() => SUBMIT()?.textContent).toBe("Import 0");
    await expect.poll(() => SUBMIT()?.disabled).toBe(true);

    // The directory's search and type chips.
    const search = page.getByRole("searchbox", { name: "Search providers in Lou Lindqvist" });
    await userEvent.type(search, "harbor");
    await expect.poll(() => rows().map((r) => r.name)).toEqual(["Dr. Nia Okafor", "Harbor Clinic"]);
    await userEvent.clear(search);
    await userEvent.click(page.getByRole("button", { name: "Pharmacies" }));
    await expect.poll(() => rows().map((r) => r.name)).toEqual(["Cornerstone Pharmacy"]);

    // A group where the user only views is a source too.
    await userEvent.click(page.getByRole("radio", { name: "Jules Moreau" }));
    await expect.poll(() => rows().map((r) => r.name)).toEqual(["Dr. Paul Moreau"]);
    await expect.poll(NOTES_RULE).toBe("Provider notes stay in Jules Moreau.");
  });

  test("importing adds copies to the list with the counts: a practice reused, another copied first, primary off, no notes", async () => {
    const device = await openSheet();
    // One other group: it's chosen already.
    await waitUntil(() => rows().length > 0, "the second group's providers");
    await tick("Dr. Grace Lindqvist");
    await tick("Dr. Nia Okafor");
    await tick("Dr. Ana Rivera");
    await expect.poll(() => SUBMIT()?.textContent).toBe("Import 3");
    await userEvent.click(await found(SUBMIT));
    await expect.poll(STATUS).toBe("Imported 3 providers and 1 practice.");
    await device.settle();

    await expect
      .poll(() => listNames("Current providers"))
      .toEqual(
        expect.arrayContaining(["Dr. Grace Lindqvist", "Dr. Nia Okafor", "Dr. Ana Rivera", "Harbor Clinic"]),
      );
    await expect
      .poll(() =>
        rows()
          .filter((r) => r.disabled)
          .map((r) => r.name),
      )
      .toEqual([
        "Dr. Grace Lindqvist",
        "Cornerstone Pharmacy",
        "Dr. Ana Rivera",
        "Dr. Nia Okafor",
        "Harbor Clinic",
        "westside  family medicine",
      ]);
    await expect.poll(() => SUBMIT()?.textContent).toBe("Import 0");

    type Copy = {
      id: string;
      name: string;
      practice_id: string | null;
      is_primary: number;
      specialty: string;
    };
    const copies = await device.query<Copy>(
      `SELECT id, name, practice_id, is_primary, specialty FROM provider
       WHERE group_id = ? AND name IN ('Dr. Grace Lindqvist', 'Dr. Nia Okafor', 'Dr. Ana Rivera', 'Harbor Clinic')`,
      [GROUP],
    );
    const byName = Object.fromEntries(copies.map((c) => [c.name, c]));
    expect(copies).toHaveLength(4);
    expect(byName["Dr. Ana Rivera"]?.practice_id).toBe(WESTSIDE.id);
    expect(byName["Dr. Nia Okafor"]?.practice_id).toBe(byName["Harbor Clinic"]?.id);
    expect(byName["Harbor Clinic"]?.specialty).toBe("Geriatrics");
    expect(byName["Dr. Grace Lindqvist"]).toMatchObject({ is_primary: 0, specialty: "Audiology" });
    expect(byName["Dr. Grace Lindqvist"]?.id).not.toBe(LINDQVIST.id);
    expect(
      await device.query("SELECT id FROM note_document WHERE provider_id = ?", [
        byName["Dr. Grace Lindqvist"]?.id,
      ]),
    ).toEqual([]);

    // Ordinary provider creates, the practice before its clinician.
    const puts = (await device.queued())
      .filter((w) => w.type === "provider" && w.op === "PUT")
      .map((w) => w.id);
    expect(puts).toHaveLength(4);
    expect(puts.indexOf(byName["Harbor Clinic"]?.id ?? "")).toBeLessThan(
      puts.indexOf(byName["Dr. Nia Okafor"]?.id ?? ""),
    );
    // The source group is untouched.
    expect(await device.query("SELECT id FROM provider WHERE group_id = ?", [SECOND])).toHaveLength(6);
  });

  describe("asking before losing ticks (B-603)", () => {
    const SHEET = () => document.querySelector("[role=dialog] [data-import-sheet]");
    const asked = () => document.querySelector("dialog[open]") !== null;
    const close = () => userEvent.click(page.getByRole("button", { name: "Close" }));
    const search = async (text: string) =>
      userEvent.fill(await found(() => document.querySelector("[role=dialog] input[type=search]")), text);
    const ready = async () => {
      await openSheet();
      await waitUntil(() => rows().length > 0, "the second group's providers");
    };

    test("a tick asks, and Discard closes", async () => {
      await ready();
      await tick("Dr. Nia Okafor");
      await close();
      await expect.poll(asked).toBe(true);
      await userEvent.click(page.getByRole("button", { name: "Discard" }));
      await expect.poll(SHEET).toBeNull();
    });

    test("a tick a search has hidden still asks", async () => {
      await ready();
      await tick("Dr. Nia Okafor");
      await search("Rivera");
      await expect.poll(() => rows().map((r) => r.name)).toEqual(["Dr. Ana Rivera"]);
      await close();
      await expect.poll(asked).toBe(true);
    });

    test("no ticks closes without asking, even after a search", async () => {
      await ready();
      await search("Rivera");
      await close();
      await expect.poll(SHEET).toBeNull();
      expect(asked()).toBe(false);
    });

    test("after a successful import, Close doesn't ask", async () => {
      await ready();
      await tick("Dr. Nia Okafor");
      await userEvent.click(await found(SUBMIT));
      await expect.poll(STATUS).toContain("Imported");
      await close();
      await expect.poll(SHEET).toBeNull();
      expect(asked()).toBe(false);
    });

    test("Done leaves without asking", async () => {
      await ready();
      await tick("Dr. Nia Okafor");
      await userEvent.click(page.getByRole("button", { name: "Done" }));
      await expect.poll(SHEET).toBeNull();
      expect(asked()).toBe(false);
    });
  });
});

describe("the page title", () => {
  test("is exactly one h1, Providers", async () => {
    await open();
    await expect.poll(() => document.querySelector<HTMLElement>("main h1")?.textContent).toBe("Providers");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
