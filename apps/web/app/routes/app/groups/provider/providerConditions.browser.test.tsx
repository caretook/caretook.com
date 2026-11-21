import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, condition, conditionManager, fx } from "../../../../../test/fixtures";
import * as profile from "../profile/route";
import * as viewCondition from "../profile/conditions/view/route";
import {
  $,
  $$,
  ALVAREZ,
  directory,
  GROUP,
  MARIA,
  PATEL,
  PROVIDER_ROUTES,
  providerUrl,
  waitUntil,
} from "../providers/providerWorld";

// The provider page's Conditions region (conditions slice 3): what the
// provider diagnosed or manages, active first, saying which; a deleted
// condition left out; each opening its sheet over the profile; no region for
// a provider with none, and the region going once their last one is gone.

const P = "/app/groups/:groupId/profile";
const ROUTES = [
  ...PROVIDER_ROUTES,
  { path: P, module: profile, children: [{ path: `${P}/conditions/:conditionId`, module: viewCondition }] },
];

const HBP = condition({ name: "High blood pressure", sinceYear: 2012, diagnosedById: ALVAREZ.id });
const AFIB = condition({ name: "Atrial fibrillation", sinceYear: 2019, diagnosedById: PATEL.id });
const PNEUMONIA = condition({
  name: "Pneumonia",
  status: "resolved",
  sinceYear: 2025,
  diagnosedById: ALVAREZ.id,
});
const GOUT = condition({ name: "Gout", deletedAt: at() });
const WORLD = [
  directory(),
  fx.recipient(),
  HBP,
  AFIB,
  PNEUMONIA,
  GOUT,
  conditionManager(HBP.id, ALVAREZ.id),
  conditionManager(AFIB.id, ALVAREZ.id),
  conditionManager(GOUT.id, ALVAREZ.id),
];

const open = (id: string, fixtures = WORLD) =>
  renderWithDevice({ route: ROUTES, url: providerUrl(id), fixtures });

const region = () =>
  $$("main [data-provider-conditions] a[data-condition-id]").map((a) =>
    [a.querySelector("[data-condition-name]"), a.querySelector("[data-condition-role]")]
      .map((el) => el?.textContent?.trim())
      .join(" · "),
  );
const ready = () => !!$("main [data-provider-conditions] a[data-condition-id]");

describe("the provider page's conditions", () => {
  test("lists what they diagnosed or manage, active first, saying which; a deleted one is left out", async () => {
    await open(ALVAREZ.id);
    await waitUntil(ready, 4000, "the region");
    expect(region()).toEqual([
      "Atrial fibrillation · Manages",
      "High blood pressure · Diagnosed and Manages",
      "Pneumonia · Diagnosed",
    ]);
    expect(
      $(`main [data-provider-conditions] a[data-condition-id="${PNEUMONIA.id}"]`)?.textContent,
    ).toContain("Resolved");
  });

  test("each opens its sheet over the profile", async () => {
    const device = await open(PATEL.id);
    await waitUntil(ready, 4000, "the region");
    expect(region()).toEqual(["Atrial fibrillation · Diagnosed"]);
    await userEvent.click($(`main [data-provider-conditions] a[data-condition-id="${AFIB.id}"]`)!);
    await expect.poll(device.location).toBe(`/app/groups/${GROUP}/profile/conditions/${AFIB.id}`);
  });

  test("a provider with none has no region; it goes once their last condition is deleted", async () => {
    await open(MARIA.id);
    await waitUntil(() => !!$("main [data-linked-entries]"), 4000, "the page");
    expect($("main [data-provider-conditions]")).toBeNull();

    const device = await open(PATEL.id);
    await waitUntil(ready, 4000, "the region");
    await device.sync(
      condition({ id: AFIB.id, name: "Atrial fibrillation", diagnosedById: PATEL.id, deletedAt: at() }),
    );
    await device.settle();
    expect($("main [data-provider-conditions]")).toBeNull();
  });
});
