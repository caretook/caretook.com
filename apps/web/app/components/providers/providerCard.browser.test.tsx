import type { DeviceRoute } from "../../../test/device";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { at, fx, recordTag, tag, TEST_GROUP } from "../../../test/fixtures";
import { found, waitUntil } from "../../../test/found";
import { getByCss } from "../../../test/locators";
import {
  MEDICATION_ROUTES,
  medicationUrl,
  RECIPIENT,
} from "../../routes/app/groups/medications/medicationWorld";
import { PROVIDER_ROUTES, PROVIDERS_URL } from "../../routes/app/groups/providers/providerWorld";
import * as search from "../../routes/app/groups/search/route";

// One provider display (shared-displays slice 4): the same provider in the
// directory, in search and on a medication's page is one `ProviderCard`,
// with its name linking to its page, its type icon, the Primary and Past
// badges, its tag chips and a Call link; a deleted prescriber reads
// "(removed)" with no link or actions; an easy role's search result opens
// its read-only sheet. The device is offline throughout. Each screen's own
// rules stay in its own tests (providers, search, medication).

const G = TEST_GROUP.id;
const HEART = tag("Heart");
const HALVORSEN_VALUES = {
  name: "Dr. Wren Halvorsen",
  type: "clinician" as const,
  specialty: "Cardiology",
  isPrimary: 1,
  phones: [{ label: "Office", number: "(555) 010-7700" }],
};
const HALVORSEN = fx.provider(HALVORSEN_VALUES);
const PHARMACY = fx.provider({
  name: "Halvorsen Square Pharmacy",
  type: "pharmacy",
  specialty: null,
  status: "past",
  phones: [{ label: "Pharmacy", number: "(555) 010-7800" }],
});
const DROPS = fx.medication({ name: "Timolol drops", prescriberId: HALVORSEN.id, pharmacyId: PHARMACY.id });

const world = () => [
  RECIPIENT,
  HEART,
  HALVORSEN,
  PHARMACY,
  DROPS,
  recordTag(HEART.id, HALVORSEN.id, "providerId"),
];

const SEARCH_ROUTE: DeviceRoute = { path: "/app/groups/:groupId/search", module: search };
const SEARCH_URL = `/app/groups/${G}/search?q=halvorsen`;

/** What a provider's row shows, wherever it is. */
const shows = (row: HTMLElement) => ({
  name: row.querySelector("[data-provider-name]")?.textContent?.trim(),
  href: row.querySelector("a[data-provider-name]")?.getAttribute("href") ?? null,
  type: row.querySelector<HTMLElement>("[data-provider-type]")?.dataset.providerType,
  badges: [...row.querySelectorAll("[data-marker]")].map((b) => b.textContent?.trim()),
  tags: [...row.querySelectorAll<HTMLElement>("[data-tag-chip]")].map((c) => c.dataset.tagChip),
  call: row.querySelector('a[data-action="call"]')?.getAttribute("href") ?? null,
});

const HALVORSEN_SHOWS = {
  name: "Dr. Wren Halvorsen",
  href: `/app/groups/${G}/providers/${HALVORSEN.id}`,
  type: "clinician",
  badges: ["Primary"],
  tags: [HEART.id],
  call: "tel:5550107700",
};
const PHARMACY_SHOWS = {
  name: "Halvorsen Square Pharmacy",
  href: `/app/groups/${G}/providers/${PHARMACY.id}`,
  type: "pharmacy",
  badges: ["Past"],
  tags: [],
  call: "tel:5550107800",
};

const rowIn = (selector: string) =>
  found(() => document.querySelector<HTMLElement>(`main li${selector}`), { message: selector });

describe("one provider display", () => {
  test("the directory shows the name linking to the page, the type icon, the badges, the tags and Call", async () => {
    await renderWithDevice({ route: PROVIDER_ROUTES, url: PROVIDERS_URL, fixtures: world() });
    expect(shows(await rowIn(`[data-provider-id="${HALVORSEN.id}"]`))).toEqual(HALVORSEN_SHOWS);
    expect(shows(await rowIn(`[data-provider-id="${PHARMACY.id}"]`))).toEqual(PHARMACY_SHOWS);
  });

  test("search shows the same, its name marked, and its name opens the provider's page", async () => {
    const device = await renderWithDevice({
      route: [SEARCH_ROUTE, ...PROVIDER_ROUTES],
      url: SEARCH_URL,
      fixtures: world(),
      search: true,
    });
    const row = await rowIn(`[data-result="provider"][data-result-id="${HALVORSEN.id}"]`);
    expect(shows(row)).toEqual(HALVORSEN_SHOWS);
    expect(row.querySelector("[data-provider-name] mark")?.textContent?.toLowerCase()).toBe("halvorsen");
    expect(shows(await rowIn(`[data-result="provider"][data-result-id="${PHARMACY.id}"]`))).toEqual(
      PHARMACY_SHOWS,
    );
    await userEvent.click(getByCss(`li[data-result-id="${HALVORSEN.id}"] a[data-provider-name]`));
    await expect.poll(() => device.location()).toBe(HALVORSEN_SHOWS.href);
  });

  test("a medication's page shows the same under Prescriber and Pharmacy, with all quick actions", async () => {
    await renderWithDevice({ route: MEDICATION_ROUTES, url: medicationUrl(DROPS.id), fixtures: world() });
    const prescriber = await rowIn('[data-medication-provider="prescriber"]');
    expect(shows(prescriber)).toEqual(HALVORSEN_SHOWS);
    expect(prescriber.textContent).toContain("Prescriber");
    const pharmacy = await rowIn('[data-medication-provider="pharmacy"]');
    expect(shows(pharmacy)).toEqual(PHARMACY_SHOWS);
    expect(pharmacy.textContent).toContain("Pharmacy");
  });

  test('a deleted prescriber reads "(removed)", with no link, badges, tags or actions', async () => {
    const device = await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: medicationUrl(DROPS.id),
      fixtures: world(),
    });
    await rowIn('[data-medication-provider="prescriber"] a[data-provider-name]');
    await device.sync([fx.provider({ ...HALVORSEN_VALUES, id: HALVORSEN.id, deletedAt: at() })]);
    await device.settle();
    await expect
      .poll(async () => shows(await rowIn('[data-medication-provider="prescriber"]')))
      .toEqual({
        ...HALVORSEN_SHOWS,
        name: "Dr. Wren Halvorsen (removed)",
        href: null,
        badges: [],
        tags: [],
        call: null,
      });
    const row = await rowIn('[data-medication-provider="prescriber"]');
    expect(row.querySelector("a, button")).toBeNull();
  });

  test("an easy role's search result opens its read-only sheet", async () => {
    await renderWithDevice({
      route: SEARCH_ROUTE,
      url: SEARCH_URL,
      fixtures: world(),
      search: true,
      role: "easy_helper",
    });
    const row = await rowIn(`[data-result="provider"][data-result-id="${HALVORSEN.id}"]`);
    expect(row.querySelector("a[data-provider-name]")).toBeNull();
    expect(shows(row).call).toBe(HALVORSEN_SHOWS.call);
    await userEvent.click(
      getByCss(`li[data-result-id="${HALVORSEN.id}"] button[data-provider-name][data-opens-sheet]`),
    );
    await waitUntil(
      () =>
        document.querySelector<HTMLElement>("[role=dialog] [data-easy-sheet]")?.dataset.easySheet ===
        "provider",
      "the provider's sheet",
    );
  });
});
