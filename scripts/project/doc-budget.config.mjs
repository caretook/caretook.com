// Byte budgets for the docs, in one place. The first matching entry wins; a
// pattern is an exact path, or `dir/*.md` for every .md directly in that
// folder (so a new doc in a budgeted folder takes the folder's budget).
// Read by doc-budget.mjs; see its header for the modes. An entry may set
// `landExempt: true` to warn but never block a landing (none does).
const KB = 1024;

export const BUDGETS = [
  { pattern: "AGENTS.md", bytes: 8 * KB },
  // A split role's two halves, adding up to the role's 15 KB: the core's generic doc and
  // Caretook's additions. The generic docs are measured here until the move (residual).
  { pattern: "scripts/loops/docs/hotfix.md", bytes: 3 * KB },
  { pattern: "docs/agents/hotfix.md", bytes: 12 * KB },
  { pattern: "scripts/loops/docs/loop.md", bytes: 1570 }, // the role was at 15358 B of 15 KB
  { pattern: "docs/agents/loop.md", bytes: 15 * KB - 1570 },
  { pattern: "scripts/loops/docs/recovery.md", bytes: 5 * KB },
  { pattern: "docs/agents/recovery.md", bytes: 10 * KB },
  { pattern: "scripts/loops/docs/orchestrator.md", bytes: 3391 }, // the role was at 15350 B of 15 KB
  { pattern: "docs/agents/orchestrator.md", bytes: 15 * KB - 3391 },
  { pattern: "scripts/loops/docs/planner.md", bytes: 5 * KB },
  { pattern: "docs/agents/planner.md", bytes: 10 * KB },
  { pattern: "scripts/loops/docs/backlog.md", bytes: 3 * KB },
  { pattern: "docs/agents/backlog.md", bytes: 12 * KB },
  { pattern: "scripts/loops/docs/inbox.md", bytes: 2 * KB },
  { pattern: "docs/agents/inbox.md", bytes: 13 * KB },
  { pattern: "docs/agents/*.md", bytes: 15 * KB },
  { pattern: "docs/domain/*.md", bytes: 10 * KB },
  { pattern: "docs/layout.md", bytes: 10 * KB },
  { pattern: "docs/loops.md", bytes: 2 * KB }, // a stub pointing to docs/agents/
  { pattern: "docs/orchestration.md", bytes: 17 * KB }, // its size when set (17129 B), rounded up
];
