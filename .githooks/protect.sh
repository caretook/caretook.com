#!/usr/bin/env bash
# Shared by the branch hooks in .githooks/ (turned on by `pnpm hooks:install`,
# which sets core.hooksPath). Source it; don't run it. (commit-msg, beside it,
# checks Conventional Commits on every branch.)
#
#   main, staging  change only by PR merge on GitHub (dev → staging → main).
#                  Locally, the only update allowed is a fast-forward to what
#                  origin already has (git pull).
#   dev            isn't restricted: it takes landings (prd/ and plan/ merges),
#                  backlog commits (risa backlog) and small direct changes.
#
# Override main and staging with CARETOOK_ALLOW_PROTECTED=1.

PROTECTED_RE='^(main|staging)$'

overridden() {
  if [[ ${CARETOOK_ALLOW_PROTECTED:-} == 1 ]]; then
    echo "caretook hooks: CARETOOK_ALLOW_PROTECTED=1, allowing: $1" >&2
    return 0
  fi
  return 1
}

refuse() {
  echo "caretook hooks: refused: $1" >&2
  echo "  main and staging change only by PR merge on GitHub (dev → staging → main)." >&2
  echo "  Work on dev or a prd/, slice/ or plan/ branch. Override (the dev keeper only): CARETOOK_ALLOW_PROTECTED=1" >&2
  exit 1
}

current_branch() { git symbolic-ref --quiet --short HEAD 2>/dev/null || true; }
