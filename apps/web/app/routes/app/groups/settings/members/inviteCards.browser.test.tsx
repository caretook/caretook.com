import type { DeviceRoute } from "../../../../../../test/device";

import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../../../../test/device";
import { TEST_GROUP } from "../../../../../../test/fixtures";
import { found } from "../../../../../../test/found";
import * as settingsLayout from "../layout/route";
import { DEFAULT_INVITE_OPTIONS } from "./linkRules";
import * as members from "./route";

// The Members page's invite cards on a phone (B-843): an invite link's
// details run the card's width with Copy, Share and Revoke on their own row
// below, and a pending invite shows its whole address with Resend and Revoke
// below it. Where there's room, both keep the actions beside the details.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const EMAIL = "samantha.okafor-invited@example.com";
const sentBy = { userId: "5d2a8c41-7e3b-4f6a-9c10-2b4e6d8f0a11", name: "Bartholomew Fitzwilliam" };
const LINK = {
  id: "link-1",
  role: "caretaker",
  state: "usable",
  expiresAt: "2027-12-02T20:00:00Z",
  createdAt: "2027-06-01T20:00:00Z",
  maxUses: 10,
  useCount: 1,
  sentBy,
};
const INVITE = {
  id: "inv-1",
  email: EMAIL,
  role: "caretaker",
  status: "pending",
  state: "usable",
  expiresAt: "2027-06-16T20:00:00Z",
  respondedAt: null,
  sentBy,
};

const open = (width: number) =>
  renderWithDevice({
    route: ROUTES,
    url: MEMBERS,
    role: "owner",
    width,
    api: {
      "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
      "invite.listForGroup": () => [INVITE],
      "invite.listLinks": () => [LINK],
      "invite.options": () => DEFAULT_INVITE_OPTIONS,
      "invite.copyLink": () => ({ token: "fictional-token" }),
      "joinRequest.list": () => [],
      "joinRequest.mine": () => [],
      "me.contact": () => null,
    },
  });

const rect = (el: Element) => el.getBoundingClientRect();
const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
/** Every line of text in `el`, as the browser laid it out. */
const textRects = (el: Element) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return [...range.getClientRects()].filter((r) => r.width > 0);
};

const linkRow = () =>
  found(() => document.querySelector<HTMLElement>(`[data-invite-links] li[data-invite-link="${LINK.id}"]`));
const inviteRow = () =>
  found(() => document.querySelector<HTMLElement>(`[data-pending-invites] li[data-invite="${INVITE.id}"]`));
/** The link's actions, once its URL has loaded and Copy and Share are on. */
const linkButtons = async (row: HTMLElement) => {
  await expect
    .poll(() => row.querySelector<HTMLButtonElement>("button[aria-label^='Copy']")?.disabled)
    .toBe(false);
  return [...row.querySelectorAll<HTMLButtonElement>("button")];
};

describe("at 375px", () => {
  test("an invite link's details sit above Copy, Share and Revoke, and no text runs under them", async () => {
    await open(375);
    const row = await linkRow();
    const buttons = await linkButtons(row);
    expect(buttons.map((b) => b.textContent)).toEqual(["Copy", "Share", "Revoke"]);
    const details = await found(() => row.querySelector("[data-link-details]"));
    const bottom = rect(details).bottom;
    for (const button of buttons) expect(rect(button).top).toBeGreaterThanOrEqual(bottom);
    for (const line of textRects(details))
      for (const button of buttons) expect(overlaps(line, rect(button))).toBe(false);
    // The status line runs the card's width, not one word per line.
    const uses = await found(() => row.querySelector("[data-link-uses]"));
    expect(new Set(textRects(uses).map((r) => Math.round(r.top))).size).toBeLessThanOrEqual(3);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  test("a pending invite shows its whole address, with Resend and Revoke below it", async () => {
    await open(375);
    const row = await inviteRow();
    const email = await found(() => row.querySelector<HTMLElement>("[data-invite-email]"));
    expect(email.textContent).toBe(EMAIL);
    expect(email.scrollWidth).toBeLessThanOrEqual(email.clientWidth);
    expect(getComputedStyle(email).textOverflow).not.toBe("ellipsis");
    const details = await found(() => row.querySelector("[data-invite-details]"));
    const bottom = rect(details).bottom;
    for (const name of ["Resend", "Revoke"]) {
      const button = await found(() =>
        row.querySelector(`button[aria-label="${name} the invitation to ${EMAIL}"]`),
      );
      expect(rect(button).top).toBeGreaterThanOrEqual(bottom);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});

test("on a desktop, both cards keep the actions beside the details", async () => {
  await open(1280);
  const link = await linkRow();
  const buttons = await linkButtons(link);
  const linkDetails = rect(await found(() => link.querySelector("[data-link-details]")));
  for (const button of buttons) expect(rect(button).left).toBeGreaterThanOrEqual(linkDetails.right - 1);

  const invite = await inviteRow();
  const inviteDetails = rect(await found(() => invite.querySelector("[data-invite-details]")));
  for (const button of invite.querySelectorAll("button"))
    expect(rect(button).left).toBeGreaterThanOrEqual(inviteDetails.right - 1);
});
