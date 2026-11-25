// Caretook's part of the landing reports (landing.mjs, the config's landing hook).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { notes, tryLines } from "./landing.mjs";

const SCRIPT = new URL("./landing.mjs", import.meta.url).pathname;

describe("the landing hook", () => {
  it("is the config's landing hook", () => {
    const risa = JSON.parse(readFileSync(new URL("../../risa.json", import.meta.url), "utf8"));
    expect(risa.hooks.landing).toBe("node scripts/project/landing.mjs");
  });

  it("says how to try it: the sign-in, and with a main checkout how to run it there", () => {
    expect(tryLines()).toEqual([expect.stringContaining("`member@example.com` (owner, two groups)")]);
    const [run, signIn] = tryLines("/m");
    expect(run).toContain("Run `pnpm dev` in /m");
    expect(run).toContain("http://localhost:5173");
    expect(signIn).toBe(tryLines()[0]);
  });

  it("names what the main checkout needs after a migration, seed or sync config change", () => {
    expect(notes(["apps/web/a.ts", "package.json"])).toEqual([]);
    expect(notes(["packages/data/src/db/migrations/0001.sql"])).toEqual([
      expect.stringContaining("migrations or seeds changed: run `pnpm datastore:reset`"),
    ]);
    expect(notes(["packages/data/src/db/seeds/a.ts", "powersync/sync-config.yaml"])).toEqual([
      expect.stringContaining("migrations or seeds"),
      expect.stringContaining("`docker compose restart powersync`"),
    ]);
  });

  it("reads the changed files on stdin and prints a line per note", () => {
    const run = (...args) =>
      execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", input: "powersync/x\n" });
    expect(run("notes")).toBe(`${notes(["powersync/x"])[0]}\n`);
    expect(run("try", "/m")).toBe(`${tryLines("/m").join("\n")}\n`);
  });
});
