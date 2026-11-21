import type { AuthUser } from "../permissions";
import type { SearchOptions, SearchResult } from ".";
import type { TimelineEntryCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../test/fixtures";
import { getDb } from "../db";
import { noteDocumentSchema, timelineEntrySchema } from "../db/schema";
import { isError } from "../errors";
import {
  entryProviderService,
  medicationService,
  noteDocumentService,
  providerService,
  recipientConditionService,
  searchService,
  timelineEntryService,
} from ".";

// Every test builds its own users and group, so tests never depend on each other.
// All names and text are fictional.

type Ctx = { authUser: AuthUser };
/** Loosely typed entry content for fixtures; the service validates it. */
type EntryInput = { kind: TimelineEntryCreateInput["kind"] } & Record<string, unknown>;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const caretaker = await createUser("Robin Quill");
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group, recipient } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  const { group: otherGroup } = await createGroup(outsider);

  const search = async (ctx: Ctx, q: string, options: Partial<SearchOptions> = {}) =>
    ok(await searchService.search(ctx, { groupId: group.id, q, ...options }));
  /** The ids of the entries a search finds, as a sorted list. */
  const entryIds = async (q: string, options: Partial<SearchOptions> = {}, ctx: Ctx = caretaker.ctx) =>
    (await search(ctx, q, { scopes: ["entry"], ...options })).entries.map((h) => h.id).sort();

  let minute = 0;
  const addEntry = async (input: EntryInput, ctx: Ctx = caretaker.ctx) => {
    minute += 1;
    const entry = ok(
      await timelineEntryService.create(ctx, {
        groupId: group.id,
        occurredAt: new Date(Date.UTC(2026, 9, 1, 12, minute)).toISOString(),
        timeZone: "America/Los_Angeles",
        ...input,
      } as TimelineEntryCreateInput),
    );
    if (!entry) throw new Error("entry not readable");
    return entry;
  };

  /** A live document with these lines, compacted, as the server stores it. */
  const writeDocument = async (
    subject: "entry" | "provider" | "medication",
    id: string,
    text: string,
    groupId = group.id,
    ctx: Ctx = caretaker.ctx,
  ) => {
    ok(await noteDocumentService.create(ctx, { id, groupId, subject }));
    const ydoc = newYDoc();
    for (const line of text.split("\n")) {
      ok(
        await noteDocumentService.appendUpdate(ctx, {
          id: randomUUID(),
          groupId,
          documentId: id,
          data: typeParagraph(ydoc, line),
        }),
      );
    }
    ok(await noteDocumentService.compact(id));
  };

  const addNote = async (text: string, input: Omit<EntryInput, "kind"> = {}) => {
    const entry = await addEntry({ kind: "note", ...input });
    await writeDocument("entry", entry.id, text);
    return entry;
  };

  return {
    group,
    recipient,
    otherGroup,
    caretaker,
    owner,
    viewer,
    outsider,
    search,
    entryIds,
    addEntry,
    addNote,
    writeDocument,
  };
};

