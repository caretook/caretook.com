import { afterEach, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "../../../../lib/core/paging";
import { clearRemembered } from "../../../../lib/sync/remembered";
import { keepPaging, RESTORE_CAP, startPaging } from "./timelinePaging";

const ROWS = {
  entryRows: [{ id: "e1" }],
  linkRows: [{ entry_id: "e1" }],
  summaryRows: [],
  medicationRows: [],
};
const HERE = { locationKey: "k1", filterKey: "[null,null,null,null]" };
const kept = (limit: number, at = HERE) => ({ ...at, limit, rows: ROWS });

describe("the timeline's kept window", () => {
  afterEach(() => clearRemembered());

  it("the same history entry and filters restore the window and its rows", () => {
    keepPaging("u1", "g1", kept(3 * PAGE_SIZE));
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: 3 * PAGE_SIZE, rows: ROWS });
  });

  it("a new history entry (a new navigation, not Back) starts at one page", () => {
    keepPaging("u1", "g1", kept(3 * PAGE_SIZE));
    expect(startPaging("u1", "g1", { ...HERE, locationKey: "k2" })).toEqual({ limit: PAGE_SIZE });
  });

  it("other filters start at one page", () => {
    keepPaging("u1", "g1", kept(3 * PAGE_SIZE));
    expect(startPaging("u1", "g1", { ...HERE, filterKey: '["vital",null,null,null]' })).toEqual({
      limit: PAGE_SIZE,
    });
  });

  it("nothing kept, one page kept, another group or another user: one page, the loader's rows", () => {
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: PAGE_SIZE });
    keepPaging("u1", "g1", kept(PAGE_SIZE));
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: PAGE_SIZE });
    keepPaging("u1", "g1", kept(3 * PAGE_SIZE));
    expect(startPaging("u1", "g2", HERE)).toEqual({ limit: PAGE_SIZE });
    expect(startPaging("u2", "g1", HERE)).toEqual({ limit: PAGE_SIZE });
  });

  it("the last window kept for a group wins", () => {
    keepPaging("u1", "g1", kept(3 * PAGE_SIZE));
    keepPaging("u1", "g1", kept(2 * PAGE_SIZE, { ...HERE, locationKey: "k2" }));
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: PAGE_SIZE });
    expect(startPaging("u1", "g1", { ...HERE, locationKey: "k2" }).limit).toBe(2 * PAGE_SIZE);
  });

  it("the cap holds: a window past it restores the cap, with no rows (they load from the device)", () => {
    keepPaging("u1", "g1", kept(RESTORE_CAP));
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: RESTORE_CAP, rows: ROWS });
    keepPaging("u1", "g1", kept(40 * PAGE_SIZE));
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: RESTORE_CAP });
  });

  it("sign-out forgets it (the tile cache is cleared)", () => {
    keepPaging("u1", "g1", kept(3 * PAGE_SIZE));
    clearRemembered();
    expect(startPaging("u1", "g1", HERE)).toEqual({ limit: PAGE_SIZE });
  });
});
