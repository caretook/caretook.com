import { describe, expect, it } from "vitest";
import {
  mergeEditors,
  parseEditTime,
  parseNoteEditors,
  RECENT_EDITORS_WINDOW_MS,
  recentEditors,
} from "./noteEditors";

const NOW = Date.parse("2026-11-17T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MARIA = "00000000-0000-4000-8000-00000000000a";
const SAM = "00000000-0000-4000-8000-00000000000b";
const LEE = "00000000-0000-4000-8000-00000000000c";

describe("parseEditTime", () => {
  it("reads Postgres, PowerSync and JavaScript timestamps", () => {
    const t = Date.parse("2026-11-17T10:00:00.250Z");
    expect(parseEditTime("2026-11-17 10:00:00.25+00")).toBe(t);
    expect(parseEditTime("2026-11-17 02:00:00.250-08:00")).toBe(t);
    expect(parseEditTime("2026-11-17T10:00:00.250000Z")).toBe(t);
    expect(parseEditTime("2026-11-17T10:00:00.250Z")).toBe(t);
    expect(parseEditTime("2026-11-17T10:00:00Z")).toBe(t - 250);
  });

  it("returns null for anything else", () => {
    for (const v of [null, undefined, "", "yesterday", 42, "2026-13-45T99:00:00Z"]) {
      expect(parseEditTime(v)).toBeNull();
    }
  });
});

describe("parseNoteEditors", () => {
  it("reads jsonb objects and JSON text, dropping junk", () => {
    expect(parseNoteEditors({ [MARIA]: "2026-11-17 10:00:00+00", [SAM]: "nope", "": ago(0) })).toEqual({
      [MARIA]: "2026-11-17T10:00:00.000Z",
    });
    expect(parseNoteEditors(JSON.stringify({ [SAM]: ago(1000) }))).toEqual({ [SAM]: ago(1000) });
    for (const v of [null, undefined, "", "{", "[]", [1], 7]) expect(parseNoteEditors(v)).toEqual({});
  });
});

describe("mergeEditors", () => {
  it("keeps the latest time per user, whichever side it's on", () => {
    const merged = mergeEditors({ [MARIA]: ago(60_000), [SAM]: ago(1_000) }, [
      { createdBy: MARIA, createdAt: ago(5_000) },
      { createdBy: MARIA, createdAt: ago(90_000) },
      { createdBy: SAM, createdAt: ago(30_000) },
      { createdBy: LEE, createdAt: "2026-11-17 11:59:00+00" },
    ]);
    expect(merged).toEqual({ [MARIA]: ago(5_000), [SAM]: ago(1_000), [LEE]: ago(60_000) });
  });

  it("ignores edits without an author or a time", () => {
    expect(
      mergeEditors({}, [
        { createdBy: null, createdAt: ago(0) },
        { createdBy: MARIA, createdAt: null },
      ]),
    ).toEqual({});
  });
});

describe("recentEditors", () => {
  it("is empty for empty inputs", () => {
    expect(recentEditors({ editors: {}, now: NOW })).toEqual([]);
    expect(recentEditors({ editors: null, pending: [], now: NOW })).toEqual([]);
  });

  it("keeps edits inside the window, up to and including its edge", () => {
    const editors = {
      [MARIA]: ago(RECENT_EDITORS_WINDOW_MS),
      [SAM]: ago(RECENT_EDITORS_WINDOW_MS + 1),
    };
    expect(recentEditors({ editors, now: NOW })).toEqual([
      { userId: MARIA, lastEditAt: ago(RECENT_EDITORS_WINDOW_MS) },
    ]);
    expect(recentEditors({ editors, now: NOW, windowMs: 1_000 })).toEqual([]);
  });

  it("merges editors with pending updates, the latest time winning", () => {
    // Maria's compacted time is outside the window; her pending update isn't.
    const res = recentEditors({
      editors: { [MARIA]: ago(10 * 60_000), [SAM]: ago(20_000) },
      pending: [
        { createdBy: MARIA, createdAt: ago(3_000) },
        { createdBy: SAM, createdAt: ago(10 * 60_000) },
      ],
      now: NOW,
    });
    expect(res).toEqual([
      { userId: MARIA, lastEditAt: ago(3_000) },
      { userId: SAM, lastEditAt: ago(20_000) },
    ]);
  });

  it("outlives compaction: editors alone carry the signal", () => {
    expect(recentEditors({ editors: { [MARIA]: ago(90_000) }, pending: [], now: NOW })).toEqual([
      { userId: MARIA, lastEditAt: ago(90_000) },
    ]);
  });

  it("leaves out the viewer", () => {
    const res = recentEditors({
      editors: { [MARIA]: ago(1_000) },
      pending: [{ createdBy: SAM, createdAt: ago(2_000) }],
      now: NOW,
      excludeUserId: MARIA,
    });
    expect(res.map((e) => e.userId)).toEqual([SAM]);
  });

  it("puts the most recent first", () => {
    const res = recentEditors({
      editors: { [LEE]: ago(50_000), [MARIA]: ago(10_000) },
      pending: [{ createdBy: SAM, createdAt: ago(30_000) }],
      now: NOW,
    });
    expect(res.map((e) => e.userId)).toEqual([MARIA, SAM, LEE]);
  });

  it("tolerates a device clock running a little fast, not wildly", () => {
    const editors = { [MARIA]: ago(-5_000), [SAM]: ago(-(RECENT_EDITORS_WINDOW_MS + 1)) };
    expect(recentEditors({ editors, now: NOW }).map((e) => e.userId)).toEqual([MARIA]);
  });
});
