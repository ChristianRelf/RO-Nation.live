#!/bin/sh
set -e

# Wait for Postgres to accept connections.
#
# This is a CONNECTIVITY probe, and it is deliberately separate from the schema
# push below. They used to be the same step — `until prisma db push` — which
# quietly conflated two very different failures: "the database isn't up yet"
# (retrying fixes it) and "Prisma refused this migration" (retrying never fixes
# it). A refusal would loop 15 times and then exit claiming the database was
# unreachable, which sent you looking at Postgres when the real message had
# already scrolled past.
echo "→ Waiting for the database..."
retries=0
until echo 'SELECT 1;' | npx prisma db execute --schema=prisma/schema.prisma --stdin > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge 15 ]; then
    echo "✗ Database not reachable after 15 attempts. Exiting."
    exit 1
  fi
  echo "  not ready yet — retrying in 3s ($retries/15)..."
  sleep 3
done

# Push the schema. ONCE — no retry loop. The database is reachable by now, so a
# failure here is a real schema problem and the error is the useful part: it is
# printed, and the container stops instead of masking it behind a retry counter.
#
# There is deliberately no --accept-data-loss. It is not a flag that belongs in
# an entrypoint: it would hand every future deploy blanket permission to drop a
# column or a table in production, silently, because a schema edit happened to
# imply one. A migration that genuinely needs it is a migration a human should
# be looking at — see README, "Applying a destructive schema change".
echo "→ Applying database schema..."
if ! npx prisma db push --skip-generate; then
  echo ""
  echo "✗ Prisma refused to apply the schema (see the error above)."
  echo "  This is NOT a connectivity problem — the database answered fine."
  echo "  If the warning is about adding a constraint, verify there are no"
  echo "  conflicting rows and then apply it once, by hand:"
  echo ""
  echo "    docker compose run --rm --entrypoint npx web \\"
  echo "      prisma db push --accept-data-loss"
  echo ""
  echo "  (--entrypoint is required: this script IS the image's entrypoint, so"
  echo "   without it your command arrives as arguments to this script, which"
  echo "   ignores them and simply fails here again.)"
  echo ""
  exit 1
fi

echo "→ Seeding starter content (skips if events already exist)..."
npm run seed || echo "  seed skipped/failed (non-fatal)"

echo "→ Starting RO. Nation LIVE on port ${PORT:-3000}..."
exec npm run start -- -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
