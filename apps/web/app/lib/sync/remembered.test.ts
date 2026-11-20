import { afterEach, describe, expect, it } from "vitest";
import { clearRemembered, recall, remember } from "./remembered";

const STRIP = { groupId: "g1", name: "dueTasks" };

describe("the tile cache", () => {
  afterEach(() => clearRemembered());

  it("remembers the last answer by key", () => {
    expect(recall("u1", STRIP)).toBeUndefined();
    remember("u1", STRIP, [{ id: "t1" }]);
    remember("u1", STRIP, [{ id: "t2" }]);
    expect(recall("u1", STRIP)).toEqual([{ id: "t2" }]);
    expect(recall("u1", { ...STRIP, name: "dueDoses:doses" })).toBeUndefined();
  });

  it("keeps two users' and two groups' answers apart", () => {
    remember("u1", STRIP, ["mine"]);
    remember("u2", STRIP, ["theirs"]);
    remember("u1", { ...STRIP, groupId: "g2" }, ["other group"]);
    expect(recall("u1", STRIP)).toEqual(["mine"]);
    expect(recall("u2", STRIP)).toEqual(["theirs"]);
    expect(recall("u1", { ...STRIP, groupId: "g2" })).toEqual(["other group"]);
    expect(recall("u2", { ...STRIP, groupId: "g2" })).toBeUndefined();
  });

  it("clear() empties it", () => {
    remember("u1", STRIP, []);
    remember("u2", { groupId: "g2", name: "x" }, [1]);
    clearRemembered();
    expect(recall("u1", STRIP)).toBeUndefined();
    expect(recall("u2", { groupId: "g2", name: "x" })).toBeUndefined();
  });
});
