import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ENTRY_TODO_NAMESPACE, entryTodoId, entryTodoLinkZSchema } from "..";

describe("entryTodoId", () => {
  const entry = randomUUID();
  const todo = randomUUID();

  it("is stable: a fixed pair always gives the same id (the migration's backfill makes it too)", () => {
    expect(ENTRY_TODO_NAMESPACE).toBe("2fa00756-8b6f-4ca0-b198-c34baab5a7ce");
    expect(entryTodoId("4b0c3f5e-1d2a-4e6b-9c8d-7f0a1b2c3d4e", "9e8d7c6b-5a49-4382-a716-05f4e3d2c1b0")).toBe(
      "996b0a2a-8122-56b4-9a6f-a4e3339e2748",
    );
  });

  it("is the same for the same pair, on any device, in any case", () => {
    expect(entryTodoId(entry, todo)).toBe(entryTodoId(entry, todo));
    expect(entryTodoId(entry.toUpperCase(), todo.toUpperCase())).toBe(entryTodoId(entry, todo));
  });

  it("differs by pair and by order", () => {
    expect(entryTodoId(entry, todo)).not.toBe(entryTodoId(entry, randomUUID()));
    expect(entryTodoId(entry, todo)).not.toBe(entryTodoId(randomUUID(), todo));
    expect(entryTodoId(entry, todo)).not.toBe(entryTodoId(todo, entry));
  });

  it("is a version 5 UUID", () => {
    expect(entryTodoId(entry, todo)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("is what a link's id must be", () => {
    const base = { groupId: randomUUID(), entryId: entry, todoId: todo };
    expect(entryTodoLinkZSchema.safeParse(base).success).toBe(true);
    expect(entryTodoLinkZSchema.safeParse({ ...base, id: entryTodoId(entry, todo) }).success).toBe(true);
    const wrong = entryTodoLinkZSchema.safeParse({ ...base, id: randomUUID() });
    expect(wrong.success ? [] : wrong.error.issues.map((i) => i.path.join("."))).toEqual(["id"]);
  });
});
