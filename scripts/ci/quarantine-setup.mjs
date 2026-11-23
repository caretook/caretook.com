// A Vitest setup file for every project: skips quarantined tests, or under
// CARETOOK_QUARANTINE=run every test but those. The list arrives through
// `provide` (vitest.config.ts), so this also runs in the browser project.
import { beforeEach, inject } from "vitest";

import { skipsTest } from "./lists.mjs";

/** The name Vitest's JSON reporter gives a test: its suites and title. */
function fullName(/** @type {any} */ task) {
  const names = [task.name];
  for (let suite = task.suite; suite?.name && suite !== task.file; suite = suite.suite)
    names.unshift(suite.name);
  return names.join(" ");
}

const { entries, mode } = /** @type {any} */ (inject(/** @type {never} */ ("caretookQuarantine")));

if (entries.length || mode === "run")
  beforeEach((context) => {
    if (skipsTest(entries, context.task.file.filepath, fullName(context.task), mode)) context.skip();
  });