describe("searchService: what matches", () => {
  it("finds entries by every searchable field", async () => {
    const s = await setup();
    const { caretaker, group } = s;

    const titled = await s.addEntry({ kind: "event", title: "Hydrotherapy session", place: "Larkspur Pool" });
    const noted = await s.addNote("Grandma enjoyed the marmalade toast");
    const symptom = await s.addEntry({ kind: "symptom", details: { name: "Dizziness", severity: 4 } });
    const vital = await s.addEntry({
      kind: "vital",
      details: { readings: [{ type: "bloodPressure", systolic: 128, diastolic: 82 }] },
    });
    const medication = ok(
      await medicationService.create(caretaker.ctx, {
        groupId: group.id,
        name: "Zanthoxyl",
        strength: "15 mg",
        schedule: { type: "scheduled", times: ["08:00"] },
      }),
    );
    if (!medication) throw new Error("medication not readable");
    const dose = await s.addEntry({
      kind: "dose",
      details: { medicationId: medication.id, status: "given", note: "Taken with applesauce" },
    });
    const provider = ok(
      await providerService.create(caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Okonkwo",
      }),
    );
    if (!provider) throw new Error("provider not readable");
    const linked = await s.addEntry({ kind: "event", title: "Checkup" });
    ok(
      await entryProviderService.link(caretaker.ctx, {
        groupId: group.id,
        entryId: linked.id,
        providerId: provider.id,
      }),
    );
    const byOwner = await s.addEntry({ kind: "symptom", details: { name: "Cough" } }, s.owner.ctx);

    expect(await s.entryIds("hydrotherapy")).toEqual([titled.id]);
    expect(await s.entryIds("larkspur")).toEqual([titled.id]);
    expect(await s.entryIds("marmalade")).toEqual([noted.id]);
    expect(await s.entryIds("dizziness")).toEqual([symptom.id]);
    expect(await s.entryIds("blood pressure")).toEqual([vital.id]);
    // The dose, and the medication's own "started" change entry.
    expect(await s.entryIds("zanthoxyl", { kinds: ["dose"] })).toEqual([dose.id]);
    expect((await s.entryIds("zanthoxyl")).length).toBe(2);
    expect(await s.entryIds("applesauce")).toEqual([dose.id]);
    expect(await s.entryIds("okonkwo")).toEqual([linked.id]);
    // The author's name: Robin Quill wrote everything except the owner's cough.
    expect(await s.entryIds("cough owner")).toEqual([byOwner.id]);
    expect(await s.entryIds("quill dizziness")).toEqual([symptom.id]);

    const hits = (await s.search(caretaker.ctx, "hydrotherapy")).entries;
    expect(hits[0]).toMatchObject({
      id: titled.id,
      type: "entry",
      kind: "event",
      title: "Hydrotherapy session",
      occurredAt: expect.any(String) as string,
      status: null,
    });
    expect(hits[0]!.rank).toBeGreaterThan(0);
    // An entry without a title is called by its symptom, vitals or medication.
    expect((await s.search(caretaker.ctx, "dizziness")).entries[0]!.title).toBe("Dizziness");
    expect((await s.search(caretaker.ctx, "blood pressure")).entries[0]!.title).toBe("Blood pressure");
    expect((await s.search(caretaker.ctx, "applesauce")).entries[0]!.title).toBe("Zanthoxyl 15 mg");
    // The snippet is plain text from the body.
    expect((await s.search(caretaker.ctx, "marmalade")).entries[0]!.snippet).toBe(
      "Grandma enjoyed the marmalade toast",
    );
  });

  it("finds providers and medications by their fields and notes, past and stopped ones marked", async () => {
    const s = await setup();
    const { caretaker, group } = s;
    const practice = ok(
      await providerService.create(caretaker.ctx, {
        groupId: group.id,
        type: "practice",
        name: "Bramblewood Clinic",
      }),
    )!;
    const clinician = ok(
      await providerService.create(caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Feldspar",
        specialty: "Nephrology",
        practiceId: practice.id,
        status: "past",
      }),
    )!;
    await s.writeDocument("provider", clinician.id, "Parking behind the bakery");
    const medication = ok(
      await medicationService.create(caretaker.ctx, {
        groupId: group.id,
        name: "Quintarol",
        strength: "5 mg",
        reason: "Restless legs",
        directions: "Before bedtime",
        status: "discontinued",
        startedOn: "2026-09-01",
        stoppedOn: "2026-10-01",
        stopReason: "sideEffects",
        schedule: { type: "scheduled", times: ["21:00"] },
      }),
    )!;
    await s.writeDocument("medication", medication.id, "Ask about a generic version");

    const providerIds = async (q: string) =>
      (await s.search(caretaker.ctx, q, { scopes: ["provider"] })).providers.map((h) => h.id).sort();
    expect(await providerIds("feldspar")).toEqual([clinician.id]);
    expect(await providerIds("nephrology")).toEqual([clinician.id]);
    expect(await providerIds("bramblewood")).toEqual([clinician.id, practice.id].sort());
    expect(await providerIds("bakery")).toEqual([clinician.id]);
    const [hit] = (await s.search(caretaker.ctx, "feldspar")).providers;
    expect(hit).toMatchObject({
      type: "provider",
      kind: null,
      title: "Dr. Feldspar",
      status: "past",
      occurredAt: null,
    });

    const medicationIds = async (q: string) =>
      (await s.search(caretaker.ctx, q, { scopes: ["medication"] })).medications.map((h) => h.id);
    for (const q of ["quintarol", "restless legs", "bedtime", "generic"]) {
      expect(await medicationIds(q)).toEqual([medication.id]);
    }
    expect((await s.search(caretaker.ctx, "quintarol")).medications[0]).toMatchObject({
      type: "medication",
      title: "Quintarol 5 mg",
      status: "discontinued",
    });
    expect((await s.search(caretaker.ctx, "generic")).medications[0]!.snippet).toBe(
      "Restless legs Before bedtime Ask about a generic version",
    );
  });

  it("ranks a title match above a body match", async () => {
    const s = await setup();
    const inBody = await s.addNote("Talked about the garden");
    const inTitle = await s.addEntry({ kind: "event", title: "Garden visit" });
    const hits = (await s.search(s.caretaker.ctx, "garden")).entries;
    expect(hits.map((h) => h.id)).toEqual([inTitle.id, inBody.id]);
    expect(hits[0]!.rank).toBeGreaterThan(hits[1]!.rank);
  });
});

