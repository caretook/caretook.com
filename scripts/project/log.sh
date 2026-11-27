#!/usr/bin/env bash
# pnpm log [git log args…]: `git log` without the chore(backlog) commits
# (every `risa backlog` write is one), every other argument passed through.
# A user --grep would be inverted along with ours (git ORs the patterns, then
# --invert-grep flips them), so with one the filter is dropped and says so.
set -euo pipefail

case "${1:-}" in
  -h | --help)
    echo "pnpm log [git log args…]  git log without chore(backlog) commits (--invert-grep --grep='^chore(backlog)')."
    echo "With your own --grep the filter is dropped (git would invert yours too); use 'git log --grep' directly."
    exit 0
    ;;
esac

for a in "$@"; do
  case "$a" in
    --) break ;;
    --grep | --grep=*)
      echo "pnpm log: --grep given, so backlog commits are not filtered" >&2
      exec git log "$@"
      ;;
  esac
done

exec git log --invert-grep --grep='^chore(backlog)' "$@"
