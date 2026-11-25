import type { SettingsItem } from "~/lib/app-shell/settingsNav";

import { createRoutesStub } from "react-router";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { appUrls } from "~/lib/app-shell/appUrls";
import { groupSettingsPages } from "~/routes/app/groups/settings/layout/settingsPages";
import { ACCOUNT_SETTINGS } from "~/routes/app/settings/layout/settingsPages";
import { TEST_GROUP } from "../../../test/fixtures";
import { SettingsFrame } from "./SettingsFrame";

// A settings link shows the tap at once (B-828): while the tapped subpage's
// loader is pending, its link is marked (`data-pending`, `aria-busy`, a
// spinner) and takes `aria-current`; once the subpage renders the mark clears.
// For the account's and a group's settings, from the phone list and the wide
// side nav. The frame's navigation itself is settingsFrame.browser.test.tsx's.

const AREAS: [string, string, readonly SettingsItem[]][] = [
  ["user settings", appUrls.settings(), ACCOUNT_SETTINGS],
  ["group settings", appUrls.groupSettings(TEST_GROUP.id), groupSettingsPages(TEST_GROUP.id)],
];

/** A loader held until `release()`. */
function held() {
  let release = () => {};
  const promise = new Promise<null>((resolve) => {
    release = () => resolve(null);
  });
  return { loader: () => promise, release };
}

const open = async (width: number, listPath: string, items: readonly SettingsItem[], url: string) => {
  await page.viewport(width, 900);
  const [first, second] = items as [SettingsItem, SettingsItem];
  const gate = held();
  const Stub = createRoutesStub([
    {
      path: listPath,
      Component: () => <SettingsFrame title="Settings" listPath={listPath} items={items} />,
      children: [
        { index: true, Component: () => null },
        { path: first.path, Component: () => <h2>{first.label} page</h2> },
        { path: second.path, loader: gate.loader, Component: () => <h2>{second.label} page</h2> },
      ],
    },
  ]);
  render(<Stub initialEntries={[url]} />);
  return { first, second, release: gate.release };
};

const link = (item: SettingsItem) =>
  document.querySelector<HTMLAnchorElement>(`[data-settings-nav] a[data-settings-item="${item.id}"]`)!;
const state = (item: SettingsItem) => {
  const a = link(item);
  return {
    pending: a.hasAttribute("data-pending"),
    busy: a.getAttribute("aria-busy"),
    spinner: !!a.querySelector(".loading-spinner"),
    current: a.getAttribute("aria-current"),
  };
};
const IDLE = { pending: false, busy: null, spinner: false };
const PENDING = { pending: true, busy: "true", spinner: true, current: "page" };

describe.each(AREAS)("%s", (_name, listPath, items) => {
  test("phone list: the tapped link shows pending at once, and clears when the page renders", async () => {
    const { second, release } = await open(420, listPath, items, listPath);
    await expect.element(page.getByRole("link", { name: new RegExp(second.label) })).toBeVisible();
    expect(state(second)).toMatchObject({ ...IDLE, current: null });

    link(second).click();
    await expect.poll(() => state(second)).toEqual(PENDING);

    release();
    await expect.element(page.getByRole("heading", { name: `${second.label} page` })).toBeVisible();
    expect(state(second)).toMatchObject({ ...IDLE, current: "page" });
  });

  test("wide side nav: the tapped link shows pending and takes aria-current at once, and clears when the page renders", async () => {
    const { first, second, release } = await open(1200, listPath, items, items[0]!.path);
    await expect.element(page.getByRole("heading", { name: `${first.label} page` })).toBeVisible();
    expect(state(first)).toMatchObject({ ...IDLE, current: "page" });

    link(second).click();
    await expect.poll(() => state(second)).toEqual(PENDING);
    expect(state(first)).toMatchObject({ ...IDLE, current: null });

    release();
    await expect.element(page.getByRole("heading", { name: `${second.label} page` })).toBeVisible();
    expect(state(second)).toMatchObject({ ...IDLE, current: "page" });
  });
});
