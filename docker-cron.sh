#!/bin/sh
# The daily maintenance loop - the entrypoint of the `cron` service in
# docker-compose.yml.
#
# It reuses the web image (so it already has tsx, the generated Prisma client and
# DATABASE_URL) and does exactly one thing: run `npm run cull` once a day, at
# CULL_HOUR:00 UTC. See scripts/cull.ts for what that removes and why it is safe.
#
# A plain sleep loop, not a cron daemon: there is one job, the container's entire
# purpose IS that job, and `sleep <seconds-until-next>` is far easier to read in the
# logs than a crontab buried inside a container nobody remembers is running. GNU
# `date` (from the Debian base image) does the arithmetic.
set -eu

HOUR="${CULL_HOUR:-4}"
echo "cron: daily cull scheduled for ${HOUR}:00 UTC"

while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today ${HOUR}:00:00" +%s)
  # Today's slot already gone? Aim at tomorrow's.
  if [ "$next" -le "$now" ]; then
    next=$(date -u -d "tomorrow ${HOUR}:00:00" +%s)
  fi
  wait=$((next - now))
  echo "cron: next cull in ${wait}s"
  sleep "$wait"

  echo "→ $(date -u +%Y-%m-%dT%H:%M:%SZ) starting cull"
  # A failed run must never kill the loop. The `if` swallows the non-zero exit (set
  # -e would otherwise abort here); cull.ts has already logged the cause, and the
  # deletes are idempotent, so the next slot simply picks up where this one stopped.
  if npm run --silent cull; then
    echo "✓ $(date -u +%Y-%m-%dT%H:%M:%SZ) cull done"
  else
    echo "✗ cull failed - retrying at the next slot"
  fi
done
