import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as searchRoute from "./route";
import * as profile from "../profile/route";
import * as viewCondition from "../profile/conditions/view/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, condition, conditionChangeEntry, fx, TEST_GROUP } from "../../../../../test/fixtures";

// The recipient's conditions on the search page (conditions slice 2): a
// condition is found by its name and its note, sits after medications and
// before tasks and entries, is marked when resolved, opens its sheet over
// the profile (closing it comes back here), and drops out once deleted; its
// changes on the timeline are found by its name. What a document holds is
// `conditionSearchDocument`'s unit test.

const P = "/app/groups/:groupId/profile";
const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/search", module: searchRoute },
  { path: P, module: profile, children: [{ path: `${P}/conditions/:conditionId`, module: viewCondition }] },
];
const searchUrl = (q: string) => `/app/groups/${TEST_GROUP.id}/search?q=${encodeURIComponent(q)}`;

const DIABETES = condition({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c01",
  name: "Type 2 diabetes",
  sinceYear: 2015,
  note: "Diet-controlled",
});
const PREDIABETES = condition({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c02",
  name: "Prediabetes",
  status: "resolved",
});
const GONE = condition({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c03",
  name: "Diabetes insipidus",
  deletedAt: at(),
});
const ADDED = conditionChangeEntry({ conditionId: DIABETES.id, conditionName: "Type 2 diabetes" });
const world = () => [
  DIABETES,
  PREDIABETES,
  GONE,
  ADDED,
  fx.medication({ name: "Metformin", reason: "Diabetes" }),
  fx.note({ text: "Asked about the diet" }),
];

const open = (url: string) =>
  renderWithDevice({ route: ROUTES, url, fixtures: world(), search: true, role: "caretaker" });

const sectionOrder = () =>
  [...document.querySelectorAll<HTMLElement>("[data-section]")].map((s) => s.dataset.section);
const results = (type: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-result="${type}"]`)].map((r) => r.dataset.resultId);
const result = (id: string) => document.querySelector<HTMLElement>(`[data-result-id="${id}"]`);

describe("search: conditions", () => {
  test('"diabetes" finds the conditions, after medications, and the change entry', async () => {
    await open(searchUrl("diabetes"));
    await expect.poll(sectionOrder).toEqual(["medication", "condition", "entry"]);
    // Prediabetes is a different word; the deleted one has no document.
    expect(results("condition")).toEqual([DIABETES.id]);
    expect(results("entry")).toEqual([ADDED.id]);
    await expect.element(page.getByRole("heading", { name: /Conditions/ })).toBeVisible();
    expect(result(DIABETES.id)?.textContent).toContain("since 2015 · Diet-controlled");
    expect(result(ADDED.id)?.querySelector("[data-condition-entry]")?.textContent).toBe(
      "Added Type 2 diabetes",
    );
    expect(document.querySelector("[data-search-status]")?.textContent).toBe(
      "1 medication, 1 condition and 1 entry",
    );
  });

  test("a condition matches by its note, and a resolved one is marked", async () => {
    const device = await open(searchUrl("diet"));
    await expect.poll(() => results("condition")).toEqual([DIABETES.id]);
    await device.screen.unmount();
    await open(searchUrl("prediabetes"));
    await expect.poll(() => results("condition")).toEqual([PREDIABETES.id]);
    expect(result(PREDIABETES.id)?.hasAttribute("data-resolved")).toBe(true);
    expect(result(PREDIABETES.id)?.querySelector("[data-marker]")?.textContent).toBe("Resolved");
  });

  test("a condition opens its sheet over the profile, and closing it comes back to the search", async () => {
    const device = await open(searchUrl("diabetes"));
    await expect.poll(() => results("condition")).toEqual([DIABETES.id]);
    await userEvent.click(page.getByRole("link", { name: "Type 2 diabetes" }));
    await expect
      .poll(() => device.location())
      .toBe(`/app/groups/${TEST_GROUP.id}/profile/conditions/${DIABETES.id}`);
    await expect.element(page.getByRole("dialog", { name: "Type 2 diabetes" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => device.location()).toBe(searchUrl("diabetes"));
  });
});
