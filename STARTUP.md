# Startup guide — RO. Nation LIVE

Zero to running, then zero to live. Follow it top to bottom the first time.

There are two things in this repo, and they run from **one app, one container**:

- the **public site** — `ronation.live` (events, careers, tickets)
- the **SHASHA staff portal** — `portal.ronation.live/shasha` (VIP list, blacklist)

| Part                    | Where              | Who gets in                             |
| ----------------------- | ------------------ | --------------------------------------- |
| Public site             | `/`                | Anyone                                  |
| Ticketing / account     | `/tickets`         | Anyone, signs in with **Roblox**        |
| Admin dashboard         | `/admin`           | Username + password from `.env`         |
| SHASHA portal           | `/shasha`          | **Discord** login + allowlisted user ID |

---

## Part 1 — Run it on your machine

### What you need

- **Node 20+** — <https://nodejs.org>
- **Docker Desktop** — <https://www.docker.com/products/docker-desktop> (used for the database)

Check both are alive:

```bash
node -v
docker ps
```

### 1. Install

```bash
npm install
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Nothing needs filling in yet — the defaults are enough to boot. You'll add the
Discord keys in Part 2.

### 3. Start the database

```bash
docker compose up -d db
```

This runs Postgres in the background on port **5433** (matching `DATABASE_URL` in
`.env`). It keeps its data in a Docker volume, so it survives restarts.

> Start `db` specifically, not the whole stack. `docker compose up -d` on its own
> would also start Caddy, which exists to fetch real HTTPS certificates for
> `ronation.live` — pointless on your laptop, since that name doesn't resolve to
> it. Locally you run the app with `npm run dev` over plain http instead.

### 4. Create the tables + demo content

```bash
npm run db:push   # builds every table from prisma/schema.prisma
npm run seed      # adds demo events and careers (skips if events already exist)
```

### 5. Go

```bash
npm run dev
```

Open <http://localhost:3000>. Locally, **both** the site and the portal are served
from the same address, so:

- Site → <http://localhost:3000>
- Admin → <http://localhost:3000/admin> (log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`)
- Portal → <http://localhost:3000/shasha> (needs Part 2 first)
- Health → <http://localhost:3000/api/health> → `{"ok":true,"db":"up"}`

Stop the server with `Ctrl+C`. Stop the database with `docker compose stop db`.

> **Roblox sign-in is optional locally.** With `ALLOW_DEV_LOGIN="true"` and no
> Roblox keys set, a mock login stands in so you can click through ticketing.
> Set it to `"false"` in production.

---

## Part 2 — Turn on the SHASHA portal

The portal is Discord-gated and **allowlist-only**: a valid Discord login is not
enough on its own. You have to do this once, even for local development.

### 1. Create a Discord app

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. Open **OAuth2** in the sidebar.
3. Under **Redirects**, click *Add Redirect* and paste — exactly, no trailing slash:

   ```text
   https://portal.ronation.live/api/auth/discord/callback
   ```

   Add a second one for local development:

   ```text
   http://localhost:3000/api/auth/discord/callback
   ```

4. **Save Changes.**
5. Copy the **Client ID**, and hit *Reset Secret* to get the **Client Secret**.

### 2. Find your Discord user ID

In Discord: **Settings → Advanced → Developer Mode: on**. Then right-click your
own name anywhere → **Copy User ID**. It's a long number like `196374471...`.

Do this for everyone who needs access.

### 3. Fill in `.env`

```env
DISCORD_CLIENT_ID="your-client-id"
DISCORD_CLIENT_SECRET="your-client-secret"

# Can add / edit / remove people. Comma-separated.
DISCORD_MANAGER_IDS="your-discord-id,another-managers-id"

# Can sign in and search, but change nothing. Optional.
DISCORD_STAFF_IDS="someone-elses-id"
```

**Put your own ID in `DISCORD_MANAGER_IDS` or you will not be able to get in.**

Restart the dev server (`Ctrl+C`, then `npm run dev`) and open
<http://localhost:3000/shasha>.

### 4. Managing access later

Access is re-checked from these variables on **every single request**. Delete
someone's ID and they lose access immediately — no waiting for a session to
expire. Edit `.env`, then `docker compose up -d` on the server to apply it.

---

## Part 3 — Using the portal

