import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import {
  $,
  $$,
  ADD_PROVIDER,
  CURRENT_NAMES,
  directory,
  FORM,
  listNames,
  PATEL,
  PROVIDER_ROUTES,
  PROVIDERS_URL,
  SEARCH,
  SHOW_PAST,
  typeChip,
  waitUntil,
} from "./providerWorld";

// The provider directory on the test device (providers.mjs's list steps):
// display order with past providers behind "Show past", search and the type
// chips in the URL (so a reload keeps them), each row's contact links and
// their names, nothing wider than a phone, a viewer's view-only list and
// sheet URLs, and a non-member's 404. The device is offline throughout, so
// all of it is the offline directory too. The order, matching and contact
// links are pure rules with unit tests (providerDirectory.test.ts,
// contactActions.test.ts); these cover the screen. A provider reaching
// another device is roundtrip.mjs's sync matrix (6b).

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: PROVIDER_ROUTES, url: PROVIDERS_URL, fixtures: directory(), ...options });

const params = (device: { location: () => string }) =>
  Object.fromEntries(new URLSearchParams(device.location().split("?")[1] ?? ""));

describe("the directory", () => {
  test("lists primary first, then current by name; past providers wait behind “Show past (1)”, then list below (?past=1)", async () => {
    const device = await open();
    expect($("main h1")?.textContent).toBe("Providers");
    expect(listNames("Current providers")).toEqual(CURRENT_NAMES);
    expect(listNames("Past providers")).toEqual([]);
    expect(SHOW_PAST()?.textContent.trim()).toBe("Show past (1)");

    await userEvent.click(await found(SHOW_PAST));
    await expect.poll(() => listNames("Past providers")).toEqual(["Dr. Alan Whitford"]);
    expect(params(device)).toEqual({ past: "1" });
    expect(listNames("Current providers")).toEqual(CURRENT_NAMES);
  });

  test("search by specialty filters as you type and goes in the URL; a reload (a fresh load of that URL) keeps the box and the list", async () => {
    const device = await open();
    await userEvent.type(await found(SEARCH), "cardio");
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Samuel Patel"]);
    await expect.poll(() => params(device).q).toBe("cardio");
    expect(listNames("Past providers")).toEqual([]);

    const url = device.location();
    await device.screen.unmount();
    await open({ url });
    expect(SEARCH()!.value).toBe("cardio");
    expect(listNames("Current providers")).toEqual(["Dr. Samuel Patel"]);
  });

  test("a practice's name finds its clinicians too; the Clinicians chip keeps the search (?q=westside&type=clinician), and survives a reload", async () => {
    const device = await open();
    await userEvent.type(await found(SEARCH), "westside");
    await expect
      .poll(() => listNames("Current providers"))
      .toEqual(["Dr. Elena Alvarez", "Westside Family Medicine"]);
    await userEvent.click(typeChip("Clinicians")!);
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Elena Alvarez"]);
    expect(params(device)).toEqual({ q: "westside", type: "clinician" });
    const current = $$('main nav[aria-label="Show providers"] a[aria-current="true"]').map((a) =>
      a.textContent.trim(),
    );
    expect(current).toEqual(["Clinicians"]);
    expect(SEARCH()!.value).toBe("westside");

    const url = device.location();
    await device.screen.unmount();
    await open({ url });
    expect(SEARCH()!.value).toBe("westside");
    expect(listNames("Current providers")).toEqual(["Dr. Elena Alvarez"]);
  });

  test("a search that matches nothing says so", async () => {
    await open({ url: `${PROVIDERS_URL}?q=dentist` });
    expect($("main [data-empty]")?.textContent).toBe("No providers match “dentist”.");
  });
});

describe("contact details on each row (B-44)", () => {
  /** A row's contact links: name (what it does, then the value), href, target, and z-index over the row's open link. */
  const rowLinks = (name: string) => {
    const li = $$("main li[data-provider-id]").find(
      (row) => row.querySelector("[data-provider-name]")?.textContent.trim() === name,
    )!;
    return [...li.querySelectorAll<HTMLAnchorElement>("[data-contact-details] a")].map((a) => [
      a.querySelector(".sr-only")!.textContent + a.querySelector(".truncate")!.textContent,
      a.getAttribute("href"),
      a.getAttribute("target"),
      getComputedStyle(a).zIndex,
    ]);
  };

  test("a clinician's numbers dial (an extension after a pause) and her email mails her, each named for what it does", async () => {
    await open();
    expect(rowLinks("Dr. Elena Alvarez")).toEqual([
      ["Call Dr. Elena Alvarez, office: (555) 010-2200 x214", "tel:5550102200,214", null, "10"],
      ["Call Dr. Elena Alvarez, after hours: (555) 010-2299", "tel:5550102299", null, "10"],
      [
        "Email Dr. Elena Alvarez: e.alvarez@westsidefamily.example",
        "mailto:e.alvarez@westsidefamily.example",
        null,
        "10",
      ],
    ]);
  });

  test("a practice's row: every number, and its address as a maps link in a new tab", async () => {
    await open();
    const links = rowLinks("Westside Family Medicine").map(([name, href, target]) => [
      name,
      href!.startsWith("https://www.google.com/maps/") ? "maps" : href,
      target,
    ]);
    expect(links).toEqual([
      ["Call Westside Family Medicine, front desk: (555) 010-2200", "tel:5550102200", null],
      ["Call Westside Family Medicine, fax: (555) 010-2201", "tel:5550102201", null],
      ["Call Westside Family Medicine, nurse line: (555) 010-2210", "tel:5550102210", null],
      [
        "Open Westside Family Medicine's address in maps: 1200 Westside Ave, Suite 300, Springfield, CA 90000",
        "maps",
        "_blank",
      ],
    ]);
  });

  test.each(["light", "dark"] as const)(
    "420 (%s): the details wrap or truncate, with no horizontal overflow",
    async (theme) => {
      await open({ theme });
      const page = document.documentElement;
      expect(page.scrollWidth - page.clientWidth).toBeLessThanOrEqual(0);
      expect($$("main li[data-provider-id]").filter((li) => li.scrollWidth > li.clientWidth)).toEqual([]);
    },
  );

  test("a tap on a row (not only the name) opens the provider's page", async () => {
    const device = await open();
    const row = $(`main li[data-provider-id="${PATEL.id}"] p.text-sm`)!;
    await userEvent.click(row, { force: true });
    await expect.poll(() => device.location()).toBe(`${PROVIDERS_URL}/${PATEL.id}`);
    await expect.element(page.getByRole("heading", { level: 1, name: "Dr. Samuel Patel" })).toBeVisible();
  });
});

describe("who sees what", () => {
  test("a writer gets Add provider; a viewer sees the same list, marked view-only, with no Add", async () => {
    const device = await open({ role: "caretaker" });
    expect(ADD_PROVIDER()?.textContent.trim()).toBe("Add provider");
    await device.screen.unmount();

    await open({ role: "viewer" });
    expect(listNames("Current providers")).toEqual(CURRENT_NAMES);
    expect($("main header p")?.textContent).toContain("You can view this directory");
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
    expect(listNames("Current providers")).toEqual(CURRENT_NAMES);
  });

  test("a non-member's …/providers?q=cardio is Not found, naming no one", async () => {
    await open({ role: null, url: `${PROVIDERS_URL}?q=cardio` });
    await expect.element(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    expect(/Moreno|Alvarez|Patel|Westside|Cornerstone|Maria/.test($("main")?.innerText ?? "")).toBe(false);
  });
});
