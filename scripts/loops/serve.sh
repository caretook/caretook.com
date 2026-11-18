#!/usr/bin/env bash
# Run a worktree's dev server in the background, so it outlives the session
# that started it and a human can open it to try the work.
#
#   serve.sh [name]             start it if it isn't running; print its link
#   serve.sh [name] --restart   stop and start (do this after merges: a long-running
#                               server can serve stale optimized deps)
#   serve.sh [name] --stop
#
# name defaults to the worktree you're in. The log is <worktree>/.dev.log.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

name="" mode=start
for a in "$@"; do
  case $a in
    --restart) mode=restart ;;
    --stop) mode=stop ;;
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

if [[ $mode != start ]]; then
  stop_server "$dir"
  for _ in $(seq 1 20); do [[ -z $(server_pids "$port") ]] && break; sleep 0.5; done
  [[ $mode == stop ]] && { echo "Stopped $name's dev server"; exit 0; }
fi

if [[ -z $(server_pids "$port") ]]; then
  cd "$dir"
  use_node
  nohup pnpm dev > .dev.log 2>&1 < /dev/null &
  disown
  for _ in $(seq 1 120); do
    curl -fsS -o /dev/null "http://127.0.0.1:$port/sign-in" 2>/dev/null && break
    sleep 0.5
  done
  [[ -n $(server_pids "$port") ]] || { tail -20 .dev.log >&2; die "the dev server didn't start (see $dir/.dev.log)"; }
fi
echo "$name is running at $url  (log: $dir/.dev.log)"
