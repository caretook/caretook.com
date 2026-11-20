import type { DeviceRoute } from "../../../../../test/device";

import { ORPCError } from "@orpc/client";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "../layout/route";
import * as contact from "./route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { TEST_USER } from "../../../../../test/fixtures";

// Account > Contact details (profiles-contacts.mjs's steps on the page): its
// own subpage, the privacy line, a refused email shown on its field, what a
// save sends, and offline. The server's rules (the sign-in email never
// returned, each group seeing only what's shared) are profiles.int.test.ts's;
// what a co-member's device shows is memberSharing.browser.test.tsx.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: "/app/settings/contact", module: contact }],
  },
];
const URL = "/app/settings/contact";

const EMPTY = { phones: [], contactEmail: null, address: null };
const PHONE = "(555) 010-1942";
const ADDRESS = "7 Check Lane";

const open = (api?: Record<string, (input: unknown) => unknown>, width?: number) =>
  renderWithDevice({ route: ROUTES, url: URL, api, width });

const phoneNumber = () => page.getByRole("textbox", { name: "Phone 1 number" });
const phoneLabel = () => page.getByRole("textbox", { name: "Phone 1 label" });
const emailBox = () => page.getByRole("textbox", { name: "Contact email" });
const addressBox = () => page.getByRole("textbox", { name: "Address" });
const save = () => page.getByRole("button", { name: "Save" });

describe.each([420, 1280])("at %i", (width) => {
  test("its own subpage in the settings frame, saying the sign-in email stays private", async () => {
    await open({ "me.contact": () => EMPTY }, width);
    await expect.element(page.getByRole("heading", { name: "Contact details", level: 1 })).toBeVisible();
    const nav = document.querySelector<HTMLElement>("nav[data-settings-nav]");
    expect(nav?.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe(URL);
    await expect
      .element(
        page.getByText(`Your sign-in email (${TEST_USER.email}) stays private unless you enter it here.`),
      )
      .toBeVisible();
    expect((emailBox().element() as HTMLInputElement).getAttribute("aria-describedby")).toBeTruthy();
  });
});

describe("saving", () => {
  test("a phone and an address are sent as typed, and it says Saved", async () => {
    const calls = apiCalls();
    await open(calls.record({ "me.contact": () => EMPTY, "me.updateContact": () => ({}) }));
    await expect.element(phoneNumber()).toBeVisible();
    await userEvent.fill(phoneLabel(), "Mobile");
    await userEvent.fill(phoneNumber(), PHONE);
    await userEvent.fill(addressBox(), ADDRESS);
    await userEvent.click(save());
    await expect.element(page.getByRole("status")).toHaveTextContent("Saved.");
    expect(calls.of("me.updateContact")).toEqual([
      { phones: [{ label: "Mobile", number: PHONE }], contactEmail: "", address: ADDRESS },
    ]);
  });

  test("the saved details fill the form", async () => {
    await open({
      "me.contact": () => ({
        phones: [{ label: "Home", number: PHONE }],
        contactEmail: "alex@example.org",
        address: ADDRESS,
      }),
    });
    await expect.element(phoneNumber()).toHaveValue(PHONE);
    await expect.element(phoneLabel()).toHaveValue("Home");
    await expect.element(emailBox()).toHaveValue("alex@example.org");
    await expect.element(addressBox()).toHaveValue(ADDRESS);
  });

  test("a bad email shows the server's error on its field, and says to check them", async () => {
    await open({
      "me.contact": () => EMPTY,
      "me.updateContact": () => {
        throw new ORPCError("BAD_REQUEST", {
          message: "Check the details",
          data: { issues: [{ path: ["contactEmail"], message: "Enter an email address" }] },
        });
      },
    });
    await expect.element(phoneNumber()).toBeVisible();
    await userEvent.fill(phoneNumber(), PHONE);
    await userEvent.fill(emailBox(), "not-an-email");
    await userEvent.click(save());
    await expect.element(emailBox()).toHaveAttribute("aria-invalid", "true");
    await expect.element(page.getByText("Enter an email address")).toBeVisible();
    await expect.element(page.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
    expect(page.getByRole("status").elements()).toHaveLength(0);
  });
});

describe("offline", () => {
  test("it says it needs a connection, and offers no form", async () => {
    await open();
    await expect
      .element(page.getByText("Needs a connection to show and edit your contact details.").first())
      .toBeVisible();
    expect(document.querySelector("[data-contact-form]")).toBeNull();
  });

  test("a save that loses the connection says so", async () => {
    let online = true;
    await open({
      "me.contact": () => EMPTY,
      "me.updateContact": () => {
        online = false;
        throw new TypeError("Failed to fetch");
      },
    });
    await expect.element(phoneNumber()).toBeVisible();
    await userEvent.fill(phoneNumber(), PHONE);
    await userEvent.click(save());
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Needs a connection to show and edit your contact details.");
    expect(online).toBe(false);
  });
});
