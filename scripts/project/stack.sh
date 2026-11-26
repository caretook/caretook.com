#!/usr/bin/env bash
# Caretook's dev stack for a worktree (Postgres, PowerSync and its storage, and
# the dev server's env): the config's stack hooks (hooks.stackUp, stackDown,
# stackStatus, stackReady, stackStop, stackStart, stackEngine, stackLeftovers).
# The core calls them (pnpm prd stack, new, rm, gc, status, down, recover,
# reclaim, tidy) and knows nothing of Docker beyond their facts.
#
#   stack.sh up DIR [--slot N] [--base B]
#                  a worktree with no stack: write its env files for slot N (the
#                  core leased it) and BASE; then the test env if it has none,
#                  start Compose, migrate and seed. A stopped stack starts again.
#                  A half-made new stack is taken down again before failing.
#   stack.sh down DIR [--base B]
#                  stop the dev server, remove the Compose projects and their
#                  data and the stack's env files (.env.loop gets B, else
#                  keeps its BASE_BRANCH); no stack: write the stackless
#                  .env.loop, no facts
#   stack.sh status DIR      its facts, from its env files (no Docker)
#   stack.sh status --slot N [--probe]   slot N's facts; --probe adds in_use
#   stack.sh ready DIR       its facts, containers=<running>/<all> and
#                            ready=yes|no, always: exit 0 for yes, 1 for no,
#                            and a call without ready= failed. With none
#                            running, stopped_secs=<how long ago it stopped>
#                            (its newest container's end; no containers: the
#                            root .env's age)
#   stack.sh stop DIR        stop its containers, data kept (pnpm prd down);
#                            its facts; no stack: nothing
#   stack.sh start DIR       start a stopped stack, wait for its Postgres
#                            (CARETOOK_RECOVER_PG_SECS, 60) and migrate, retried
#                            once, never seeding (pnpm prd recover); its facts,
#                            and migrating=yes once it gets to the migrate
#   stack.sh engine [status|start]   running=yes|no and name=Docker; start
#                            opens Docker Desktop and waits for it
#                            (CARETOOK_DOCKER_WAIT_SECS, 180)
#   stack.sh leftovers [--all] [PROJECT…]   dangling data no stack uses, the
#                            PROJECTs (the worktrees' project facts), the main
#                            checkout's and the shared test Postgres's kept:
#                            volume=<name> <KB|?> <why> for a gone worktree stack's
#                            volumes; --all adds anonymous volumes, image=<id>
#                            <KB> <why> for dangling images, and kept=<why>
#                            lines. Docker not running: one kept= line
#   stack.sh leftovers remove volume|image ID   remove one of them
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
dir="" slot="" base="" probe="" all="" rest=()
while (($#)); do
  case $1 in
    --slot) slot=${2:?--slot N}; shift 2 ;;
    --base) base=${2:?--base B}; shift 2 ;;
    --probe) probe=1; shift ;;
    --all) all=1; shift ;;
    --*) die "stack.sh $cmd: unknown option $1" ;;
    *) if [[ -z $dir ]]; then dir=$1; else rest+=("$1"); fi; shift ;;
  esac
done
usage() { sed -n '2,47p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 1; }
need_dir() { [[ -n $dir && -d $dir ]] || die "stack.sh $cmd: no worktree at ${dir:-(none given)}"; }
name=$(basename "${dir:-.}")
# The base a rewritten .env.loop gets: the one given, else its own.
base_of() { [[ -n $base ]] && echo "$base" || env_get "$dir/.env.loop" BASE_BRANCH; }

case $cmd in
  up)
    need_dir
    if [[ -z $(stack_project "$dir") ]]; then
      [[ -n $slot ]] || die "stack.sh up: $name has no stack, so it needs --slot"
      require_main_env
      base=$(base_of)
      # Undo a half-made stack: its containers and env files.
      trap 'echo "stack up failed: taking it down again" >&2; stack_teardown "$dir" >&2 || true
        rm -f "$dir/.env" "$dir/packages/data/.env" "$dir/apps/web/.env"
        write_stackless_env "$dir" "$base"' ERR
      write_stack_env "$dir" "$slot" "$base"
    fi
    [[ -f $dir/packages/data/.env.test.local ]] || bash "$here/test-db.sh" use "$name" >/dev/null
    (cd "$dir" && use_node && pnpm datastore:start) >&2
    trap - ERR
    stack_facts "$dir"
    ;;
  down)
    need_dir
    proj=$(stack_project "$dir")
    # No stack: leave it as a stackless worktree (its .env.loop), no facts.
    if [[ -z $proj ]]; then write_stackless_env "$dir" "$(base_of)"; exit 0; fi
    facts=$(stack_facts "$dir")
    stack_teardown "$dir" >&2
    b=$(base_of)
    rm -f "$dir/.env" "$dir/packages/data/.env" "$dir/apps/web/.env" "$dir/.serve-mode" "$dir/.serve-built"
    write_stackless_env "$dir" "$b"
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
      if ((running == 0)); then
        secs=$(stopped_secs "$dir" "$proj")
        [[ -z $secs ]] || echo "stopped_secs=$secs"
      fi
    fi
    echo "containers=$running/$all"
    if ((all > 0 && running == all)); then echo "ready=yes"; else echo "ready=no"; exit 1; fi
    ;;
  stop)
    need_dir
    proj=$(stack_project "$dir")
    # Never fall back to Compose's default project: that's the main checkout's.
    [[ $proj == caretook-loop* ]] || exit 0
    facts=$(stack_facts "$dir")
    (cd "$dir" && docker compose stop) </dev/null >&2
    echo "$facts"
    ;;
  start)
    need_dir
    proj=$(stack_project "$dir")
    [[ $proj == caretook-loop* ]] || die "stack.sh start: $name has no stack"
    facts=$(stack_facts "$dir")
    # Quiet, as recover prints: only its own lines go to stderr.
    (cd "$dir" && docker compose up -d --wait) </dev/null >/dev/null 2>&1 || die "compose up failed"
    wait_for_pg "$dir" "$proj"
    # The core's migrate marker counts a failure only from here on.
    echo "migrating=yes"
    if ! migrate "$dir"; then
      echo "migrate failed; retrying once" >&2
      sleep 3
      migrate "$dir" || die "migrate failed again (see $dir/.recover-migrate.log)"
    fi
    rm -f "$dir/.recover-migrate.log"
    echo "$facts"
    ;;
  engine)
    case ${dir:-status} in
      status) if docker info >/dev/null 2>&1; then echo "running=yes"; else echo "running=no"; fi; echo "name=Docker" ;;
      start) start_engine; echo "running=yes"; echo "name=Docker" ;;
      *) die "stack.sh engine: status or start (got $dir)" ;;
    esac
    ;;
  leftovers)
    if [[ ${dir:-} == remove ]]; then
      # stack.sh leftovers remove volume|image ID (dir took "remove"; the rest are in rest).
      kind=${rest[0]:-} id=${rest[1]:-}
      [[ -n $id ]] || die "stack.sh leftovers remove: volume|image ID"
      case $kind in
        volume) docker volume rm "$id" >/dev/null ;;
        image) docker image rm "$id" >/dev/null ;;
        *) die "stack.sh leftovers remove: volume or image (got ${kind:-none})" ;;
      esac
      exit 0
    fi
    leftovers ${dir:+"$dir"} ${rest[@]+"${rest[@]}"}
    ;;
  *) usage ;;
esac
