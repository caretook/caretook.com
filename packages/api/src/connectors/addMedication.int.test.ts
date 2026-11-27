import { careGroupService, medicationService, providerService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import {
  callTool,
  connectAssistant,
  enablePasswordSignIn,
  mcpHandler,
  mcpPost,
  textOf,
  TEST_ORIGIN,
  toolRequest,
} from "./testing";

// add_medication through /mcp with tokens from the real OAuth dance: the Add
// medication sheet's schemas and checks, med times by name, the started
// entry's "via", no second copy of a current medication, and the grant's
// limits. All data is fictional.

const handler = mcpHandler();
const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });
const CLIENT = "Test Claude";

const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  for (const who of [owner, caretaker]) await enablePasswordSignIn(who.user.id);
  const { group } = await createGroup(owner, [{ user: caretaker.user, role: "caretaker" }]);
  ok(await careGroupService.update(owner.ctx, { filter: byId(group.id), data: { connectorsEnabled: true } }));
  const provider = async (type: "clinician" | "pharmacy", name: string) =>
    ok(await providerService.create(owner.ctx, { groupId: group.id, type, name }))!;
  const clinician = await provider("clinician", "Dr. Example Fern");
  const pharmacy = await provider("pharmacy", "Maple Corner Pharmacy");
  const connect = async (scope: "read" | "readWrite" = "readWrite") =>
    (await connectAssistant({ email: caretaker.user.email, groupId: group.id, scope, clientName: CLIENT }))
      .tokens.access_token;
  const medications = async () => ok(await medicationService.list(owner.ctx, { groupId: group.id })).data;
  return { group, clinician, pharmacy, connect, medications };
};

type Listed = {
  id: string;
  type: string | null;
  schedule: string | null;
  maxPerDay: number | null;
  prescriber: { id: string; name: string | null } | null;
  pharmacy: { id: string; name: string | null } | null;
};
type Round = { name: string; time: string; medications: { medicationId: string }[] };

