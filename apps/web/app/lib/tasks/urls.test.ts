import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls: tasks", () => {
  it("builds the list, a task, and its sheets, carrying the chip", () => {
    expect(appUrls.tasks(G)).toBe(`/app/groups/${G}/tasks`);
    expect(appUrls.tasks(G, "?who=mine")).toBe(`/app/groups/${G}/tasks?who=mine`);
    expect(appUrls.task(G, "t1")).toBe(`/app/groups/${G}/tasks/t1`);
    expect(appUrls.editTask(G, "t1", "?who=everyone")).toBe(`/app/groups/${G}/tasks/t1/edit?who=everyone`);
  });

  it("prefills a new task with links and a due day", () => {
    expect(appUrls.newTask(G)).toBe(`/app/groups/${G}/tasks/new`);
    expect(appUrls.newTask(G, { providerId: "p1", eventId: "e1", dueOn: "2026-11-20" }, "?who=mine")).toBe(
      `/app/groups/${G}/tasks/new?who=mine&providerId=p1&eventId=e1&dueOn=2026-11-20`,
    );
    expect(appUrls.newTask(G, { medicationId: "m1" })).toBe(`/app/groups/${G}/tasks/new?medicationId=m1`);
  });

  it("prefills a new task's title, assignee and time (quick entry's Edit)", () => {
    expect(
      appUrls.newTask(G, {
        title: "Call pharmacy & fax",
        assigneeId: "u1",
        dueOn: "2026-11-20",
        dueTime: "17:00",
      }),
    ).toBe(
      `/app/groups/${G}/tasks/new?dueOn=2026-11-20&title=Call+pharmacy+%26+fax&assigneeId=u1&dueTime=17%3A00`,
    );
  });
});
