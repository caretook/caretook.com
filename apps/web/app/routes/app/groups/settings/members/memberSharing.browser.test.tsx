import type { DeviceRoute } from "../../../../../../test/device";
import type { Fixture } from "../../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as contactSettings from "../../../settings/contact/route";
import * as settingsLayout from "../../../settings/layout/route";
import * as groupSettingsLayout from "../layout/route";
import * as members from "./route";
import { apiCalls } from "../../../../../../test/api";
import { renderWithDevice } from "../../../../../../test/device";
import { contactShare, fx, TEST_GROUP, TEST_USER } from "../../../../../../test/fixtures";

// Members' contact details on the Members page (profiles-contacts.mjs's
// steps): your own row's "What this group sees" (from your Contact details,
// online only), what you choose sending, and what co-members share showing as
// call and text links, never an unshared field nor a sign-in email. The
// co-member's device is the test device here, with the share rows arriving by
// `sync` and leaving by `unsync`; the stream's own rule (a member who leaves
// takes their share off the group's devices) is app-shell.mjs's.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: groupSettingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: "/app/settings/contact", module: contactSettings }],
  },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const CT = fx.user({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a21", name: "Dev Caretaker" });
const CT_MEMBERSHIP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b21";
const ctMember = (v: Partial<Parameters<typeof fx.member>[0]> = {}) =>
  fx.member({ id: CT_MEMBERSHIP, userId: CT.id, role: "caretaker", ...v });
const PHONE = "(555) 010-1942";
const PHONE_2 = "(555) 010-1842";
const ADDRESS = "7 Check Lane";
const RELATIONSHIP = "Aide, Sunrise";

const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
  "invite.listForGroup": () => [],
  "invite.listLinks": () => [],
  "joinRequest.list": () => [],
  "me.contact": () => ({ phones: [], contactEmail: null, address: null }),
};
const FILLED = { phones: [{ label: "Mobile", number: PHONE }], contactEmail: null, address: ADDRESS };

/** The device, with the co-member in the group (`shared`: and what they share). */
const open = (api?: Record<string, (input: unknown) => unknown>, shared?: Fixture[]) =>
  renderWithDevice({
    route: ROUTES,
    url: MEMBERS,
    role: "caretaker",
    fixtures: [CT, shared ?? ctMember()],
    api: api && { ...ONLINE, ...api },
  });

const rowOf = (userId: string) => document.querySelector<HTMLElement>(`main li[data-member="${userId}"]`);
const text = (userId: string) => rowOf(userId)?.textContent ?? "";
const ready = () => expect.poll(() => document.querySelectorAll("main li[data-member]").length).toBe(2);
const sharing = () => document.querySelector<HTMLElement>("main [data-sharing-form]");
const boxes = () =>
  [...(sharing()?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])].map(
    (b) => `${b.value}:${b.checked}`,
  );

/** The co-member shares their phone, and says how they're related. */
const sharedPhone = [
  ctMember({ relationship: RELATIONSHIP, sharedFields: '["phones"]' }),
  contactShare({
    memberId: CT_MEMBERSHIP,
    userId: CT.id,
    phones: [{ label: "Mobile", number: PHONE }],
  }),
];

describe("your own row", () => {
  test("with nothing entered: no choices, and a link to Contact details that opens it", async () => {
    const device = await open({});
    await ready();
    await expect.poll(() => !!sharing()?.querySelector("[data-no-contact]")).toBe(true);
    expect(boxes()).toEqual([]);
    expect(rowOf(TEST_USER.id)!.querySelector("[data-member-contact]")).toBeNull();
    await userEvent.click(page.getByRole("link", { name: "Add contact details" }));
    await expect.poll(device.location).toBe("/app/settings/contact");
    await expect.element(page.getByRole("heading", { name: "Contact details", level: 1 })).toBeVisible();
  });

  test("offers what's filled in (not the empty email), nothing ticked, and names the relationship for the recipient", async () => {
    await open({ "me.contact": () => FILLED });
    await ready();
    await expect.poll(boxes).toEqual(["phones:false", "address:false"]);
    const labels = [...sharing()!.querySelectorAll("label")].map((l) => l.textContent ?? "");
    expect(labels[0]).toContain(PHONE);
    expect(labels[1]).toContain(ADDRESS);
    await expect
      .element(page.getByRole("textbox", { name: "How you're related to Grandma June" }))
      .toBeVisible();
  });

  test("sharing phones sends the choice and the relationship; unsharing sends none", async () => {
    const calls = apiCalls();
    const device = await open(
      calls.record({ "me.contact": () => FILLED, "careGroup.updateMySharing": () => ({}) }),
    );
    await ready();
    await expect.poll(boxes).toEqual(["phones:false", "address:false"]);
    await userEvent.click(page.getByRole("checkbox", { name: /Phone numbers/ }));
    await userEvent.fill(
      page.getByRole("textbox", { name: "How you're related to Grandma June" }),
      RELATIONSHIP,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.element(page.getByRole("status")).toHaveTextContent("Saved.");
    expect(calls.of("careGroup.updateMySharing")).toEqual([
      { groupId: TEST_GROUP.id, sharedFields: ["phones"], relationship: RELATIONSHIP },
    ]);

    // It syncs back onto your own membership, and the form shows it ticked.
    const [mine] = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
      TEST_USER.id,
    ]);
    await device.sync(
      fx.member({
        id: mine!.id,
        userId: TEST_USER.id,
        role: "caretaker",
        relationship: RELATIONSHIP,
        sharedFields: '["phones"]',
      }),
    );
    await device.settle();
    expect(boxes()).toEqual(["phones:true", "address:false"]);
  });
});