describe("add_medication", () => {
  it("adds a prescription in a med time and at a time of its own, listed, planned and tagged via", async () => {
    const w = await world();
    const token = await w.connect();
    const added = await callTool(handler, token, "add_medication", {
      name: "Lisinopril",
      type: "prescription",
      strength: "10 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: "With water",
      reason: "Blood pressure",
      prescriberId: w.clinician.id,
      pharmacyId: w.pharmacy.id,
      schedule: { type: "scheduled", slots: [{ medTime: "mORNING" }, { time: "14:00" }] },
    });
    expect(added.isError).toBeFalsy();
    const medicationId = added.structuredContent.medicationId as string;
    const url = `${TEST_ORIGIN}/app/groups/${w.group.id}/medications/${medicationId}`;
    expect(textOf(added)).toBe(
      [
        "Added medication: Lisinopril · 10 mg · Tablet · With water",
        "Schedule: Morning and 14:00",
        url,
        `Shown as "via ${CLIENT}" on its started entry.`,
      ].join("\n"),
    );
    expect(added.structuredContent).toMatchObject({
      medicationId,
      url,
      via: CLIENT,
      schedule: "Morning and 14:00",
      preview: { title: "Lisinopril", detail: "10 mg · Tablet · With water" },
    });

    const listed = await callTool(handler, token, "list_medications");
    const meds = listed.structuredContent.medications as Listed[];
    expect(meds.find((m) => m.id === medicationId)).toMatchObject({
      type: "prescription",
      schedule: "Morning and 14:00",
      prescriber: { id: w.clinician.id, name: "Dr. Example Fern" },
      pharmacy: { id: w.pharmacy.id, name: "Maple Corner Pharmacy" },
    });

    const plan = await callTool(handler, token, "dose_schedule");
    const rounds = (plan.structuredContent.days as { rounds: Round[] }[]).flatMap((d) => d.rounds);
    const holding = rounds.filter((r) => r.medications.some((m) => m.medicationId === medicationId));
    expect(new Set(holding.map((r) => r.time))).toEqual(new Set(["08:00", "14:00"]));
    expect(holding.find((r) => r.time === "08:00")?.name).toBe("Morning");

    const timeline = await callTool(handler, token, "list_timeline", { kinds: ["medicationChange"] });
    const entries = timeline.structuredContent.entries as {
      details: { medicationId?: string; change?: string };
      via: string | null;
    }[];
    const started = entries.filter((e) => e.details.medicationId === medicationId);
    expect(started.map((e) => [e.details.change, e.via])).toEqual([["started", CLIENT]]);
  });

  it("adds an as-needed one with a most a day", async () => {
    const w = await world();
    const token = await w.connect();
    const added = await callTool(handler, token, "add_medication", {
      name: "Acetaminophen",
      type: "otc",
      strength: "500 mg",
      schedule: { type: "asNeeded", maxPerDay: 4 },
    });
    expect(added.isError).toBeFalsy();
    expect(added.structuredContent.schedule).toBe("As needed, up to 4 a day");
    const meds = (await callTool(handler, token, "list_medications")).structuredContent
      .medications as Listed[];
    expect(meds.find((m) => m.id === added.structuredContent.medicationId)).toMatchObject({
      type: "otc",
      maxPerDay: 4,
      schedule: "As needed, up to 4 a day",
    });
  });

  it("refuses no type, an unknown med time, a slot with both, and a clinician as pharmacy, writing nothing", async () => {
    const w = await world();
    const token = await w.connect();
    const base = { name: "Metformin", type: "prescription", schedule: { type: "asNeeded" } };

    const noType = await callTool(handler, token, "add_medication", { ...base, type: undefined });
    expect(noType.isError).toBe(true);
    expect(noType.structuredContent).toMatchObject({
      error: { code: "mcp:invalidArguments", issues: [{ path: "type" }] },
    });

    const unknown = await callTool(handler, token, "add_medication", {
      ...base,
      schedule: { type: "scheduled", slots: [{ time: "12:00" }, { medTime: "Bedtime" }] },
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.structuredContent).toMatchObject({
      error: {
        code: "connectorTool:invalid",
        issues: [
          {
            path: "schedule.slots.1.medTime",
            message: "No med time called Bedtime. Med times: Morning (08:00), Evening (20:00).",
          },
        ],
      },
    });

    const both = await callTool(handler, token, "add_medication", {
      ...base,
      schedule: { type: "scheduled", slots: [{ medTime: "Morning", time: "08:00" }] },
    });
    expect(both.isError).toBe(true);
    expect(both.structuredContent).toMatchObject({ error: { code: "mcp:invalidArguments" } });

    const badPharmacy = await callTool(handler, token, "add_medication", {
      ...base,
      pharmacyId: w.clinician.id,
    });
    expect(badPharmacy.isError).toBe(true);
    expect(badPharmacy.structuredContent).toMatchObject({
      error: { code: "medicationService:badPharmacy", issues: [{ path: "pharmacyId" }] },
    });

    expect(await w.medications()).toHaveLength(0);
  });

  it("adds nothing for the same name and strength again, answering with the first one", async () => {
    const w = await world();
    const token = await w.connect();
    const first = await callTool(handler, token, "add_medication", {
      name: "Vitamin D3",
      type: "supplement",
      strength: "1000 IU",
      schedule: { type: "scheduled", slots: [{ medTime: "Morning" }] },
    });
    const firstId = first.structuredContent.medicationId as string;

    const again = await callTool(handler, token, "add_medication", {
      name: "  vitamin   d3 ",
      type: "supplement",
      strength: "1000 iu",
      schedule: { type: "asNeeded" },
    });
    expect(again.isError).toBeFalsy();
    expect(again.structuredContent).toMatchObject({ medicationId: firstId, alreadyThere: true });
    expect(textOf(again)).toBe(
      `Already on the medication list, nothing added: Vitamin D3 1000 IU\n${TEST_ORIGIN}/app/groups/${w.group.id}/medications/${firstId}`,
    );
    expect(await w.medications()).toHaveLength(1);

    // Another strength is another medication.
    const other = await callTool(handler, token, "add_medication", {
      name: "Vitamin D3",
      type: "supplement",
      schedule: { type: "asNeeded" },
    });
    expect(other.structuredContent.alreadyThere).toBeUndefined();
    expect(await w.medications()).toHaveLength(2);
  });

  it("isn't for a read grant", async () => {
    const w = await world();
    const reader = await w.connect("read");
    const refused = await mcpPost(
      handler,
      reader,
      toolRequest("add_medication", { name: "Nope", type: "other", schedule: { type: "asNeeded" } }),
    );
    expect(refused.status).toBe(403);
    expect(refused.headers.get("www-authenticate")).toContain("insufficient_scope");
    expect(await w.medications()).toHaveLength(0);
  });
});
