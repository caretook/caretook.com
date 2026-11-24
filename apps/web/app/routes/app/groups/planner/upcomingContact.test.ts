import { describe, expect, it } from "vitest";
import { contactsByEntry, contactsQuery, placeLine, placeOf, upcomingActions } from "./upcomingContact";

const one = (sql: string) => sql.replace(/\s+/g, " ").trim();

const patel = {
  id: "p1",
  name: "Dr. Patel",
  deletedAt: null,
  phones: [{ label: "Office", number: "(555) 010-2000 x214" }],
  address: "48 Harbor Heart Center\nSpringfield, CA 90000",
};
const nurse = { id: "p2", name: "Maria", deletedAt: null, phones: [], address: null };
const removed = { ...patel, id: "p3", name: "Dr. Gone", deletedAt: "2026-11-01T00:00:00.000Z" };

describe("contactsQuery", () => {
  it("reads every listed entry's providers in one query over the same window", () => {
    const query = contactsQuery({ sql: "FROM timeline_entry WHERE group_id = ?", params: ["g"] });
    expect(one(query.sql)).toBe(
      "SELECT l.entry_id, l.provider_id, p.name, p.deleted_at, p.phones, p.address " +
        "FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id " +
        "WHERE l.entry_id IN (SELECT id FROM timeline_entry WHERE group_id = ?) " +
        "ORDER BY l.entry_id, l.created_at, l.id",
    );
    expect(query.params).toEqual(["g"]);
  });
});

describe("contactsByEntry", () => {
  it("groups rows by entry in link order, parsing phones and skipping half-synced rows", () => {
    const byEntry = contactsByEntry([
      { entry_id: "e1", provider_id: "p2", name: "Maria", deleted_at: null, phones: null, address: null },
      {
        entry_id: "e1",
        provider_id: "p1",
        name: "Dr. Patel",
        deleted_at: null,
        phones: JSON.stringify(patel.phones),
        address: patel.address,
      },
      { entry_id: "e2", provider_id: "p9", name: null, deleted_at: null, phones: "[]", address: null },
    ]);
    expect(byEntry.get("e1")).toEqual([nurse, patel]);
    expect(byEntry.has("e2")).toBe(false);
  });
});

describe("placeOf", () => {
  it("is the entry's own place, else the first linked provider's address", () => {
    expect(placeOf({ place: " Room 4 " }, [patel])).toEqual({ text: "Room 4", from: null });
    expect(placeOf({ place: null }, [nurse, patel])).toEqual({
      text: "48 Harbor Heart Center, Springfield, CA 90000",
      from: "Dr. Patel",
    });
    expect(placeOf({ place: "" }, [removed])).toBeNull();
    expect(placeOf({})).toBeNull();
  });

  it("joins a place's lines for one line", () => {
    expect(placeLine("48 Harbor Heart Center\n Springfield, CA 90000\n")).toBe(
      "48 Harbor Heart Center, Springfield, CA 90000",
    );
  });
});

describe("upcomingActions", () => {
  it("calls the first linked provider with a number, and maps the place", () => {
    expect(upcomingActions({ place: null }, [removed, nurse, patel])).toEqual([
      {
        kind: "call",
        href: "tel:5550102000,214",
        label: "Call Dr. Patel, office",
        value: patel.phones[0]!.number,
      },
      {
        kind: "map",
        href: expect.stringContaining(
          "https://www.google.com/maps/search/?api=1&query=48%20Harbor",
        ) as string,
        label: "Directions to 48 Harbor Heart Center, Springfield, CA 90000",
        value: "48 Harbor Heart Center, Springfield, CA 90000",
      },
    ]);
  });

  it("has nothing for an item with no provider or place", () => {
    expect(upcomingActions({ place: null }, [nurse])).toEqual([]);
    expect(upcomingActions({ place: "Home" })).toEqual([
      expect.objectContaining({ kind: "map", label: "Directions to Home" }) as unknown,
    ]);
  });
});
