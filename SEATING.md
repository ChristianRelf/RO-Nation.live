# Robux payments + Ticketmaster-style seating — build state

Working notes. Written 2026-07-14. **All six phases are built.**

Plan this implements: `~/.claude/plans/plan-a-a-way-crispy-metcalfe.md` (laptop only — the
substance is reproduced below, so you don't need it).

---

## Where it stands

| Phase | State |
|---|---|
| **0 — schema + pure venue libs** | ✅ done, verified (34 checks) |
| **1 — the ticketing authority** | ✅ done, verified against real Postgres (43 checks + a 40-way race) |
| **2 — the venue designer** | ✅ done, incl. drag/resize + polygon & ellipse tools |
| **3 — seat picker (free tickets)** | ✅ done, verified |
| **4 — Game Pass rail** | ✅ done — consent, checkout, tier verify |
| **5 — Game API (the hub)** | ✅ done, **verified over HTTP against a real server (31 checks)** |
| **6 — door + stub show the seat** | ✅ done |

`npx tsc --noEmit` passes clean and `npx next build` compiles. Do not break either.

**Verified 2026-07-14 against a real Postgres: 22 library checks + 31 HTTP checks, all green.**
That includes a 12-way race on one chair (exactly one winner, no chair sold twice, the losers
routed elsewhere rather than refused).

### What is actually true now

- A promoter can **draw a room**, assign tiers to sections, and put it on a show.
- A buyer can **pick a seat**, hold it for ten minutes, and check out. Free tickets today.
- A buyer can **pay Robux on the web** via a game pass, and we can *prove* they paid.
- A **game server can run its own ticket booth** — hold a seat, prompt a product, settle the
  receipt — without RNL writing a line of Luau for it.
- The **door** says where to sit; the **ticket** says it too, and draws the map.

### The one thing that is switched OFF

`ROBUX_TICKETS_ENABLED` and `ROBUX_GAMEPASS_ENABLED` are both **false**. Everything on the
paid rails is built and refuses to take a penny until both are on (and, for a partner, until
their `robuxTickets` flag is on too — three keys, see `gamePassSalesAllowed`). Free seated
tickets work today with the switches off, which is exactly the order this was meant to ship
in: the entire hold/allocate/expire machine has now run at real concurrency with **zero refund
risk**.

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

**Also written (2026-07-14):**

- **Partner mirror** — `src/app/pp/[slug]/(portal)/studio/venues/{page,new/page,[id]/edit/page}.tsx`
  and `.../studio/events/[id]/venue/page.tsx`. Gated on the **`events` feature** (a partner who
  can't run shows has no use for a room), and scoped to `partner.slug` throughout, so RNL's
  templates and every other partner's 404 rather than render an Edit button that would fail.
- **`event-form.tsx`** — `seatMode` (select) and `placeId` (text). `readEventForm()` reads both.
  `seatMode` is **validated against the enum, not cast to it** (a forged `seatMode=SEATT` would
  otherwise reach Postgres as a bad enum and 500); `placeId` is **digits or nothing** — a pasted
  URL is *not* scraped for an id, because an id guessed out of a tracking query string builds a
  deep link that goes silently nowhere.
- **Nav** — "Venues" in `company-nav.tsx` (under "The shows") and in the partner studio nav.
- **The link into the designer.** `…/events/[id]/venue` existed and *nothing linked to it* — the
  whole feature was a URL you had to already know. Both event edit pages now have the button.

**Two bugs found and fixed while doing it:**

1. **`actions/venue.ts` revalidated the PUBLIC partner path.** `revalidatePath(partnerPortalPath(…))`
   → must be `partnerPortalRoute(…)` (the internal `/pp/<slug>/…` route Next actually renders).
   The public path **matches no route, throws nothing**, and the venue list simply keeps serving
   the layout you just replaced. `lib/partners/urls.ts` warns about exactly this in its header;
   every other partner action gets it right. Fixed in all three partner venue actions.
2. **The Prisma client on this machine was stale** — `venueMap`, `SeatMode` and the Roblox token
   columns were all missing from it, so `tsc` reported ~30 phantom errors. `npx prisma generate`.
   On Windows it fails with `EPERM … query_engine-windows.dll.node` **if a dev server is running**
   — kill it first. That is the whole of that mystery.

**The designer's ergonomics, now done:**

- **Drag to move, drag the corner to resize.** The whole drag is **one** undo entry — committing
  on every `mousemove` would push sixty layouts a second onto the history, and undo would walk
  back through the drag one pixel at a time, which is not undo, it is a replay. So the layout
  before the drag is held in a ref and pushed once, on mouseup.
- **Polygon and ellipse tools.** `schema.ts` and `venue-map.tsx` supported all three geometries
  from the day they were written; only the designer couldn't draw them. It is now **two knobs —
  the kind, and the shape** — rather than eighteen buttons: a curved balcony is a seated section
  drawn as a polygon; a round pit is a standing area drawn as an ellipse. Polygon = click each
  corner, Enter or double-click to close, Esc to abandon. There is a rubber band now, too —
  drawing a block used to be an act of faith.
- `boundsOf()` in the designer was a **hand-copied duplicate** of `bounds()` in `venue/seats.ts` —
  same three cases, same arithmetic, written out twice. It delegates now. Two implementations of
  one fact agree right up until somebody changes one of them, and then the designer's idea of
  where a shape is stops matching the allocator's.

---

## Phase 3 — the seat picker ✅

**Shipped on FREE tickets, before any money moves** — which was the whole point of the ordering.
The entire new machine (holds under the lock, allocation, expiry, best-available fallback, the
countdown) is now exercised at real concurrency with **zero refund risk**.

**The flow, and where the wiring actually lives:**

reserve → **seats** → checkout → ticket

- **`reserve/page.tsx` (both copies) chooses the next step, and that is the ENTIRE routing
  change.** `CheckoutForm` is a plain GET form, so where it points is where "Continue" goes:
  `seatMode === "NONE"` → `/checkout` (every show that exists today, byte-for-byte untouched),
  anything else → `/seats`. The form itself was not modified.
- **`src/lib/venue/picker.ts`** — `seatPickerFor()`, the one place that answers *"is there a seat
  to pick?"*, and it answers it with **resolveSeat's own decision tree**, in resolveSeat's order.
  The picker must be shown **iff** the allocator would give this person a seat, or you get an
  empty map with a dead Continue button (shown when it shouldn't be) or a buyer who is never
  offered a chair (skipped when it shouldn't be). The subtle case is the third one:
  **an unmapped tier skips the map**, because an unmapped tier sells as GA exactly as it does
  today — that's what lets a promoter map two of three tiers and have the third keep working.
  A map that won't *parse* is `broken` → refuse, never "no map, sell it as GA".
- **`seat-picker.tsx`** — the surface. Two-pane, bidirectional hover, click a block to zoom in
  and reveal its chairs (only the focused section mounts seats — the one perf rule).
  **The hold is taken the moment they click a seat, not at Continue.** That is what `intents.ts`
  is built for: its "one live hold per person" rule *cancels* your previous hold rather than
  refusing the new one, precisely so swapping K12 for K13 doesn't leave you holding both.
- **"Best available" sends NO seat key.** SEATING.md used to say it "must call the same
  `bestAvailableOrder()` the server uses" — it does something stronger: it doesn't call it at
  all. `resolveSeat` reads a null seat as "give them the best available" and walks that order
  under the lock, against the live taken set. A client-side copy could only ever be a second
  opinion, and a second opinion eventually disagrees.
- **`hold-bar.tsx`** — sticky bar, mm:ss, `onExpire`. **It does NOT reuse `countdown.tsx`,
  and can't:** that component renders four cells (days/hrs/min/sec) because it counts down to a
  *show*, and when it hits zero it announces **"DOORS ARE OPEN"** — which, on a hold that has
  just expired and taken the buyer's seat with it, means the exact opposite of what happened.
- **`src/app/actions/purchase.ts`** — `createIntent`, `releaseHold`. Neither decides anything;
  neither redirects (a server action's `redirect()` doesn't run the middleware — see the top of
  `actions/tickets.ts`), so they return and the client navigates.
- **`checkout/page.tsx` (both copies)** — takes `?intent=`, and **requires one when there is a
  seat to be had** (you cannot sell a numbered chair to somebody who never said which chair;
  without this a bookmarked checkout URL walks straight past the map). Validated by
  `holdIsSpendable()`, which is **issueTicket's checklist minus expiry**:

  > **An expired hold is deliberately let through.** `issueTicket` doesn't check `expiresAt`
  > either, and says why at length: an expiry costs them **the seat they picked, not the ticket
  > they came for** — it falls back to the best available chair in the same tier. Refusing an
  > expired token at the page would reintroduce, one page earlier, the exact failure that
  > fallback exists to prevent. `userId` **is** checked, and that's the one addition.

- **`checkout-processing.tsx`** — passes `intentToken` through to `reserveTicket` (the action
  already accepted it). The staged animation, the promise-in-a-ref guard and the hard
  `location.assign` are unchanged, exactly as that file's own comment predicted. It now holds an
  error **code** rather than a sentence, because a *seat* failure (`bad_intent`, `seat_taken`)
  must retry back to **the map**, not to the tier list — otherwise the buyer re-accepts the
  terms to reach a screen they were one click from.

**Verified against real Postgres on 2026-07-14 — 26 checks, all passing** (script in the session
scratchpad, `check-seating.ts`; rewrite or ignore):

1. `seatPickerFor` — mapped tier gets the picker; **unmapped tier skips**; `NONE` skips; no map
   skips; **an unreadable map is `broken`, not "sell the room again"**.
2. The whole path — hold the seat you clicked, `holdIsSpendable` passes it, spend it, and
   **the ticket carries the seat you actually picked**, label frozen on.
3. `holdIsSpendable` refuses **somebody else's** hold, the **wrong tier**, and a garbage token —
   and **accepts an expired one**, per the rule above.
4. Expiry — hold, expire, let someone else take the chair, then claim: **she still gets a ticket,
   on a different seat.**
5. Changing your mind — two picks in a row leaves her holding **exactly one** seat, the first is
   `CANCELLED`, and "Change" gives it back at once.
6. **The race** — 12 buyers, one chair, `Promise.all`: exactly one holds it, **no chair held
   twice**, the rest are **routed elsewhere rather than refused** until the tier genuinely runs
   out, and only then is it `seat_taken`.

---

## Phase 4 — the Game Pass rail ✅

**Built. Switched off** (`ROBUX_GAMEPASS_ENABLED=false`), and it refuses to hold a seat for a
sale that cannot happen until it is on.

- **`src/app/api/auth/roblox/consent/route.ts`** — incremental consent, from any host.
  **It never looks at the session, and that is the entire point:** the SSO front door
  short-circuits when you already have one, which is right for signing in and *wrong* here —
  **a session proves who they are, it does not prove what they consented to.** Reuse the
  short-circuit and a signed-in buyer with no grant is bounced home with nothing asked and
  nothing stored, the checkout finds no grant, and the button appears to do nothing at all,
  forever, in a loop, with no error anywhere. So it always goes to Roblox.
  It borrows `authorise.ronation.live`'s redirect (the only one Roblox knows) exactly as the
  login route does, and lands back via `/api/auth/sso/authorize`, so the buyer returns to the
  host they started on *with a session*.
- **The grant needs no cookie and no ticket to cross hosts.** `saveGrant()` writes it to the
  **User row**, and every host reads it back by user id. That is why a partner's checkout can
  use a grant obtained on RNL's front door with no new secret anywhere.
- **`callback/route.ts`** — reads a `ron_oauth_grant` cookie (set by the consent route, *not*
  a query flag: what we persist is not a decision that comes from the address bar) and calls
  `saveGrant()`. It already refuses to store a grant with **no refresh token** — `offline_access`
  missing means the access token dies in 15 minutes, and recording that as a grant would make
  `hasInventoryGrant()` start lying within the hour.
- **`src/components/ticket/gamepass-checkout.tsx`** — the rule this file exists to obey:

  > **NEVER SAY "PAYMENT FAILED".**
  >
  > Roblox's inventory **lags a purchase by seconds**. For the whole time a buyer is walking
  > back to our tab, the honest answer to "do they own the pass?" is *not yet* — and "not yet"
  > is `owns: false`, the same shape as "they never bought it". Render that as an error and you
  > have told somebody who is 500 Robux down that they did not pay, at the exact moment they
  > are most alarmed by it. `waiting` is a **spinner**, always.

  Polls us every 2s **and on `visibilitychange`** (them coming back to our tab *is* the signal,
  and it beats the next tick by up to two seconds). Gives up auto-polling after 2 min and shows
  a manual "I've paid — check again". `needs_consent` is a **button**; `unavailable` is a
  **wait**; neither is "you didn't pay".
- **`startGamePass` / `claimGamePass`** in `app/actions/purchase.ts`. `startGamePass` **reads the
  buyer's existing free hold, proves it is theirs, and takes the seat off it server-side** —
  the seat is never re-sent by the client — then switches the rail. `createPurchaseIntent`
  cancels the old hold and takes the new one *in the same transaction, under the same lock*, so
  **the chair is never released back into the room, not for an instant.**
- **The Roblox poll limit is a compare-and-swap on `PurchaseIntent.checkedAt`**, in the database,
  not a ref on the client — so a refresh or a second tab cannot reset it. `updateMany` with
  `checkedAt < cutoff` in the WHERE: whoever wins does the Roblox call, everybody else is told
  to wait. **Verified** with two concurrent claims: exactly one wins.
- **`tier-editor.tsx`** — the pass/product fields, which **did not exist** (the server has read
  `gamePassId`/`devProductId` since Phase 2; there was simply no UI to type one in, so the rail
  was unusable), plus **Verify pass** → `gamePassDetails()`. It warns on a wrong id, on
  `forSale: false`, on a price mismatch, and — the expensive one — on **"already on another
  tier"**: a pass is owned *forever*, so pasting last month's onto this month's show lets every
  one of last month's buyers walk in free, verified, waved through by our own ownership check
  doing exactly what it was built to do. `TicketTier.gamePassId` is `@unique` to stop it; this
  button is that constraint asked politely, before the promoter has typed out a whole show.

---

## Phase 5 — the Game API (your self-serve ticket hub)

**The hub is an API, not a page.** You already have a walk-up booth against `/api/v1`; the goal
is an API complete enough to build an in-experience hub against **without RNL writing any Luau
for you.** What's missing today:

| The booth must… | Now |
|---|---|
| List shows / tiers / prices | ✅ |
| Render a seat map **in 3D** | ✅ `GET /events/[id]?include=venue` — layout + world anchor |
| Know which seats are gone, live | ✅ `GET /events/[id]/seats` |
| **Hold** a seat while the player decides | ✅ `POST /intents` |
| Know **which product to prompt** | ✅ `devProductId` on every tier |
| Know what the player already holds | ✅ `GET /players/[robloxId]/tickets` |
| Settle the receipt | ✅ (now takes `intentToken`) |

**New endpoints** — all four verified over HTTP against a running server:

- **`GET /api/v1/events/[id]/seats`** — live availability. A booth polls it, so it is compact
  (seat keys, nothing else — the caller already has the layout, which never changes) and it
  **answers 304** to `If-None-Match`. An idle show costs a hash and an empty body. The ETag is
  over the **answer**, never a timestamp: two reads that say the same thing must produce the
  same tag, or the 304 never fires and the header is decoration.
- **`POST /api/v1/intents`** — *the missing primitive.* Scope **`INTENTS_WRITE`**, a new one,
  and deliberately **not** `TICKETS_PURCHASE`: that scope's whole warning is that it can assert
  a payment nothing on our side can check. **Holding a chair cannot take a penny off anybody.**
  A lobby board should be able to hold seats without also being able to mint itself a free VIP
  ticket.
- **`DELETE /api/v1/intents/[token]`** — release on a dismissed prompt. Releasing twice is
  **not** an error: a dismissal arriving after the purchase landed is an ordinary race.
- **`GET /api/v1/intents/[token]`** — resolve a `launchData` token, so a buy that started on the
  web finishes in-game. Returns `ticketId` if it has already been spent, which is how the game
  knows to show them their ticket instead of selling a second one.
- **`GET /api/v1/players/[robloxId]/tickets?eventId=`** — the booth's opening question, and there
  was no way to ask it. `nothing` → sell; **`GA` → offer the upgrade** (the sale that otherwise
  never happens — they don't know VIP is left, and the booth can't tell it's talking to a GA
  holder); `VIP` → let them in. Never returns the **code**: this answers a question about a
  player, it does not hand over the thing that gets them through a door.

**Changed:**

- `GET /api/v1/events/[id]` — `seatMode`, `sections[]`, per-tier `devProductId`/`gamePassId`, and
  the full `layout` **behind `?include=venue`** (a lobby board polling every 10s does not need
  40KB of polygons; the map is also the one thing that never changes, so fetch it once).
- `POST /api/v1/tickets/purchase` — takes `intentToken`, **required when `seatMode !== NONE`**,
  refused *before* `issueTicket` with a sentence that says what to do instead. Unseated shows are
  untouched. `/tickets/reserve` takes one too, but **optionally** — the asymmetry is money: on
  `/purchase`, guessing a seat means somebody has already paid for a chair nobody agreed on;
  on `/reserve` the worst case is a free ticket in a seat they didn't choose.

### The bug this phase found

**`eventId` was an id on the write endpoints and an id-*or-slug* on the reads.** The events
endpoints have always accepted either ("a game server is configured by hand, and
`stro-the-first-rite` is easier to not get wrong than a cuid") — but `issueTicket` and
`createPurchaseIntent` look up by **id only**. So a booth configured with a slug would list the
line-up, read the seat map, draw the room perfectly… and then **404 the moment somebody tried to
hold a chair**. Caught by the HTTP checks, and it would have been a 2am discovery otherwise.

Closed with `resolveEventId()` in `lib/api/guard.ts`, used by `/intents`, `/reserve` and
`/purchase`. **The authority still takes the id and only the id** — it should not be in the
business of guessing what you meant; the *routes* do the resolving. `llm.txt` now says plainly:
**one constant, and it works everywhere.**

`public/llm.txt` is the real contract, and it now carries the two rails, the intent lifecycle,
`GetJoinData().LaunchData`, the world anchor, and a **complete walk-up booth in Luau** — greet a
player, show what they hold, hold a seat, prompt, settle the receipt, release on a dismissal.

**Not blocked, not built:** opening RNL to outside organisers needs partners to become a **DB
table** (`registry.ts` is code *on purpose* — middleware runs on the edge where Prisma can't
reach). Everything new here is `partnerId`-scoped from day one with scope as a required
argument, so nothing makes that day harder.

---

## Phase 6 — the door ✅

**No new server code, exactly as predicted** — the seat already rode in the standard
`ticketEnvelope`, so `/verify` and `/redeem` were carrying it and nothing was looking.

- **`door-check.tsx`** — "Seat them at **Balcony Left · Row K · Seat 12**", in type you can read
  at arm's length in a dark room, **above** the detail grid rather than as a fourth cell inside
  it. On a seated show it is the only thing the steward needs after "admit", and it is what the
  queue is waiting on. Renders on a seated ticket and on no other.
- **`ticket-art.tsx`** — the seat, printed big, on its own line. A real ticket prints the block,
  the row and the seat large enough to find with a phone torch. Same string, same weight as the
  door: the steward and the holder look at **one fact**, not two renderings of it.
- **`ticket-detail.tsx`** — draws the map with **their own chair lit up**, using the same
  `<VenueMap>` the designer drew the room with and the picker sold it with. That is the third
  reader, and it is why one renderer exists. Note what is *not* passed to it: `taken` and `held`.
  Whose ticket is in the chair next to yours is nobody's business but theirs, and a stub is not a
  live availability view.
- **`ticket-stub.tsx`** — the seat in the wallet, on its own line (crammed onto the tier line it
  truncates to nonsense on a phone, and the seat is the half you opened the wallet to check).
- The map is fetched **only for a ticket that actually holds a seat**, so every unseated ticket
  page costs exactly what it did before seating existed. `seatLabel` is frozen on the row, so a
  map that has since been deleted costs the *picture*, never the *fact*.

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

**This works — it is what every phase has been verified on** (2026-07-14, on the laptop, no
Docker). Three things that will bite:

- **`prisma generate` fails with `EPERM … query_engine-windows.dll.node` while a dev server is
  running.** Kill it, generate, restart. A stale client is also why `tsc` may greet you with
  thirty errors about `prisma.venueMap` and `SeatMode` not existing — the schema is fine, the
  *client* is old. Generate before you believe any of them.
- A check script must live **in the repo root** (not the scratchpad) to resolve the `@/…` paths,
  and is run with `npx tsx --conditions=react-server <file>.ts`. Delete it afterwards.
- **Killing a `next start` by its shell does not kill the server.** The Node process survives and
  keeps the port — so the next `next start` fails with `EADDRINUSE` and you carry on testing the
  **old build**, which is a green run that proves nothing. Kill it **by port**
  (`Get-NetTCPConnection -LocalPort <p>` → `Stop-Process`). This genuinely happened, and it hid a
  real bug for a whole cycle.

### The scripts (in the session scratchpad — rewrite or ignore)

**`check-seating.ts`** — 22 library checks, and **`check-api.ts`** — 31 HTTP checks against a
real `next start`. Both passed on 2026-07-14. What they assert, and what any replacement must:

1. **The bricking bug** — reserve a seat, cancel, re-reserve **the same seat**. Must succeed. If
   `seatKey` wasn't nulled it fails on the unique index, which is exactly the failure the test
   exists to catch.
2. **The race** — many buyers, one chair, `Promise.all`: exactly one gets it, **no chair held
   twice**, and the rest are **routed elsewhere, not refused**, until the tier genuinely runs out.
3. **Expired hold** — expire it, let someone else take the chair, then claim. They must still get
   a ticket, on a *different* seat.
4. **Own-hold / own-ticket** — hold a seat then buy it (mustn't block itself); hold GA then
   upgrade to VIP (must get a VIP *chair*, not collide with your own GA seat).
5. **Replay** — same `purchaseId` twice → same ticket, **one** payment row. Then cancel and
   re-claim → ticket restored, still one payment row.
6. **Regression** — an unseated show must be byte-identically unaffected: no seat, `seat: null`
   at the door, many tickets coexisting with `NULL seatKey`.
7. **The picker's decision tree** — an *unmapped tier* skips the map (it sells as GA, exactly as
   today); an *unreadable* map refuses rather than reselling the room.
8. **The poll limiter** is a compare-and-swap: two concurrent claims, exactly one asks Roblox.
9. **The API, over HTTP** — the 304, the hold, the release, `launchData`, the by-player lookup,
   and `intentToken` being demanded on a seated purchase.

> **A green test that proves nothing is worse than a red one.** `check-api.ts` first ran against
> seats that `check-seating.ts`'s race was *still holding*, and "the map shows it held" went green
> for entirely the wrong reason. It now clears the event's intents and tickets before it starts.
> If you rewrite these, keep that.

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

### Turning the paid rails on, when the day comes

1. Add `user.inventory-item:read` and **`offline_access`** to the Roblox OAuth app. Leave
   `offline_access` out and Roblox issues **no refresh token**, the grant dies in fifteen
   minutes, and the rail breaks *hours later* with nothing on any screen to say why.
2. `ROBUX_TICKETS_ENABLED=true` (the master switch).
3. `ROBUX_GAMEPASS_ENABLED=true` (the third key — it exists *because* step 1 is a thing the
   other two switches cannot possibly know about).
4. For a **partner**, also set `robuxTickets: true` on their entry in `partners/registry.ts`.
   The master switch alone must never start charging a partner's visitors who never signed up
   for it — that is why `gamePassSalesAllowed()` reads all three.
5. On each priced tier: paste the **game pass id** and press **Verify pass**. It will tell you
   if the pass is off-sale, priced differently, or — the expensive one — **already on another
   tier**.

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
