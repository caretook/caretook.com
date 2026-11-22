import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok, system } from "../../test/fixtures";
import { isError } from "../errors";
import {
  careGroupMemberModel,
  careRecipientDetailsModel,
  memberContactShareModel,
  userContactModel,
} from "../models";
import {
  careGroupMemberService,
  careRecipientDetailsService,
  careRecipientService,
  emergencyContactService,
  memberSharingService,
  userContactService,
} from ".";

// Profiles slice 1: the recipient's basics and details, the emergency list,
// and members' contact details with the per-group share projection. Each
// test builds its own users and group.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const PHONE = { label: "Mobile", number: "(555) 010-1001" };

const setup = async () => {
  const {
    u: { owner, admin, caretaker, viewer, outsider },
    group,
  } = await createWorld({ extras: ["outsider"] });
  const groupId = group.id;
  const membership = async (userId: string) => {
    const m = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
      }),
    );
    if (!m) throw new Error("no membership");
    return m;
  };
  const shareOf = async (userId: string) =>
    ok(
      await memberContactShareModel.get({
        ...system,
        filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
      }),
    );
  /** A member who shares a phone with the group. */
  const sharePhone = async (who: { ctx: typeof owner.ctx }) => {
    ok(await userContactService.update(who.ctx, { phones: [PHONE] }));
    ok(await memberSharingService.update(who.ctx, groupId, { sharedFields: ["phones"] }));
  };
  return { owner, admin, caretaker, viewer, outsider, groupId, membership, shareOf, sharePhone };
};

