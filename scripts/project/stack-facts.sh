#!/usr/bin/env bash
# Caretook's dev stack facts (Compose projects, ports, env files, containers,
# images), shared by stack.sh (the config's stack hooks) and serve.sh. Source it;
# don't run it. It sources no core file: it is Caretook's, and the core reaches
# it only through the hooks.

# The main checkout (the repo's first worktree) and its .loops worktrees.
main=$(git -C "$(dirname "${BASH_SOURCE[0]}")" worktree list --porcelain 2>/dev/null | awk 'NR==1{print $2}')
loops=$main/.loops

die() { echo "$*" >&2; exit 1; }

# env_get FILE KEY → the value of KEY in an env file, or nothing.
env_get() { [[ -f $1 ]] && grep "^$2=" "$1" | tail -1 | cut -d= -f2- | tr -d '"' || true; }

# here_name → the name of the .loops worktree the shell is in, or nothing.
here_name() {
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) || return 0
  [[ $top == "$loops"/* ]] && basename "$top"
  return 0
}

# use_node → put the Node that .nvmrc names (here, else the main checkout's)
# first on PATH, with the pnpm beside it (agent shells have another node ahead
# of nvm's). Returns 1 when that Node isn't installed.
use_node() {
  local want dir
  want=$(cat .nvmrc 2>/dev/null || cat "$main/.nvmrc" 2>/dev/null || echo 24)
  want=${want#v}
  node_is "$want" && return 0
  export NVM_DIR=${NVM_DIR:-$HOME/.nvm}
  dir=$(ls -d "$NVM_DIR/versions/node/v$want"/bin "$NVM_DIR/versions/node/v$want".*/bin 2>/dev/null | sort -V | tail -1 || true)
  if [[ -n $dir ]]; then
    export PATH=$dir:$PATH
  elif [[ -s $NVM_DIR/nvm.sh ]]; then
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh" >/dev/null && nvm use >/dev/null
  fi
  node_is "$want" || { echo "need Node $want (from .nvmrc); got $(node -v 2>/dev/null || echo none)" >&2; return 1; }
}

# node_is VERSION → true when `node` on PATH is VERSION (24, 24.22 or 24.22.3).
node_is() {
  local have
  have=$(node -v 2>/dev/null) || return 1
  [[ $have == "v$1" || $have == "v$1".* ]]
}

# slot_ports N → sets web, pg, pgt, ps and off for slot N (1-19).
#   1-9:   web 6N73, Postgres 6N34, test Postgres 6N35, PowerSync 6N80
#   10-19: the same with 7(N-10) in place of 6N: 7073 … 7980
#   CDP and proxy ports shift by N*1000 (CDP_PORT_OFFSET).
slot_ports() {
  local n=$1 p
  [[ $n =~ ^[0-9]+$ ]] && ((n >= 1 && n <= 19)) || die "slot must be 1-19 (got ${n:-none})"
  if ((n < 10)); then p=6$n; else p=7$((n - 10)); fi
  web=${p}73 pg=${p}34 pgt=${p}35 ps=${p}80 off=$((n * 1000))
}

# slot_project N → slot N's Compose project.
slot_project() { echo "caretook-loop$1"; }