describe("what a co-member shares", () => {
  test("their phone (call and text) and relationship; never the unshared address, nor anyone's sign-in email", async () => {
    await open({}, sharedPhone);
    await ready();
    const row = rowOf(CT.id)!;
    expect(row.querySelector("[data-member-relationship]")?.textContent?.trim()).toBe(RELATIONSHIP);
    const call = row.querySelector<HTMLAnchorElement>('a[data-action="call"]')!;
    expect(call.getAttribute("href")).toBe("tel:5550101942");
    expect(call.textContent).toContain("Call Dev Caretaker, mobile:");
    const textLink = row.querySelector('a[data-action="text"]')!;
    expect(textLink.getAttribute("href")).toBe("sms:5550101942");
    expect(textLink.getAttribute("aria-label")).toBe("Text Dev Caretaker, mobile");
    expect([...row.querySelectorAll<HTMLElement>("[data-shared]")].map((li) => li.dataset.shared)).toEqual([
      "phones",
    ]);
    expect(text(CT.id)).not.toContain(ADDRESS);
    expect(document.querySelector("main")!.textContent).not.toMatch(/@example\.com/);
  });

  test("a changed number follows the sync, without a reload", async () => {
    const device = await open({}, sharedPhone);
    await ready();
    await expect.poll(() => text(CT.id)).toContain(PHONE);
    await device.sync(
      contactShare({
        memberId: CT_MEMBERSHIP,
        userId: CT.id,
        phones: [{ label: "Mobile", number: PHONE_2 }],
      }),
    );
    await device.settle();
    expect(text(CT.id)).toContain(PHONE_2);
    expect(text(CT.id)).not.toContain(PHONE);
  });

  test("offline they still read; your own row says what you share, with no form", async () => {
    const device = await open(undefined, sharedPhone);
    await ready();
    const [mine] = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
      TEST_USER.id,
    ]);
    await device.sync(
      fx.member({ id: mine!.id, userId: TEST_USER.id, role: "caretaker", sharedFields: '["phones"]' }),
    );
    await device.settle();
    expect(text(CT.id)).toContain(PHONE);
    expect(text(CT.id)).toContain(RELATIONSHIP);
    expect(sharing()).toBeNull();
    expect(rowOf(TEST_USER.id)!.querySelector("[data-sharing-summary]")?.textContent).toMatch(/^You share /);
    expect(document.querySelector("[data-needs-connection]")).not.toBeNull();
  });

  test("unsharing takes the phone off the row after sync; the relationship stays", async () => {
    const device = await open({}, sharedPhone);
    await ready();
    await expect.poll(() => text(CT.id)).toContain(PHONE);
    await device.sync([
      ctMember({ relationship: RELATIONSHIP, sharedFields: "[]" }),
      contactShare({ memberId: CT_MEMBERSHIP, userId: CT.id, phones: [] }),
    ]);
    await device.settle();
    expect(rowOf(CT.id)!.querySelector("[data-member-contact]")).toBeNull();
    expect(text(CT.id)).toContain(RELATIONSHIP);
  });

  test("when they leave, the member and their shared details leave the device", async () => {
    const device = await open({}, sharedPhone);
    await ready();
    await expect.poll(() => text(CT.id)).toContain(PHONE);
    await device.unsync([
      { table: "member_contact_share", id: CT_MEMBERSHIP },
      { table: "care_group_member", id: CT_MEMBERSHIP },
    ]);
    await device.settle();
    expect(rowOf(CT.id)).toBeNull();
    expect(await device.query("SELECT 1 FROM member_contact_share WHERE user_id = ?", [CT.id])).toHaveLength(
      0,
    );
  });
});
