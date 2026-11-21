import { afterEach, describe, expect, it } from "vitest";
import {
  ADDED_NOTICE_MS,
  addedNoticeAt,
  addedNoticeSnapshot,
  addedNoticeText,
  clearAddedNotice,
  followLocation,
  offerAddedNotice,
} from "./addedNotice";

const SHEET = "/app/groups/g1/timeline/new/dose";
const TIMELINE = "/app/groups/g1/timeline";
const NOW = 1_000_000;
const offer = () =>
  offerAddedNotice({ groupId: "g1", medicationId: "m1", name: "Ibuprofen", from: SHEET }, NOW);

afterEach(() => clearAddedNotice());

describe("the quick add's notice", () => {
  it("reads 'Added <name>'", () => {
    expect(addedNoticeText({ name: "Ibuprofen" })).toBe("Added Ibuprofen");
  });

  it("waits while the sheet is open, then shows in its group only, until its time is up", () => {
    offer();
    expect(addedNoticeAt("g1", { pathname: SHEET, locationKey: "a", now: NOW })).toBeNull();
    expect(addedNoticeAt("g1", { pathname: TIMELINE, locationKey: "b", now: NOW })).toMatchObject({
      medicationId: "m1",
      name: "Ibuprofen",
    });
    expect(addedNoticeAt("g2", { pathname: TIMELINE, locationKey: "b", now: NOW })).toBeNull();
    expect(
      addedNoticeAt("g1", { pathname: TIMELINE, locationKey: "b", now: NOW + ADDED_NOTICE_MS }),
    ).toBeNull();
  });

  it("lands where the sheet closed to and goes at the next navigation", () => {
    offer();
    followLocation("g1", { pathname: SHEET, locationKey: "a" });
    expect(addedNoticeSnapshot()?.landedAt).toBeNull();
    followLocation("g1", { pathname: TIMELINE, locationKey: "b" });
    expect(addedNoticeSnapshot()?.landedAt).toBe("b");
    followLocation("g1", { pathname: TIMELINE, locationKey: "b" });
    expect(addedNoticeAt("g1", { pathname: TIMELINE, locationKey: "b", now: NOW })).not.toBeNull();
    expect(addedNoticeAt("g1", { pathname: TIMELINE, locationKey: "c", now: NOW })).toBeNull();
    followLocation("g1", { pathname: TIMELINE, locationKey: "c" });
    expect(addedNoticeSnapshot()).toBeNull();
  });

  it("a newer notice replaces it; clearing another's key leaves it", () => {
    offer();
    offerAddedNotice({ groupId: "g1", medicationId: "m2", name: "Vitamin D", from: SHEET }, NOW + 1);
    const notice = addedNoticeSnapshot()!;
    expect(notice.name).toBe("Vitamin D");
    clearAddedNotice("other");
    expect(addedNoticeSnapshot()).toBe(notice);
    clearAddedNotice(notice.key);
    expect(addedNoticeSnapshot()).toBeNull();
  });
});
