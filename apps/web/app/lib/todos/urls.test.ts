import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls: todos", () => {
  it("prefills a new todo after the chip, encoding its values", () => {
    expect(appUrls.newTodo(G, { providerId: "p1", eventId: "e1", dueOn: "2026-11-20" }, "?who=mine")).toBe(
      `/app/groups/${G}/todos/new?who=mine&providerId=p1&eventId=e1&dueOn=2026-11-20`,
    );
    expect(appUrls.newTodo(G, { entryId: "n1" })).toBe(`/app/groups/${G}/todos/new?entryId=n1`);
    expect(
      appUrls.newTodo(G, {
        title: "Call pharmacy & fax",
        assigneeId: "u1",
        dueOn: "2026-11-20",
        dueTime: "17:00",
      }),
    ).toBe(
      `/app/groups/${G}/todos/new?dueOn=2026-11-20&title=Call+pharmacy+%26+fax&assigneeId=u1&dueTime=17%3A00`,
    );
  });
});