describe("searchService: condition changes (conditions slice 2)", () => {
  it("finds a condition's changes by its name, each titled by the name it had then", async () => {
    const s = await setup();
    const condition = ok(
      await recipientConditionService.create(s.caretaker.ctx, { groupId: s.group.id, name: "Diabetes" }),
    )!;
    ok(await recipientConditionService.update(s.caretaker.ctx, condition.id, { name: "Type 2 diabetes" }));
    const hits = (await s.search(s.viewer.ctx, "diabetes", { scopes: ["entry"] })).entries;
    expect(hits).toHaveLength(2);
    // Each is titled by the name it had then.
    expect(hits.map((h) => [h.kind, h.title]).sort()).toEqual([
      ["conditionChange", "Diabetes"],
      ["conditionChange", "Type 2 diabetes"],
    ]);
    // Only the add knew it as just "Diabetes".
    expect(await s.entryIds("diabetes -type")).toHaveLength(1);
  });
});

describe("searchService: the query language", () => {
  it("stems, folds accents and case, and matches prefixes", async () => {
    const s = await setup();
    const walking = await s.addNote("She was WALKING to the café with Zoë");
    expect(await s.entryIds("walked")).toEqual([walking.id]);
    expect(await s.entryIds("walki")).toEqual([walking.id]);
    expect(await s.entryIds("wal")).toEqual([walking.id]);
    expect(await s.entryIds("CAFE zoe")).toEqual([walking.id]);
    expect(await s.entryIds("café")).toEqual([walking.id]);
    expect(await s.entryIds("walked swimming")).toEqual([]);
  });

  it("matches phrases and leaves out exclusions", async () => {
    const s = await setup();
    const a = await s.addNote("Long walk by the river");
    const b = await s.addNote("River walk was long");
    expect(await s.entryIds("river walk")).toEqual([a.id, b.id].sort());
    expect(await s.entryIds('"river walk"')).toEqual([b.id]);
    expect(await s.entryIds('"walk by the river"')).toEqual([a.id]);
    expect(await s.entryIds("river -long")).toEqual([]);
    expect(await s.entryIds("river -swim")).toEqual([a.id, b.id].sort());
    expect(await s.entryIds('river -"long walk"')).toEqual([b.id]);
  });

  it("matches nothing for an empty or exclusion-only search, and never fails on junk", async () => {
    const s = await setup();
    await s.addNote("Something to find");
    for (const q of ["", "   ", "-something", '-"to find"']) {
      expect(await s.search(s.caretaker.ctx, q)).toEqual({
        entries: [],
        nextCursor: null,
        providers: [],
        medications: [],
      });
    }
    for (const q of ['"unbalanced', "a & b | !c", "(:*)", "'quote' \\ ;--", "<-> !!"]) {
      expect(codeOf(await searchService.search(s.caretaker.ctx, { groupId: s.group.id, q }))).toBe("ok");
    }
  });
});

