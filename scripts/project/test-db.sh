#!/usr/bin/env bash
# The shared test Postgres (docker-compose.shared-test.yml): one server, one
# database per worktree, for integration tests. (pnpm prd test-db …)
#
#   test-db.sh status            running or not, its port and databases
#   test-db.sh up                start it if it isn't running (never recreates it)
#   test-db.sh down              stop it (every worktree's test database goes)
#   test-db.sh facts             port=<its port>, project=<its Compose project>
#                                and running=yes|no
#   test-db.sh orphans [worktree…]   orphan=<database> for each worktree database
#                                or worker copy on it that none of them owns
#   test-db.sh name <worktree>   the database name for a worktree
#   test-db.sh create <worktree> start it if needed and create that database
#   test-db.sh drop <worktree>   drop that database and its integration workers'
#                                copies, caretook_tw_<stem>_<hash>_w<n> (nothing
#                                when it isn't running)
#   test-db.sh drop-db <database>   the same by database name, for one whose
#                                worktree is gone (pnpm prd tidy)
#   test-db.sh list              the worktree databases on it, with their worker copies
#   test-db.sh use [worktree]    point a worktree's integration tests at its
#                                database here (packages/data/.env.test.local);
#                                for worktrees made before the shared server;
#                                database=, port= and summary= facts
#
# Env: CARETOOK_SHARED_TEST_PORT (5436), CARETOOK_SHARED_TEST_PROJECT
# (caretook-shared-test). The integration globalSetup starts it and creates the
# database on first use, so worktrees never need to call this themselves.
set -euo pipefail

# Caretook's own (the config's test-db hook): it sources no core file, since the
# integration tests run it with no Risa present, so the few values it needs are
# defined here.
shared_test_port=${CARETOOK_SHARED_TEST_PORT:-5436}
shared_test_project=${CARETOOK_SHARED_TEST_PROJECT:-caretook-shared-test}
compose_file=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)/docker-compose.shared-test.yml
die() { echo "$*" >&2; exit 1; }

