#!/usr/bin/env bash
# The old place of the shared test Postgres's script, which is Caretook's now
# (scripts/project/test-db.sh, the config's test-db hook). The core's callers
# (prd.sh, down.sh, ls.sh, recover.sh, rm.sh, tidy-cli.mjs) still run this one;
# a later slice points them at the hook and removes it.
exec bash "$(dirname "$0")/../project/test-db.sh" "$@"
