# RO. Nation LIVE

A bold, modern website for the **RO. Nation LIVE** Roblox event-management group.
Post events, sell (free) tickets tied to Roblox accounts, verify them in-game over
an API, post careers, take applications, and run it all from an admin dashboard.

Built with **Next.js (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL**,
and packaged to run on any VPS with **Docker Compose**.

> **Setting this up for the first time? Follow [STARTUP.md](STARTUP.md)** — a
> step-by-step guide from a fresh clone to a live site, including the SHASHA
> staff portal and troubleshooting. The rest of this README is reference.

---

## Features

- **Events** — listing, rich detail pages, dates/venue/capacity, featured show on the homepage.
- **Ticketing** — members sign in with **Roblox OAuth**, reserve a free ticket, and get a unique code.
- **In-game verification API** — your Roblox experience checks & redeems tickets over HTTP with a shared key.
- **Careers** — post roles, collect applications, track status (New → Reviewing → Accepted/Rejected).
- **Admin dashboard** — password-protected: create/edit events & careers, view attendees, check people in, review applications.
- **SHASHA staff portal** — `portal.ronation.live/shasha`: Discord-gated VIP list & blacklist, searchable, with roles/reasons and a full change history.
- **Marketing pages** — Home, About (with a ticketing explainer), Contact + FAQ.
- **Design** — dark, Live-Nation-inspired: big condensed type, event ticker, ticket-stub cards. No AI-template smell.

---

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

**Admin:** go to `/admin`, sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

---

## Deploy on a VPS with Docker

1. Copy the project to your server and create your `.env`:

   ```bash
   cp .env.example .env
   ```

2. Set at least these in `.env` (compose reads this file automatically):

   ```env
   NEXT_PUBLIC_SITE_URL="https://your-domain.com"
   AUTH_SECRET="<openssl rand -base64 48>"
   ADMIN_USERNAME="you"
   ADMIN_PASSWORD="<a strong password>"
   GAME_API_KEY="<openssl rand -hex 32>"
   POSTGRES_PASSWORD="<a strong db password>"
   ALLOW_DEV_LOGIN="false"
   # add ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET when ready (see below)
   ```

3. Build and run:

   ```bash
   docker compose up -d --build
   ```

   On first boot the web container creates the database schema and seeds demo
   content automatically. The app listens on port **3000** (change with
   `WEB_PORT`).

4. Put it behind HTTPS. Point a reverse proxy (Caddy, Nginx, or Traefik) at
   `http://127.0.0.1:3000`. Roblox OAuth **requires HTTPS** on your public URL.

   Minimal **Caddy** example:

   ```
   your-domain.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```

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

Point a `portal` record at the same server as the main site — it's the same app
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

Access is **allowlist-only** — a valid Discord login is not enough. Turn on
Developer Mode in Discord, right-click a user → **Copy User ID**:

```env
DISCORD_CLIENT_ID="..."
DISCORD_CLIENT_SECRET="..."
DISCORD_MANAGER_IDS="1103...,2204..."   # can add / edit / remove people
DISCORD_STAFF_IDS="3305..."             # can sign in and search only
```

Then `docker compose up -d`. Set at least one manager or nobody can get in.

Access level is re-read from these variables on **every request**, so removing
an ID revokes that person immediately — no waiting for a session to expire.

### Using it

| Page                | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `/shasha`           | Search both lists at once — username, Roblox ID, role or reason |
| `/shasha/vip`       | The VIP list: add/edit/remove, with roles + a reason            |
| `/shasha/blacklist` | The blacklist: same, with tags + a reason                       |
| `/shasha/audit`     | Who changed what, when, and why                                 |

When adding someone you pick their account from a **live Roblox search**, and the
server re-resolves the user ID before saving — so entries can't be pinned to a
typo, and they survive the player renaming themselves. Roles/tags are free-form
(max 8 per person); a reason is always required.

---

## Swapping the placeholders

Everything marked "placeholder" is designed to be replaced:

- **Event thumbnails** — drop images in `public/` and set the *Thumbnail image URL*
  when editing an event (e.g. `/my-show.jpg`), or paste any full URL. The demo art
  lives in `public/placeholders/`.
- **Favicon** — replace `src/app/icon.svg`.
- **Logo mark** — the wordmark is code in `src/components/logo.tsx`; a static
  version is at `public/brand/logo.svg`.
- **Socials / group links / email** — edit `src/lib/site.ts`.
- **Homepage stats & copy** — `src/app/page.tsx`.

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
    shasha/                  # SHASHA staff portal — VIP list, blacklist, history (portal.* subdomain)
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

## Notes

- Times entered in the admin use the **server's timezone**. Set `TZ` in `.env`
  (e.g. `TZ="Europe/London"`) so dates display as you expect.
- This site is not affiliated with or endorsed by Roblox Corporation.
```