# slot_in_use N → true when a worktree's .env names slot N's project or one of
# its ports is listening (the core checks its own slot lease first).
slot_in_use() {
  local n=$1 f p
  for f in "$loops"/*/.env; do
    [[ -f $f ]] && grep -qx "CARETOOK_STACK=$(slot_project "$n")" "$f" && return 0
  done
  slot_ports "$n"
  for p in $web $pg $pgt $ps; do
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  done
  return 1
}

# web_port DIR → the dev server port of a stacked worktree, or nothing.
web_port() { env_get "$1/apps/web/.env" WEB_PORT; }

# server_pids PORT → pids listening on PORT.
server_pids() { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true; }

# stop_server DIR → stop the worktree's dev server, if one is running.
stop_server() {
  local port pids
  port=$(web_port "$1"); [[ -n $port ]] || return 0
  pids=$(server_pids "$port"); [[ -n $pids ]] || return 0
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
}

# stack_project DIR → the worktree's Compose project (caretook-loopN), or nothing.
stack_project() { env_get "$1/.env" CARETOOK_STACK; }

# require_main_env → the main checkout's env files a stack copies secrets from.
require_main_env() {
  local f
  for f in packages/data/.env apps/web/.env; do
    [[ -f $main/$f ]] || die "missing $main/$f (copy its .env.example)"
  done
}

# write_stack_env DIR SLOT BASE → the env files of a stacked worktree: the root
# .env (Compose's project and ports), packages/data/.env, apps/web/.env and
# .env.loop. Secrets come from the main checkout's copies.
write_stack_env() {
  local dir=$1 base=$3
  slot_ports "$2"
  cat > "$dir/.env" <<ENV
CARETOOK_STACK=$(slot_project "$2")
PG_PORT=$pg
PG_TEST_PORT=$pgt
POWERSYNC_PORT=$ps
POWERSYNC_URL=http://localhost:$ps
PS_JWKS_URL=http://host.docker.internal:$web/api/auth/jwks
ENV
  mkdir -p "$dir/packages/data" "$dir/apps/web"
  sed -E "s#^DATABASE_URL=.*#DATABASE_URL=\"postgresql://caretook:password@localhost:$pg/caretook\"#" \
    "$main/packages/data/.env" > "$dir/packages/data/.env"
  sed -E \
    -e "s#^BETTER_AUTH_URL=.*#BETTER_AUTH_URL=\"http://localhost:$web\"#" \
    -e "s#^AUTH_TRUSTED_ORIGINS=.*#AUTH_TRUSTED_ORIGINS=\"http://localhost:$web\"#" \
    -e "s#^POWERSYNC_URL=.*#POWERSYNC_URL=\"http://localhost:$ps\"#" \
    -e "s#^VITE_POWERSYNC_URL=.*#VITE_POWERSYNC_URL=\"http://localhost:$ps\"#" \
    -e "/^WEB_PORT=/d" \
    -e "/^APP_URL=/d" \
    "$main/apps/web/.env" > "$dir/apps/web/.env"
  # Emailed links point at this worktree's dev server. The mail secrets
  # (CRON_SECRET, INVITE_LINK_KEY, …) come over with the rest of the file.
  printf 'WEB_PORT=%s\nAPP_URL="http://localhost:%s"\n' "$web" "$web" >> "$dir/apps/web/.env"
  # A main checkout without a CRON_SECRET still gives the worktree one (random,
  # local), so /api/cron/outbox can be called there.
  if ! grep -Eq '^CRON_SECRET="?[^"]' "$dir/apps/web/.env"; then
    sed -i.bak '/^CRON_SECRET=/d' "$dir/apps/web/.env" && rm -f "$dir/apps/web/.env.bak"
    printf 'CRON_SECRET="%s"\n' "$(openssl rand -hex 32)" >> "$dir/apps/web/.env"
  fi
  # Contact messages from the marketing site go to SUPPORT_EMAIL (the dev
  # mailbox outside production); the main checkout's value comes over above.
  if ! grep -Eq '^SUPPORT_EMAIL="?[^"]' "$dir/apps/web/.env"; then
    sed -i.bak '/^SUPPORT_EMAIL=/d' "$dir/apps/web/.env" && rm -f "$dir/apps/web/.env.bak"
    printf 'SUPPORT_EMAIL="support@example.com"\n' >> "$dir/apps/web/.env"
  fi
  # For browser checks: `set -a; source .env.loop; set +a`.
  cat > "$dir/.env.loop" <<ENV
SLOT=$2
BASE_BRANCH=$base
BASE=http://localhost:$web
CDP_PORT_OFFSET=$off
PG_CONTAINER=$(slot_project "$2")-postgres-1
ENV
  grep '^SEED_USER_PASSWORD=' "$dir/packages/data/.env" >> "$dir/.env.loop" || true
}

# write_stackless_env DIR BASE → .env.loop for a worktree without a stack.
write_stackless_env() { printf 'SLOT=\nBASE_BRANCH=%s\n' "$2" > "$1/.env.loop"; }

# stack_teardown DIR → stop the worktree's dev server and its Compose projects
# (the stack and, for worktrees made before the shared test Postgres, its own
# test database), and delete their data. Only this worktree's projects.
stack_teardown() {
  local dir=$1 proj
  proj=$(stack_project "$dir")
  # Never fall back to Compose's default project: that's the main checkout's.
  [[ $proj == caretook-loop* ]] || return 0
  stop_server "$dir"
  rm -f "$dir/.dev.log"
  docker compose -p "$proj" down --remove-orphans
  if [[ -n $(docker ps -aq --filter "label=com.docker.compose.project=$proj-test" 2>/dev/null) ]]; then
    docker compose -p "$proj-test" down --remove-orphans
  fi
  # Postgres writes its data as the container user; remove it through a container.
  if [[ -d $dir/.postgres ]]; then
    docker run --rm --network none -v "$dir:/w" postgres:18.7-alpine rm -rf /w/.postgres
  fi
}

# slot_facts N → the facts of slot N's stack, whether or not a worktree has it.
slot_facts() {
  slot_ports "$1"
  printf '%s\n' "slot=$1" "project=$(slot_project "$1")" "web_port=$web" "pg_port=$pg" "pg_test_port=$pgt" \
    "powersync_port=$ps" "cdp_offset=$off" "url=http://localhost:$web" "pg_container=$(slot_project "$1")-postgres-1" \
    "summary=Postgres     :$pg   PowerSync :$ps"
}

# stack_facts DIR → the facts of the worktree's stack, from its env files (no
# Docker): nothing for a worktree without a stack, but web_port when its
# apps/web/.env names one.
stack_facts() {
  local slot proj port
  proj=$(stack_project "$1") slot=$(env_get "$1/.env.loop" SLOT) port=$(web_port "$1")
  if [[ -n $proj && $slot =~ ^[0-9]+$ ]]; then
    slot_facts "$slot" | grep -v '^web_port=\|^url='
    [[ -n $port ]] && printf '%s\n' "web_port=$port" "url=http://localhost:$port"
  else
    [[ -z $proj ]] || echo "project=$proj"
    [[ -z $port ]] || echo "web_port=$port"
  fi
  return 0
}
