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
// provider's page for every role, `QuickTags` on the page and the edit sheet
// for writers (tags-2 slice 5; the picker is entry/entryTags'), and the
// directory's Tag filter (`?tag=`) beside Type and the search. The rows tag
// too (`QuickTags`, tags-3), without opening the provider. The filter
// functions are providerDirectory.test.ts's.

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
const sheetChips = () =>
  [...document.querySelectorAll("[role=dialog] [data-provider-edit-tags] [data-tag-chip]")]
    .map((c) => c.textContent?.trim())
    .join(",");
/** The header's ⋯ (Copy to another group only, since tags-2). */
const ACTIONS = () => document.querySelector<HTMLButtonElement>("main header [data-provider-actions]");
const params = (device: { location: () => string }) =>
  Object.fromEntries(new URLSearchParams(device.location().split("?")[1] ?? ""));
const linksOf = async (device: Awaited<ReturnType<typeof open>>, providerId: string) =>
  (
    await device.query<{ name: string }>(
      "SELECT t.name FROM record_tag r JOIN tag t ON t.id = r.tag_id WHERE r.provider_id = ? ORDER BY t.name_key",
      [providerId],
    )
  ).map((r) => r.name);
/** The page header's tags. */
const PAGE_TAGS = 'main header [data-region="details"]';
/**
 * Add tag in `scope` (the page header's tags, or the edit sheet; the linked
 * entries' rows have their own), then the picker's toggle for `name` (the
 * picker stays open).
 */
const pick = async (name: string, scope: typeof PAGE_TAGS | "[role=dialog]") => {
  await userEvent.click(page.getByCss(scope).getByRole("button", { name: "Add tag" }));
  await found(() => document.querySelector("[data-tag-picker]"));
  await userEvent.click(page.getByRole("checkbox", { name }));
};
const menuRadios = () =>
  [...document.querySelectorAll("[role=menuitemradio]")].map((m) => m.textContent?.trim());

describe("tags on a provider", () => {
  test("a writer untags with one tap and tags through Add tag on the page; the header has no Tags", async () => {
    const device = await open(providerUrl(PATEL.id));
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    // No ⋯ here (no other group to copy to), so no Tags anywhere in the header.
    expect(ACTIONS()).toBeNull();
    expect(document.querySelector("main [data-tag-record]")).toBeNull();

    await userEvent.click(page.getByRole("button", { name: "Remove tag Knee" }));
    await device.settle();
    await expect.poll(pageChips).toBe("Care home move,Heart");
    expect(await linksOf(device, PATEL.id)).toEqual(["Care home move", "Heart"]);

    await pick("Knee", PAGE_TAGS);
    await device.settle();
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    expect(await linksOf(device, PATEL.id)).toEqual(["Care home move", "Heart", "Knee"]);
  });

  test("the edit sheet tags and untags at once, never through Save", async () => {
    const device = await open(`${providerUrl(ALVAREZ.id)}/edit`);
    const sheet = "[role=dialog] [data-provider-edit-tags]";
    await found(() => document.querySelector(sheet));
    expect(sheetChips()).toBe("");

    await pick("Knee", "[role=dialog]");
    await device.settle();
    await expect.poll(sheetChips).toBe("Knee");
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    // The row under the sheet follows too.
    await expect.poll(() => rowChips(ALVAREZ.id)).toBe("Knee");

    await userEvent.click(page.getByCss("[role=dialog]").getByRole("button", { name: "Remove tag Knee" }));
    await device.settle();
    await expect.poll(sheetChips).toBe("");
    expect(await linksOf(device, ALVAREZ.id)).toEqual([]);
    // Each tap its own write: nothing touched the provider, and the sheet is still open.
    expect((await device.queued()).filter((w) => w.type === "provider")).toEqual([]);
    await expect.element(page.getByRole("dialog", { name: "Edit Dr. Elena Alvarez" })).toBeInTheDocument();
    // Tagging isn't an edit to discard: the sheet closes without asking.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector(sheet)).toBeNull();
  });

  test("a viewer sees every chip on the page, and nothing to press", async () => {
    await open(providerUrl(PATEL.id), "viewer");
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    expect(document.querySelectorAll('main header [data-region="details"] button')).toHaveLength(0);
    expect(document.querySelector("main [data-quick-tag-add]")).toBeNull();
    expect(ACTIONS()).toBeNull();
  });

  test("a writer tags and untags from a directory row without opening it; a tap beside the chips opens it", async () => {
    const device = await open(PROVIDERS_URL);
    const row = `main li[data-provider-id="${ALVAREZ.id}"]`;
    await found(() => document.querySelector(row));
    await userEvent.click(page.getByCss(row).getByRole("button", { name: "Add tag" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Knee" }));
    await device.settle();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    await expect.poll(() => rowChips(ALVAREZ.id)).toBe("Knee");
    expect(device.location()).toBe(PROVIDERS_URL);

    await userEvent.click(page.getByCss(row).getByRole("button", { name: "Remove tag Knee" }));
    await device.settle();
    await expect.poll(() => rowChips(ALVAREZ.id)).toBe("");
    expect(await linksOf(device, ALVAREZ.id)).toEqual([]);
    expect(device.location()).toBe(PROVIDERS_URL);

    // Just beside a row's chips is still the row's open target.
    const patel = document.querySelector<HTMLElement>(`main li[data-provider-id="${PATEL.id}"]`)!;
    const line = patel.querySelector<HTMLElement>("[data-quick-tags]")!.getBoundingClientRect();
    expect(document.elementFromPoint(line.left - 4, line.top + line.height / 2)).toBe(
      patel.querySelector("a[data-provider-name]"),
    );
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
