import type { RouteConfigEntry } from "@react-router/dev/routes";

import { describe, expect, it } from "vitest";
import { medicationRoutes } from "./routes";

// Where the Medications page's tabs sit: Passes is the frame's third tab
// (B-424), at the URL it had as a page of its own, with the add-pass sheet
// as its child.

const paths = (routes: RouteConfigEntry[], parent = ""): string[] =>
  routes.flatMap((r) => {
    const path = r.path ? `${parent}/${r.path}` : parent;
    return [path, ...paths(r.children ?? [], path)];
  });

describe("the medications routes", () => {
  it("nest the three tabs under the frame, Passes with its add-pass sheet", () => {
    const frame = medicationRoutes.find((r) => r.path === "medications");
    expect(frame?.file).toBe("routes/app/groups/medications/route.tsx");
    const tabs = (frame?.children ?? []).map((r) => [r.path, r.file]);
    expect(tabs).toEqual([
      ["schedule", "routes/app/groups/medications/schedule/route.tsx"],
      ["list", "routes/app/groups/medications/list/route.tsx"],
      ["passes", "routes/app/groups/medications/passes/route.tsx"],
    ]);
    const passes = frame?.children?.find((r) => r.path === "passes");
    expect(passes?.children?.map((r) => [r.path, r.file])).toEqual([
      ["new", "routes/app/groups/medications/passes/new/route.tsx"],
    ]);
  });

  it("answer the passes URL only from the frame", () => {
    const all = paths(medicationRoutes);
    expect(all.filter((p) => p.startsWith("/medications/passes"))).toEqual([
      "/medications/passes",
      "/medications/passes/new",
    ]);
  });
});
