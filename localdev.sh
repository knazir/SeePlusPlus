#!/usr/bin/env bash
# Thin wrapper around `docker compose` that loads port + DB vars from
# .env.local so interpolation works in both the main clone and worktree
# siblings.
#
#   ./localdev.sh up
#   ./localdev.sh down
#   ./localdev.sh logs -f backend
#   ./localdev.sh ps
set -euo pipefail

cd "$(dirname "$0")"

compose_args=()
if [ -f .env.local ]; then
  compose_args=(--env-file .env.local)
else
  echo "note: no .env.local found — using docker-compose defaults (3000/4000/5432, seepp_main)." >&2
  echo "      for a worktree, run: ./scripts/worktree-ports.sh <slug>" >&2
fi

exec docker compose "${compose_args[@]}" "$@"