| Page                | What it's for                                                     |
| ------------------- | ----------------------------------------------------------------- |
| `/shasha`           | Search **both** lists at once — username, Roblox ID, role, reason |
| `/shasha/vip`       | The VIP list — add, edit, remove                                   |
| `/shasha/blacklist` | The blacklist — same                                               |
| `/shasha/audit`     | Who changed what, when, and why                                    |

**Adding someone:** start typing a Roblox username (or paste a user ID) in the
add form and pick the right account from the live search results. Give them any
roles/tags you like — they're free-form, up to 8 — and a reason, which is
required and is kept in the history log.

The server re-checks the Roblox account against Roblox before saving, so an entry
can never be pinned to a typo, and it keeps working if the player renames
themselves.

Read-only staff see the lists and the search, but no add form and no
edit/remove buttons.

---

## Part 4 — Deploy it live

### 1. DNS

Point **both** records at your server's IP:

```text
ronation.live.          A   <your server IP>
portal.ronation.live.   A   <your server IP>
```

Same server, same container — the portal is not a separate deployment. The app
works out which one you're on from the hostname: `portal.*` serves the staff
portal, anything else serves the public site.

### 2. Get the code onto the server

```bash
git clone <your repo> ronation
cd ronation
cp .env.example .env
```

### 3. Fill in `.env` — the production version

