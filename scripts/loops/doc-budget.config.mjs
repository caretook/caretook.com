// Byte budgets for the docs, in one place. The first matching entry wins; a
// pattern is an exact path, or `dir/*.md` for every .md directly in that
// folder (so a new doc in a budgeted folder takes the folder's budget).
// Read by doc-budget.mjs; see its header for the modes. `landExempt` entries
// warn but never block a landing: AGENTS.md and docs/loops.md until
// agent-tooling slice 4 splits them (it removes both flags).
const KB = 1024;

export const BUDGETS = [
  { pattern: "AGENTS.md", bytes: 8 * KB, landExempt: true },
  { pattern: "docs/agents/*.md", bytes: 15 * KB },
  { pattern: "docs/domain/*.md", bytes: 10 * KB },
  { pattern: "docs/layout.md", bytes: 10 * KB },
  { pattern: "docs/loops.md", bytes: 2 * KB, landExempt: true }, // the stub-to-be
  { pattern: "docs/orchestration.md", bytes: 17 * KB }, // its size when set (17129 B), rounded up
];
