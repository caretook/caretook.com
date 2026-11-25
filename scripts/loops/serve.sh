#!/usr/bin/env bash
# The old place of the dev server script, which is Caretook's now
# (scripts/project/serve.sh). The core's callers (prd.sh, browser.sh, down.sh,
# recover.sh) still run this one; orchestration-split-2 slice 3 removes it.
exec bash "$(dirname "$0")/../project/serve.sh" "$@"
