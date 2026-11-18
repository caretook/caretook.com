#!/usr/bin/env bash
# Shared by the branch hooks in .githooks/ (turned on by `pnpm hooks:install`,
# which sets core.hooksPath). Source it; don't run it. (commit-msg, beside it,
# checks Conventional Commits on every branch.)
#
#   main, staging  change only by PR merge on GitHub (dev → staging → main).
#                  Locally, the only update allowed is a fast-forward to what
#                  origin already has (git pull).
#   dev            takes merge commits (landing a prd/ or plan/ branch) and
#                  commits that touch only plans/backlog.md and plans/inbox.md
#                  (pnpm backlog).
#
# Override any of it with CARETOOK_ALLOW_PROTECTED=1.

PROTECTED_RE='^(main|staging)$'
TRUNK_BRANCH=dev
BACKLOG_FILES=(plans/backlog.md plans/inbox.md)

overridden() {
  if [[ ${CARETOOK_ALLOW_PROTECTED:-} == 1 ]]; then
    echo "caretook hooks: CARETOOK_ALLOW_PROTECTED=1, allowing: $1" >&2
    return 0
  fi
  return 1
}

refuse() {
  echo "caretook hooks: refused: $1" >&2
  echo "  main and staging change only by PR merge on GitHub; dev takes merges and backlog edits." >&2
  echo "  Work on a prd/, slice/ or plan/ branch. Override (the dev keeper only): CARETOOK_ALLOW_PROTECTED=1" >&2
  exit 1
}

current_branch() { git symbolic-ref --quiet --short HEAD 2>/dev/null || true; }
