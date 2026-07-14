# Robux payments + Ticketmaster-style seating — build state

Working notes for picking this up on another machine. Written 2026-07-14.

Plan this implements: `~/.claude/plans/plan-a-a-way-crispy-metcalfe.md` (laptop only — the
substance is reproduced below, so you don't need it).

---

## Where it stands

| Phase | State |
|---|---|
| **0 — schema + pure venue libs** | ✅ done, verified (34 checks) |
| **1 — the ticketing authority** | ✅ done, verified against real Postgres (43 checks + a 40-way race) |
| **2 — the venue designer** | 🚧 **in progress** — company side written, partner mirror + event-form wiring left |
| **3 — seat picker (free tickets)** | ⬜ not started — *this is the milestone* |
| **4 — Game Pass rail** | ⬜ lib is written; consent route + checkout UI left |
| **5 — Game API (the hub)** | ⬜ not started |
| **6 — door + stub show the seat** | ⬜ not started |

`npx tsc --noEmit` passes clean at every commit. Do not break that.

---

## The five things that must stay true

These were found by reading the code, and four of them changed the design. If you forget
one, you reintroduce a real bug.

1. **Cancelling a ticket MUST null `seatKey` and `sectionKey`.**
   `@@unique([eventId, seatKey])` binds **cancelled rows too** — Postgres can't express
   "unique among live tickets" without a partial index, and `prisma db push` (which runs on
   every boot) silently drops those. Verified: the index really is a plain
   `tickets_eventId_seatKey_key` btree with no `WHERE`.
   So a cancelled row that keeps its `seatKey` **owns that chair forever** — unsellable,
   rendering as taken, nobody in it, nothing on screen to explain why.
   **Two writers, both must do it:** `voidTicket()` in `src/lib/tickets/issue.ts`, and
   `cancelTicket()` in `src/app/actions/tickets.ts`.
   `seatLabel` is deliberately **kept** — the stub still says where they were.

2. **A game pass cannot be gifted.** Roblox has no mechanism; the pass lands in the
   *buyer's* inventory, so our ownership check would ask about the wrong person.
   `PurchaseIntent` carries both `userId` (payer) and `beneficiaryUserId`, and
   `createPurchaseIntent()` refuses `beneficiary !== payer` on the `GAME_PASS` rail. That
   one refusal is the whole rule. **Paid gifting is a Dev Product, bought in-experience.**

3. **`settleExisting()` in `issue.ts` re-reads the ticket.** The old replay short-circuit
   handed back `settled.ticketId` without checking it was alive. Nearly harmless on the
   Dev Product rail; **routine** on the game-pass rail, because the idempotency key is
   `gp:<passId>:<robloxId>` and a pass is owned *forever* — so anyone who cancels and comes
   back always hits that branch and gets handed their dead ticket, with no way out (Roblox
   won't sell them the pass twice). It now restores the cancelled ticket instead, without
   writing a second payment row (`skipPurchaseRow`).

4. **`gp:<passId>:<robloxId>` as `TicketPurchase.purchaseId` is the key design move.**
   It rides the *existing* unique constraint, so retry-safety, double-claim protection and
   the payment ledger all come free. Keying on the intent token instead would let one person
   mint fresh intents and re-"pay" with the same pass forever.

5. **The surface picks the rail, not the tier.** `TicketTier` has **both** `gamePassId`
   (web, `@unique`) and `devProductId` (in-experience, *not* unique — a product is a
   payment, not a possession). A priced tier with neither is unsellable → warn.
   `gamePassId` is `@unique` because a pass is owned forever: paste last month's onto this
   month's VIP and every one of last month's buyers walks in free, **verified**.

Two more, smaller:

- **`cssColor()` is the wrong tool for the map.** It exists in `ticket-download.tsx` because
  *canvas* can't read CSS custom properties. **SVG can** — `fill="rgb(var(--seat-free-rgb))"`
  works natively and server-renders. Never hardcode hex; it breaks partner theming.
- **`src/lib/merch/price.ts` is a formatter, not the economy reader**, and `assetDetails()`
  in `merch/roblox.ts` hits `economy.roblox.com/v2/assets/…` which answers for **catalog
  assets — a game pass is not one**. `src/lib/roblox-gamepass.ts` uses
  `apis.roblox.com/game-passes/v1/game-passes/{id}/product-info`. Reuse the *shape* of
  `DetailResult`, never that function.

---

## Done and verified

### Phase 0 — schema + pure libs

`prisma/schema.prisma`
- `User` → `robloxAccessToken/RefreshToken/TokenExpires/Scopes` (the incremental OAuth grant)
- `TicketTier` → `gamePassId @unique`, `devProductId`
- `Ticket` → `seatKey`, `sectionKey`, `seatLabel`, `@@unique([eventId, seatKey])`
- `Event` → `seatMode` (NONE|SECTION|SEAT), `venueMapId`, **`placeId`** (it only had `placeUrl`)
- **`VenueMap`** (TEMPLATE|EVENT, `layout Json`), **`PurchaseIntent`** (the hold; `rail` is
  nullable because a *free* seated ticket still needs a hold)

Pure libs (no prisma, no DOM — shared by client and server, same discipline as `pricing.ts`):
- `src/lib/venue/schema.ts` — zod for the layout. Section keys are `[A-Z0-9]{1,8}` **so a
  seat key can be a plain string** (`"A1-K12"`) split on the hyphen, with no parser and no
  escaping anywhere.
- `src/lib/venue/seats.ts` — **`sectionSeats()` is THE function**. The SVG grid and the
  server's allocator both call it, so they physically cannot disagree about which seats
  exist. Also `bestAvailableOrder()`: **section order → row → seat**, where section order is
  the **array order in `layout.shapes`** = the layers list a human dragged. Deliberately NOT
  derived from geometry — "closest to stage" would offer the front row of the side block over
  the middle of the good block, and no formula that's never been to a gig will work out why.
- `src/lib/venue/anchor.ts` — one anchor per **map** (not per shape), ~12 lines. Six
  hand-typed floats per section in a 2D editor *will* be wrong, silently.
- `src/lib/venue/colors.ts` — CSS var references only.

Also: `pricing.ts` (+`gamePassId`/`devProductId`, `railsFor`, `isUnsellable`,
`gamePassSalesAllowed`), `env.ts` (+`robuxGamePass` — a **third** key, because the game-pass
rail needs the OAuth app to carry the inventory scope, which the other two switches can't
see; get it wrong and a buyer pays and we can't verify), `globals.css` (seat/tier channels).

### Phase 1 — the authority

- `src/lib/tickets/seating.ts` — **`resolveSeat()`, the only allocator.** Runs inside the
  caller's transaction, under the event row lock. Takes `ignoreIntentId` (their own hold must
  not block them — *the easiest way to get this wrong*) and `ignoreTicketId` (their own GA
  ticket must not block their VIP upgrade seat).
  **It does NOT filter on ticket status** — because the unique index doesn't. `seatKey` is
  non-null **iff** the ticket holds the seat. Filtering on status would hand out a seat the
  INSERT then bounces, and the retry would loop.
- `src/lib/tickets/intents.ts` — `createPurchaseIntent()` (same event row lock; kills the
  caller's other PENDING hold, so changing your mind about a seat doesn't leave you holding
  both), `seatAvailability()` (**deliberately unlocked** — it runs on every page view of a hot
  show; slightly stale is correct, and the lock + unique index downstream make staleness safe),
  `releaseIntent()`, `findIntent()`. No cron: expired holds just stop counting, and are swept
  opportunistically.
- `src/lib/tickets/issue.ts` — the surgery. New reasons (`bad_intent`, `not_paid`,
  `verify_unavailable`, `needs_consent`, `seat_taken`), new `game_pass` mode carrying **a token
  and nothing else** (pass id, price, seat and buyer are all re-read from the DB — a caller who
  could *name* the pass could name one they already own).
  **`ownsGamePass()` runs OUTSIDE the transaction** and must never move inside: the lock
  serialises every issue for the event at ~10ms each (~100/sec); an HTTP round trip to Roblox
  is 200–800ms, which would drop a sold-out show to **three tickets a second** on the one night
  it matters.
  **An expired hold is not a refusal** — it costs them the seat they picked, not the ticket
  they paid for. Fallback to best-available in the same tier; only `seat_taken` (whole tier
  full) is a refund case.
- `verify.ts` — `VerifyResult.ticket.seat`. One extra query, **only** when `seatKey` is
  non-null, so unseated shows are byte-for-byte as cheap as before. `label` is frozen (off the
  ticket); `world` is live (off the event's current map) — if the venue is re-anchored, the new
  position is the right one.
- `src/lib/roblox-gamepass.ts` — `ownsGamePass()` / `gamePassDetails()` / `gamePassPurchaseId()`.
  **Three-state result is not optional**: "they don't own it" and "we couldn't ask" are the same
  falsy value and completely different facts. Collapsing them tells someone who just spent
  500 R$ that they didn't pay. (Same lesson `merch/roblox.ts` documents having shipped once.)
- `src/lib/roblox-tokens.ts` — `accessTokenFor()`. **Roblox refresh tokens ROTATE**, so the
  refresh is a **compare-and-swap** (`updateMany where robloxRefreshToken = <the one we read>`;
  on `count === 0`, take the winner's). Two polling tabs would otherwise permanently kill the
  grant. Only refreshes within 60s of expiry.
- `roblox.ts` — `BASE_SCOPES` vs `INVENTORY_SCOPES`. **`offline_access` is what makes Roblox
  issue a refresh token at all** — leave it out and the grant dies in 15 minutes and the rail is
  unusable, hours later.

---

## Phase 2 — the designer (IN PROGRESS)

**Written:**
- `src/lib/venue/form.ts` — `readVenueForm()` (**`null` = "couldn't read it", never
  `emptyLayout()`** — that default would wipe a sold show's map and put the room back on sale
  over the top of the people already sitting in it), `saveVenueLayout()` **with the sold-seat
  guard** (refuses an edit that would strand a live ticket, and names the seats),
  `cloneTemplateOnto()` (**clears `tierId` on every section** — a template's tier ids belong to
  another show), `venueTemplates()`, `venueMapFor()`.
- `src/components/venue/venue-map.tsx` — the SVG renderer, **shared by designer + picker +
  stub**. Only mounts a section's seats when that section is **focused** (20 polygons at
  overview, ~200 circles zoomed — that one rule is the difference between smooth and janky at
  2,000 seats).
- `src/components/venue/venue-designer.tsx` — draft in `useState` → **one hidden JSON input** →
  server action → zod. Same pattern as `survey-builder.tsx` / `tier-editor.tsx`. Undo/redo is a
  stack of whole layouts (cheap *because* the draft is one serialisable object — don't make it
  granular).
- `src/components/venue/shape-inspector.tsx`
- `src/app/actions/venue.ts` — two exports per op, one guard each, one lib underneath. *Nobody
  borrows anybody else's permission.*
- `src/app/company/(dash)/venues/{page,new/page,[id]/edit/page}.tsx`
- `src/app/company/(dash)/events/[id]/venue/page.tsx`
- `tiers-form.ts` — `gamePassId`/`devProductId` (**`"" → null`**, because `@unique` treats empty
  strings as equal but NULLs as distinct), and `syncEventTiers` now returns
  `SyncTiersResult` so a duplicate pass id is a sentence, not a 500. Both callers updated.

**Left to do:**

1. **Partner mirror** of the venue routes:
   `src/app/pp/[slug]/(portal)/studio/venues/{page,new/page,[id]/edit/page}.tsx` and
   `.../studio/events/[id]/venue/page.tsx`. Copy the company ones; swap
   `requireCompanyUser()` → `requirePartnerManager(slug)` and `saveCompanyVenue` →
   `savePartnerVenue`, pass `scope={slug}`. Note `PartnerUser` **is** the session (spread), so
   it's `user.partner`, not `{ partner, user }`.
2. **`event-form.tsx`** gains `seatMode` (select) and `placeId` (text). `readEventForm()` in
   `src/lib/content.ts` must read both, or the designer is drawn and nobody is ever offered a
   seat off it.
3. **Nav**: add "Venues" to `src/components/company-nav.tsx` (under "The shows") and the
   partner studio nav.
4. **Drag-to-move / resize** an existing shape. Right now you can draw, select, edit numerically
   and reorder, but not drag a drawn block around. Add pointer-drag on the select layer in
   `venue-designer.tsx` (the repo's only drag precedent is `src/components/shop/rail.tsx`).
5. **Polygon + ellipse tools** — `schema.ts` and `venue-map.tsx` fully support both; the
   *designer* currently only draws rects. Polygon = click points, Enter/dbl-click to close.

---

## Phase 3 — the seat picker  ← **do this next, it's the milestone**

**Ship seating on FREE tickets before any money moves.** A free seated ticket still needs a
hold, so this exercises the entire new machine — intent creation under the lock, allocation,
expiry, best-available fallback, the countdown — at real concurrency with **zero refund risk**.
Build Robux first and the day you discover the hold logic races is the day someone has paid.

- `src/app/events/[slug]/seats/page.tsx` + `src/app/p/[slug]/events/[event]/seats/page.tsx`.
  Sits between reserve and checkout. **Skipped entirely when `seatMode === NONE`**, so every
  existing show is untouched.
- `src/components/venue/seat-picker.tsx` — **the Ticketmaster surface.** Two-pane: `<VenueMap>`
  left (hover-highlight, dim non-matching, click a section to zoom in and reveal the grid),
  price/tier legend + sorted available-section list right, bidirectional hover. "Best available"
  must call the same `bestAvailableOrder()` the server uses, or the button promises a seat the
  server won't give.
- `src/components/venue/hold-bar.tsx` — sticky selection bar + countdown to `expiresAt`. Reuse
  `src/components/countdown.tsx` (takes a `target` Date).
- `src/app/actions/purchase.ts` — `createIntent`, `releaseHold`.
- `checkout/page.tsx` takes `?intent=<token>`, re-validated server-side (*the query string is
  not evidence* — that file already says so).
- `checkout-processing.tsx` passes `intentToken` through to `reserveTicket`. **The action
  already accepts it** (`formData.get("intent")`); the staged animation, the promise-in-a-ref
  guard and the hard `location.assign` are all unchanged — that file's own comment predicted
  this.

---

## Phase 4 — the Game Pass rail

Lib is done (`roblox-gamepass.ts`, `roblox-tokens.ts`, `roblox.ts` scopes). Left:

- `src/app/api/auth/roblox/consent/route.ts` — kick off **incremental consent** from any host.
  Default sign-in stays `openid profile`, so free-ticket users never see an extra permission;
  a paid game-pass checkout asks for `user.inventory-item:read offline_access`.
  It must run through `sso.ts` on `authorise.ronation.live` (the only registered redirect) and
  must **force** the Roblox round trip even when a session exists — a session proves who they
  are, not what they consented to.
- `src/app/api/auth/roblox/{login,callback}/route.ts` — carry a `grant` param; the callback
  calls `saveGrant()`.
- `src/components/ticket/gamepass-checkout.tsx` — create intent → `window.open(gamePassUrl(id))`
  (fall back to a link if the popup is blocked) → poll on an interval **and on
  `visibilitychange`** (them coming back to our tab *is* the signal).
  **Roblox's inventory lags a purchase by seconds**: poll us every 2s, ask Roblox at most every
  4s (guarded by `PurchaseIntent.checkedAt`, in the DB so a refresh can't reset it), and after
  ~2 min stop auto-polling and show a manual "I've paid — check again".
  **Never say "payment failed"** — say "waiting for Roblox". `not_paid` is not a failure.
- `tier-editor.tsx` — `gamePassId` + `devProductId` fields (**the form already posts them**) and
  a **Verify pass** button → `gamePassDetails()` → warn on price mismatch, `forSale === false`,
  and "already on another tier".

---

## Phase 5 — the Game API (your self-serve ticket hub)

**The hub is an API, not a page.** You already have a walk-up booth against `/api/v1`; the goal
is an API complete enough to build an in-experience hub against **without RNL writing any Luau
for you.** What's missing today:

| The booth must… | Today |
|---|---|
| List shows / tiers / prices | ✅ |
| Render a seat map **in 3D** | ❌ needs `layout` + world anchor |
| Know which seats are gone, live | ❌ **missing** |
| **Hold** a seat while the player decides | ❌ **missing — without this two booths sell the same chair** |
| Know **which product to prompt** | ❌ needs `devProductId` (now on the tier) |
| Know what the player already holds | ❌ no by-player lookup |
| Settle the receipt | ✅ |

New endpoints:
- `GET /api/v1/events/[id]/seats` — live availability. **Must be cheap** (a booth polls it):
  compact form, **ETag + `If-None-Match`** so an idle booth costs a 304.
- `POST /api/v1/intents` — *the missing primitive.* Scope **`INTENTS_WRITE`** (a new scope — do
  **not** overload `TICKETS_PURCHASE`, whose whole warning is that it can assert payment;
  holding a seat cannot). Body `{robloxId, eventId, tierId, seatKey?}` → `{token, expiresAt,
  priceRobux, devProductId, seatLabel}`. The game then calls `PromptProductPurchase`.
- `DELETE /api/v1/intents/[token]` — release on a dismissed prompt
  (`PromptProductPurchaseFinished` with `wasPurchased == false`).
- `GET /api/v1/intents/[token]` — resolve a `launchData` token, so a buy that started on the web
  finishes in-game.
- `GET /api/v1/players/[robloxId]/tickets?eventId=` — "you have GA — upgrade to VIP?"

Changed:
- `GET /api/v1/events/[id]` — `seatMode`, `sections[]`, per-tier product ids, and the full
  `layout` **behind `?include=venue`** (a lobby board polling every 10s doesn't need 40KB of
  polygons).
- `POST /api/v1/tickets/purchase` — accepts `intentToken`; **REQUIRED when `seatMode !== NONE`**
  (you cannot sell a numbered seat on the word of a game server with no idea which seat).
  Stays optional for unseated shows, so today's booth keeps working untouched.

`public/llm.txt` is the real contract — it gets the two rails, the intent lifecycle,
`GetJoinData().LaunchData`, the world anchor, and a **complete walk-up booth recipe in Luau**.

**Not blocked, not built:** opening RNL to outside organisers needs partners to become a **DB
table** (`registry.ts` is code *on purpose* — middleware runs on the edge where Prisma can't
reach). Everything new here is `partnerId`-scoped from day one with scope as a required
argument, so nothing makes that day harder.

---

## Phase 6 — the door

**No new server code.** The seat rides in the standard `ticketEnvelope`, so `/verify` and
`/redeem` already carry it. Just surface it in `door-check.tsx` and on the ticket stub.

---

## How to verify (no Docker needed)

**This laptop can't run Docker** — `wsl --list` shows **no distributions installed**, so Docker
Desktop's Linux engine can never start. That's the real cause, if you hit it again. Your desktop
may be fine; if so just use `docker compose up db`.

Otherwise, a real Postgres with no Docker, no WSL, no admin:

```bash
cd <scratch dir>
npm install embedded-postgres
node -e "const P=require('embedded-postgres');const p=new P.default({databaseDir:'./pgdata',user:'rnl',password:'rnl',port:55432,persistent:true});(async()=>{await p.initialise();await p.start();await p.createDatabase('rnl');})()"
```

Then, from the repo:

```bash
export DATABASE_URL="postgresql://rnl:rnl@127.0.0.1:55432/rnl"
npx prisma db push && npx prisma generate
npx tsc --noEmit
```

The two check scripts I drove Phase 0/1 with are in the scratchpad (they'll be gone on the
desktop — rewrite or ignore). What they assert, and what any replacement must:

1. **The bricking bug** — reserve a seat, cancel, re-reserve **the same seat**. Must succeed. If
   `seatKey` wasn't nulled it fails on the unique index, which is exactly the failure the test
   exists to catch.
2. **The race** — 40 buyers, 20 chairs, `Promise.all`. Exactly 20 tickets, **no chair sold
   twice**, the other 20 get `seat_taken`. Then have all 40 demand the *same* seat: exactly one
   gets it, the rest are **routed elsewhere, not refused**.
3. **Expired hold** — expire it, let someone else take the chair, then claim. They must still get
   a ticket, on a *different* seat.
4. **Own-hold / own-ticket** — hold a seat then buy it (mustn't block itself); hold GA then
   upgrade to VIP (must get a VIP *chair*, not collide with your own GA seat).
5. **Replay** — same `purchaseId` twice → same ticket, **one** payment row. Then cancel and
   re-claim → ticket restored, still one payment row.
6. **Regression** — an unseated show must be byte-identically unaffected: no seat, `seat: null`
   at the door, many tickets coexisting with `NULL seatKey`.

All of the above passed on 2026-07-14.

---

## Env vars you'll need

```
DATABASE_URL=postgresql://…
AUTH_SECRET=…
ROBUX_TICKETS_ENABLED=false     # master switch
ROBUX_GAMEPASS_ENABLED=false    # the THIRD key — see env.ts. Needs the OAuth app to
                                # carry user.inventory-item:read + offline_access, or a
                                # buyer pays and we cannot verify.
```

There is **no `.env`** in this checkout — copy `.env.example`.

---

## Note on the git corruption (2026-07-14)

`refs/heads/main` and `refs/remotes/origin/main` were found blanked — **41 bytes of
whitespace instead of a SHA** — so `git log` said *"your current branch appears to be broken"*
and every file looked newly-added. Classic interrupted-write corruption.

**Nothing was lost.** Every object was intact; only the ref files were damaged. Recovered from
the reflog: `refs/heads/main` → `55fded1` ("rw"), `origin/main` → `20c1607`. `git fsck` is now
clean apart from one harmless dangling commit.

The old (corrupt) refs are backed up in the session scratchpad, but they contain nothing —
they're literally blank. If it happens again, `.git/logs/HEAD` is the thing that saves you.

One nit: **`tsconfig.tsbuildinfo` is tracked** and churns on every build. Consider gitignoring it.