Generate real secrets (don't reuse the dev ones):

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32      # GAME_API_KEY
```

```env
NEXT_PUBLIC_SITE_URL="https://ronation.live"
AUTH_SECRET="<the base64 string>"

ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<something long>"

POSTGRES_PASSWORD="<something long>"

ROBLOX_CLIENT_ID="..."          # from create.roblox.com/dashboard/credentials
ROBLOX_CLIENT_SECRET="..."
GAME_API_KEY="<the hex string>"

DISCORD_CLIENT_ID="..."         # from Part 2
DISCORD_CLIENT_SECRET="..."
DISCORD_MANAGER_IDS="..."

ALLOW_DEV_LOGIN="false"         # important
```

### 4. Start it

```bash
docker compose up -d --build
```

On boot the container creates any missing database tables and seeds starter
content automatically, so there is no separate migration step. **This is also how
you ship a schema change** — pull, `docker compose up -d --build`, done.

> **Don't run `npm` commands on the server.** `npm run db:push`, `npm run seed`
> and `npm run dev` are for your own machine. On the server everything happens
> inside the container, which reaches the database at `db:5432` on Docker's
> internal network. Running Prisma from the host will try `localhost` and fail
> with `P1001`, even though the app is perfectly healthy.

Check it came up:

```bash
docker compose ps
curl localhost:3000/api/health     # → {"ok":true,"db":"up"}
docker compose logs -f web         # live logs, Ctrl+C to detach
```

### 5. Check the database isn't exposed

Postgres should only be reachable from the server itself. Confirm:

```bash
docker compose ps
```

The `db` line must show `127.0.0.1:5433->5432/tcp`. If it shows `0.0.0.0:5433`,
you're running an old `docker-compose.override.yml` and **Postgres is open to the
internet** — published Docker ports bypass `ufw`. Pull the latest code and run
`docker compose up -d` to rebind it, then set a real `POSTGRES_PASSWORD` in `.env`.

### 6. HTTPS — it's already done

There's a **Caddy** container in `docker-compose.yml`. It gets Let's Encrypt
certificates for both hostnames on first boot, renews them on its own, and
redirects `http://` to `https://`. No certbot, no cron job, no renewal script.

You only need three things to be true:

**a. Both names point at this server.** You've done this — verify with
`dig +short ronation.live` and `dig +short portal.ronation.live`; both should
print the server's IP.

**b. Ports 80 and 443 are open and free.** Certificate issuance uses port 80, so
it can't be blocked or already taken:

```bash
sudo ss -tlnp | grep -E ':80 |:443 '   # must be empty (or already caddy)
sudo ufw allow 80,443/tcp              # if ufw is on
```

If nginx or Apache is already sitting on port 80, Caddy can't start — stop it
first (`sudo systemctl disable --now nginx`).

**c. Your hostnames are in `.env`:**

```env
SITE_HOST="ronation.live"
PORTAL_HOST="portal.ronation.live"
ACME_EMAIL="you@example.com"     # where expiry warnings go
```

Then bring it up and watch the certificates get issued:

```bash
docker compose up -d --build
docker compose logs -f caddy     # look for "certificate obtained successfully"
```

First issuance takes a few seconds per hostname. If it fails, Caddy retries with
a backoff — read the log, fix the cause (almost always DNS or a blocked port 80),
and it'll pick itself up.

> **Don't wipe the `caddy-data` volume.** Your certificates live there. Let's
> Encrypt rate-limits issuance to 5 per domain per week, so repeatedly destroying
> it will lock you out of new certs for days.

### 7. Register the real redirect URLs

Go back to the Discord app (Part 2) and make sure
`https://portal.ronation.live/api/auth/discord/callback` is in the Redirects list.
Do the same for Roblox: its redirect is
`https://ronation.live/api/auth/roblox/callback`.

### 8. Smoke test

- <https://ronation.live> loads, with a valid padlock
- `http://ronation.live` redirects itself to https
- <https://ronation.live/admin> logs in
- <https://portal.ronation.live> lands you on `/shasha`, and Discord sign-in works
- <https://ronation.live/shasha> bounces you to the portal
- Add a test VIP, confirm it shows in `/shasha/audit`, then remove them

---

## Everyday commands

```bash
docker compose up -d --build      # deploy a change
docker compose logs -f web        # watch the logs
docker compose restart web        # restart after an .env change
docker compose down               # stop everything (data is kept)

npm run dev                       # local dev server
npm run db:push                   # apply schema changes to the database
npm run build                     # check it compiles before you deploy
```

### Back up the database

```bash
docker compose exec db pg_dump -U ronation ronation > backup-$(date +%F).sql
```

---

## When something breaks

**`Can't reach database server at localhost:5433` (P1001)**
The database isn't running. `docker compose up -d db`, wait a few seconds, retry.
Confirm it's up and which port it's on with `docker ps` — you want to see
`0.0.0.0:5433->5432/tcp`.

**`Can't reach database server at localhost:5432` (P1001) — note the 5432**
Nothing listens on 5432; the database publishes on **5433**. Either:

- **You ran `npm run db:push` on the server.** Don't — the container applies the
  schema itself. Use `docker compose up -d --build` instead. (Host Prisma reads
  `.env` and dials `localhost`; the app dials `db:5432` internally and is fine.)

- **Your `.env` says `5432`.** Older copies of `.env.example` had this wrong. On
  your own machine, fix the line to read:

  ```env
  DATABASE_URL="postgresql://ronation:ronation@localhost:5433/ronation?schema=public"
  ```

**Caddy won't start: "address already in use"**
Something else owns port 80 or 443 — usually a system nginx or Apache. Find it
with `sudo ss -tlnp | grep -E ':80 |:443 '` and stop it
(`sudo systemctl disable --now nginx`), then `docker compose up -d`.

**No certificate / browser warns the site is insecure**
Read `docker compose logs caddy`. The usual causes, in order of likelihood:

- DNS doesn't point here yet (`dig +short ronation.live` — is that this server?)
- Port 80 is blocked upstream (cloud firewall, `ufw`), so the ACME challenge
  can't complete. Certificate issuance needs **80**, not just 443.
- You're hitting the server by IP rather than by hostname — certificates are
  issued per name, so use the domain.

**Certificates stopped renewing / rate-limit errors**
Renewal is automatic at ~30 days remaining. If you see "too many certificates
already issued", you've re-issued more than 5 times in a week — most often by
deleting the `caddy-data` volume. Wait it out; the existing cert keeps working.

**Portal says "That Discord account isn't on the SHASHA access list"**
The Discord ID you signed in with isn't in `DISCORD_MANAGER_IDS` or
`DISCORD_STAFF_IDS`. Copy the ID again (Developer Mode → right-click → Copy User
ID) — it's a long number, not your username. Then `docker compose up -d` to apply.

**Portal login page warns "No managers are configured yet"**
`DISCORD_MANAGER_IDS` is empty. Nobody can get in until you set it.

**Discord says "Invalid OAuth2 redirect_uri"**
The URL in the Discord dashboard doesn't match byte-for-byte. Check for `http`
vs `https`, a trailing slash, or `www.`.

**`portal.ronation.live` shows the public site**
DNS hasn't propagated, or your reverse proxy isn't routing the subdomain to port
3000. Confirm with `curl -H "Host: portal.ronation.live" localhost:3000/shasha` —
it should redirect to `/shasha/login`.

**Everything on the portal bounces to the main site**
The hostname has to *start with* `portal.` — that's what the app keys off.

**Changed `.env` and nothing happened**
Environment variables are read at container start. `docker compose up -d`.
