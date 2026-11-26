import { describe, expect, it } from "vitest";
import { careGroupInsertZSchema, careGroupNameZSchema } from "./careGroup";

describe("careGroupNameZSchema (B-872)", () => {
  // Plain zod, so the web app doesn't carry drizzle-zod: it parses as the
  // insert schema's name did.
  const picked = careGroupInsertZSchema.pick({ name: true });
  const outcome = (schema: typeof picked | typeof careGroupNameZSchema, input: unknown) => {
    const result = schema.safeParse(input);
    return result.success
      ? { data: result.data }
      : { paths: result.error.issues.map((i) => i.path.join(".")) };
  };

  it.each([
    { name: "  Dev Family " },
    { name: "" },
    { name: "   " },
    { name: "x".repeat(121) },
    {},
    { name: 3 },
  ])("parses %o as the insert schema's name did", (input) => {
    expect(outcome(careGroupNameZSchema, input)).toEqual(outcome(picked, input));
  });
});
