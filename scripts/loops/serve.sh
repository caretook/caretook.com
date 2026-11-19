#!/usr/bin/env bash
# Run a worktree's dev server in the background, so it outlives the session
# that started it and a human can open it to try the work.
#
#   serve.sh [name]             start it if it isn't running; print its link
#   serve.sh [name] --restart   stop and start (do this after merges: a long-running
#                               server can serve stale optimized deps)
#   serve.sh [name] --stop
#   serve.sh [name] --built     a production build of the web target (with
#                               VITE_CHECK_BUILD=1, so checks get their hooks),
#                               served by react-router-serve on the same port
#
# name defaults to the worktree you're in. The log is <worktree>/.dev.log.
#
# Browser checks run against --built: no Vite websocket, no dependency
# re-optimization reloading a page mid-check, no stale optimized deps, faster
# pages. `pnpm prd browser` starts one by itself (replacing a dev server), and
# rebuilds and restarts it when the source is newer than the build; its --dev
# keeps the dev server instead. Use the dev server (no flag, or --dev) to work
# on the app by hand. The mode is kept in <worktree>/.serve-mode, so --restart
# keeps it; pass --dev to switch back.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

name="" mode=start kind=""
for a in "$@"; do
  case $a in
    --restart) mode=restart ;;
    --stop) mode=stop ;;
    --built) kind=built ;;
    --dev) kind=dev ;;
    --*) die "unknown option $a" ;;
    *) name=$a ;;
  esac
done
name=${name:-$(here_name)}
[[ -n $name ]] || die "which worktree? (pnpm prd serve <name>; pnpm prd status lists them)"
dir=$loops/$name
[[ -d $dir ]] || die "no worktree at $dir"
port=$(web_port "$dir")
[[ -n $port ]] || die "$name has no stack, so no dev server"
url=http://localhost:$port
modefile=$dir/.serve-mode
current=$(cat "$modefile" 2>/dev/null || echo dev)
kind=${kind:-$current}
# Switching kinds needs a restart.
[[ $mode == start && $kind != "$current" && -n $(server_pids "$port") ]] && mode=restart

if [[ $mode != start ]]; then
  stop_server "$dir"
  for _ in $(seq 1 20); do [[ -z $(server_pids "$port") ]] && break; sleep 0.5; done
  [[ $mode == stop ]] && { echo "Stopped $name's dev server"; exit 0; }
fi

if [[ -z $(server_pids "$port") ]]; then
  cd "$dir"
  use_node
  if [[ $kind == built ]]; then
    echo "Building $name (web, check build)…"
    t0=$(date +%s)
    (cd apps/web && VITE_CHECK_BUILD=1 pnpm -s build > ../../.dev.log 2>&1) ||
      { tail -20 .dev.log >&2; die "the build failed (see $dir/.dev.log)"; }
    echo "Built in $(($(date +%s) - t0)) s."
    touch .serve-built
    # react-router-serve doesn't load .env files: give it the ones Vite loads.
    # VITE_CHECK_BUILD at run time too: with a localhost APP_URL, the server
    # sends mail to the dev mailbox (isCheckBuild in @caretook/notifications).
    # The whole subshell's output goes to the log: a subshell left holding our
    # stdout would keep `pnpm prd serve --built | tail` waiting for ever.
    (cd apps/web && VITE_CHECK_BUILD=1 HOST=127.0.0.1 PORT=$port NODE_ENV=production exec nohup node \
      --env-file-if-exists=.env --env-file-if-exists=../../packages/data/.env \
      node_modules/@react-router/serve/bin.cjs build/web/server/index.js) >> .dev.log 2>&1 < /dev/null &
    disown
  else
    nohup pnpm dev > .dev.log 2>&1 < /dev/null &
    disown
  fi
  echo "$kind" > "$modefile"
  for _ in $(seq 1 120); do
    curl -fsS -o /dev/null "http://127.0.0.1:$port/sign-in" 2>/dev/null && break
    sleep 0.5
  done
  [[ -n $(server_pids "$port") ]] || { tail -20 .dev.log >&2; die "the dev server didn't start (see $dir/.dev.log)"; }
fi
echo "$name is running at $url ($kind server; log: $dir/.dev.log)"
