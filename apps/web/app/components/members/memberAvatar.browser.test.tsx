import { afterEach, describe, expect, test } from "vitest";
import * as groupSettingsLayout from "~/routes/app/groups/settings/layout/route";
import * as members from "~/routes/app/groups/settings/members/route";
import * as entryRoute from "~/routes/app/groups/entry/route";
import { forgetMyAvatar, saveMyAvatar } from "~/lib/app-shell/myAvatar";
import { renderWithDevice } from "../../../test/device";
import { at, fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../test/fixtures";
import { found, waitUntil } from "../../../test/found";

// The member-aware avatar on its two screens: chosen looks and per-group
// defaults on the Members page and in `EditorAvatars`, a former member staying
// neutral, and your own choice holding until the synced row catches up.

const BASE = "/app/groups/:groupId/settings";
const ROUTES = [
  { path: BASE, module: groupSettingsLayout, children: [{ path: `${BASE}/members`, module: members }] },
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
];
const MEMBERS = `/app/groups/${TEST_GROUP.id}/settings/members`;

const ROSA_PROFILE = { id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a31", name: "Rosa Delgado" };
const ROSA = fx.user(ROSA_PROFILE);
const ROSA_MEMBER = fx.member({ userId: ROSA.id });
const IVO = fx.user({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a32", name: "Ivo Marsh" });
const IVO_MEMBER = fx.member({ userId: IVO.id });

const avatar = (userId: string) =>
  document.querySelector<HTMLElement>(`[data-member="${userId}"] [aria-hidden="true"]`);

afterEach(() => forgetMyAvatar());

describe("the Members page", () => {
  test("shows a chosen color and icon, and initials on a default color", async () => {
    const chosen = fx.user({ ...ROSA_PROFILE, avatarColor: "jade", avatarIcon: "bird" });
    await renderWithDevice({
      route: ROUTES,
      url: MEMBERS,
      fixtures: [chosen, ROSA_MEMBER, IVO, IVO_MEMBER],
    });
    const rosa = await found(() => avatar(ROSA.id));
    expect(rosa.dataset.avatarColor).toBe("jade");
    expect(rosa.dataset.avatarIcon).toBe("bird");
    expect(rosa.querySelector("svg")).not.toBeNull();

    const ivo = await found(() => avatar(IVO.id));
    expect(ivo.dataset.avatarColor).toBeTruthy();
    expect(ivo.dataset.avatarColor).not.toBe("jade");
    expect(ivo.hasAttribute("data-avatar-default")).toBe(true);
    expect(ivo.textContent).toBe("IM");
  });

  test("gives members with no choice different colors", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: MEMBERS,
      fixtures: [ROSA, ROSA_MEMBER, IVO, IVO_MEMBER],
    });
    const rosa = await found(() => avatar(ROSA.id));
    const ivo = await found(() => avatar(IVO.id));
    await waitUntil(() => !!rosa.dataset.avatarColor && !!ivo.dataset.avatarColor);
    expect(rosa.dataset.avatarColor).not.toBe(ivo.dataset.avatarColor);
  });

  test("your own look doesn't revert between the server accepting it and the synced row arriving", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: MEMBERS,
      fixtures: [ROSA, ROSA_MEMBER],
      connected: true,
      api: {
        "me.setAvatar": (input: unknown) => ({ avatar: input }),
        "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
        "invite.listForGroup": () => [],
        "invite.listLinks": () => [],
        "joinRequest.list": () => [],
        "me.contact": () => ({ phones: [], contactEmail: null, address: null }),
      },
    });
    await found(() => avatar(TEST_USER.id));
    await saveMyAvatar(TEST_USER.id, { color: "violet", icon: "moon" });
    await waitUntil(() => avatar(TEST_USER.id)?.dataset.avatarColor === "violet");
    await device.settle();
    // Accepted, but the synced row still has no choice: the look holds.
    expect(avatar(TEST_USER.id)?.dataset.avatarIcon).toBe("moon");

    await device.sync(
      fx.user({ id: TEST_USER.id, name: TEST_USER.name, avatarColor: "violet", avatarIcon: "moon" }),
    );
    await device.settle();
    expect(avatar(TEST_USER.id)?.dataset.avatarColor).toBe("violet");

    // The row is current now, so another device's change shows.
    await device.sync(
      fx.user({ id: TEST_USER.id, name: TEST_USER.name, avatarColor: "sky", avatarIcon: null }),
    );
    await device.settle();
    await waitUntil(() => avatar(TEST_USER.id)?.dataset.avatarColor === "sky");
    expect(avatar(TEST_USER.id)?.hasAttribute("data-avatar-icon")).toBe(false);
  });
});

describe("EditorAvatars", () => {
  const stack = () => [...document.querySelectorAll<HTMLElement>('[data-region="editors"] [data-person]')];

  test("shows a chosen look, a default, and a former member neutral with initials", async () => {
    const chosen = fx.user({ ...ROSA_PROFILE, avatarColor: "coral", avatarIcon: null });
    const former = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a39";
    const event = fx.event({ title: "PT visit", occurredAt: hoursAgo(2), text: "Stretches" });
    const editors = {
      [ROSA.id]: at(),
      [IVO.id]: at(new Date(Date.now() - 5_000)),
      [former]: at(new Date(Date.now() - 10_000)),
    };
    await renderWithDevice({
      route: ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/entries/${event.id}`,
      fixtures: [
        chosen,
        ROSA_MEMBER,
        IVO,
        IVO_MEMBER,
        event,
        fx.document({ ownerId: event.id, text: "Stretches", editors: JSON.stringify(editors) }),
      ],
    });
    await waitUntil(() => stack().length === 3, "three editors");
    const by = (id: string) => stack().find((el) => el.dataset.person === id)!;
    expect(by(ROSA.id).dataset.avatarColor).toBe("coral");
    expect(by(ROSA.id).textContent).toBe("RD");
    expect(by(IVO.id).hasAttribute("data-avatar-default")).toBe(true);
    expect(by(IVO.id).textContent).toBe("IM");
    expect(by(former).hasAttribute("data-avatar-neutral")).toBe(true);
    expect(by(former).hasAttribute("data-avatar-color")).toBe(false);
    expect(by(former).textContent).toBe("S");
  });
});
