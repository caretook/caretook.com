// Caretook's part of the landing reports (the config's `landing` hook): how to
// try a landed branch, and what the main checkout needs after a landing. The
// core's ready.sh and land.sh print what this gives them.
//   node landing.mjs try [MAIN]  the bullets to try it, one per line (no "- "):
//                                with MAIN (the landing's to-test file), how
//                                to run it there too
//   node landing.mjs notes       the changed files on stdin; what the main
//                                checkout needs after the landing, one per line
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SIGN_IN =
  "Sign in as `member@example.com` (owner, two groups), `caretaker@example.com` or `viewer@example.com`; the password is `SEED_USER_PASSWORD` in `packages/data/.env`.";

/** The bullets to try a landing, for MAIN's to-test file or (no MAIN) the ready report. */
export function tryLines(main = "") {
  const run = `Run \`pnpm dev\` in ${main} (after \`pnpm install\`, or \`pnpm datastore:reset\` if the notes below say so) and open http://localhost:5173.`;
  return main ? [run, SIGN_IN] : [SIGN_IN];
}

/** What the main checkout needs after a landing that changed these files. */
export function notes(/** @type {string[]} */ changed) {
  const any = (/** @type {RegExp} */ re) => changed.some((f) => re.test(f));
  const out = [];
  if (any(/^packages\/data\/src\/db\/(migrations|seeds)\//))
    out.push("migrations or seeds changed: run `pnpm datastore:reset` in the main checkout after landing");
  if (any(/^powersync\//))
    out.push(
      "the sync config changed: run `docker compose restart powersync` in the main checkout after landing",
    );
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, main] = process.argv.slice(2);
  if (cmd === "try") console.log(tryLines(main).join("\n"));
  else if (cmd === "notes") {
    const lines = notes(readFileSync(0, "utf8").split("\n").filter(Boolean));
    if (lines.length) console.log(lines.join("\n"));
  } else {
    console.error("usage: landing.mjs try [MAIN] | notes < changed-files");
    process.exit(2);
  }
}
