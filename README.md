# RO. Nation LIVE

A bold, modern website for the **RO. Nation LIVE** Roblox event-management group.
Post events, sell (free) tickets tied to Roblox accounts, verify them in-game over
an API, post careers, take applications, and run it all from one dashboard - plus
partner sites (like Sleep Token) that their own crews author themselves.

Built with **Next.js (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL**,
and packaged to run on any VPS with **Docker Compose**.

> **Setting this up for the first time? Follow [STARTUP.md](STARTUP.md)** - a
> step-by-step guide from a fresh clone to a live site, including the SHASHA
> staff portal and troubleshooting. The rest of this README is reference.

---

## Features

- **Events** - listing, rich detail pages, dates/venue/capacity, featured show on the homepage.
- **Ticketing** - members sign in with **Roblox OAuth**, reserve a free ticket, and get a unique code.
- **In-game verification API** - your Roblox experience checks & redeems tickets over HTTP with a shared key.
- **Careers** - post roles, collect applications, track status (New → Reviewing → Accepted/Rejected).
- **The Company** - `/company`: the one door onto ronation.live. Events, blog, surveys, careers, applications, attendees and check-in. Access is a rank in RNL's Roblox group - there is no password and no account list. (It replaced the old `/admin` and `/studio`, which now redirect here.)
- **Partner sites & studios** - a partner gets `<slug>.ronation.live` and a studio at `portal.ronation.live/<slug>/studio`, where their crew edits their own shows and pricing, blog, careers, applications and homepage copy. Everything is scoped by `partnerId`: their content never appears on RNL's site, and RNL's never appears on theirs.
- **Uploads** - images (5 MB, magic-byte checked) go to a Docker volume and are served straight off disk by Caddy. Scoped per-org, so one partner cannot overwrite another's files.
- **Blog** - public posts at `/blog`, and on each partner's own site. Drafts stay hidden.
- **Surveys** - `survey.ronation.live/<code>`: built in `/company`, answered with a Roblox sign-in (one response per account), results summarised and exportable as CSV.
- **SHASHA staff portal** - `portal.ronation.live/shasha`: Roblox-ranked VIP list & blacklist, searchable, with roles/reasons and a full change history.
- **Marketing pages** - Home, About (with a ticketing explainer), Contact + FAQ.
- **Design** - dark, Live-Nation-inspired: big condensed type, event ticker, ticket-stub cards. No AI-template smell.

---
xcv
## Quick start (local, no Roblox needed)

Requires Node 20+ and a PostgreSQL database (or just use Docker below).

```bash
cp .env.example .env          # then edit values (see below)
npm install
npm run db:push               # create tables
npm run seed                  # add demo events + careers
npm run dev                   # http://localhost:3000
```

With `ALLOW_DEV_LOGIN="true"` and no Roblox credentials set, the `/account`
page shows a **dev login** so you can test the whole ticketing flow locally.

**`/company`** (events, blog, surveys, careers, applications) needs a real Roblox
sign-in and rank 245+ in the group - the dev login mints a fake `dev-<name>` id
that no group can rank, so it cannot open that door. Configure Roblox OAuth to
work on `/company` locally. See *Who gets in* below.

---

## Deploy on a VPS with Docker

> ### Upgrading an existing server to `/company` + partner studios?
>
> Three one-off steps. Skip them and the container will stop on boot and tell you
> so - which is the entrypoint working, not a bug.
>
> 1. **The schema needs a hand.** This release adds a unique constraint
>    (`[partnerId, slug]` on posts and careers), and `prisma db push` will not add
>    a constraint on its own. Prove it's safe, then apply it once:
>
>    ```bash
>    # Should return no rows. If it does, rename the duplicate slugs first.
>    docker compose exec db psql -U ronation -d ronation -c 'SELECT slug, count(*) FROM posts GROUP BY 1 HAVING count(*) > 1;'
>    docker compose exec db psql -U ronation -d ronation -c 'SELECT slug, count(*) FROM careers GROUP BY 1 HAVING count(*) > 1;'
>
>    docker compose run --rm --entrypoint npx web prisma db push --accept-data-loss
>    ```
>
> 2. **Delete `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`.** Nothing reads
>    them. Access is now a Roblox group rank - see *Who gets in* below. Make sure
>    somebody is ranked 245+ **before** you deploy, or nobody can sign in to
>    `/company` at all.
>
> 3. **Back up the new `uploads` volume.** Uploaded images live there, not in
>    Postgres - a database dump alone will not restore them.
>
>    ```bash
>    docker run --rm -v ronation_uploads:/from -v "$PWD":/to alpine tar czf /to/uploads-backup.tar.gz -C /from .
>    ```

1. Copy the project to your server and create your `.env`:

   ```bash
   cp .env.example .env
   ```

2. Set at least these in `.env` (compose reads this file automatically):

   ```env
   NEXT_PUBLIC_SITE_URL="https://your-domain.com"
   AUTH_SECRET="<openssl rand -base64 48>"
   GAME_API_KEY="<openssl rand -hex 32>"
   POSTGRES_PASSWORD="<a strong db password>"
   ALLOW_DEV_LOGIN="false"
   # add ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET when ready (see below)
   ```

3. Set your hostnames - a bundled **Caddy** container terminates TLS and gets
   Let's Encrypt certificates for them automatically (no certbot, no cron):

   ```env
   SITE_HOST="ronation.live"
   PORTAL_HOST="portal.ronation.live"
   ACME_EMAIL="you@example.com"
   ```

   Both names must already resolve to the server, and ports **80** and **443**
   must be open and not already taken by a system nginx/Apache.

4. Build and run:

   ```bash
   docker compose up -d --build
   docker compose logs -f caddy   # "certificate obtained successfully"
   ```

   On first boot the web container creates the database schema and seeds demo
   content automatically. The app itself is bound to `127.0.0.1:3000` (change with
   `WEB_PORT`) - the public entrypoint is Caddy on 443. Certificates live in the
   `caddy-data` volume; don't delete it, or you'll re-issue into a rate limit.

Useful commands:

```bash
docker compose logs -f web     # tail app logs
docker compose down            # stop
docker compose up -d --build   # rebuild after changes
```

---

## Roblox sign-in (OAuth 2.0)

1. Open the **Roblox Creator Dashboard → Credentials → OAuth 2.0 Apps**
   (`https://create.roblox.com/dashboard/credentials`).
2. Create an app with:
   - **Redirect URL:** `https://your-domain.com/api/auth/roblox/callback`
   - **Scopes:** `openid`, `profile`
3. Put the client id/secret in `.env`:

   ```env
   ROBLOX_CLIENT_ID="..."
   ROBLOX_CLIENT_SECRET="..."
   ```

4. Restart: `docker compose up -d`. The dev login disappears automatically once
   real credentials are present.

A live status view is in **Admin → Settings**.

---

## In-game ticket API

Your Roblox experience talks to these endpoints with the header
`x-api-key: <GAME_API_KEY>` (enable *Allow HTTP Requests* in Game Settings → Security):

| Method | Path                      | Purpose                                        |
| ------ | ------------------------- | ---------------------------------------------- |
| `GET`  | `/api/v1/events`          | List published upcoming events + counts        |
| `POST` | `/api/v1/tickets/verify`  | Check if a ticket is valid (no side effects)   |
| `POST` | `/api/v1/tickets/redeem`  | Mark a ticket checked-in at the door           |

Look tickets up by `{ "code": "RN-XXXXXX" }` or by
`{ "robloxId": "123", "eventId": "..." }`. A copy-paste **Luau** door script and
`curl` examples are on the **Admin → Settings** page. Event IDs are shown on each
event's **Attendees** page.

---

## SHASHA staff portal (`portal.ronation.live/shasha`)

A separate, Discord-gated area holding the **VIP list** and the **blacklist**.
Both are keyed on a Roblox player, searchable, and every change is logged.

### 1. DNS

Point a `portal` record at the same server as the main site - it's the same app
and the same container, so there's nothing extra to deploy:

```text
portal.ronation.live.   A   <your server IP>
```

Make sure your reverse proxy / TLS cert covers the subdomain (with Caddy,
add `portal.ronation.live` to the site block; with Certbot, add `-d portal.ronation.live`).

Routing is host-based and needs no config: `portal.*` serves `/shasha` and
bounces every other path to the main site, while `/shasha` on the main domain
redirects to the portal. On `localhost` both are served, so `npm run dev` works.

### 2. Discord app

1. Create an app at <https://discord.com/developers/applications>.
2. Under **OAuth2 → Redirects**, add exactly:
   `https://portal.ronation.live/api/auth/discord/callback`
   (add `http://localhost:3000/api/auth/discord/callback` too, for local dev).
3. Copy the client id/secret into `.env`.

### 3. Who gets in

Access is **allowlist-only** - a valid Discord login is not enough. Turn on
Developer Mode in Discord, right-click a user → **Copy User ID**:

```env
DISCORD_CLIENT_ID="..."
DISCORD_CLIENT_SECRET="..."
DISCORD_MANAGER_IDS="1103...,2204..."   # can add / edit / remove people
DISCORD_STAFF_IDS="3305..."             # can sign in and search only
```

Then `docker compose up -d`. Set at least one manager or nobody can get in.

Access level is re-read from these variables on **every request**, so removing
an ID revokes that person immediately - no waiting for a session to expire.

### Using it

| Page                | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `/shasha`           | Search both lists at once - username, Roblox ID, role or reason |
| `/shasha/vip`       | The VIP list: add/edit/remove, with roles + a reason            |
| `/shasha/blacklist` | The blacklist: same, with tags + a reason                       |
| `/shasha/audit`     | Who changed what, when, and why                                 |

When adding someone you pick their account from a **live Roblox search**, and the
server re-resolves the user ID before saving - so entries can't be pinned to a
typo, and they survive the player renaming themselves. Roles/tags are free-form
(max 8 per person); a reason is always required.

---

## Swapping the placeholders

Everything marked "placeholder" is designed to be replaced:

- **Event thumbnails** - drop images in `public/` and set the *Thumbnail image URL*
  when editing an event (e.g. `/my-show.jpg`), or paste any full URL. The demo art
  lives in `public/placeholders/`.
- **Favicon** - replace `src/app/icon.svg`.
- **Logo mark** - the wordmark is code in `src/components/logo.tsx`; a static
  version is at `public/brand/logo.svg`.
- **Socials / group links / email** - edit `src/lib/site.ts`.
- **Homepage stats & copy** - `src/app/page.tsx`.

---

## Project structure

```
src/
  app/
    page.tsx                 # homepage
    events/                  # listing + [slug] detail (reserve tickets)
    careers/                 # listing + [slug] detail (apply)
    about, contact, account, tickets
    admin/                   # login + guarded dashboard (events, careers, applications, settings)
    shasha/                  # SHASHA staff portal - VIP list, blacklist, history (portal.* subdomain)
    api/
      auth/                  # roblox oauth, discord oauth (portal), dev login, logout
      v1/                    # in-game ticket API (key-protected)
      health/                # health check
    actions/                 # server actions (tickets, applications, admin CRUD, portal CRUD)
  components/                # header, footer, cards, ticket stub, forms, admin UI, portal UI
  lib/                       # db, env, session, roblox oauth + user lookup, discord oauth, queries
  middleware.ts              # host routing: portal.* ⇄ main site
prisma/                      # schema + seed
```

---

## Who gets in (the rank ladder)

Every door is a **rank in RNL's Roblox group** ([RoNation Live](https://www.roblox.com/communities/33033115/RoNation-Live), id `33033115`). There is no
allowlist to maintain, no shared password, and nothing to revoke by hand:
promoting somebody **is** the grant, demoting them **is** the revocation. Rank is
re-read from Roblox on every request (cached ~5 min) and never trusted from the
session cookie, so a change lands on its own with no redeploy.

| Rank | Opens |
| --- | --- |
| **200+** | SHASHA portal, read only - search the VIP list and blacklist |
| **245+** | SHASHA writes, **and** `/company`: all of ronation.live |
| **250+** | **Every partner portal and studio**, as an owner-equivalent |

Set with `COMPANY_MIN_RANK`, `PARTNER_STAFF_RANK`, `SHASHA_MIN_RANK` and
`SHASHA_MANAGER_RANK` - see `.env.example`.

A **partner's own crew** get in the other way: an explicit `PartnerMember` row -
their owners manage crew from `portal.ronation.live/<slug>/members`, and the very
first owner is seated with `npm run partner:member` (the old boot-time seed,
`STRO_OWNER_ROBLOX_ID`, is gone). They are not in RNL's group at all, and
RNL deliberately does **not** rank off *their* group - RNL doesn't own it, so
ranking off it would let a partner mint access to RNL's infrastructure by
promoting whoever they liked.

> **`ADMIN_USERNAME` / `ADMIN_PASSWORD` are gone.** The shared-password `/admin`
> dashboard was merged into `/company`. If they're still in your `.env`, delete
> them - nothing reads them.

---

## Applying a destructive schema change

The container runs `prisma db push` on boot, without `--accept-data-loss`. That
flag is left off on purpose: in an entrypoint it would give **every** future
deploy standing permission to drop a column or a table in production, silently,
because some schema edit happened to imply one.

So when Prisma refuses a change, the container stops and prints why. That is the
system working. Do this:

1. **Read the warning.** It names the exact change it won't make on its own.

2. **Prove it's safe against the real data.** Don't take the schema's word for
   it - ask the database. For a new unique constraint, look for rows that would
   collide:

   ```bash
   docker compose exec db psql -U ronation -d ronation \
     -c 'SELECT "partnerId", kind, "robloxId", count(*)
           FROM roster_entries GROUP BY 1,2,3 HAVING count(*) > 1;'
   ```

   Zero rows means nothing collides and the constraint is safe to add.

3. **Apply it once, by hand:**

   ```bash
   docker compose run --rm --entrypoint npx web \
     prisma db push --accept-data-loss
   ```

   `--entrypoint` is not optional. `docker-entrypoint.sh` is the image's
   ENTRYPOINT, and `docker compose run web <cmd>` overrides the *command*, not
   the entrypoint - so without it your `npx …` arrives as arguments to the
   entrypoint script, which ignores them, runs the normal boot sequence, and
   fails on the very error you are trying to fix.

4. **Bring the app back up.** `db push` is now a no-op for that change, so the
   entrypoint sails past it on every subsequent boot. (If `web` is already in a
   `restart: unless-stopped` loop, it will recover on its own.)

Never put `--accept-data-loss` into `docker-entrypoint.sh` to make a deploy go
green. The one time it silently drops the tickets table, it will be at 2am on a
show night.

### The partner-scoping migration (first deploy after partners landed)

This one warns about a unique constraint on
`roster_entries(partnerId, kind, robloxId)`. It is safe, and here is the actual
reason rather than a shrug: the previous schema already enforced
`unique(kind, robloxId)`, so Postgres has been rejecting duplicate pairs all
along. Every existing row backfills to `partnerId = 'shasha'` (the column
default), so the new triple is unique by construction. Prisma simply can't
*prove* that, so it asks.

Run the check in step 2 anyway - it costs nothing and confirms the reasoning
against your data rather than mine - then apply step 3.

---

## Notes

- Times entered in the admin use the **server's timezone**. Set `TZ` in `.env`
  (e.g. `TZ="Europe/London"`) so dates display as you expect.
- This site is not affiliated with or endorsed by Roblox Corporation.
