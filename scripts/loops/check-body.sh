#!/usr/bin/env bash
# check-body.sh MODE BASE TOOLING [OWN_TEST_FILE…]: what one check runs, in the
# current directory (prd.sh check puts it inside the lease and check-run.sh).
# The plan (check-plan.mjs) has decided MODE, TOOLING (1 or 0) and the diff's
# own test files; this runs them.
#   slice: typecheck, lint, format, every unit test, and the integration and
#          component test files the diff adds or edits (the OWN files that still
#          exist), then the check-areas lint, the docs budget and the tooling tests
#   quick: the same, plus the integration tests related to the diff
#          (`vitest --changed BASE`); no component test beyond the OWN files
#   full:  pnpm check, the build budget, then the tooling tests
# (the tooling tests without their own lint step: this check lints everything)
# A slice or quick check writes "<test files run> <test files in all>" to
# $CARETOOK_CHECK_COUNTS (check-run.sh logs them).
set -euo pipefail
mode=$1 base=$2 tooling=$3; shift 3
unit=(--project data:unit --project web:unit --project notifications:unit --project server:unit --project scripts:unit)

if [[ $mode == full ]]; then
  pnpm check
  pnpm build:budget
else
  pnpm typecheck
  pnpm lint
  pnpm format:check
  own_int=() own_browser=()
  for f in "$@"; do
    [[ -f $f ]] || continue  # deleted in the diff
    if [[ $f == *.browser.test.tsx ]]; then own_browser+=("$f"); else own_int+=("$f"); fi
  done
  files() { pnpm exec vitest list --filesOnly "$@" | awk '/\.test\.[a-z]+$/ {print $NF}' | sort -u; }
  all=$(files --project '!tooling:unit' | grep -c . || true)
  run=$( { files "${unit[@]}"
           if [[ $mode == quick ]]; then files --project integration --changed "$base"; fi
           printf '%s\n' ${own_int[@]+"${own_int[@]}"} ${own_browser[@]+"${own_browser[@]}"}; } | sort -u | grep -c . || true)
  [[ -z ${CARETOOK_CHECK_COUNTS:-} ]] || echo "$run $all" > "$CARETOOK_CHECK_COUNTS"
  what="every unit test, and the integration and component tests the diff adds or edits"
  [[ $mode == slice ]] || what+=", plus the integration tests related to the diff"
  echo "$mode check: $run of $all test files ($what)"
  pnpm exec vitest run "${unit[@]}"
  if [[ $mode == quick ]]; then
    pnpm exec vitest run --changed "$base" --passWithNoTests --project integration
  elif ((${#own_int[@]})); then
    pnpm exec vitest run --project integration "${own_int[@]}"
  fi
  if ((${#own_browser[@]})); then
    pnpm exec vitest run --project web:components "${own_browser[@]}"
  fi
  node scripts/loops/check-areas.mjs lint
  pnpm docs:budget
fi
if [[ $tooling == 1 ]]; then
  # The check above linted and formatted every file, so the tooling tests skip
  # their own lint of the changed tooling files (tooling-lint.mjs).
  CARETOOK_TOOLING_LINT=off pnpm test:tooling
fi
exit 0
