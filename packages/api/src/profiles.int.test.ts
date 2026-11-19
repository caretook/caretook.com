import type { AuthUser } from "@caretook/data";

import { createRouterClient, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";

// Profiles slice 1 through the API: status codes, and what each procedure
// returns. Each test makes its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const rejection = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error as ORPCError<string, { code?: string; issues?: { path: string; message: string }[] }>;
};

const setup = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  return {
    groupId: group.id,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    caretaker: { ...caretaker, api: clientFor(caretaker.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
    outsider: { ...outsider, api: clientFor(outsider.ctx.authUser) },
  };
};

const PHONE = { label: "Mobile", number: "(555) 010-1001" };

describe("careGroup.updateRecipient and recipient", () => {
  it("save and return the basics and the note", async () => {
    const s = await setup();
    const saved = await s.caretaker.api.careGroup.updateRecipient({
      groupId: s.groupId,
      codeStatus: "fullCode",
      bloodType: "A+",
      notes: " Hard of hearing ",
    });
    expect(saved).toMatchObject({ codeStatus: "fullCode", bloodType: "A+", notes: "Hard of hearing" });
    expect(await s.viewer.api.careGroup.recipient({ groupId: s.groupId })).toMatchObject({
      codeStatus: "fullCode",
      notes: "Hard of hearing",
    });
  });

  it("refuse an unknown code status by field", async () => {
    const s = await setup();
    const error = await rejection(
      s.owner.api.careGroup.updateRecipient({ groupId: s.groupId, codeStatus: "maybe" as never }),
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(error.data?.issues)).toContain("codeStatus");
  });
});

describe("careGroup.recipientDetails", () => {
  it("is for writers: a viewer gets a 403, a non-member a 404", async () => {
    const s = await setup();
    const saved = await s.caretaker.api.careGroup.updateRecipientDetails({
      groupId: s.groupId,
      phones: [{ label: "Home", number: "555 010 2231" }],
      insurance: [{ insurer: "Medicare", memberId: "1EG4", rank: "primary" }],
    });
    expect(saved).toMatchObject({ phones: [{ number: "555 010 2231" }], insurance: [{ memberId: "1EG4" }] });
    expect(await s.owner.api.careGroup.recipientDetails({ groupId: s.groupId })).toEqual(saved);
    expect(Object.keys(saved)).not.toContain("createdBy");

    expect((await rejection(s.viewer.api.careGroup.recipientDetails({ groupId: s.groupId }))).code).toBe(
      "FORBIDDEN",
    );
    expect(
      (await rejection(s.viewer.api.careGroup.updateRecipientDetails({ groupId: s.groupId, email: null })))
        .code,
    ).toBe("FORBIDDEN");
    expect((await rejection(s.outsider.api.careGroup.recipientDetails({ groupId: s.groupId }))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("names the field of an invalid plan", async () => {
    const s = await setup();
    const error = await rejection(
      s.owner.api.careGroup.updateRecipientDetails({
        groupId: s.groupId,
        insurance: [{ insurer: "", memberId: "1" }],
      }),
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(error.data?.issues)).toContain("insurer");
  });
});

describe("emergency contacts", () => {
  it("are set by owners (outside contacts, order, primary), and refused to caretakers", async () => {
    const s = await setup();
    await s.caretaker.api.me.updateContact({ phones: [PHONE] });
    await s.caretaker.api.careGroup.updateMySharing({ groupId: s.groupId, sharedFields: ["phones"] });

    const withRosa = await s.owner.api.careGroup.updateOutsideContacts({
      groupId: s.groupId,
      contacts: [{ name: "Rosa", phone: "555 010 4410" }],
    });
    const rosaId = withRosa.outsideContacts.map((c) => (c as { id: string }).id)[0]!;
    const contacts = [
      { kind: "member" as const, userId: s.caretaker.user.id },
      { kind: "outside" as const, id: rosaId },
    ];
    expect(await s.owner.api.careGroup.setEmergencyContacts({ groupId: s.groupId, contacts })).toEqual({
      contacts,
      primaryUserId: null,
    });
    expect(
      await s.owner.api.careGroup.setPrimaryContact({ groupId: s.groupId, userId: s.caretaker.user.id }),
    ).toEqual({ contacts, primaryUserId: s.caretaker.user.id });

    expect(
      (await rejection(s.caretaker.api.careGroup.setEmergencyContacts({ groupId: s.groupId, contacts })))
        .code,
    ).toBe("FORBIDDEN");
    expect(
      (await rejection(s.caretaker.api.careGroup.updateOutsideContacts({ groupId: s.groupId, contacts: [] })))
        .code,
    ).toBe("FORBIDDEN");
    expect(
      (await rejection(s.outsider.api.careGroup.setPrimaryContact({ groupId: s.groupId, userId: null })))
        .code,
    ).toBe("NOT_FOUND");
  });

  it("refuse a member who shares no phone with a 409", async () => {
    const s = await setup();
    const error = await rejection(
      s.owner.api.careGroup.setPrimaryContact({ groupId: s.groupId, userId: s.viewer.user.id }),
    );
    expect(error.code).toBe("CONFLICT");
  });
});

describe("me.contact and updateMySharing", () => {
  it("keep the caller's details private until shared, and never return a sign-in email", async () => {
    const s = await setup();
    expect(await s.caretaker.api.me.contact()).toEqual({ phones: [], contactEmail: null, address: null });
    const saved = await s.caretaker.api.me.updateContact({ phones: [PHONE], contactEmail: "c@example.com" });
    expect(saved).toMatchObject({
      phones: [PHONE],
      contactEmail: "c@example.com",
      droppedFromEmergencyLists: [],
    });

    const sharing = await s.caretaker.api.careGroup.updateMySharing({
      groupId: s.groupId,
      sharedFields: ["email"],
      relationship: "Nephew",
    });
    expect(sharing).toMatchObject({
      relationship: "Nephew",
      sharedFields: ["email"],
      share: { phones: null, email: "c@example.com", address: null },
    });
    expect(JSON.stringify(sharing)).not.toContain(s.caretaker.user.email);

    expect(
      (await rejection(s.outsider.api.careGroup.updateMySharing({ groupId: s.groupId, sharedFields: [] })))
        .code,
    ).toBe("NOT_FOUND");
    const members = await s.viewer.api.careGroup.members({ groupId: s.groupId });
    expect(JSON.stringify(members)).not.toContain("@example.com");
  });
});