describe("the recipient's basics", () => {
  it("are edited by writers and read by everyone", async () => {
    const s = await setup();
    const saved = ok(
      await careRecipientService.updateProfile(s.caretaker.ctx, s.groupId, {
        codeStatus: "dnr",
        bloodType: "O-",
        primaryLanguage: "Tagalog",
        pronouns: "she/her",
        notes: "Uses a walker",
      }),
    );
    expect(saved).toMatchObject({ codeStatus: "dnr", bloodType: "O-", notes: "Uses a walker" });
    const read = ok(
      await careRecipientService.get(s.viewer.ctx, { filter: { groupId: { type: "eq", value: s.groupId } } }),
    );
    expect(read).toMatchObject({ codeStatus: "dnr", primaryLanguage: "Tagalog", pronouns: "she/her" });
  });

  it("refuse viewers and non-members, and bad values", async () => {
    const s = await setup();
    expect(codeOf(await careRecipientService.updateProfile(s.viewer.ctx, s.groupId, { notes: "x" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await careRecipientService.updateProfile(s.outsider.ctx, s.groupId, { notes: "x" }))).toBe(
      "careRecipientService:notFound",
    );
    expect(
      codeOf(
        await careRecipientService.updateProfile(s.owner.ctx, s.groupId, {
          bloodType: "Z" as never,
        }),
      ),
    ).toBe("careRecipientService:invalid");
  });
});

describe("the recipient's details", () => {
  it("are read and written by owners, admins and caretakers, and not viewers", async () => {
    const s = await setup();
    // Empty before anyone saves.
    expect(ok(await careRecipientDetailsService.get(s.caretaker.ctx, s.groupId))).toMatchObject({
      phones: [],
      insurance: [],
      outsideContacts: [],
    });

    ok(
      await careRecipientDetailsService.update(s.caretaker.ctx, s.groupId, {
        phones: [{ label: "Home", number: "555 010 2231" }],
        address: "1 Example Way",
        insurance: [{ insurer: "Medicare", memberId: "1EG4" }],
      }),
    );
    for (const who of [s.owner, s.admin, s.caretaker]) {
      const details = ok(await careRecipientDetailsService.get(who.ctx, s.groupId));
      expect(details).toMatchObject({ address: "1 Example Way", insurance: [{ insurer: "Medicare" }] });
    }

    expect(codeOf(await careRecipientDetailsService.get(s.viewer.ctx, s.groupId))).toBe(
      "careRecipientDetailsService:notAllowed",
    );
    expect(
      codeOf(await careRecipientDetailsService.update(s.viewer.ctx, s.groupId, { address: "Elsewhere" })),
    ).toBe("careRecipientDetailsService:notAllowed");
    // Not even through the model: viewers' scope is `none`.
    expect(
      ok(
        await careRecipientDetailsModel.get({
          ...s.viewer.ctx,
          filter: { groupId: { type: "eq", value: s.groupId } },
        }),
      ),
    ).toBeNull();
  });

  it("keep fields left out, and clear empty ones", async () => {
    const s = await setup();
    ok(
      await careRecipientDetailsService.update(s.owner.ctx, s.groupId, {
        email: "pat@example.com",
        address: "A",
      }),
    );
    ok(await careRecipientDetailsService.update(s.owner.ctx, s.groupId, { address: "" }));
    expect(ok(await careRecipientDetailsService.get(s.owner.ctx, s.groupId))).toMatchObject({
      email: "pat@example.com",
      address: null,
    });
  });

  it("answer non-members with not-found and refuse invalid input", async () => {
    const s = await setup();
    expect(codeOf(await careRecipientDetailsService.get(s.outsider.ctx, s.groupId))).toBe(
      "careRecipientService:notFound",
    );
    expect(
      codeOf(await careRecipientDetailsService.update(s.outsider.ctx, s.groupId, { address: "Somewhere" })),
    ).toBe("careRecipientService:notFound");
    expect(
      codeOf(
        await careRecipientDetailsService.update(s.owner.ctx, s.groupId, {
          insurance: [{ insurer: "Medicare", memberId: "" }],
        }),
      ),
    ).toBe("careRecipientDetailsService:invalid");
  });

  it("let only owners and admins change outside contacts, which keep their place on the list", async () => {
    const s = await setup();
    const rosa = { id: crypto.randomUUID(), name: "Rosa", relationship: "Neighbour", phone: "555 010 4410" };
    expect(
      codeOf(await careRecipientDetailsService.updateOutsideContacts(s.caretaker.ctx, s.groupId, [rosa])),
    ).toBe("careRecipientDetailsService:managersOnly");
    expect(
      codeOf(await careRecipientDetailsService.updateOutsideContacts(s.viewer.ctx, s.groupId, [rosa])),
    ).toBe("careRecipientDetailsService:managersOnly");
    ok(await careRecipientDetailsService.updateOutsideContacts(s.admin.ctx, s.groupId, [rosa]));
    ok(await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [{ kind: "outside", id: rosa.id }]));

    const sam = { name: "Sam", phone: "555 010 4411" };
    ok(await careRecipientDetailsService.updateOutsideContacts(s.owner.ctx, s.groupId, [sam, rosa]));
    const details = ok(await careRecipientDetailsService.get(s.owner.ctx, s.groupId));
    expect(details.outsideContacts.map((c) => [c.name, c.emergencyRank])).toEqual([
      ["Sam", null],
      ["Rosa", 1],
    ]);
  });
});

describe("the emergency list", () => {
  it("is ordered across members and outside contacts by owners and admins only", async () => {
    const s = await setup();
    await s.sharePhone(s.caretaker);
    await s.sharePhone(s.viewer);
    const rosa = { id: crypto.randomUUID(), name: "Rosa", phone: "555 010 4410" };
    ok(await careRecipientDetailsService.updateOutsideContacts(s.owner.ctx, s.groupId, [rosa]));

    const order = [
      { kind: "outside" as const, id: rosa.id },
      { kind: "member" as const, userId: s.viewer.user.id },
      { kind: "member" as const, userId: s.caretaker.user.id },
    ];
    for (const who of [s.caretaker, s.viewer]) {
      expect(codeOf(await emergencyContactService.setOrder(who.ctx, s.groupId, order))).toBe(
        "emergencyContactService:notAllowed",
      );
    }
    expect(codeOf(await emergencyContactService.setOrder(s.outsider.ctx, s.groupId, order))).toBe(
      "careGroupService:notFound",
    );

    expect(ok(await emergencyContactService.setOrder(s.admin.ctx, s.groupId, order)).contacts).toEqual(order);
    expect((await s.membership(s.viewer.user.id)).emergencyRank).toBe(2);
    expect((await s.membership(s.caretaker.user.id)).emergencyRank).toBe(3);
    const details = ok(await careRecipientDetailsService.get(s.owner.ctx, s.groupId));
    expect(details.outsideContacts[0]?.emergencyRank).toBe(1);

    // A shorter list takes the rest off, renumbered.
    ok(await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [order[2]!]));
    expect((await s.membership(s.caretaker.user.id)).emergencyRank).toBe(1);
    expect((await s.membership(s.viewer.user.id)).emergencyRank).toBeNull();
  });

  it("only takes members who share a phone, and real outside contacts", async () => {
    const s = await setup();
    ok(await userContactService.update(s.caretaker.ctx, { phones: [PHONE], contactEmail: "c@example.com" }));
    ok(await memberSharingService.update(s.caretaker.ctx, s.groupId, { sharedFields: ["email"] }));
    expect(
      codeOf(
        await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [
          { kind: "member", userId: s.caretaker.user.id },
        ]),
      ),
    ).toBe("emergencyContactService:noPhone");
    expect(
      codeOf(
        await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [
          { kind: "member", userId: s.outsider.user.id },
        ]),
      ),
    ).toBe("emergencyContactService:invalid");
    expect(
      codeOf(
        await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [
          { kind: "outside", id: crypto.randomUUID() },
        ]),
      ),
    ).toBe("emergencyContactService:invalid");
  });

  it("has one primary contact, set by owners and admins, who must share a phone", async () => {
    const s = await setup();
    await s.sharePhone(s.caretaker);
    await s.sharePhone(s.admin);

    expect(
      codeOf(await emergencyContactService.setPrimary(s.caretaker.ctx, s.groupId, s.caretaker.user.id)),
    ).toBe("emergencyContactService:notAllowed");
    expect(codeOf(await emergencyContactService.setPrimary(s.owner.ctx, s.groupId, s.viewer.user.id))).toBe(
      "emergencyContactService:noPhone",
    );

    ok(await emergencyContactService.setPrimary(s.owner.ctx, s.groupId, s.caretaker.user.id));
    ok(await emergencyContactService.setPrimary(s.admin.ctx, s.groupId, s.admin.user.id));
    expect((await s.membership(s.caretaker.user.id)).isPrimaryContact).toBe(false);
    expect((await s.membership(s.admin.user.id)).isPrimaryContact).toBe(true);

    ok(await emergencyContactService.setPrimary(s.owner.ctx, s.groupId, null));
    expect((await s.membership(s.admin.user.id)).isPrimaryContact).toBe(false);
  });

  it("is kept to one primary by the database too", async () => {
    const s = await setup();
    const a = await s.membership(s.caretaker.user.id);
    const b = await s.membership(s.admin.user.id);
    ok(
      await careGroupMemberModel.update({
        ...system,
        filter: { id: { type: "eq", value: a.id } },
        data: { isPrimaryContact: true },
      }),
    );
    const second = await careGroupMemberModel.update({
      ...system,
      filter: { id: { type: "eq", value: b.id } },
      data: { isPrimaryContact: true },
    });
    expect(isError(second)).toBe(true);
  });

  it("drops a member who stops sharing a phone (rank and primary), and says so", async () => {
    const s = await setup();
    await s.sharePhone(s.caretaker);
    await s.sharePhone(s.admin);
    const rosa = { id: crypto.randomUUID(), name: "Rosa", phone: "555 010 4410" };
    ok(await careRecipientDetailsService.updateOutsideContacts(s.owner.ctx, s.groupId, [rosa]));
    ok(
      await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [
        { kind: "member", userId: s.caretaker.user.id },
        { kind: "member", userId: s.admin.user.id },
        { kind: "outside", id: rosa.id },
      ]),
    );
    ok(await emergencyContactService.setPrimary(s.owner.ctx, s.groupId, s.caretaker.user.id));

    const unshared = ok(await memberSharingService.update(s.caretaker.ctx, s.groupId, { sharedFields: [] }));
    expect(unshared.droppedFromEmergencyList).toBe(true);
    const caretaker = await s.membership(s.caretaker.user.id);
    expect([caretaker.emergencyRank, caretaker.isPrimaryContact]).toEqual([null, false]);
    // Managers' note: when they fell off, until a manager saves the list again.
    expect(caretaker.emergencyDroppedAt).not.toBeNull();
    expect((await s.membership(s.admin.user.id)).emergencyRank).toBe(1);
    expect((await s.membership(s.admin.user.id)).emergencyDroppedAt).toBeNull();
    const details = ok(await careRecipientDetailsService.get(s.owner.ctx, s.groupId));
    expect(details.outsideContacts[0]?.emergencyRank).toBe(2);

    // Clearing the phone itself on the account does the same.
    const cleared = ok(await userContactService.update(s.admin.ctx, { phones: [] }));
    expect(cleared.droppedFromEmergencyLists).toEqual([s.groupId]);
    expect((await s.membership(s.admin.user.id)).emergencyRank).toBeNull();
    expect((await s.membership(s.admin.user.id)).emergencyDroppedAt).not.toBeNull();

    // Saving the list answers the notes.
    ok(await emergencyContactService.setOrder(s.owner.ctx, s.groupId, [{ kind: "outside", id: rosa.id }]));
    for (const who of [s.caretaker, s.admin])
      expect((await s.membership(who.user.id)).emergencyDroppedAt).toBeNull();
  });
});

