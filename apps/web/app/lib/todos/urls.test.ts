import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls: todos", () => {
  it("builds the list, a todo, and its sheets, carrying the chip", () => {
    expect(appUrls.todos(G)).toBe(`/app/groups/${G}/todos`);
    expect(appUrls.todos(G, "?who=mine")).toBe(`/app/groups/${G}/todos?who=mine`);
    expect(appUrls.todo(G, "t1")).toBe(`/app/groups/${G}/todos/t1`);
    expect(appUrls.editTodo(G, "t1", "?who=everyone")).toBe(`/app/groups/${G}/todos/t1/edit?who=everyone`);
  });

  it("prefills a new todo with links and a due day", () => {
    expect(appUrls.newTodo(G)).toBe(`/app/groups/${G}/todos/new`);
    expect(appUrls.newTodo(G, { providerId: "p1", eventId: "e1", dueOn: "2026-11-20" }, "?who=mine")).toBe(
      `/app/groups/${G}/todos/new?who=mine&providerId=p1&eventId=e1&dueOn=2026-11-20`,
    );
    expect(appUrls.newTodo(G, { medicationId: "m1" })).toBe(`/app/groups/${G}/todos/new?medicationId=m1`);
  });

  it("prefills a new todo's title, assignee and time (quick entry's Edit)", () => {
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