describe("searchService: deleted rows, filters and paging", () => {
  it("never matches deleted entries, providers or medications", async () => {
    const s = await setup();
    const { caretaker, group } = s;
    const entry = await s.addNote("Vanishing pelican");
    const provider = ok(
      await providerService.create(caretaker.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Pelican",
      }),
    )!;
    const medication = ok(
      await medicationService.create(caretaker.ctx, {
        groupId: group.id,
        name: "Pelicanol",
        schedule: { type: "asNeeded" },
      }),
    )!;
    const before = await s.search(caretaker.ctx, "pelican");
    expect(before.entries.map((h) => h.id)).toContain(entry.id);
    expect(before.providers.map((h) => h.id)).toEqual([provider.id]);
    expect(before.medications.map((h) => h.id)).toEqual([medication.id]);

    ok(await timelineEntryService.remove(caretaker.ctx, entry.id));
    ok(await providerService.remove(caretaker.ctx, provider.id));
    ok(await medicationService.remove(caretaker.ctx, medication.id));
    const after = await s.search(caretaker.ctx, "pelican");
    expect(after.entries.map((h) => h.id)).not.toContain(entry.id);
    expect(after.providers).toEqual([]);
    expect(after.medications).toEqual([]);
  });

  it("filters by scope, kind, date range and author", async () => {
    const s = await setup();
    const { caretaker, owner, group } = s;
    const early = await s.addEntry({
      kind: "symptom",
      details: { name: "Heron ache" },
      occurredAt: "2026-03-01T10:00:00.000Z",
    });
    const late = await s.addNote("Heron by the pond", { occurredAt: "2026-06-01T10:00:00.000Z" });
    const byOwner = await s.addEntry(
      { kind: "event", title: "Heron watch", occurredAt: "2026-04-01T10:00:00.000Z" },
      owner.ctx,
    );
    ok(await providerService.create(caretaker.ctx, { groupId: group.id, type: "other", name: "Heron Taxi" }));

    expect(await s.entryIds("heron")).toEqual([early.id, late.id, byOwner.id].sort());
    expect(await s.entryIds("heron", { kinds: ["note", "event"] })).toEqual([late.id, byOwner.id].sort());
    expect(await s.entryIds("heron", { from: "2026-03-15T00:00:00.000Z" })).toEqual(
      [late.id, byOwner.id].sort(),
    );
    expect(await s.entryIds("heron", { to: "2026-04-01T10:00:00.000Z" })).toEqual([early.id]);
    expect(await s.entryIds("heron", { authorId: owner.user.id })).toEqual([byOwner.id]);

    const providersOnly = await s.search(caretaker.ctx, "heron", { scopes: ["provider"] });
    expect(providersOnly.entries).toEqual([]);
    expect(providersOnly.providers.map((h) => h.title)).toEqual(["Heron Taxi"]);
    expect((await s.search(caretaker.ctx, "heron", { scopes: ["entry"] })).providers).toEqual([]);
  });

  it("pages entries with a cursor, best match first, then newest", async () => {
    const s = await setup();
    const notes = [];
    for (let i = 0; i < 5; i++) notes.push(await s.addNote(`Ferret parade number ${i}`));
    const titled = await s.addEntry({ kind: "event", title: "Ferret parade" });

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: SearchResult = await s.search(s.caretaker.ctx, "ferret parade", { limit: 2, cursor });
      seen.push(...page.entries.map((h) => h.id));
      if (pages > 0) expect(page.providers).toEqual([]);
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    // The title match first, then the equally ranked notes newest first.
    expect(seen).toEqual([titled.id, ...notes.map((n) => n.id).reverse()]);

    expect(
      codeOf(
        await searchService.search(s.caretaker.ctx, { groupId: s.group.id, q: "ferret", cursor: "nope" }),
      ),
    ).toBe("searchService:badCursor");
  });
});

