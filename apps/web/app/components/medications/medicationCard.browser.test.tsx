import type { DeviceRoute } from "../../../test/device";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { recordTag, tag } from "../../../test/fixtures";
import { waitUntil } from "../../../test/found";
import { getByCss } from "../../../test/locators";
import { List } from "~/components/ui";
import {
  GROUP,
  LARK,
  LISINOPRIL,
  MEDICATION_ROUTES,
  medicationUrl,
  OXYBUTYNIN,
  world,
} from "~/routes/app/groups/medications/medicationWorld";
import * as provider from "~/routes/app/groups/provider/route";
import * as search from "~/routes/app/groups/search/route";
import { MedicationCard } from "./MedicationCard";

// The one medication display (shared-displays slice 3, B-961): the same
// medication reads the same on a provider's page and in search (its name
// linking to its page, its summary, its tags' chips), a stopped one is
// muted with its marker, an easy role's search result opens its read-only
// sheet rather than the page, a removed one reads "(removed)" with no link,
// and `open={null}` is a plain name.

const HEART = tag("Heart");
const fixtures = () => [...world(), HEART, recordTag(HEART.id, LISINOPRIL.id, "medicationId")];
const ROUTES: DeviceRoute[] = [
  ...MEDICATION_ROUTES,
  { path: "/app/groups/:groupId/providers/:providerId", module: provider },
  { path: "/app/groups/:groupId/search", module: search },
];
/** The card's own fields, for rendering it alone. */
const SHOWN = { id: LISINOPRIL.id, name: "Lisinopril", strength: "10 mg" };
const searchUrl = (q: string) => `/app/groups/${GROUP}/search?q=${encodeURIComponent(q)}`;

const card = (where: string, id: string) =>
  document.querySelector<HTMLElement>(`${where} [data-medication-id="${id}"]`);
const nameOf = (row: HTMLElement) => row.querySelector<HTMLElement>("[data-medication-name]");

/** What the card shows, wherever it is. */
const shown = (row: HTMLElement) => ({
  name: nameOf(row)?.textContent?.trim(),
  link: nameOf(row)?.getAttribute("href"),
  summary: row.querySelector("[data-medication-summary]")?.textContent?.trim(),
  chips: [...row.querySelectorAll("[data-tag-chip]")].map((c) => c.textContent?.trim()),
});

/** Lisinopril's card, as both places show it. */
const LISINOPRIL_CARD = {
  name: "Lisinopril 10 mg",
  link: medicationUrl(LISINOPRIL.id),
  summary: expect.stringContaining("1 tablet") as unknown,
  chips: ["Heart"],
};

describe("the one medication card", () => {
  test("on a provider's page: its role above the name, the name linking to its page, the summary, its tags", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: `/app/groups/${GROUP}/providers/${LARK.id}`,
      fixtures: fixtures(),
    });
    await waitUntil(() => !!card("main [data-provider-medications]", LISINOPRIL.id), "the region");
    const row = card("main [data-provider-medications]", LISINOPRIL.id)!;
    expect(shown(row)).toEqual(LISINOPRIL_CARD);
    expect(row.querySelector("[data-medication-label]")?.textContent).toBe("Prescribes");
  });

  test("in search: the same card, its name marked", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: searchUrl("lisinopril"),
      fixtures: fixtures(),
      search: true,
    });
    await waitUntil(() => !!card("", LISINOPRIL.id), "the result");
    const row = card("", LISINOPRIL.id)!;
    expect(row.dataset.result).toBe("medication");
    expect(shown(row)).toEqual(LISINOPRIL_CARD);
    expect(nameOf(row)?.querySelector("mark")?.textContent).toMatch(/^lisinopril$/i);
  });

  test("a stopped medication in search is muted and marked", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: searchUrl("oxybutynin"),
      fixtures: fixtures(),
      search: true,
    });
    await waitUntil(() => !!card("", OXYBUTYNIN.id), "the result");
    const row = card("", OXYBUTYNIN.id)!;
    expect(row.hasAttribute("data-stopped")).toBe(true);
    expect(row.querySelector("[data-marker]")?.textContent).toBe("Discontinued");
    expect(nameOf(row)?.className).toContain("text-muted");
    expect(row.querySelector("[data-medication-icon]")?.className).toContain("text-faint");
  });

  test("an easy role's search result opens its read-only sheet, not the page", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: searchUrl("lisinopril"),
      fixtures: fixtures(),
      role: "easy_helper",
      search: true,
    });
    await waitUntil(() => !!card("", LISINOPRIL.id), "the result");
    const row = card("", LISINOPRIL.id)!;
    expect(row.querySelector("a[data-medication-name]")).toBeNull();
    await userEvent.click(getByCss(`[data-medication-id="${LISINOPRIL.id}"] button[data-medication-name]`));
    await waitUntil(
      () =>
        document.querySelector<HTMLElement>("[role=dialog] [data-easy-sheet]")?.dataset.easySheet ===
        "medication",
      "the medication's sheet",
    );
    expect(device.location()).toBe(searchUrl("lisinopril"));
  });

  test('a removed one reads "(removed)" with no link or actions; open={null} is a plain name', async () => {
    await renderWithDevice({
      url: `/app/groups/${GROUP}/medications`,
      element: (
        <List>
          <MedicationCard
            medication={SHOWN}
            groupId={GROUP}
            removed
            actions={<button type="button">Log</button>}
            data-medication-id="removed"
          />
          <MedicationCard medication={SHOWN} groupId={GROUP} open={null} data-medication-id="plain" />
        </List>
      ),
    });
    const removed = card("", "removed")!;
    expect(nameOf(removed)?.textContent).toBe("Lisinopril 10 mg (removed)");
    expect(removed.hasAttribute("data-removed")).toBe(true);
    expect(removed.querySelector("a, button")).toBeNull();

    const plain = card("", "plain")!;
    expect(nameOf(plain)?.tagName).toBe("SPAN");
    expect(nameOf(plain)?.textContent).toBe("Lisinopril 10 mg");
    expect(plain.querySelector("a, button")).toBeNull();
  });
});
