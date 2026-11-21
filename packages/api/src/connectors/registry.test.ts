import { describe, expect, it } from "vitest";
import { describeTool } from "./registry";
import { zonedIso } from "./time";
import { CONNECTOR_TOOLS } from "./tools";

// Every registered tool, as tools/list sends it: a plain name, an object
// input schema the clients can read, and the annotations that make Claude
// and ChatGPT ask before a write.

describe("the connector tools", () => {
  const described = CONNECTOR_TOOLS.map(describeTool);

  it("have unique, plain names", () => {
    const names = described.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z_]{2,40}$/);
  });

  it("name the todo tools, and no task tool", () => {
    const names = described.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["add_todo", "list_todos"]));
    expect(names.filter((n) => /task/.test(n))).toEqual([]);
    expect(JSON.stringify(described)).not.toMatch(/task/i);
  });

  it("describe their inputs as JSON Schema objects", () => {
    for (const tool of described) {
      expect(tool.inputSchema).toMatchObject({ type: "object" });
      expect(tool.inputSchema).not.toHaveProperty("$schema");
      expect(tool.description.length).toBeGreaterThan(40);
    }
  });

  it("mark reads read-only and writes as neither read-only nor destructive", () => {
    for (const tool of CONNECTOR_TOOLS) {
      if (tool.scope === "read") expect(tool.annotations).toMatchObject({ readOnlyHint: true });
      else
        expect(tool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        });
    }
  });

  it("emit group_overview and list_timeline's inputs", () => {
    expect(described.find((t) => t.name === "group_overview")?.inputSchema).toEqual({
      type: "object",
      properties: {},
    });
    const timeline = described.find((t) => t.name === "list_timeline")?.inputSchema as {
      properties: Record<string, Record<string, unknown>>;
      required?: string[];
    };
    expect(Object.keys(timeline.properties)).toEqual(["from", "to", "kinds", "authorId", "cursor", "limit"]);
    expect(timeline.required ?? []).toEqual([]);
    expect(timeline.properties.limit).toMatchObject({ type: "integer", minimum: 1, maximum: 50 });
    expect(timeline.properties.from).toMatchObject({ type: "string", format: "date-time" });
    expect(timeline.properties.kinds).toMatchObject({ type: "array" });
    expect((timeline.properties.kinds?.items as { enum: string[] }).enum).toEqual(
      expect.arrayContaining(["note", "vital"]),
    );
    // No tool takes a group: it's always the grant's.
    for (const tool of described) expect(JSON.stringify(tool.inputSchema)).not.toMatch(/groupId/);
  });
});

describe("zonedIso", () => {
  it("writes an instant in the recipient's zone with its offset", () => {
    expect(zonedIso("2026-11-21T04:05:00.000Z", "America/Los_Angeles")).toBe("2026-11-20T20:05:00-08:00");
    expect(zonedIso("2026-07-01T12:00:00Z", "America/Los_Angeles")).toBe("2026-07-01T05:00:00-07:00");
    expect(zonedIso("2026-07-01T12:00:00Z", "Asia/Kolkata")).toBe("2026-07-01T17:30:00+05:30");
    expect(zonedIso("2026-07-01T12:00:00Z", "UTC")).toBe("2026-07-01T12:00:00+00:00");
  });
});
