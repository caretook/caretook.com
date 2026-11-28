#!/usr/bin/env bash
# Caretook's plain browser-check runner: runs the named checks (Playwright Test
# specs, scripts/browser-checks/<check>.spec.mjs) one after another and says how
# each went. It holds no lease and has no load wait, cap, retry or hang watchdog:
# `risa browser` (the tool's gate) wraps those around it through risa.json's
# hooks.browser, and CI's browser job (scripts/ci/browser-job.mjs) calls it bare.
#
#   browser-run.sh list
#       the checks this tree has, one "<check><TAB><spec, from the top>" a line
#   browser-run.sh run [--output DIR] [--results FILE] [--timeout S] <check>… [-- ARG…]
#       each check through Playwright Test's CLI with playwright.config.mjs (one
#       worker, the checks' reporter: PASS, FAIL and SKIP lines and "N/M passed"),
#       its output on stdout, ARGs after it (file filters). A check is its name,
#       its spec's name or a path to its spec.
#       --output   its test artifacts (traces) go to DIR/pw-<check>
#       --results  appends "<check><TAB><result><TAB>0" for each: pass, FAIL,
#                  TIMEOUT (--timeout reached) or MISSING (no such spec)
#       --timeout  ends each check after S seconds (Playwright's global timeout)
#       Exit 0 when every check passed, else 1.
#
# The checks read the caller's env: BASE, SEED_USER_PASSWORD, PG_CONTAINER and
# SMOKE (1: only @smoke tests), as fixtures.mjs says.
set -euo pipefail
# Caretook's own: it sources no core file.

top=$(cd "$(dirname "$0")/../.." && pwd)
rel=scripts/browser-checks
checks_dir=$top/$rel

die() { echo "browser-run.sh: $*" >&2; exit 1; }

# name_of X → the check's name: sign-in for sign-in, sign-in.spec.mjs or a path to it.
name_of() {
  local b=${1##*/}
  b=${b%.mjs}
  echo "${b%.spec}"
}

if [[ ${1:-} == list ]]; then
  for f in "$checks_dir"/*.spec.mjs; do
    [[ -f $f ]] && printf '%s\t%s\n' "$(name_of "$f")" "$rel/${f##*/}"
  done
  exit 0
fi
[[ ${1:-} == run ]] || die "list, or run [--output DIR] [--results FILE] [--timeout S] <check>… [-- ARG…]"
shift

output="" results="" timeout="" checks=() args=()
while (($#)); do
  case $1 in
    --output) output=${2:?--output needs a folder}; shift 2 ;;
    --results) results=${2:?--results needs a file}; shift 2 ;;
    --timeout) timeout=${2:?--timeout needs seconds}; shift 2 ;;
    --) shift; args=("$@"); break ;;
    -*) die "unknown option $1" ;;
    *) checks+=("$1"); shift ;;
  esac
done
[[ -z $timeout || $timeout =~ ^[0-9]+$ ]] || die "--timeout takes whole seconds"
((${#checks[@]})) || die "run needs a check"

cli=$top/node_modules/@playwright/test/cli.js

# run_one NAME → runs the check; sets result.
run_one() {
  local name=$1 rc=0 start envs=(FORCE_COLOR=0)
  if [[ ! -f $checks_dir/$name.spec.mjs ]]; then
    echo "browser-run.sh: no check $name ($rel/$name.spec.mjs)" >&2
    result=MISSING
    return
  fi
  if [[ ! -f $cli ]]; then
    echo "FAIL no @playwright/test in this tree (pnpm install)"
    result=FAIL
    return
  fi
  [[ -n $output ]] && envs+=("CARETOOK_PW_OUTPUT=$output/pw-$name")
  start=$(date +%s)
  (cd "$checks_dir" && exec env "${envs[@]}" node "$cli" test --config playwright.config.mjs --workers=1 \
    ${timeout:+"--global-timeout=$((timeout * 1000))"} "$name.spec.mjs" ${args[@]+"${args[@]}"}) || rc=$?
  if ((rc == 0)); then result=pass
  elif [[ -n $timeout ]] && (($(date +%s) - start >= timeout)); then result=TIMEOUT
  else result=FAIL
  fi
}

failed=0
for c in "${checks[@]}"; do
  name=$(name_of "$c")
  run_one "$name"
  [[ -z $results ]] || printf '%s\t%s\t0\n' "$name" "$result" >> "$results"
  [[ $result == pass ]] || failed=1
done
exit "$failed"
