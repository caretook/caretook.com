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
// medication's page for every role, `QuickTags` on the page and the edit
// sheet for writers (tags-2 slice 5; the picker is entry/entryTags'), and the
// list's Tag filter (`?tag=`) beside Status, Type and the search. The rows
// tag too (`QuickTags`, tags-3), without opening the medication. The filter
// functions are medicationList.test.ts's.

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
const linksOf = async (device: Awaited<ReturnType<typeof open>>, medicationId: string) =>
  (
    await device.query<{ name: string }>(
      "SELECT t.name FROM record_tag r JOIN tag t ON t.id = r.tag_id WHERE r.medication_id = ? ORDER BY t.name_key",
      [medicationId],
    )
  ).map((r) => r.name);
/** Add tag, then the picker's toggle for `name` (the picker stays open). */
const pick = async (name: string) => {
  await userEvent.click(page.getByRole("button", { name: "Add tag" }));
  await found(() => document.querySelector("[data-tag-picker]"));
  await userEvent.click(page.getByRole("checkbox", { name }));
};
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
  test("a writer untags with one tap and tags through Add tag on the page", async () => {
    const device = await open(medicationUrl(LISINOPRIL.id));
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");

    await userEvent.click(page.getByRole("button", { name: "Remove tag Heart" }));
    await device.settle();
    await expect.poll(pageChips).toBe("Care home move,Knee");
    expect(await linksOf(device, LISINOPRIL.id)).toEqual(["Care home move", "Knee"]);

    await pick("Heart");
    await device.settle();
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    expect(await linksOf(device, LISINOPRIL.id)).toEqual(["Care home move", "Heart", "Knee"]);
    // Each tap its own write: nothing touched the medication.
    expect((await device.queued()).filter((w) => w.type === "medication")).toEqual([]);
  });

  test("the edit sheet tags and untags at once, never through Save; the sheet's Tags button is gone", async () => {
    const device = await open(`${LIST}/${METFORMIN.id}/edit`);
    await found(() => document.querySelector("[role=dialog] [data-medication-tags]"));
    expect(sheetChips()).toBe("");
    expect(document.querySelector("[role=dialog] [data-tag-record]")).toBeNull();

    await pick("Knee");
    await device.settle();
    await expect.poll(sheetChips).toBe("Knee");
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    // The row under the sheet follows too.
    await expect.poll(() => rowChips(METFORMIN.id)).toBe("Knee");

    await pick("Heart");
    await device.settle();
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
    await userEvent.click(page.getByRole("button", { name: "Remove tag Knee" }));
    await device.settle();
    await expect.poll(sheetChips).toBe("Heart");
    expect(await linksOf(device, METFORMIN.id)).toEqual(["Heart"]);
    expect((await device.queued()).filter((w) => w.type === "medication")).toEqual([]);
    // Tagging isn't an edit to discard: the sheet closes without asking.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => SHEET()).toBeNull();
  });

  test("a writer tags and untags from a list row without opening it; a tap beside the chips opens it", async () => {
    const device = await open(LIST);
    await found(() => document.querySelector(row(METFORMIN.id)));
    await userEvent.click(page.getByCss(row(METFORMIN.id)).getByRole("button", { name: "Add tag" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Knee" }));
    await device.settle();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    await expect.poll(() => rowChips(METFORMIN.id)).toBe("Knee");
    expect(device.location()).toBe(LIST);

    await userEvent.click(page.getByCss(row(METFORMIN.id)).getByRole("button", { name: "Remove tag Knee" }));
    await device.settle();
    await expect.poll(() => rowChips(METFORMIN.id)).toBe("");
    expect(await linksOf(device, METFORMIN.id)).toEqual([]);
    expect(device.location()).toBe(LIST);

    // Just beside a row's chips is still the card's open target.
    const card = document.querySelector<HTMLElement>(row(LISINOPRIL.id))!;
    const line = card.querySelector<HTMLElement>("[data-quick-tags]")!.getBoundingClientRect();
    expect(document.elementFromPoint(line.left - 4, line.top + line.height / 2)).toBe(
      card.querySelector("a[data-medication-name]"),
    );
  });

  test("a viewer sees two chips then +N on the rows", async () => {
    await open(LIST, "viewer");
    await expect.poll(() => rowChips(LISINOPRIL.id)).toBe("Care home move,Heart,+1");
    expect(rowChips(AMOXICILLIN.id)).toBe("Heart");
    expect(rowChips(METFORMIN.id)).toBe("");
  });

  test("a viewer sees every chip on the page, and nothing to press", async () => {
    await open(medicationUrl(LISINOPRIL.id), "viewer");
    await expect.poll(pageChips).toBe("Care home move,Heart,Knee");
    expect(document.querySelectorAll('main header [data-region="details"] button')).toHaveLength(0);
    expect(document.querySelector("main [data-quick-tag-add]")).toBeNull();
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