describe("searchService: who may search", () => {
  it("lets a viewer search, and gives a non-member not-found and nothing from other groups", async () => {
    const s = await setup();
    const mine = await s.addNote("Albatross sighting");
    // The outsider's own group has a matching note too.
    const theirs = ok(
      await timelineEntryService.create(s.outsider.ctx, {
        groupId: s.otherGroup.id,
        kind: "note",
        occurredAt: "2026-10-01T10:00:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    )!;
    await s.writeDocument(
      "entry",
      theirs.id,
      "Albatross sighting elsewhere",
      s.otherGroup.id,
      s.outsider.ctx,
    );

    expect(await s.entryIds("albatross", {}, s.viewer.ctx)).toEqual([mine.id]);
    expect(codeOf(await searchService.search(s.outsider.ctx, { groupId: s.group.id, q: "albatross" }))).toBe(
      "searchService:notFound",
    );
    expect(
      codeOf(await searchService.search(s.outsider.ctx, { groupId: randomUUID(), q: "albatross" })),
    ).toBe("searchService:notFound");
  });
});

describe("searchService: timing", () => {
  it("searches a group of 10,000 entries in under 200 ms", { timeout: 120_000 }, async () => {
    const s = await setup();
    const { group, caretaker } = s;
    const recipientId = s.recipient.id;

    const WORDS = [
      "breakfast",
      "walk",
      "nap",
      "garden",
      "visit",
      "phone",
      "call",
      "lunch",
      "tired",
      "cheerful",
      "medicine",
      "doctor",
      "pharmacy",
      "rain",
      "sunny",
      "reading",
      "puzzle",
      "music",
      "dinner",
      "bath",
    ];
    const sentence = (i: number, n: number) =>
      Array.from({ length: n }, (_, k) => WORDS[(i * 7 + k * 3) % WORDS.length]).join(" ");
    const kinds = ["note", "symptom", "event", "vital"] as const;
    const rows = Array.from({ length: 10_000 }, (_, i) => {
      const kind = kinds[i % kinds.length]!;
      return {
        id: randomUUID(),
        groupId: group.id,
        recipientId,
        kind,
        occurredAt: new Date(Date.UTC(2025, 0, 1) + i * 3_600_000).toISOString(),
        timeZone: "America/Los_Angeles",
        title: kind === "event" ? `Event ${sentence(i, 2)}` : null,
        body: null,
        details:
          kind === "symptom"
            ? { name: sentence(i, 1), severity: i % 10 }
            : kind === "vital"
              ? { readings: [{ type: "heartRate", value: 60 + (i % 40) }] }
              : null,
        createdBy: caretaker.user.id,
        updatedBy: caretaker.user.id,
      };
    });
    // One rare word, deep in the history, so the search must scan everything.
    const target = rows[1234]!;
    const db = getDb();
    for (let i = 0; i < rows.length; i += 1000) {
      await db.insert(timelineEntrySchema).values(rows.slice(i, i + 1000) as never);
    }
    const docs = rows
      .filter((r) => r.kind === "note" || r.kind === "event")
      .map((r) => ({
        id: r.id,
        groupId: group.id,
        subject: "entry" as const,
        entryId: r.id,
        text: r.id === target.id ? "The kingfisher came back" : `${sentence(rows.indexOf(r), 40)}`,
        createdBy: caretaker.user.id,
        updatedBy: caretaker.user.id,
      }));
    // The target must be a note or event, so it has a document.
    expect(["note", "event"]).toContain(target.kind);
    for (let i = 0; i < docs.length; i += 1000) {
      await db.insert(noteDocumentSchema).values(docs.slice(i, i + 1000) as never);
    }
    await db.execute(sql`ANALYZE timeline_entry`);
    await db.execute(sql`ANALYZE note_document`);

    const timed = async (q: string) => {
      const times: number[] = [];
      let result: SearchResult | null = null;
      for (let run = 0; run < 3; run++) {
        const start = performance.now();
        result = await s.search(caretaker.ctx, q);
        times.push(performance.now() - start);
      }
      return { best: Math.min(...times), result: result! };
    };

    const rare = await timed("kingfisher");
    expect(rare.result.entries.map((h) => h.id)).toEqual([target.id]);
    const common = await timed("garden walk");
    expect(common.result.entries.length).toBe(20);
    expect(common.result.nextCursor).not.toBeNull();

    console.info(
      `search timing (10,000 entries, best of 3): rare word ${rare.best.toFixed(0)} ms, common words ${common.best.toFixed(0)} ms`,
    );
    expect(rare.best).toBeLessThan(200);
    expect(common.best).toBeLessThan(200);
  });
});