describe("members' contact details", () => {
  it("are their own: nobody else reads user_contact", async () => {
    const s = await setup();
    ok(await userContactService.update(s.caretaker.ctx, { phones: [PHONE], address: "1 Example Way" }));
    expect(ok(await userContactService.get(s.caretaker.ctx))).toMatchObject({ address: "1 Example Way" });
    expect(ok(await userContactService.get(s.owner.ctx))).toEqual({
      phones: [],
      contactEmail: null,
      address: null,
    });
    for (const who of [s.owner, s.viewer]) {
      const rows = ok(await userContactModel.list({ ...who.ctx, filter: {} }));
      expect(rows.data.map((r) => r.userId)).not.toContain(s.caretaker.user.id);
    }
  });

  it("reach a group only as shared: nothing by default, chosen fields only", async () => {
    const s = await setup();
    ok(
      await userContactService.update(s.caretaker.ctx, {
        phones: [PHONE],
        contactEmail: "c@example.com",
        address: "1 Example Way",
      }),
    );
    expect(await s.shareOf(s.caretaker.user.id)).toBeNull();

    const saved = ok(
      await memberSharingService.update(s.caretaker.ctx, s.groupId, {
        sharedFields: ["phones", "email"],
        relationship: "Daughter",
      }),
    );
    expect(saved).toMatchObject({ relationship: "Daughter", sharedFields: ["phones", "email"] });

    // Every member of the group reads it, the viewer included.
    const share = ok(
      await memberContactShareModel.get({
        ...s.viewer.ctx,
        filter: { userId: { type: "eq", value: s.caretaker.user.id } },
      }),
    );
    expect(share).toMatchObject({ phones: [PHONE], email: "c@example.com", address: null });
    // An outsider doesn't.
    expect(
      ok(
        await memberContactShareModel.get({
          ...s.outsider.ctx,
          filter: { userId: { type: "eq", value: s.caretaker.user.id } },
        }),
      ),
    ).toBeNull();
  });

  it("follow contact changes in every group, and per-group choices", async () => {
    const s = await setup();
    const { group: other } = await createGroup(s.owner, [{ user: s.caretaker.user, role: "caretaker" }]);
    ok(await userContactService.update(s.caretaker.ctx, { phones: [PHONE], address: "Old Street" }));
    ok(await memberSharingService.update(s.caretaker.ctx, s.groupId, { sharedFields: ["address"] }));
    ok(await memberSharingService.update(s.caretaker.ctx, other.id, { sharedFields: ["phones"] }));

    ok(await userContactService.update(s.caretaker.ctx, { address: "New Street" }));
    expect(await s.shareOf(s.caretaker.user.id)).toMatchObject({ address: "New Street", phones: null });
    const otherShare = ok(
      await memberContactShareModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: other.id },
          userId: { type: "eq", value: s.caretaker.user.id },
        },
      }),
    );
    expect(otherShare).toMatchObject({ phones: [PHONE], address: null });

    // Unsharing removes the row.
    ok(await memberSharingService.update(s.caretaker.ctx, s.groupId, { sharedFields: [] }));
    expect(await s.shareOf(s.caretaker.user.id)).toBeNull();
  });

  it("disappear from a group when the member leaves, or is removed", async () => {
    const s = await setup();
    await s.sharePhone(s.caretaker);
    await s.sharePhone(s.viewer);
    expect(await s.shareOf(s.caretaker.user.id)).not.toBeNull();

    ok(await careGroupMemberService.leave(s.caretaker.ctx, s.groupId));
    expect(await s.shareOf(s.caretaker.user.id)).toBeNull();

    const viewer = await s.membership(s.viewer.user.id);
    ok(await careGroupMemberService.remove(s.owner.ctx, viewer.id));
    expect(await s.shareOf(s.viewer.user.id)).toBeNull();
  });

  it("can't be shared with a group you're not in, or for someone else", async () => {
    const s = await setup();
    expect(
      codeOf(await memberSharingService.update(s.outsider.ctx, s.groupId, { sharedFields: ["phones"] })),
    ).toBe("memberSharingService:notFound");
    // Managers can't set another member's choices through the model either.
    const caretaker = await s.membership(s.caretaker.user.id);
    expect(
      codeOf(
        await careGroupMemberModel.update({
          ...s.owner.ctx,
          filter: { id: { type: "eq", value: caretaker.id } },
          data: { sharedFields: ["phones"] },
        }),
      ),
    ).toBe("permissions:fieldUnauthorized");
  });
});
