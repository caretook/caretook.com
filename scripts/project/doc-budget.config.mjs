// Byte budgets for the docs, in one place. The first matching entry wins; a
// pattern is an exact path, or `dir/*.md` for every .md directly in that
// folder (so a new doc in a budgeted folder takes the folder's budget).
// Read by doc-budget.mjs; see its header for the modes. An entry may set
// `landExempt: true` to warn but never block a landing (none does).
const KB = 1024;

export const BUDGETS = [
  { pattern: "AGENTS.md", bytes: 8 * KB },
  // A split role's two halves add up to the role's 15 KB: Risa's generic doc (its budget
  // is Risa's loops/docs-budget.mjs) and Caretook's additions, which take the rest.
  { pattern: "docs/agents/hotfix.md", bytes: 12 * KB },
  { pattern: "docs/agents/loop.md", bytes: 15 * KB - 2218 },
  { pattern: "docs/agents/recovery.md", bytes: 10 * KB },
  { pattern: "docs/agents/orchestrator.md", bytes: 15 * KB - 3954 },
  { pattern: "docs/agents/planner.md", bytes: 10 * KB },
  { pattern: "docs/agents/backlog.md", bytes: 12 * KB },
  { pattern: "docs/agents/inbox.md", bytes: 13 * KB },
  { pattern: "docs/agents/machinery.md", bytes: 15 * KB - 600 },
  { pattern: "docs/agents/project-config.md", bytes: 14 * KB },
  { pattern: "docs/agents/*.md", bytes: 15 * KB },
  { pattern: "docs/domain/*.md", bytes: 10 * KB },
  { pattern: "docs/layout.md", bytes: 10 * KB },
  { pattern: "docs/loops.md", bytes: 2 * KB }, // a stub pointing to docs/agents/
  { pattern: "docs/orchestration.md", bytes: 17 * KB - 174 }, // the guide's 17 KB: its size when set (17129 B), rounded up
];
