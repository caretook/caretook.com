#!/usr/bin/env bash
# Caretook's dev stack for a worktree (Postgres, PowerSync and its storage, and
# the dev server's env): the config's stack hooks (hooks.stackUp, stackDown,
# stackStatus, stackReady). The core's `pnpm prd stack` calls them; so do the
# core's old stack functions (stack-lib.sh) until orchestration-split-2 slice 3.
#
#   stack.sh up DIR [--slot N] [--base B]
#                  a worktree with no stack: write its env files for slot N (the
#                  core leased it) and BASE; then the test env if it has none,
#                  start Compose, migrate and seed. A stopped stack starts again.
#                  A half-made new stack is taken down again before failing.
#   stack.sh up DIR --slot N --base B --env-only    only write the env files
#   stack.sh up --check      the main checkout has the env files a stack needs
#   stack.sh down DIR [--base B]
#                  stop the dev server, remove the Compose projects and their
#                  data and the stack's env files (.env.loop keeps BASE_BRANCH,
#                  else B); no stack: nothing
#   stack.sh down DIR --teardown-only   only the server, projects and data
#   stack.sh down DIR --base B --env-only   only write the stackless .env.loop
#   stack.sh status DIR      its facts, from its env files (no Docker)
#   stack.sh status --slot N [--probe]   slot N's facts; --probe adds in_use
#   stack.sh ready DIR       its facts, containers=<running>/<all> and
#                            ready=yes|no; exit 0 only when ready
#
# Out: facts as key=value lines on stdout (slot, project, web_port, pg_port,
# pg_test_port, powersync_port, cdp_offset, url, pg_container, summary: a line
# for people); progress on stderr. Non-zero on failure. The integration tests'
# env is test-db.sh's (`use`), never written here.
set -euo pipefail
here=$(dirname "$0")
# shellcheck source=stack-facts.sh
source "$here/stack-facts.sh"

cmd=${1:-}; (($#)) && shift
dir="" slot="" base="" only="" probe=""
while (($#)); do
  case $1 in
    --slot) slot=${2:?--slot N}; shift 2 ;;
    --base) base=${2:?--base B}; shift 2 ;;
    --env-only | --teardown-only | --check) only=${1#--}; shift ;;
    --probe) probe=1; shift ;;
    --*) die "stack.sh $cmd: unknown option $1" ;;
    *) dir=$1; shift ;;
  esac
done
usage() { sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 1; }
need_dir() { [[ -n $dir && -d $dir ]] || die "stack.sh $cmd: no worktree at ${dir:-(none given)}"; }
name=$(basename "${dir:-.}")
# The base a rewritten .env.loop keeps: its own, else the one given.
base_of() { local b; b=$(env_get "$dir/.env.loop" BASE_BRANCH); echo "${b:-$base}"; }

case $cmd in
  up)
    if [[ $only == check ]]; then require_main_env; exit 0; fi
    need_dir
    if [[ -z $(stack_project "$dir") ]]; then
      [[ -n $slot ]] || die "stack.sh up: $name has no stack, so it needs --slot"
      require_main_env
      base=$(base_of)
      if [[ $only != env-only ]]; then
        # Undo a half-made stack: its containers and env files.
        trap 'echo "stack up failed: taking it down again" >&2; stack_teardown "$dir" >&2 || true
          rm -f "$dir/.env" "$dir/packages/data/.env" "$dir/apps/web/.env"
          write_stackless_env "$dir" "$base"' ERR
      fi
      write_stack_env "$dir" "$slot" "$base"
    fi
    if [[ $only != env-only ]]; then
      [[ -f $dir/packages/data/.env.test.local ]] || bash "$here/test-db.sh" use "$name" >&2
      (cd "$dir" && use_node && pnpm datastore:start) >&2
      trap - ERR
    fi
    stack_facts "$dir"
    ;;
  down)
    need_dir
    if [[ $only == env-only ]]; then write_stackless_env "$dir" "$(base_of)"; exit 0; fi
    proj=$(stack_project "$dir")
    [[ -n $proj ]] || exit 0
    facts=$(stack_facts "$dir")
    stack_teardown "$dir" >&2
    [[ $only == teardown-only ]] || {
      b=$(base_of)
      rm -f "$dir/.env" "$dir/packages/data/.env" "$dir/apps/web/.env" "$dir/.serve-mode" "$dir/.serve-built"
      write_stackless_env "$dir" "$b"
    }
    echo "$facts"
    ;;
  status)
    if [[ -n $slot ]]; then
      slot_facts "$slot"
      [[ -z $probe ]] || { if slot_in_use "$slot"; then echo "in_use=yes"; else echo "in_use=no"; fi; }
      exit 0
    fi
    need_dir
    stack_facts "$dir"
    ;;
  ready)
    need_dir
    stack_facts "$dir"
    proj=$(stack_project "$dir")
    all=0 running=0
    if [[ $proj == caretook-loop* ]]; then
      all=$(docker ps -aq --filter "label=com.docker.compose.project=$proj" 2>/dev/null | grep -c . || true)
      running=$(docker ps -q --filter "label=com.docker.compose.project=$proj" --filter status=running 2>/dev/null | grep -c . || true)
    fi
    echo "containers=$running/$all"
    if ((all > 0 && running == all)); then echo "ready=yes"; else echo "ready=no"; exit 1; fi
    ;;
  *) usage ;;
esac
