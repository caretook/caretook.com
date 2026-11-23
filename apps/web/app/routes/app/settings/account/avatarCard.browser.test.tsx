import type { DeviceRoute } from "../../../../../test/device";

import { beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { UserAvatar } from "~/components/ui";
import { forgetMyAvatar } from "~/lib/app-shell/myAvatar";
import * as settingsLayout from "../layout/route";
import * as account from "./route";
import { apiCalls, refusal } from "../../../../../test/api";
import { renderInRouter, renderWithDevice } from "../../../../../test/device";
import { TEST_USER } from "../../../../../test/fixtures";
import { getByCss } from "../../../../../test/locators";

// The Avatar card: a live preview, saving and clearing through `me.setAvatar`,
// the header showing the choice; and `UserAvatar`'s four looks.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: "/app/settings/account", module: account }],
  },
];

const server = (start: { color: string | null; icon: string | null }) => {
  let avatar = start;
  const calls = apiCalls();
  const api = calls.record({
    "me.get": () => ({ id: TEST_USER.id, avatar }),
    "me.setAvatar": (input) => {
      avatar = input as typeof avatar;
      return { avatar };
    },
  });
  return { calls, api, stored: () => avatar };
};

const preview = () => getByCss("[data-avatar-preview]");
const radio = (group: string, name: string) =>
  page.getByRole("radiogroup", { name: group }).getByRole("radio", { name, exact: true });
// The radio is visually hidden and its swatch sits over it: a tap lands on the swatch.
const choose = (group: string, name: string) => userEvent.click(radio(group, name), { force: true });
const save = () => userEvent.click(page.getByRole("button", { name: "Save" }));

beforeEach(() => forgetMyAvatar());

describe("the Avatar card", () => {
  test("previews a choice before saving, then saves both ids", async () => {
    const { calls, api, stored } = server({ color: null, icon: null });
    await renderWithDevice({ route: ROUTES, url: "/app/settings/account", api, connected: true });
    await choose("Color", "Jade");
    await choose("Icon", "Bird");
    await expect.element(preview()).toHaveAttribute("data-avatar-color", "jade");
    await expect.element(preview()).toHaveAttribute("data-avatar-icon", "bird");
    expect(calls.of("me.setAvatar")).toEqual([]);

    await save();
    await expect.element(page.getByText("Saved.")).toBeVisible();
    expect(calls.of("me.setAvatar")).toEqual([{ color: "jade", icon: "bird" }]);
    expect(stored()).toEqual({ color: "jade", icon: "bird" });
  });

  test("clears back to the default with null", async () => {
    const { calls, api } = server({ color: "sky", icon: "cat" });
    await renderWithDevice({ route: ROUTES, url: "/app/settings/account", api, connected: true });
    await expect.element(radio("Color", "Sky")).toBeChecked();
    await choose("Color", "Default");
    await choose("Icon", "Default");
    await save();
    await expect.element(page.getByText("Saved.")).toBeVisible();
    expect(calls.of("me.setAvatar")).toEqual([{ color: null, icon: null }]);
    expect(preview().element().hasAttribute("data-avatar-color")).toBe(false);
  });

  test("a refused save says so and keeps the choice on screen", async () => {
    const { api } = server({ color: null, icon: null });
    api["me.setAvatar"] = () => refusal("permissions:unauthorized");
    await renderWithDevice({ route: ROUTES, url: "/app/settings/account", api, connected: true });
    await choose("Color", "Rose");
    await save();
    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect.element(preview()).toHaveAttribute("data-avatar-color", "rose");
  });

  test("the header shows the saved choice", async () => {
    const { api } = server({ color: "violet", icon: "moon" });
    await renderWithDevice({
      route: ROUTES,
      url: "/app/settings/account",
      api,
      connected: true,
      frame: true,
    });
    const avatar = getByCss('[data-region="user"] [data-avatar-color]');
    await expect.element(avatar).toHaveAttribute("data-avatar-color", "violet");
    await expect.element(avatar).toHaveAttribute("data-avatar-icon", "moon");
  });
});

describe("UserAvatar's looks", () => {
  const shown = async (look?: { color?: string | null; icon?: string | null }) => {
    await renderInRouter(<UserAvatar data-testid="who" name="Rosa Delgado" look={look} />);
    return page.getByTestId("who").element();
  };

  test("neither: initials on the primary color", async () => {
    const el = await shown();
    expect(el.textContent).toBe("RD");
    expect(el.className).toContain("bg-primary");
  });

  test("color only: initials on that color", async () => {
    const el = await shown({ color: "jade" });
    expect(el.textContent).toBe("RD");
    expect(el.className).toContain("bg-avatar-jade");
  });

  test("icon only: the icon on the default color", async () => {
    const el = await shown({ icon: "bird" });
    expect(el.textContent).toBe("");
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.className).toContain("bg-primary");
  });

  test("both: the icon on that color", async () => {
    const el = await shown({ color: "violet", icon: "moon" });
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.className).toContain("bg-avatar-violet");
  });

  test("an unknown id reads as unset", async () => {
    const el = await shown({ color: "ultraviolet", icon: "unicorn" });
    expect(el.textContent).toBe("RD");
    expect(el.className).toContain("bg-primary");
  });
});