# The main checkout (the repo's first worktree, its path whole) and its .loops worktrees.
main=$(git -C "$(dirname "$0")" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p') || main=""
[[ -n $main ]] || die "test-db.sh: $(dirname "$0") isn't in a git repository (it needs the main checkout)"
loops=$main/.loops

# here_name → the name of the .loops worktree the shell is in, or nothing.
here_name() {
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) || return 0
  [[ $top == "$loops"/* ]] && basename "$top"
  return 0
}

# test_db_name NAME → the worktree's database on the shared test Postgres:
# caretook_test_<name>, anything but a-z0-9 as _, at most 63 characters.
test_db_name() {
  local n
  n=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '_')
  printf 'caretook_test_%s\n' "$n" | cut -c1-63
}

# write_test_env DIR NAME → packages/data/.env.test.local pointing the
# integration tests at NAME's own database on the shared test Postgres. The
# globalSetup creates it on first use and clears and migrates only it.
write_test_env() {
  mkdir -p "$1/packages/data"
  cat > "$1/packages/data/.env.test.local" <<ENV
# Integration tests: this worktree's own database on the shared test Postgres
# (scripts/project/test-db.sh). Created on first use; dropped by pnpm prd rm.
DATABASE_URL="postgresql://caretook:password@localhost:$shared_test_port/$(test_db_name "$2")"
PG_TEST_PORT=$shared_test_port
SHARED_TEST_DB=1
ENV
}

# container → the running shared Postgres container's id, or nothing.
container() {
  docker ps -q --filter "label=com.docker.compose.project=$shared_test_project" \
    --filter label=com.docker.compose.service=postgres --filter status=running 2>/dev/null | head -1
}

psql_c() { docker exec "$1" psql -U caretook -d postgres -Atqc "$2"; }

# A worker copy's name: caretook_tw_<stem cut to 38>_<md5 of the database cut
# to 8>_w<n>, where the stem is the database without caretook_test_
# (workerDatabaseName in packages/data/src/db/testDatabase.ts; tidy.mjs too).
# No worktree database starts caretook_tw_, so a copy is never another
# worktree's database. Copies named the old way, <database cut to 59>_w<n>,
# list as databases and are left to pnpm prd tidy (an orphan once their
# worktree is gone): by name alone one can be a worktree's own database.
worker_re='_w([1-9]|1[0-6])$'

md5_hex() { if command -v md5sum >/dev/null 2>&1; then md5sum; else md5 -q; fi; }

# worker_prefix DB → its worker copies' name without the _w<n>.
worker_prefix() {
  local stem=${1#caretook_test_} hash
  hash=$(printf '%s' "$1" | md5_hex | cut -c1-8)
  echo "caretook_tw_${stem:0:38}_$hash"
}

# copies_of NAMES DB → the names in NAMES (one per line) that are DB's worker copies.
copies_of() { grep -E "^$(worker_prefix "$2")$worker_re" <<<"$1" || true; }

# databases_of CONTAINER DB → DB's worker copies that exist, one per line.
databases_of() {
  copies_of "$(psql_c "$1" "SELECT datname FROM pg_database WHERE datname LIKE 'caretook\_tw\_%' ORDER BY 1")" "$2"
}

# owned_by_any DB WORKTREE… → true when one of the worktrees owns DB.
owned_by_any() {
  local db=$1 w own p; shift
  for w in "$@"; do [[ $(test_db_name "$w") == "$db" ]] && return 0; done
  for w in "$@"; do
    p=$(worker_prefix "$(test_db_name "$w")")
    [[ $db == "$p"* && ${db#"$p"} =~ ^$worker_re ]] && return 0
  done
  for w in "$@"; do
    own=$(test_db_name "$w"); p=${own:0:59}
    [[ $db == "$p"* && ${db#"$p"} =~ ^$worker_re ]] && return 0
  done
  return 1
}

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
      prd=$(node "$(dirname "$0")/risa.mjs" tool prd) || prd=prd
      echo "shared test Postgres: not running (started on first integration run, or $prd test-db up)"
    else
      n=$(psql_c "$c" "SELECT count(*) FROM pg_database WHERE datname LIKE 'caretook\_test\_%'" 2>/dev/null || echo '?')
      w=$(psql_c "$c" "SELECT count(*) FROM pg_database WHERE datname LIKE 'caretook\_tw\_%'" 2>/dev/null || echo '?')
      echo "shared test Postgres: running on :$shared_test_port ($shared_test_project), $n worktree databases (+$w worker copies)"
    fi
    ;;
  up) up; echo "shared test Postgres running on :$shared_test_port" ;;
  down)
    # Only this project: never other Compose projects or their networks.
    docker compose -p "$shared_test_project" down --remove-orphans
    ;;
  facts)
    printf '%s\n' "port=$shared_test_port" "project=$shared_test_project"
    if [[ -n $(container) ]]; then echo "running=yes"; else echo "running=no"; fi
    ;;
  orphans)
    # orphan=<database> for each one on the server that none of the named
    # worktrees owns: not its own database, nor one of its worker copies (new
    # names first, then the old <database cut to 59>_w<n>, so a topic ending
    # -w<n> owns its database instead of it reading as another's old copy).
    c=$(container); [[ -n $c ]] || exit 0
    all=$(psql_c "$c" "SELECT datname FROM pg_database WHERE datname LIKE 'caretook\_test\_%' OR datname LIKE 'caretook\_tw\_%' ORDER BY 1")
    while read -r d; do
      [[ -n $d ]] && ! owned_by_any "$d" "$@" && echo "orphan=$d"
    done <<<"$all"
    exit 0
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
  drop | drop-db)
    if [[ $cmd == drop-db ]]; then
      db=${1:-}
      [[ $db =~ ^caretook_(test|tw)_[a-z0-9_]+$ ]] || die "drop-db: not a test database name: ${db:-(none)}"
    else
      db=$(db_of "${1:-}")
    fi
    c=$(container)
    # Not running: its tmpfs went with it, so there's nothing to drop.
    [[ -n $c ]] || exit 0
    # The database itself always (it may be missing), then each worker copy.
    dbs=$( { echo "$db"; databases_of "$c" "$db"; } | grep -E '^caretook_(test|tw)_[a-z0-9_]+$' | sort -u)
    for d in $dbs; do
      docker exec "$c" dropdb -U caretook --if-exists --force "$d"
    done
    n=$(($(wc -l <<<"$dbs") - 1))
    echo "dropped test database $db$( ((n)) && echo " and $n worker copies")"
    ;;
  list)
    c=$(container); [[ -n $c ]] || { echo "(not running)"; exit 0; }
    # One line per worktree database, with how many worker copies it has,
    # then any copy whose database is gone.
    all=$(psql_c "$c" "SELECT datname FROM pg_database WHERE datname LIKE 'caretook\_test\_%' OR datname LIKE 'caretook\_tw\_%' ORDER BY 1")
    owned=""
    while read -r d; do
      [[ $d == caretook_test_* ]] || continue
      copies=$(copies_of "$all" "$d")
      owned+=$copies$'\n'
      n=$(grep -c . <<<"$copies" || true)
      if ((n)); then echo "$d (+$n worker copies)"; else echo "$d"; fi
    done <<<"$all"
    while read -r d; do
      if [[ $d == caretook_tw_* ]] && ! grep -qxF "$d" <<<"$owned"; then echo "$d (worker copy, its database is gone)"; fi
    done <<<"$all"
    ;;
  use)
    name=${1:-$(here_name)}
    [[ -n $name && -d $loops/$name ]] || die "use: give a .loops worktree name, or run it inside one"
    write_test_env "$loops/$name" "$name"
    # The human line only for a person at a terminal; a caller (new.sh) reads summary=.
    if [[ -t 1 ]]; then
      echo "$name's integration tests now use $(db_of "$name") on the shared test Postgres (:$shared_test_port)" >&2
    fi
    printf '%s\n' "database=$(db_of "$name")" "port=$shared_test_port" \
      "summary=$(db_of "$name") on the shared test Postgres (:$shared_test_port)"
    ;;
  *) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 1 ;;
esac
