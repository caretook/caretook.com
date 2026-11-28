import { describe, expect, it } from "vitest";
import { setTodoView, SUBTASKS_PARAM, todoViewOf, todoViewSection } from "./todoView";

describe("the todo lists' view option", () => {
  it("reads trees by default, own only for ?subtasks=own", () => {
    expect(SUBTASKS_PARAM).toBe("subtasks");
    expect(todoViewOf("")).toBe("tree");
    expect(todoViewOf("?who=mine")).toBe("tree");
    expect(todoViewOf("?subtasks=own")).toBe("own");
    expect(todoViewOf("?subtasks=flat")).toBe("tree");
    expect(todoViewOf("?subtasks=tree")).toBe("tree");
  });

  it("sets the view both ways, keeping the rest", () => {
    expect(setTodoView("", "own")).toBe("?subtasks=own");
    expect(setTodoView("?who=mine&tag=t1", "own")).toBe("?who=mine&tag=t1&subtasks=own");
    expect(setTodoView("?who=mine&subtasks=own", "tree")).toBe("?who=mine");
    expect(setTodoView("?subtasks=own", "tree")).toBe("");
  });

  it("builds the Subtasks section: In their tree by default, On their own with a chip", () => {
    const tree = todoViewSection("?who=mine");
    expect(tree).toMatchObject({ id: "subtasks", title: "Subtasks", current: "tree", defaultId: "tree" });
    expect(tree.chipLabel).toBeUndefined();
    expect(tree.options.map((o) => [o.id, o.label, o.search])).toEqual([
      ["tree", "In their tree", "?who=mine"],
      ["own", "On their own", "?who=mine&subtasks=own"],
    ]);

    const own = todoViewSection("?subtasks=own&who=mine");
    expect(own.current).toBe("own");
    expect(own.chipLabel).toBe("Subtasks on their own");
    expect(own.options.map((o) => o.search)).toEqual(["?who=mine", "?subtasks=own&who=mine"]);
  });
});
