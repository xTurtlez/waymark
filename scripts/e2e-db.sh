#!/usr/bin/env bash
# Fresh database for live E2E: reset, migrate, runtime role, seed. Local/CI only.
set -euo pipefail
: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL}"
: "${RUNTIME_DB_PASSWORD:?Set RUNTIME_DB_PASSWORD}"
case "$DATABASE_ADMIN_URL" in *localhost*|*127.0.0.1*|*@postgres:*) ;; *) echo "Refusing to reset a non-local database" >&2; exit 1;; esac
export DATABASE_URL="$DATABASE_ADMIN_URL"
npx tsx scripts/reset.ts
npx tsx scripts/migrate.ts
npx tsx scripts/runtime-role.ts
npx tsx --conditions=react-server scripts/seed.ts
