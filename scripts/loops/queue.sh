#!/usr/bin/env bash
# queue.sh <topic> [--every SECONDS] [--manual] [-- <extra claude args>]
#
# Wait for a free PRD slot (at most CARETOOK_MAX_PRDS PRD worktrees), then
# create the PRD's worktree and stack (new.sh prd) and open its orchestrator in
# this terminal with --remote-control. Run it in a terminal of its own and leave
# it: queued topics take slots in the order they were queued (a ticket in
# .loops/.queue/), and one lock around "count, then create" means two queues
# never take the same slot.
#
# The orchestrator runs fully autonomous (prompt.sh orchestrator <topic> --auto):
# every wave, landing and clean-up without asking. --manual gives the usual
# prompt (it asks which slices to run and waits for your word to land).
# A topic whose worktree already exists opens at once. The session starts
# through session.sh, so it is recorded (.loops/.sessions/prd-<topic>.json).
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
bin=$(dirname "$0")

topic=${1:?topic}; shift
[[ $topic =~ ^[a-z0-9-]+$ ]] || die "topic: lowercase, digits, dashes"
every=60 mode=--auto
claude_args=()
while (($#)); do
  case $1 in
    --every) every=${2:?--every SECONDS}; shift 2 ;;
    --manual) mode=""; shift ;;
    --) shift; claude_args=("$@"); break ;;
    *) die "unknown option $1" ;;
  esac
done
[[ -f $main/plans/$topic-plan.md ]] || die "no plans/$topic-plan.md on dev: write the plan first"

queue=$loops/.queue lock=$loops/.prd-start.lock
mkdir -p "$queue"
ticket=$queue/$(date +%s)-$$-$topic
for t in "$queue"/*-"$topic"; do
  [[ -e $t && $t != "$ticket" ]] && kill -0 "$(cat "$t")" 2>/dev/null && die "$topic is already queued (pid $(cat "$t"))"
done
echo $$ >"$ticket"
cleanup() { rm -f "$ticket"; rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM

# first_in_line → true when no live ticket is older than ours (stale ones are dropped).
first_in_line() {
  local t
  for t in "$queue"/*; do
    [[ -e $t ]] || continue
    [[ $t == "$ticket" ]] && return 0
    if kill -0 "$(cat "$t" 2>/dev/null)" 2>/dev/null; then return 1; fi
    rm -f "$t"
  done
  return 0
}

start_worktree() {
  [[ -d $loops/$topic ]] && return 0
  ((max_prds > $(prd_count))) || return 1
  "$bin/new.sh" prd "$topic" >&2
}

waited=0
until [[ -d $loops/$topic ]]; do
  if first_in_line && mkdir "$lock" 2>/dev/null; then
    started=0
    start_worktree && started=1
    rmdir "$lock"
    ((started)) && break
  fi
  if ((waited % 600 == 0)); then
    echo "$(date '+%H:%M') $topic waiting: $(prd_count) of $max_prds PRD worktrees in use, $(ls "$queue" | wc -l | tr -d ' ') queued" >&2
  fi
  sleep "$every"; waited=$((waited + every))
done

rm -f "$ticket"
command -v osascript >/dev/null && osascript -e "display notification \"Orchestrator for $topic is starting\" with title \"Caretook PRD queue\"" 2>/dev/null || true
cd "$loops/$topic"
prompt=$("$bin/prompt.sh" orchestrator "$topic" $mode)
exec "$bin/session.sh" "prd-$topic" --kind prd --topic "$topic" ${mode:+--auto} -- \
  --remote-control "prd-$topic" ${claude_args[@]+"${claude_args[@]}"} "$prompt"
