#!/usr/bin/env bash
# The shared test Postgres (docker-compose.shared-test.yml): one server, one
# database per worktree, for integration tests. (pnpm prd test-db …)
#
#   test-db.sh status            running or not, its port and databases
#   test-db.sh up                start it if it isn't running (never recreates it)
#   test-db.sh down              stop it (every worktree's test database goes)
#   test-db.sh name <worktree>   the database name for a worktree
#   test-db.sh create <worktree> start it if needed and create that database
#   test-db.sh drop <worktree>   drop that database (nothing when it isn't running)
#   test-db.sh list              the databases on it
#   test-db.sh use [worktree]    point a worktree's integration tests at its
#                                database here (packages/data/.env.test.local);
#                                for worktrees made before the shared server
#
# Env: CARETOOK_SHARED_TEST_PORT (5436), CARETOOK_SHARED_TEST_PROJECT
# (caretook-shared-test). The integration globalSetup starts it and creates the
# database on first use, so worktrees never need to call this themselves.
set -euo pipefail
# shellcheck source=stack-lib.sh
source "$(dirname "$0")/stack-lib.sh"

compose_file=$(cd "$(dirname "$0")/../.." && pwd)/docker-compose.shared-test.yml

# container → the running shared Postgres container's id, or nothing.
container() {
  docker ps -q --filter "label=com.docker.compose.project=$shared_test_project" \
    --filter label=com.docker.compose.service=postgres --filter status=running 2>/dev/null | head -1
}

psql_c() { docker exec "$1" psql -U caretook -d postgres -Atqc "$2"; }

up() {
  [[ -n $(container) ]] && return 0
  CARETOOK_SHARED_TEST_PORT=$shared_test_port CARETOOK_SHARED_TEST_PROJECT=$shared_test_project \
    docker compose -f "$compose_file" up -d --wait >&2
}

db_of() {
  local db
  db=$(test_db_name "${1:?worktree name}")
  [[ $db =~ ^caretook_test_[a-z0-9_]+$ ]] || die "not a test database name: $db"
  echo "$db"
}

cmd=${1:-status}; (($#)) && shift
case $cmd in
  status)
    c=$(container)
    if [[ -z $c ]]; then
      echo "shared test Postgres: not running (started on first integration run, or pnpm prd test-db up)"
    else
      n=$(psql_c "$c" "SELECT count(*) FROM pg_database WHERE datname LIKE 'caretook\_test\_%'" 2>/dev/null || echo '?')
      echo "shared test Postgres: running on :$shared_test_port ($shared_test_project), $n worktree databases"
    fi
    ;;
  up) up; echo "shared test Postgres running on :$shared_test_port" ;;
  down)
    # Only this project: never other Compose projects or their networks.
    docker compose -p "$shared_test_project" down --remove-orphans
    ;;
  name) db_of "${1:-}" ;;
  create)
    db=$(db_of "${1:-}"); up
    c=$(container); [[ -n $c ]] || die "the shared test Postgres didn't start"
    if [[ -z $(psql_c "$c" "SELECT 1 FROM pg_database WHERE datname = '$db'") ]]; then
      docker exec "$c" createdb -U caretook "$db" 2>/dev/null ||
        [[ -n $(psql_c "$c" "SELECT 1 FROM pg_database WHERE datname = '$db'") ]] || die "couldn't create $db"
    fi
    echo "$db"
    ;;
  drop)
    db=$(db_of "${1:-}")
    c=$(container)
    # Not running: its tmpfs went with it, so there's nothing to drop.
    [[ -n $c ]] || exit 0
    docker exec "$c" dropdb -U caretook --if-exists --force "$db"
    echo "dropped test database $db"
    ;;
  list)
    c=$(container); [[ -n $c ]] || { echo "(not running)"; exit 0; }
    psql_c "$c" "SELECT datname FROM pg_database WHERE datname LIKE 'caretook\_test\_%' ORDER BY 1"
    ;;
  use)
    name=${1:-$(here_name)}
    [[ -n $name && -d $loops/$name ]] || die "use: give a .loops worktree name, or run it inside one"
    write_test_env "$loops/$name" "$name"
    echo "$name's integration tests now use $(db_of "$name") on the shared test Postgres (:$shared_test_port)"
    ;;
  *) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 1 ;;
esac
