// Every dependency is pinned to an exact version (AGENTS.md): a manifest's
// specifiers are an exact semver version, a `workspace:` link, or a git
// dependency at a full commit hash (Risa's `github:owner/repo#<sha>`).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const GIT_COMMIT = /^(?:github:|git\+https:\/\/|git\+ssh:\/\/)[^#\s]+#[0-9a-f]{40}$/;

export const isPinned = (specifier) =>
  EXACT.test(specifier) || specifier.startsWith("workspace:") || GIT_COMMIT.test(specifier);

// The `packages:` list of pnpm-workspace.yaml (plain `- "glob"` lines).
export const workspaceGlobs = (yaml) => {
  const globs = [];
  let inPackages = false;
  for (const line of yaml.split("\n")) {
    if (/^\S/.test(line)) inPackages = /^packages:\s*$/.test(line);
    else if (inPackages) {
      const m = line.match(/^\s+-\s+["']?([^"'#]+?)["']?\s*(?:#.*)?$/);
      if (m) globs.push(m[1]);
    }
  }
  return globs;
};

// The manifests of the root and every workspace package, relative to root.
export const manifestPaths = (root) => {
  const paths = ["package.json"];
  for (const glob of workspaceGlobs(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"))) {
    const dirs = glob.endsWith("/*")
      ? readdirSync(join(root, glob.slice(0, -2)), { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => `${glob.slice(0, -2)}/${d.name}`)
      : [glob];
    for (const dir of dirs) if (existsSync(join(root, dir, "package.json"))) paths.push(`${dir}/package.json`);
  }
  return paths;
};

// One message per specifier that isn't pinned: "<file>: <group> <name> <specifier>".
export const unpinned = (file, manifest) =>
  DEPENDENCY_GROUPS.flatMap((group) =>
    Object.entries(manifest[group] ?? {})
      .filter(([, specifier]) => !isPinned(specifier))
      .map(([name, specifier]) => `${file}: ${group} ${name} ${specifier}`),
  );
