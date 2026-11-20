import type { ApiOutputs } from "~/lib/core/rpc";
import type { LoaderArgs } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { openAdmin } from "../adminWorld";
import * as waitlist from "./route";
import { pageCount, parseWaitlistSearch } from "./waitlistFilters";

// /admin/waitlist (groups.mjs step 8, on loader data): the filters live in
// the URL, the count says how many match, rows are as the API orders them
// (newest first) with what each visitor typed, and Export CSV carries
// exactly the list's filters. Which rows match, the order, paging and the
// export holding exactly those rows are
// packages/api/src/waitlistAdmin.int.test.ts's; the CSV's escaping,
// formula defusing and file name are waitlistCsv.test.ts's; the filters'
// parsing is waitlistFilters.test.ts's.

type Entry = ApiOutputs["admin"]["waitlist"]["list"]["entries"][number];

let n = 0;
const entry = (v: Partial<Entry> & Pick<Entry, "email">): Entry => ({
  id: `5a7d0c00-0000-4000-8000-0000000a${String(++n).padStart(4, "0")}`,
  firstName: "Robin",
  caringFor: "parent",
  heardFrom: null,
  source: { page: "/", utmSource: "flyer" },
  createdAt: "2026-10-01T12:00:00.000Z",
  ...v,
});

const ENTRIES = [
  entry({ email: "wl3@example.com", createdAt: "2026-11-05T12:00:00.000Z", heardFrom: "=1+1" }),
  entry({
    email: "wl2.example@example.com",
    caringFor: "spouse",
    source: { page: "/features", utmSource: "flyer" },
    createdAt: "2026-10-20T12:00:00.000Z",
  }),
  entry({ email: "wl1.someone@example.com", heardFrom: 'A friend, "Jo"\nat church' }),
];

/** The API's answer for the URL's filters: by who they care for and the date range. */
const waitlistData = ({ url }: LoaderArgs) => {
  const { filter, page: at } = parseWaitlistSearch(url.search);
  const found = ENTRIES.filter(
    (e) =>
      (!filter.caringFor || e.caringFor === filter.caringFor) &&
      (!filter.from || e.createdAt.slice(0, 10) >= filter.from) &&
      (!filter.to || e.createdAt.slice(0, 10) <= filter.to),
  );
  return {
    entries: found,
    count: found.length,
    page: at,
    pageSize: 50,
    filter,
    pages: pageCount(found.length, 50),
  };
};

const open = (url = "/admin/waitlist") =>
  openAdmin({ routes: { path: "/admin/waitlist", module: waitlist, loaderData: waitlistData }, url });

const shown = () =>
  [...document.querySelectorAll<HTMLElement>("[data-waitlist] tbody tr")].map((tr) => tr.dataset.entry);

describe("/admin/waitlist", () => {
  test("everyone, newest first, with what they typed; filters go in the URL and narrow the count and the export", async () => {
    const device = await open();
    await expect.element(page.getByRole("status")).toHaveTextContent("3 people on the waitlist.");
    expect(shown()).toEqual(["wl3@example.com", "wl2.example@example.com", "wl1.someone@example.com"]);
    const first = document.querySelector('[data-entry="wl1.someone@example.com"]')!;
    expect([...first.querySelectorAll("td")].map((td) => td.textContent)).toEqual([
      "Oct 1, 2026, 12:00 PM UTC",
      "wl1.someone@example.com",
      "Robin",
      "A parent",
      'A friend, "Jo"\nat church',
      "/ · flyer",
    ]);
    await expect
      .element(page.getByRole("link", { name: "Export CSV" }))
      .toHaveAttribute("href", "/admin/waitlist/export");

    await userEvent.selectOptions(page.getByLabelText("Cares for"), "parent");
    await userEvent.fill(page.getByLabelText("Joined from"), "2026-10-01");
    await userEvent.fill(page.getByLabelText("Joined to"), "2026-10-31");
    await userEvent.click(page.getByRole("button", { name: "Filter" }));
    await expect.element(page.getByRole("status")).toHaveTextContent("1 person matches.");
    expect(new URLSearchParams(device.location().split("?")[1]).get("caringFor")).toBe("parent");
    expect(shown()).toEqual(["wl1.someone@example.com"]);
    await expect
      .element(page.getByRole("link", { name: "Export CSV" }))
      .toHaveAttribute("href", "/admin/waitlist/export?from=2026-10-01&to=2026-10-31&caringFor=parent");

    // Clear goes back to everyone.
    await userEvent.click(page.getByRole("link", { name: "Clear" }));
    await expect.element(page.getByRole("status")).toHaveTextContent("3 people on the waitlist.");
  });

  test("nothing matching: no table, and the export is disabled", async () => {
    await open("/admin/waitlist?caringFor=child");
    await expect.element(page.getByRole("status")).toHaveTextContent("0 people match.");
    expect(document.querySelector("[data-waitlist]")).toBeNull();
    await expect
      .element(page.getByRole("link", { name: "Export CSV" }))
      .toHaveAttribute("aria-disabled", "true");
  });
});
