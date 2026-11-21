#!/usr/bin/env bash
# check-body.sh MODE BASE TOOLING [ALWAYS_RUN_FILE…]: what one check runs, in the
# current directory (prd.sh check puts it inside the lease and check-run.sh).
# The plan (check-plan.mjs) has decided MODE, TOOLING (1 or 0) and the always-run
# files; this runs them.
#   quick: typecheck, lint, format, `vitest --changed BASE`, the always-run
#          tests, the check-areas lint, the docs budget, then the tooling tests
#   full:  pnpm check, the build budget, then the tooling tests
# A quick check writes "<test files run> <test files in all>" to
# $CARETOOK_CHECK_COUNTS (check-run.sh logs them) and warns above half.
set -euo pipefail
mode=$1 base=$2 tooling=$3; shift 3
default=(--project '!tooling:unit')

if [[ $mode == full ]]; then
  pnpm check && pnpm build:budget
else
  pnpm typecheck && pnpm lint && pnpm format:check
  files() { pnpm exec vitest list --filesOnly "${default[@]}" "$@" | awk '/\.test\.[a-z]+$/ {print $NF}' | sort -u; }
  all=$(files | grep -c . || true)
  run=$( { files --changed "$base"; (($#)) && printf '%s\n' "$@"; true; } | sort -u | grep -c . || true)
  [[ -z ${CARETOOK_CHECK_COUNTS:-} ]] || echo "$run $all" > "$CARETOOK_CHECK_COUNTS"
  echo "quick check: $run of $all test files (the tests related to the diff, plus the ones that read files by path)"
  if ((run * 2 > all)); then
    echo "WARNING: this quick check ran more than half of all test files ($run of $all): a shared file changed, so it is barely quicker than a full check"
  fi
  pnpm exec vitest run --changed "$base" --passWithNoTests "${default[@]}"
  if (($#)); then pnpm exec vitest run "${default[@]}" "$@"; fi
  node scripts/loops/check-areas.mjs lint
  pnpm docs:budget
fi
if [[ $tooling == 1 ]]; then pnpm test:tooling; fi
