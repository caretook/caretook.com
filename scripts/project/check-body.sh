#!/usr/bin/env bash
# check-body.sh MODE BASE [OWN_TEST_FILE…]: Caretook's check, in the current
# directory (the repo's root). The tool runs it through risa.json's `check` hook,
# inside its lease, load gate, log and limits (Risa's check-run.sh), and
# runs its own tooling tests after it; without the tool it runs alone. The
# tool's check plan has decided MODE and the diff's own test files; this runs them.
#   slice: typecheck, lint, format, every unit test, and the integration and
#          component test files the diff adds or edits (the OWN files that still
#          exist), then the check-areas lint and the docs budget
#   quick: the same, plus the integration tests related to the diff
#          (`vitest --changed BASE`); no component test beyond the OWN files
#   full:  what `pnpm check` runs, then the build budget
# A slice or quick check writes "<test files run> <test files in all>" to
# $RISA_CHECK_COUNTS when it is set (the tool logs them).
#
# The static steps: one typegen, then tsc, ESLint and Prettier side by side (they
# only read), each one's output printed whole, in that order, once all are done.
# A test step that fails reruns only its failed files, once, one at a time. A
# pass there passes the step and names the files as flakes. No rerun after an
# unhandled error (no file owns it) or past CARETOOK_CHECK_RERUN_MAX failed files
# (20: that many is a real break).
# $RISA_CHECK_STATE, a directory, when set, gets the current `step` and the
# `failed` and `flaky` files, one per line; `times`, each step's seconds once it
# ends (`<seconds> <step>` lines: typegen, static, unit, integration, components,
# lint, docs, build, `count` for a slice or quick check's file listing, or `tests`
# for a full check's one run); and `slowest`, each
# test step's ten slowest files from its first run's Vitest report (`<seconds>
# <file>` lines; the time gate names them). The exit code is the check's: 0 passed.
set -euo pipefail
here=$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mode=$1 base=$2; shift 2
unit=(--project data:unit --project web:unit --project notifications:unit --project server:unit --project project:unit)
state=${RISA_CHECK_STATE:-}
work=$(mktemp -d)
# The step being timed and its start; the last one's seconds are written at exit.
timed="" timed_at=0
lap() {
  [[ -z $state || -z $timed ]] || printf '%s %s\n' "$(($(date +%s) - timed_at))" "$timed" >> "$state/times"
  timed=""
}
trap 'lap; rm -rf "$work"' EXIT

case $mode in
  slice) echo "Slice check against ${base:0:7}: typecheck, lint, format, every unit test, and the integration and component tests this diff adds or edits" ;;
  quick) echo "Quick check against ${base:0:7}: typecheck, lint, format, every unit test, the integration tests related to the diff, and the component tests it adds or edits" ;;
esac

step() { [[ -z $state ]] || printf '%s\n' "$1" > "$state/step"; }
# clock NAME: time what runs next as NAME. begin STEP [NAME]: STEP starts (and
# names a failure), timed as NAME (default STEP). A failure's renaming of the step
# is a plain `step`.
clock() { lap; timed=$1; timed_at=$(date +%s); }
begin() { step "$1"; clock "${2:-$1}"; }
record() { # record failed|flaky FILE…
  local kind=$1; shift
  [[ -z $state ]] || (($# == 0)) || printf '%s\n' "$@" >> "$state/$kind"
}

static() {
  begin typecheck typegen
  pnpm typegen
  begin static
  local names=(typecheck lint format) pids=() i code=0 failed=""
  pnpm --filter './apps/*' --filter './packages/*' exec tsc > "$work/typecheck.log" 2>&1 & pids+=($!)
  # Type-aware ESLint sits at Node's default heap limit (about 4 GB), as in ci.yml.
  NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=6144" \
    pnpm exec eslint . > "$work/lint.log" 2>&1 & pids+=($!)
  # --cache: Prettier's cache in this worktree's node_modules/.cache (about 26 s cold, 2.5 s warm).
  pnpm exec prettier --check --cache . > "$work/format.log" 2>&1 & pids+=($!)
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
  begin "$name"
  pnpm exec vitest run ${selection[@]+"${selection[@]}"} "${projects[@]}" ${targets[@]+"${targets[@]}"} \
    --reporter=default --reporter=json --outputFile.json="$json" 2>&1 | tee "$out" || code=$?
  [[ -z $state ]] || node "$here/check-failed.mjs" --slowest "$json" >> "$state/slowest" || true
  ((code)) || return 0
  local failed=() still=() flaky=()
  while IFS= read -r f; do [[ -z $f ]] || failed+=("$f"); done < <(node "$here/check-failed.mjs" "$json")
  if [[ $name == tests ]]; then name=$(node "$here/check-failed.mjs" --step ${failed[@]+"${failed[@]}"}); step "$name"; fi
  if ((${#failed[@]} == 0)); then echo "$name failed with no test file to rerun"; exit "$code"; fi
  if node "$here/check-failed.mjs" --unhandled "$out"; then
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
  projects=(--project '!tooling:browser' --project '!project:tooling')
  tests tests
  begin docs; pnpm docs:budget
  begin build; pnpm build:budget
else
  own_int=() own_browser=()
  for f in "$@"; do
    [[ -f $f ]] || continue  # deleted in the diff
    if [[ $f == *.browser.test.tsx ]]; then own_browser+=("$f"); else own_int+=("$f"); fi
  done
  clock count
  files() { pnpm exec vitest list --filesOnly "$@" | awk '/\.test\.[a-z]+$/ {print $NF}' | sort -u; }
  all=$(files --project '!tooling:browser' --project '!project:tooling' | grep -c . || true)
  run=$( { files "${unit[@]}"
           if [[ $mode == quick ]]; then files --project integration --changed "$base"; fi
           printf '%s\n' ${own_int[@]+"${own_int[@]}"} ${own_browser[@]+"${own_browser[@]}"}; } | sort -u | grep -c . || true)
  [[ -z ${RISA_CHECK_COUNTS:-} ]] || echo "$run $all" > "$RISA_CHECK_COUNTS"
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
  begin lint; node scripts/project/check-areas.mjs lint
  begin docs; pnpm docs:budget
fi
exit 0
