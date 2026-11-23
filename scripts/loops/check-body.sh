#!/usr/bin/env bash
# check-body.sh MODE BASE TOOLING [OWN_TEST_FILE…]: what one check runs, in the
# current directory (prd.sh check puts it inside the lease and check-run.sh).
# The plan (check-plan.mjs) has decided MODE, TOOLING (0, 1, or 2 with the
# browser harness test) and the diff's
# own test files; this runs them.
#   slice: typecheck, lint, format, every unit test, and the integration and
#          component test files the diff adds or edits (the OWN files that still
#          exist), then the check-areas lint, the docs budget and the tooling tests
#   quick: the same, plus the integration tests related to the diff
#          (`vitest --changed BASE`); no component test beyond the OWN files
#   full:  what `pnpm check` runs, the build budget, then the tooling tests
# A slice or quick check writes "<test files run> <test files in all>" to
# $CARETOOK_CHECK_COUNTS (check-run.sh logs them).
#
# The static steps: one typegen, then tsc, ESLint and Prettier side by side (they
# only read), each one's output printed whole, in that order, once all are done.
# A test step that fails reruns only its failed files, once, one at a time. A
# pass there passes the step and names the files as flakes. No rerun after an
# unhandled error (no file owns it) or past CARETOOK_CHECK_RERUN_MAX failed files
# (20: that many is a real break).
# $CARETOOK_CHECK_STATE, a directory from check-run.sh, gets the current `step`
# and the `failed` and `flaky` files, one per line.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mode=$1 base=$2 tooling=$3; shift 3
unit=(--project data:unit --project web:unit --project notifications:unit --project server:unit --project scripts:unit)
state=${CARETOOK_CHECK_STATE:-}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

step() { [[ -z $state ]] || printf '%s\n' "$1" > "$state/step"; }
record() { # record failed|flaky FILE…
  local kind=$1; shift
  [[ -z $state ]] || (($# == 0)) || printf '%s\n' "$@" >> "$state/$kind"
}

static() {
  step typecheck
  pnpm typegen
  step static
  local names=(typecheck lint format) pids=() i code=0 failed=""
  pnpm --filter './apps/*' --filter './packages/*' exec tsc > "$work/typecheck.log" 2>&1 & pids+=($!)
  pnpm exec eslint . > "$work/lint.log" 2>&1 & pids+=($!)
  pnpm exec prettier --check . > "$work/format.log" 2>&1 & pids+=($!)
  for i in 0 1 2; do
    code=0; wait "${pids[$i]}" || code=$?
    if ((code)) && [[ -z $failed ]]; then failed=${names[$i]}; first=$code; fi
  done
  for i in 0 1 2; do echo "--- ${names[$i]}"; cat "$work/${names[$i]}.log"; done
  if [[ -n $failed ]]; then step "$failed"; echo "$failed failed"; exit "$first"; fi
}

# tests STEP: vitest with $selection (what picks the files), $projects and
# $targets; on a failure, the rerun of the failed files alone. STEP "tests" is a
# mixed run: its failed files name the step.
tests() {
  local name=$1 json="$work/first.json" again="$work/again.json" out="$work/out.log" code=0 f
  step "$name"
  pnpm exec vitest run ${selection[@]+"${selection[@]}"} "${projects[@]}" ${targets[@]+"${targets[@]}"} \
    --reporter=default --reporter=json --outputFile.json="$json" 2>&1 | tee "$out" || code=$?
  ((code)) || return 0
  local failed=() still=() flaky=()
  while IFS= read -r f; do [[ -z $f ]] || failed+=("$f"); done < <(node "$here/check-failed.mjs" "$json")
  if [[ $name == tests ]]; then name=$(node "$here/check-failed.mjs" --step ${failed[@]+"${failed[@]}"}); step "$name"; fi
  if ((${#failed[@]} == 0)); then echo "$name failed with no test file to rerun"; exit "$code"; fi
  if grep -qE 'Unhandled (Error|Rejection)|unhandled error' "$out"; then
    echo "$name: an unhandled error, so no rerun"; record failed "${failed[@]}"; exit "$code"
  fi
  if ((${#failed[@]} > ${CARETOOK_CHECK_RERUN_MAX:-20})); then
    echo "$name: ${#failed[@]} files failed, so no rerun"; record failed "${failed[@]}"; exit "$code"
  fi
  echo "$name: rerunning the ${#failed[@]} failed file(s) alone: ${failed[*]}"
  local recode=0
  pnpm exec vitest run --no-file-parallelism "${projects[@]}" "${failed[@]}" \
    --reporter=default --reporter=json --outputFile.json="$again" 2>&1 | tee "$out" || recode=$?
  if ((recode == 0)); then
    echo "$name: passed alone, logged as flaky: ${failed[*]}"; record flaky "${failed[@]}"; return 0
  fi
  while IFS= read -r f; do [[ -z $f ]] || still+=("$f"); done < <(node "$here/check-failed.mjs" "$again")
  # A rerun that failed and names no file proves nothing: every file still counts.
  ((${#still[@]})) || still=("${failed[@]}")
  for f in "${failed[@]}"; do
    [[ " ${still[*]} " == *" $f "* ]] || flaky+=("$f")
  done
  record failed "${still[@]}"
  record flaky ${flaky[@]+"${flaky[@]}"}
  echo "$name: failed again: ${still[*]}"
  exit "$recode"
}

selection=() targets=()
static
if [[ $mode == full ]]; then
  projects=(--project '!tooling:unit' --project '!tooling:browser')
  tests tests
  step docs; pnpm docs:budget
  step build; pnpm build:budget
else
  own_int=() own_browser=()
  for f in "$@"; do
    [[ -f $f ]] || continue  # deleted in the diff
    if [[ $f == *.browser.test.tsx ]]; then own_browser+=("$f"); else own_int+=("$f"); fi
  done
  files() { pnpm exec vitest list --filesOnly "$@" | awk '/\.test\.[a-z]+$/ {print $NF}' | sort -u; }
  all=$(files --project '!tooling:unit' --project '!tooling:browser' | grep -c . || true)
  run=$( { files "${unit[@]}"
           if [[ $mode == quick ]]; then files --project integration --changed "$base"; fi
           printf '%s\n' ${own_int[@]+"${own_int[@]}"} ${own_browser[@]+"${own_browser[@]}"}; } | sort -u | grep -c . || true)
  [[ -z ${CARETOOK_CHECK_COUNTS:-} ]] || echo "$run $all" > "$CARETOOK_CHECK_COUNTS"
  what="every unit test, and the integration and component tests the diff adds or edits"
  [[ $mode == slice ]] || what+=", plus the integration tests related to the diff"
  echo "$mode check: $run of $all test files ($what)"
  projects=("${unit[@]}")
  tests unit
  projects=(--project integration)
  if [[ $mode == quick ]]; then
    selection=(--changed "$base" --passWithNoTests)
    tests integration
    selection=()
  elif ((${#own_int[@]})); then
    targets=("${own_int[@]}")
    tests integration
    targets=()
  fi
  if ((${#own_browser[@]})); then
    projects=(--project web:components) targets=("${own_browser[@]}")
    tests components
    targets=()
  fi
  step lint; node scripts/loops/check-areas.mjs lint
  step docs; pnpm docs:budget
fi
if [[ $tooling != 0 ]]; then
  # The static steps linted and formatted every file, so this skips the lint of
  # the changed tooling files that `pnpm test:tooling` runs first.
  projects=(--project tooling:unit --project scripts:unit)
  [[ $tooling != 2 ]] || projects+=(--project tooling:browser)
  tests tooling
fi
exit 0
