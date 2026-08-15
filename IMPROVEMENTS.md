# Site improvements

A four-phase pass that fills gaps rather than fixing messes: professional link
previews and indexing, staff notifications, graceful failures, closed security
edges, and a durable test/CI safety net. Every phase is additive and
independently revertible - no existing behaviour was removed.

- [Phase 1 - Sharing, SEO & graceful failure](#phase-1--sharing-seo--graceful-failure)
- [Phase 2 - Discord notifications](#phase-2--discord-notifications)
- [Phase 3 - Security hardening](#phase-3--security-hardening)
- [Phase 4 - Testing & CI](#phase-4--testing--ci)
- [New environment variables](#new-environment-variables)
- [Deploy notes](#deploy-notes)
- [Verification](#verification)
- [Deferred (not shipped)](#deferred-not-shipped)

---

## Phase 1 - Sharing, SEO & graceful failure

### Social / OpenGraph images
- **Event detail pages** emit `og:image` from the real `event.thumbnailUrl`
  (`src/app/events/[slug]/page.tsx`). Real posters only - no fabricated art.
- **Blog covers** are now made absolute for crawlers (`src/app/blog/[slug]/page.tsx`).
- **A branded default card** is generated at `/opengraph-image` via `next/og`
  (`src/app/opengraph-image.tsx`, shared renderer in `src/lib/og.tsx`). Next merges
  file-based images down the segment tree, so every page without its own image gets
  this card; the event/blog posters (deeper segments) win where they exist.
  - Runs on the **edge runtime** - the Node runtime throws `Invalid URL` from
    `@vercel/og` while prerendering at build time; edge is where it belongs.
- **Twitter** mirrors `og:image` everywhere (no separate `twitter-image` file), so
  event/blog pages show the real poster on X, not the generic card.

### Metadata completeness
- **Homepage** now sets an explicit title, description and `canonical` + an
  **Organization** JSON-LD block (`src/app/page.tsx`).
- **Canonical URLs** (`alternates.canonical`) added to: home, `/events`,
  `/events/[slug]`, `/blog`, `/blog/[slug]`, `/about`, `/team`, `/services`,
  `/press`, `/faq`.
- **JSON-LD** (`src/components/json-ld.tsx`):
  - **Event** on `/events/[slug]` - name, startDate, VirtualLocation (RNL runs
    inside Roblox), organizer, image, offers. A price is asserted **only when entry
    is genuinely free**; a Robux-priced tier is left without a price rather than
    dressed up in a currency it isn't.
  - **FAQPage** on `/faq` - flattened from the same `groups` array the page renders,
    so the structured data can't drift from what a visitor reads.
  - **Organization** on the homepage - `sameAs` is only the socials RNL actually has.

### Dynamic sitemap + robots
- `src/app/sitemap.ts` is now **async** with `revalidate = 3600`, appending real
  published event / blog / career slugs from the scoped queries (scope `null` =
  RNL's own). If the database is unreachable at generation time it **falls back to
  the static routes** - keeping the build safe, which was the original reason it
  skipped the DB.
- `src/app/robots.ts` now disallows the internal areas as well:
  `/shasha`, `/hub`, `/portal`, `/docs`, `/authorise`.

### Error & loading boundaries
- `src/app/error.tsx` - a **brand-aware** route error boundary (renders inside the
  root layout, so `data-brand` themes it to the partner's palette).
- `src/app/global-error.tsx` - the last resort, its own `<html>`/`<body>`, inline
  styles only.
- `loading.tsx` skeletons for the data-driven routes: `/events`, `/events/[slug]`,
  `/blog`, `/careers`, `/team` (shared primitives in `src/components/skeletons.tsx`).

### Hygiene
- `tsconfig.tsbuildinfo` untracked and added to `.gitignore`.
- Added `.eslintrc.json` (`next/core-web-vitals`) + `eslint` / `eslint-config-next`
  devDeps, so `next lint` and CI have a config. Fixed one pre-existing lint **error**
  so the baseline is green (0 errors; 3 pre-existing `<img>` warnings remain).
- **Doc reconciliation** - the partner member-admin UI shipped and the boot-time
  seed is gone, but several docs still described the old world. Corrected across
  `scripts/grant-partner-owner.ts`, `.env.example`, `STARTUP.md`, `README.md`, and
  `docker-compose.yml` (the `STRO_OWNER_*` vars are now documented as deprecated /
  no-op).

---

## Phase 2 - Discord notifications

Push, don't poll. Applications, enquiries and ticket reservations used to write a
row and tell nobody.

- **`src/lib/notify.ts`** - a server-only Discord webhook poster that is:
  - **fire-and-forget** - callers do `void notify(...)`, started before the redirect
    and never awaited, so it adds nothing to a submission;
  - **never throws** - a down webhook can't turn a saved enquiry / reserved ticket
    into an error the visitor sees;
  - **degrades to no-op** - no webhook configured → returns silently (the dev default).
- **Wired** after each `create()`:
  - `src/app/actions/applications.ts` → the partner's channel when the career carries
    a `partnerId`, else RNL's; links to the matching applications dashboard.
  - `src/app/actions/enquiries.ts` → RNL's channel (enquiries are always RNL's).
  - `src/app/actions/tickets.ts` (reserve path) → the event's partner channel, else
    RNL's; links to where staff manage that show.
- **Routing:** RNL uses `DISCORD_WEBHOOK_URL`; a partner uses
  `DISCORD_WEBHOOK_URL_<SLUG>` when set, falling back to RNL's. Resolved directly
  from `process.env` (a webhook URL is a secret, so it's not in the code registry).
- New helper `partnerPortalUrl()` in `src/lib/partners/urls.ts` for links that leave
  the app onto the portal host.

---

## Phase 3 - Security hardening

### Fail-fast on insecure production config
- **`src/instrumentation.ts`** `register()` refuses to boot the server in production
  when `AUTH_SECRET`, `GAME_API_KEY`, or the `DATABASE_URL` password are unset or a
  known default. Enabled via `experimental.instrumentationHook: true`
  (`next.config.mjs`).
- Runs at **server startup, not build** (guarded on `NEXT_RUNTIME === "nodejs"` and
  `NODE_ENV === "production"`), so it never breaks `next build` - which sets
  production `NODE_ENV` without real secrets. Closes the forgeable-session risk from
  the default `AUTH_SECRET`.

### Security headers (Caddy)
Added to the site block in `Caddyfile`, on every response from every host:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (all subdomains
  are RNL-owned)
- `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`

The global CSP carries **only** `frame-ancestors`, so it can't break a page by
blocking a resource; the `/uploads` handler keeps its own stricter CSP (it runs
later in the chain and wins for those responses).

### Rate limiting
- **`src/lib/rate-limit.ts`** - a Postgres fixed-window counter (one atomic upsert
  per check), backed by a new `RateLimit` model / `rate_limits` table. **Fails open**
  - if the DB is unreachable or the table doesn't exist yet, it allows the request
  rather than taking the site down.
- **Applied to:**
  - `submitEnquiry` - `enquiry:<uid>`, 5 per 10 min.
  - Ticket reserve - `reserve:<uid>`, 10 per 60 s (new `rate_limited` reserve outcome
    + a client message in `checkout-processing.tsx`).
  - The `/api/v1` guard (`src/lib/api/guard.ts`) - `apikey:<id>`, 600 per 60 s, with
    a `Retry-After` header on the 429. Generous on purpose (a busy door scans a lot);
    ship loose, tighten later.
- The unscoped root `GAME_API_KEY` shares a single `apikey:root` bucket - one more
  reason to retire it onto a minted key (noted in `src/lib/apikey.ts`).

---

## Phase 4 - Testing & CI

### Vitest suite
- `vitest` + `vitest.config.ts` + `tests/`, run with `npm test`. `tests/global-setup.ts`
  brings up Postgres (an existing `DATABASE_URL`, e.g. a CI service container, or a
  local `embedded-postgres`) and runs `prisma db push` before the suite.
- **Passing tests, against real Postgres row locks:**
  - **Payment idempotency** (`tests/purchase-idempotency.test.ts`) - the same
    `PurchaseId` twice yields one ticket + one payment row; cancel then re-claim the
    same `PurchaseId` restores the ticket without a second payment.
  - **Reserve race** (`tests/reserve-race.test.ts`) - one holder racing themselves
    ends with exactly one ticket; capacity-1 with 8 concurrent buyers → exactly one
    winner, the rest `soldout`, and the room never oversells.

### GitHub Actions
- `.github/workflows/ci.yml` - on push to `main` and every PR:
  `npm ci → prisma generate → tsc --noEmit → next lint → vitest`, with a Postgres
  service container. This is the gate `next.config.mjs`'s `eslint.ignoreDuringBuilds:
  true` currently leaves un-enforced.

---

## New environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_WEBHOOK_URL` | No | RNL's notification channel. Blank → notifications no-op. |
| `DISCORD_WEBHOOK_URL_<SLUG>` | No | Per-partner override, e.g. `DISCORD_WEBHOOK_URL_SLEEPTOKENRO`. Falls back to RNL's. |

Existing secrets are now **enforced in production** by the fail-fast: `AUTH_SECRET`,
`GAME_API_KEY`, and the `DATABASE_URL` password must not be defaults.

CI / tests also set `AUTH_SECRET` and `ROBUX_TICKETS_ENABLED=true` (the latter lets
the paid-tier idempotency fixtures issue).

---

## Deploy notes

1. **The `rate_limits` table** is created by the existing boot-time `prisma db push`
   on the next deploy. Until it exists, the limiter fails open (allows) - there is no
   window where it breaks writes.
2. **The fail-fast will stop the container from starting** if the production
   `AUTH_SECRET` / `GAME_API_KEY` / DB password are still defaults. Set real values
   before deploying.
3. **Discord notifications** are inert until `DISCORD_WEBHOOK_URL` (and optionally
   per-partner ones) is set - see `.env.example`.

---

## Verification

| Phase | How it was verified |
| --- | --- |
| 1 | `tsc --noEmit`, `next build`, and `next lint` all clean; sitemap DB-fallback exercised by the build (no DB present). |
| 2 | `notify()` routing verified with a mocked-`fetch` harness: RNL→RNL, partner→partner, unknown→RNL fallback, unconfigured→0 calls. |
| 3 | Fail-fast harness (defaults→refuse, real→boot, dev→skip); `caddy validate` passes; the rate-limit upsert SQL run against a real Postgres 16 (increment within window, reset after). |
| 4 | 4 tests green against a throwaway Postgres; `tsc` clean including tests + config. |

---

## Deferred (not shipped)

- **Seated seat-race and hold-expiry tests** - the "chair held exactly once" and
  "expired hold → best-available fallback" cases need a seated-venue fixture (a
  `VenueMap` layout cloned onto the event, tiers assigned to sections). Left as
  documented `describe.todo` entries in `tests/purchase-idempotency.test.ts`,
  pointing at `src/lib/venue/presets.ts` for the fixture, rather than shipping a
  hand-rolled one that might pass for the wrong reason.
- **Prisma migrations switch** - moving from boot-time `prisma db push` to a
  committed `prisma/migrations/` history + `prisma migrate deploy`. It's the riskiest
  change (a deploy-path change) and was deliberately kept separate; the current
  `db push` flow is unchanged.
