// pnpm-workspace.yaml keeps the one-day wait on new packages (AGENTS.md).
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("pnpm-workspace.yaml sets minimumReleaseAge to 1440 minutes or more", () => {
  const text = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
  const match = text.match(/^minimumReleaseAge:\s*(\d+)\s*(?:#.*)?$/m);
  expect(match, "minimumReleaseAge is missing").not.toBeNull();
  expect(Number(match[1])).toBeGreaterThanOrEqual(1440);
});
