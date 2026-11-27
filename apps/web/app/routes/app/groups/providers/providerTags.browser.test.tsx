import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { recordTag, tag } from "../../../../../test/fixtures";
import {
  ALVAREZ,
  chooseFilter,
  CORNERSTONE,
  directory,
  filterButton,
  filterChips,
  listNames,
  PATEL,
  PROVIDER_ROUTES,
  providerUrl,
  PROVIDERS_URL,
  SEARCH,
  WHITFORD,
} from "./providerWorld";

// Tags on providers (tags slice 5): chips on the directory's rows and the
// provider's page for every role, Tags on the page for writers (the picker
// is entry/entryTags'), and the directory's Tag filter (`?tag=`) beside Type
// and the search. The filter functions are providerDirectory.test.ts's.

const HEART = tag("Heart");
const MOVE = tag("Care home move");
const KNEE = tag("Knee");
const tagged = () => [
  ...directory(),
  HEART,
  MOVE,
  KNEE,
  recordTag(HEART.id, PATEL.id, "providerId"),
  recordTag(MOVE.id, PATEL.id, "providerId"),
  recordTag(KNEE.id, PATEL.id, "providerId"),
  recordTag(HEART.id, WHITFORD.id, "providerId"),
  recordTag(MOVE.id, CORNERSTONE.id, "providerId"),
];

const open = (url: string, role: "owner" | "viewer" = "owner", fixtures = tagged()) =>
  renderWithDevice({ route: PROVIDER_ROUTES, url, fixtures, role });

/** A row's chips: the names, then "+N" when some are folded. */
const rowChips = (id: string) =>
  [
    ...document.querySelectorAll(
      `main li[data-provider-id="${id}"] [data-tag-chip], main li[data-provider-id="${id}"] [data-tag-more] [aria-hidden]`,
    ),
  ]
    .map((c) => c.textContent?.trim())
    .join(",");
const pageChips = () =>
  [...document.querySelectorAll('main header [data-region="details"] [data-tag-chip]')]
    .map((c) => c.textContent?.trim())
    .join(",");
/** The header's ⋯, where a writer's Tags is. */
const ACTIONS = () => document.querySelector<HTMLButtonElement>("main header [data-provider-actions]");
const params = (device: { location: () => string }) =>
  Object.fromEntries(new URLSearchParams(device.location().split("?")[1] ?? ""));
const menuRadios = () =>
  [...document.querySelectorAll("[role=menuitemradio]")].map((m) => m.textContent?.trim());

describe("tags on a provider", () => {
  test("a writer tags a provider from its page; the chips follow live", async () => {
    const device = await open(providerUrl(ALVAREZ.id));
    expect(pageChips()).toBe("");
    await userEvent.click(await found(ACTIONS));
    await userEvent.click(page.getByRole("menuitem", { name: "Tags" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Knee" }));
    await device.settle();
    await expect.poll(pageChips).toBe("Knee");
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
  });

  test("a viewer sees every chip on the page, and no Tags", async () => {
    await open(providerUrl(PATEL.id), "viewer");
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    expect(ACTIONS()).toBeNull();
  });

  test("the directory's rows show two chips, then +N, for a viewer too", async () => {
    await open(PROVIDERS_URL, "viewer");
    await expect.poll(() => rowChips(PATEL.id)).toBe("Care home move,Heart,+1");
    expect(rowChips(CORNERSTONE.id)).toBe("Care home move");
    expect(rowChips(ALVAREZ.id)).toBe("");
  });
});

describe("the directory's Tag filter", () => {
  test("?tag= narrows the list, keeps the type and the search, and survives as a chip", async () => {
    const device = await open(PROVIDERS_URL);
    await chooseFilter("Heart");
    await expect.poll(() => params(device).tag).toBe(HEART.id);
    await expect.poll(() => listNames("Current providers")).toEqual(["Dr. Samuel Patel"]);
    expect(listNames("Past providers")).toEqual(["Dr. Alan Whitford"]);
    expect(filterChips()).toEqual(["Heart"]);

    await chooseFilter("Clinicians");
    await expect.poll(() => params(device)).toEqual({ type: "clinician", tag: HEART.id });
    await userEvent.type(await found(SEARCH), "whit");
    await expect.poll(() => listNames("Past providers")).toEqual(["Dr. Alan Whitford"]);
    expect(listNames("Current providers")).toEqual([]);
    await expect.poll(() => params(device)).toEqual({ q: "whit", type: "clinician", tag: HEART.id });

    await chooseFilter("All tags");
    await expect.poll(() => params(device)).toEqual({ q: "whit", type: "clinician" });
  });

  test("an unknown tag reads as no filter", async () => {
    await open(`${PROVIDERS_URL}?tag=9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d`);
    await expect.poll(() => listNames("Current providers").length).toBeGreaterThan(1);
    expect(filterChips()).toEqual([]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
  });

  test("a group with no tags shows no Tag section", async () => {
    await open(PROVIDERS_URL, "owner", directory());
    await userEvent.click(filterButton());
    await waitUntil(() => menuRadios().includes("Clinicians"), "the menu");
    expect(menuRadios()).not.toContain("All tags");
  });
});
