#!/bin/sh
set -e

echo "→ Applying database schema..."
retries=0
until npx prisma db push --skip-generate; do
  retries=$((retries + 1))
  if [ "$retries" -ge 15 ]; then
    echo "✗ Database not reachable after multiple attempts. Exiting."
    exit 1
  fi
  echo "  database not ready yet — retrying in 3s ($retries/15)..."
  sleep 3
done

echo "→ Seeding starter content (skips if events already exist)..."
npm run seed || echo "  seed skipped/failed (non-fatal)"

echo "→ Starting RO. Nation LIVE on port ${PORT:-3000}..."
exec npm run start -- -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
