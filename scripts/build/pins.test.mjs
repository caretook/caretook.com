import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { manifestPaths, unpinned, workspaceGlobs } from "./pins.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("dependency pins", () => {
  it("finds the root, apps/web and every package", () => {
    const paths = manifestPaths(root);
    expect(paths).toContain("package.json");
    expect(paths).toContain("apps/web/package.json");
    expect(paths).toContain("packages/data/package.json");
  });

  it("every manifest pins each dependency exactly or links the workspace", () => {
    const problems = manifestPaths(root).flatMap((file) =>
      unpinned(file, JSON.parse(readFileSync(`${root}${file}`, "utf8"))),
    );
    expect(problems).toEqual([]);
  });

  it("refuses a caret, a tilde, a dist-tag and a star, naming the file and package", () => {
    const fixture = {
      dependencies: { a: "^1.2.3", b: "~1.2.3", ok: "1.2.3", pre: "2.0.0-rc.1", local: "workspace:*" },
      devDependencies: { c: "latest", d: "*" },
    };
    expect(unpinned("fixture/package.json", fixture)).toEqual([
      "fixture/package.json: dependencies a ^1.2.3",
      "fixture/package.json: dependencies b ~1.2.3",
      "fixture/package.json: devDependencies c latest",
      "fixture/package.json: devDependencies d *",
    ]);
  });

  it("takes a git dependency only at a full commit hash", () => {
    const sha = "fa38e19360e17a33dfe73719a4f1cf820449f2f9";
    const fixture = { devDependencies: { pinned: `github:o/r#${sha}`, branch: "github:o/r#main", bare: "github:o/r" } };
    expect(unpinned("f", fixture)).toEqual(["f: devDependencies branch github:o/r#main", "f: devDependencies bare github:o/r"]);
  });

  it("reads the workspace's package globs", () => {
    expect(workspaceGlobs('packages:\n  - "apps/*"\n  - packages/* # all\n\nallowBuilds:\n  - x\n')).toEqual([
      "apps/*",
      "packages/*",
    ]);
  });
});
