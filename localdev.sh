#!/usr/bin/env bash
# Thin wrapper around `docker compose` that loads config from `.env`.
#
#   ./localdev.sh up
#   ./localdev.sh down
#   ./localdev.sh logs -f backend
#   ./localdev.sh ps
set -euo pipefail

cd "$(dirname "$0")"

compose_args=()
if [ -f .env ]; then
  compose_args=(--env-file .env)
else
  echo "note: no .env found — using docker-compose defaults (3000/4000/5432, seepp_main)." >&2
  echo "      to configure local dev (auth, etc.): cp .env.example .env && edit." >&2
fi

exec docker compose ${compose_args[@]+"${compose_args[@]}"} "$@"
