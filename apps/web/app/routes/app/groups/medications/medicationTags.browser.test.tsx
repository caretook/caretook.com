import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { recordTag, tag } from "../../../../../test/fixtures";
import {
  AMOXICILLIN,
  LISINOPRIL,
  LIST,
  listNames,
  MEDICATION_ROUTES,
  medicationUrl,
  METFORMIN,
  SHEET,
  world,
} from "./medicationWorld";

// Tags on medications (tags slice 5): chips on the list's rows and the
// medication's page for every role, Tags in the edit sheet for writers (the
// picker is entry/entryTags'), and the list's Tag filter (`?tag=`) beside
// Status, Type and the search. The filter functions are medicationList.test.ts's.

const HEART = tag("Heart");
const MOVE = tag("Care home move");
const KNEE = tag("Knee");
const tagged = () => [
  ...world(),
  HEART,
  MOVE,
  KNEE,
  recordTag(HEART.id, LISINOPRIL.id, "medicationId"),
  recordTag(MOVE.id, LISINOPRIL.id, "medicationId"),
  recordTag(KNEE.id, LISINOPRIL.id, "medicationId"),
  recordTag(HEART.id, AMOXICILLIN.id, "medicationId"),
];

const open = (url: string, role: "owner" | "viewer" = "owner", fixtures = tagged()) =>
  renderWithDevice({ route: MEDICATION_ROUTES, url, fixtures, role });

const CURRENT = "Current medications";
const STOPPED = "Completed and discontinued medications";
const row = (id: string) => `main li[data-medication-id="${id}"]`;
/** A row's chips: the names, then "+N" when some are folded. */
const rowChips = (id: string) =>
  [...document.querySelectorAll(`${row(id)} [data-tag-chip], ${row(id)} [data-tag-more] [aria-hidden]`)]
    .map((c) => c.textContent?.trim())
    .join(",");
const chipsIn = (selector: string) =>
  [...document.querySelectorAll(`${selector} [data-tag-chip]`)].map((c) => c.textContent?.trim()).join(",");
const pageChips = () => chipsIn('main header [data-region="details"]');
const sheetChips = () => chipsIn("[role=dialog] [data-medication-tags]");
const TAGS_BUTTON = () => document.querySelector<HTMLButtonElement>("[role=dialog] [data-tag-record]");
const params = (device: { location: () => string }) =>
  Object.fromEntries(new URLSearchParams(device.location().split("?")[1] ?? ""));
const SEARCH = () => document.querySelector<HTMLInputElement>('main input[type="search"]');
const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
const choose = async (option: string) => {
  await userEvent.click(filterButton());
  await userEvent.click(page.getByRole("menuitemradio", { name: option, exact: true }));
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
};
const filterChips = () =>
  [...document.querySelectorAll<HTMLElement>('main nav[aria-label="Filters on"] a')].map((a) =>
    a.textContent?.trim(),
  );
const menuRadios = () =>
  [...document.querySelectorAll("[role=menuitemradio]")].map((m) => m.textContent?.trim());

describe("tags on a medication", () => {
  test("a writer tags a medication from its edit sheet; the chips follow live and the form keeps no change", async () => {
    const device = await open(`${LIST}/${METFORMIN.id}/edit`);
    await found(SHEET);
    expect(sheetChips()).toBe("");
    await userEvent.click(await found(TAGS_BUTTON));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Knee" }));
    await device.settle();
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    await expect.poll(sheetChips).toBe("Knee");
    // The row under the sheet follows too.
    await expect.poll(() => rowChips(METFORMIN.id)).toBe("Knee");
    // Tagging isn't an edit to discard: the sheet closes without asking.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => SHEET()).toBeNull();
  });

  test("a viewer sees two chips then +N on the rows", async () => {
    await open(LIST, "viewer");
    await expect.poll(() => rowChips(LISINOPRIL.id)).toBe("Care home move,Heart,+1");
    expect(rowChips(AMOXICILLIN.id)).toBe("Heart");
    expect(rowChips(METFORMIN.id)).toBe("");
  });

  test("a viewer sees every chip on the page, and no Tags", async () => {
    await open(medicationUrl(LISINOPRIL.id), "viewer");
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    expect(document.querySelector("main [data-tag-record]")).toBeNull();
  });
});

describe("the list's Tag filter", () => {
  test("?tag= narrows the list, keeps the status and the search, and shows a chip", async () => {
    const device = await open(LIST);
    await choose("Heart");
    await expect.poll(() => params(device).tag).toBe(HEART.id);
    await expect.poll(() => listNames(CURRENT)).toEqual(["Lisinopril 10 mg"]);
    expect(listNames(STOPPED)).toEqual(["Amoxicillin 500 mg"]);
    expect(filterChips()).toEqual(["Heart"]);

    await choose("Completed");
    await expect.poll(() => params(device)).toEqual({ status: "completed", tag: HEART.id });
    await expect.poll(() => listNames(CURRENT)).toEqual([]);

    await choose("All");
    await userEvent.type(await found(SEARCH), "lisin");
    await expect.poll(() => params(device)).toEqual({ q: "lisin", tag: HEART.id });
    await expect.poll(() => listNames(CURRENT)).toEqual(["Lisinopril 10 mg"]);
    expect(listNames(STOPPED)).toEqual([]);

    await choose("All tags");
    await expect.poll(() => params(device)).toEqual({ q: "lisin" });
  });

  test("an unknown tag reads as no filter", async () => {
    await open(`${LIST}?tag=9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d`);
    await expect.poll(() => listNames(CURRENT).length).toBe(4);
    expect(filterChips()).toEqual([]);
  });

  test("a group with no tags shows no Tag section", async () => {
    await open(LIST, "owner", world());
    await userEvent.click(filterButton());
    await waitUntil(() => menuRadios().includes("All types"), "the menu");
    expect(menuRadios()).not.toContain("All tags");
  });
});
