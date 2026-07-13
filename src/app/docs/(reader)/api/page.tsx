import Link from "next/link";
import { ALL_SCOPES, SCOPE_LABELS } from "@/lib/apikey";
import { requireDocsUser } from "@/lib/docs-guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ticket API",
  robots: { index: false, follow: false },
};

// The human rendering of /llm.txt.
//
// That file is the contract; this page is the same contract with headings you can
// scroll and a table you can read. If the two ever drift, /llm.txt wins and this
// is the bug — so the scopes table below is generated from ALL_SCOPES rather than
// typed out, because the one thing that must never be stale is the list of things
// a key is allowed to do.

const RESPONSE_JSON = `{
  "ok": true,
  "valid": true,
  "admit": true,
  "reason": "ok",
  "message": "Admit — VIP — Front Barrier",

  "ticket": {
    "id": "cmrijfyc500029h3m26mh212t",
    "code": "ST-4K9QW2",
    "status": "RESERVED",
    "admission": {
      "tier": "VIP — Front Barrier",
      "kind": "VIP",
      "priceRobux": 250,
      "paid": true
    },
    "activated": true,
    "activatedAt": "2026-07-13T18:40:00.000Z",
    "checkedIn": false,
    "checkedInAt": null,
    "seal": "PVZFNR",
    "sealValid": true
  },

  "event": {
    "id": "cmr9nedoy0001fgfa4abrsbt2",
    "slug": "stro-the-first-rite",
    "title": "THE FIRST RITE",
    "startsAt": "2026-08-03T19:00:00.000Z",
    "doorsAt": "2026-08-03T18:00:00.000Z",
    "venue": "The Hollow — Main Stage",
    "partnerId": "sleeptokenro"
  },

  "holder": {
    "robloxId": "851394804",
    "username": "chrxs_dev",
    "displayName": "chrxs_dev"
  }
}`;

const EMPTY_JSON = `{ "ok": true, "valid": false, "admit": false, "reason": "not_found",
  "message": "No ticket with that code.", "ticket": null, "event": null, "holder": null }`;

const IDENTIFY_JSON = `{ "code": "RN-4K9QW2" }                        // the code printed on the ticket
{ "robloxId": "851394804", "eventId": "..." }  // or: who is standing here
{ "username": "chrxs_dev", "eventId": "..." }  // or: the same person, by name`;

const OPTIONAL_JSON = `{
  "eventId": "cmr9nedoy0001fgfa4abrsbt2",  // the show THIS server is running
  "seal": "PVZFNR"                          // the 6-char seal printed on the ticket
}`;

const EVENT_JSON = `{
  "ok": true,
  "event": {
    "id": "cmr9nedoy0001fgfa4abrsbt2", "slug": "stro-the-first-rite",
    "title": "THE FIRST RITE", "status": "PUBLISHED",
    "startsAt": "…", "doorsAt": "…", "venue": "The Hollow — Main Stage",
    "capacity": 200, "reserved": 176, "remaining": 24, "partnerId": "sleeptokenro"
  },
  "tiers": [
    { "id": null, "name": "General Admission", "kind": "GA", "priceRobux": 0,
      "remaining": 24, "available": true,  "blockedReason": null },
    { "id": "cmr9…", "name": "VIP — Front Barrier", "kind": "VIP", "priceRobux": 250,
      "remaining": 0,  "available": false, "blockedReason": "soldout" }
  ]
}`;

const RESERVE_JSON = `{ "robloxId": "851394804", "eventId": "cmr9…", "tierId": null }`;

const GIFT_JSON = `{ "robloxId": "851394804",       // who GETS it
  "fromRobloxId": "1234567",     // who GAVE it
  "eventId": "cmr9…", "tierId": null }`;

const PURCHASE_JSON = `{ "purchaseId": "<receiptInfo.PurchaseId>",   // REQUIRED. The idempotency key.
  "robloxId":   "851394804",
  "eventId":    "cmr9…",
  "tierId":     "cmr9…",                      // REQUIRED. A priced tier.
  "robuxSpent": 250,
  "placeId":    "…", "productId": "…" }       // optional, recorded`;

const LUAU_CALL = `local HttpService = game:GetService("HttpService")

local BASE     = "https://ronation.live"
local API_KEY  = "rnl_…"                       -- keep this OUT of client scripts
local EVENT_ID = "cmr9nedoy0001fgfa4abrsbt2"   -- the show this server is running

local function callApi(path, body)
    local ok, res = pcall(function()
        return HttpService:RequestAsync({
            Url = BASE .. path,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-api-key"] = API_KEY,
            },
            Body = HttpService:JSONEncode(body),
        })
    end)

    -- The network failed. This is NOT "the ticket is bad" — do not turn somebody
    -- away because the wifi blinked. Let staff decide, or retry.
    if not ok or not res.Success then
        return nil, "network"
    end

    return HttpService:JSONDecode(res.Body), nil
end

--- Somebody presented \`code\` at the door.
local function admit(player, code)
    local data, err = callApi("/api/v1/tickets/redeem", {
        code = code,
        eventId = EVENT_ID,   -- always: this is what pins it to TONIGHT
    })

    if err == "network" then
        return false, "Couldn't reach the door system. Try again."
    end

    -- Branch on \`admit\`, NOT on \`valid\`. See the note above.
    if not data.admit then
        return false, data.message  -- "Already checked in.", "Cancelled.", …
    end

    -- They're in. \`admission.kind\` says what they hold.
    if data.ticket.admission.kind == "VIP" then
        -- open the VIP room, spawn on the barrier, hand out the badge…
        print(player.Name .. " is VIP: " .. data.ticket.admission.tier)
    end

    return true, data.message  -- "Checked in — General Admission"
end`;

const LUAU_GATE = `game.Players.PlayerAdded:Connect(function(player)
    -- Look up by who they are, rather than asking them to type a code.
    local data, err = callApi("/api/v1/tickets/verify", {
        robloxId = tostring(player.UserId),
        eventId = EVENT_ID,
    })

    -- Fail OPEN on a network error, not closed. A blip at our end must not
    -- start kicking the entire room out of a show they paid to attend.
    if err == "network" then return end

    if not data.valid then
        player:Kick("You need a ticket for this show — get one at ronation.live")
    end
end)`;

const LUAU_RESERVE = `local function reserveFor(player)
    local data, err = callApi("/api/v1/tickets/reserve", {
        robloxId = tostring(player.UserId),
        eventId = EVENT_ID,
        -- tierId = nil → General Admission. Read GET /api/v1/events/<id> for the rest.
    })
    if err == "network" then return false, "Couldn't reach the ticket system." end
    if not data.issued then return false, data.message end  -- soldout, revoked, past…

    return true, data.ticket.code   -- "RN-4K9QW2" — show it to them
end`;

const LUAU_RECEIPT = `local MarketplaceService = game:GetService("MarketplaceService")

-- productId → the tier it buys. Fill this in from GET /api/v1/events/<id>.
local TIER_FOR_PRODUCT = {
    [123456789] = "cmr9tierid…",   -- VIP — Front Barrier
}

MarketplaceService.ProcessReceipt = function(receipt)
    local tierId = TIER_FOR_PRODUCT[receipt.ProductId]
    if not tierId then
        -- Not one of ours. Don't grant something you don't understand.
        return Enum.ProductPurchaseDecision.NotProcessedYet
    end

    local data, err = callApi("/api/v1/tickets/purchase", {
        -- THE important field. Roblox re-delivers this receipt until you grant it,
        -- and this is what stops the re-delivery becoming a second ticket.
        purchaseId = receipt.PurchaseId,
        robloxId   = tostring(receipt.PlayerId),
        eventId    = EVENT_ID,
        tierId     = tierId,
        robuxSpent = receipt.CurrencySpent,
        placeId    = tostring(receipt.PlaceIdWherePurchased),
        productId  = tostring(receipt.ProductId),
    })

    -- Could not reach us, or we refused. Do NOT grant: Roblox will re-deliver the
    -- receipt, and /purchase is idempotent, so the retry settles it safely.
    if err == "network" or not data or not data.issued then
        return Enum.ProductPurchaseDecision.NotProcessedYet
    end

    -- They have their ticket. \`data.created\` is false on a re-delivery — that is
    -- success, not a duplicate, and it must still be granted or Roblox will keep
    -- sending it forever.
    return Enum.ProductPurchaseDecision.PurchaseGranted
end`;

const LUAU_LOOKUP = `--- "/hasticket chrxs_dev"
local function hasTicket(username)
    local data, err = callApi("/api/v1/tickets/verify", {
        username = username,
        eventId = EVENT_ID,   -- required for a player lookup, not optional
    })
    if err == "network" then return nil end
    return data.valid, data  -- data.holder tells you WHO we matched
end`;

const ENDPOINTS: {
  method: "GET" | "POST";
  path: string;
  scope: string;
  writes: boolean;
  desc: string;
}[] = [
  {
    method: "GET",
    path: "/api/v1/events",
    scope: "EVENTS_READ",
    writes: false,
    desc: "What shows are coming up?",
  },
  {
    method: "GET",
    path: "/api/v1/events/<id>",
    scope: "EVENTS_READ",
    writes: false,
    desc: "One show: doors, room, tiers, seats left.",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/verify",
    scope: "TICKETS_VERIFY",
    writes: false,
    desc: "Is this ticket good, and what is it?",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/redeem",
    scope: "TICKETS_REDEEM",
    writes: true,
    desc: "Let them in, and burn the ticket.",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/reserve",
    scope: "TICKETS_ISSUE",
    writes: true,
    desc: "Give this player a free ticket.",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/gift",
    scope: "TICKETS_ISSUE",
    writes: true,
    desc: "X gives Y a ticket.",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/purchase",
    scope: "TICKETS_PURCHASE",
    writes: true,
    desc: "They paid Robux. Issue the paid ticket.",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/void",
    scope: "TICKETS_VOID",
    writes: true,
    desc: "Cancel a ticket. They may reserve again.",
  },
  {
    method: "POST",
    path: "/api/v1/tickets/revoke",
    scope: "TICKETS_VOID",
    writes: true,
    desc: "Cancel it, and bar them from this show.",
  },
];

const VERIFY_REASONS: [string, string, string, string][] = [
  ["ok", "true", "true", "Good ticket. Let them in."],
  [
    "already_checked_in",
    "true",
    "false",
    "Real ticket, already used. Do not admit again.",
  ],
  ["cancelled", "false", "false", "Voided, revoked, or the holder cancelled it."],
  ["not_found", "false", "false", "No such code — or not one of your org's."],
  ["wrong_event", "false", "false", "Real ticket, but for a different show."],
];

const ISSUE_REASONS: [string, string][] = [
  ["not_found", "No such show — or not one of yours."],
  ["unavailable", "The show is not open for tickets (draft, or archived)."],
  ["past", "It has already happened."],
  ["badtier", "No such tier on this show, or it has been deactivated."],
  ["soldout", "The room is full."],
  ["tier_soldout", "That tier is full, but others may not be."],
  ["no_player", "Roblox has never heard of that robloxId."],
  [
    "revoked",
    "They were revoked from this show. They may not have another.",
  ],
  ["payments_off", "Priced tier, and Robux sales are off. Nobody can have it."],
  [
    "payment_required",
    "Priced tier, on a path that collects no money. Use /purchase.",
  ],
  [
    "not_purchasable",
    "You called /purchase for a free tier. Don't charge them.",
  ],
];

const ERRORS: [string, string, string][] = [
  [
    "401",
    '{ "ok": false, "error": "unauthorized" }',
    "Missing, wrong or revoked key.",
  ],
  [
    "403",
    '{ "ok": false, "error": "forbidden" }',
    "Real key, without the scope for this.",
  ],
  [
    "400",
    '{ "ok": false, "error": "provide `code`, or …" }',
    "No usable identifier sent.",
  ],
];

export default async function ApiDocsPage() {
  const { orgs } = await requireDocsUser();

  return (
    // No `shell` here: the docs layout owns the page frame and the sidebar grid.
    <div className="pb-14">
      {/* 1 — Title */}
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Documentation
        </p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">Ticket API</h1>
        <p className="mt-5 text-muted">
          Check whether a ticket is valid, find out what kind of ticket it is,
          hand one out, take one back, and mark it redeemed once it has been
          scanned at the door.
        </p>
        <div className="mt-5 space-y-2 text-sm text-muted">
          <p>
            Base URL <Mono>https://ronation.live</Mono>. Every request needs the
            header <Mono>x-api-key: &lt;key&gt;</Mono> (
            <Mono>Authorization: Bearer &lt;key&gt;</Mono> also works). POST +{" "}
            <Mono>Content-Type: application/json</Mono>, except the two event
            reads, which are GET.
          </p>
          <p>
            Enable <span className="text-fg">Allow HTTP Requests</span> in Roblox
            Studio → Game Settings → Security, or none of this works.
          </p>
          <p>
            <a
              href="/llm.txt"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-fg"
            >
              /llm.txt
            </a>{" "}
            is the machine-readable copy of this same contract — hand it straight
            to an LLM. If the code and that file ever disagree, the code wins and
            the file is a bug.
          </p>
        </div>
      </header>

      {/* Your keys */}
      <Section title="Your keys">
        <p className="text-muted">
          You manage {orgs.length === 1 ? "this organisation" : "these organisations"}.
          Mint a key in its portal, under <span className="text-fg">API keys</span>:
        </p>
        <ul className="mt-4 space-y-2">
          {orgs.map((org) => (
            <li key={org.id}>
              <Link
                href={org.keysPath}
                className="flex flex-col gap-1 border-t border-line pt-3 hover:text-fg sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-fg">{org.name}</span>
                <span className="font-mono text-sm text-accent">
                  {org.keysPath}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* 2 — Getting a key */}
      <Section title="Getting a key">
        <p className="text-muted">
          A key is the whole of your credentials, and it looks like this:
        </p>
        <Code>{`rnl_k7m2p9x4qz_9f3hd2n8vqw4mzx7rbt6cyk3jphs5nga
    └── keyId ──┘└──────────── secret ─────────────┘`}</Code>

        <p className="mt-6 text-muted">
          You mint one in your portal, under <span className="text-fg">API keys</span>{" "}
          — the links above. Minting is a <span className="text-fg">write</span>, so
          read-only staff cannot do it: on an organisation governed by its own Roblox
          group, that is a rank. Sleep Token&rsquo;s crew read the portal at 249+
          and write at 253+, so the people who can work the door are deliberately not
          the same set as the people who can mint a credential that works the door
          from anywhere in the world.
        </p>

        <h3 className="mt-6 text-fg">It belongs to one organisation.</h3>
        <p className="text-muted">
          A Sleep Token key sees Sleep Token&rsquo;s shows and nothing else.
          A ticket for anybody else&rsquo;s show comes back{" "}
          <Mono>not_found</Mono> — not &ldquo;forbidden&rdquo;, because whether
          somebody else&rsquo;s ticket exists is none of your business, and those
          are the same answer. The scope is read from the key on our side.{" "}
          <span className="text-fg">
            You cannot widen it from the request. There is no field for it.
          </span>
        </p>

        <h3 className="mt-6 text-fg">It carries only the scopes it was minted with.</h3>
        <p className="text-muted">
          Six of them, one per thing a key can do — listed below. Tick only what the
          key needs: a door scanner with <Mono>TICKETS_REDEEM</Mono> and nothing else,
          if it leaks, cannot be turned into a ticket printer. That is the entire
          reason scopes exist — one key per job, not one key for everything.
        </p>
        <p className="text-muted">
          Calling an endpoint your key has no scope for is a{" "}
          <span className="text-fg">403</span>, never a 401. Your key is fine; it is
          simply not allowed to do that. Scopes are fixed at mint and cannot be
          edited afterwards, so changing what a key may do means replacing it —
          deliberately.
        </p>

        <h3 className="mt-6 text-fg">It is shown once.</h3>
        <p className="text-muted">
          We store a SHA-256 of the token, not the token, so nobody — including us —
          can ever read it back to you. Lose it and you mint a new one. There is no
          reveal button, and no support request that produces one.
        </p>

        <p className="mt-6 text-muted">
          Keep it in <span className="text-fg">server</span> scripts only — never a{" "}
          <Mono>LocalScript</Mono>, never <Mono>ReplicatedStorage</Mono>, never
          anywhere a player can take a copy. Anybody holding it can do everything it
          was minted with, from anywhere, as you. Revoke it the moment it leaks: the
          portal&rsquo;s Revoke button kills it on the very next request.
        </p>

        <Note>
          <span className="text-fg">Handed a key that doesn&rsquo;t start with</span>{" "}
          <Mono>rnl_</Mono>? That is <Mono>GAME_API_KEY</Mono>, the original one, and
          it predates all of this. It is <span className="text-fg">unscoped</span> —
          every show on the platform, RNL&rsquo;s and every partner&rsquo;s — and it
          holds every scope. It still works, and it cannot be revoked from the portal.
          It is on its way out: mint a scoped key and use that instead.
        </Note>
      </Section>

      {/* 3 — Scopes */}
      <Section title="The scopes">
        <TableBox minWidth={640}>
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Scope</Th>
              <Th>What it is called</Th>
              <Th>What it hands over</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ALL_SCOPES.map((scope) => (
              <tr key={scope}>
                <Td>
                  <Mono>{scope}</Mono>
                </Td>
                <Td className="text-fg">{SCOPE_LABELS[scope].title}</Td>
                <Td className="text-muted">{SCOPE_LABELS[scope].detail}</Td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      </Section>

      {/* 4 — Endpoints */}
      <Section title="The endpoints">
        <TableBox minWidth={720}>
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Endpoint</Th>
              <Th>Writes?</Th>
              <Th>Scope</Th>
              <Th>Use it for</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ENDPOINTS.map((e) => (
              <tr key={e.path + e.method}>
                <Td>
                  <span className="flex items-center gap-2">
                    <Method method={e.method} />
                    <span className="font-mono text-xs text-fg">{e.path}</span>
                  </span>
                </Td>
                <Td className={e.writes ? "text-fg" : "text-faint"}>
                  {e.writes ? "Yes" : "No"}
                </Td>
                <Td>
                  <Mono>{e.scope}</Mono>
                </Td>
                <Td className="text-muted">{e.desc}</Td>
              </tr>
            ))}
          </tbody>
        </TableBox>
        <p className="mt-4 text-sm text-muted">
          Every ticket endpoint returns the{" "}
          <span className="text-fg">same response shape</span>. That is
          deliberate: you parse one shape in Luau, not nine.
        </p>
      </Section>

      {/* 5 — Identifying a ticket */}
      <Section title="Identifying a ticket">
        <p className="text-muted">
          <Mono>/verify</Mono>, <Mono>/redeem</Mono>, <Mono>/void</Mono> and{" "}
          <Mono>/revoke</Mono> all take the same body. Send{" "}
          <span className="text-fg">one</span> of:
        </p>
        <Code>{IDENTIFY_JSON}</Code>

        <h3 className="mt-6 text-fg">Asking by player, not by code</h3>
        <p className="text-muted">
          Your server already knows who joined — <Mono>Player.UserId</Mono> and{" "}
          <Mono>Player.Name</Mono> — so it can ask{" "}
          <em>&ldquo;does this player hold a ticket for tonight?&rdquo;</em> the
          moment they spawn, without anybody typing anything. That is what{" "}
          <Mono>robloxId</Mono> is for, and it is the one to reach for:{" "}
          <span className="text-fg">send <Mono>robloxId</Mono> whenever you have it.</span>
        </p>
        <p className="mt-3 text-muted">
          <Mono>username</Mono> exists for the times a human is doing the typing.
          It is resolved against Roblox&rsquo;s own API into a{" "}
          <Mono>robloxId</Mono> before any ticket is looked up, because a username
          is a label a player can change and an id is not — so somebody who renamed
          the night before the show still walks through their own door. (An id sent
          in the <Mono>username</Mono> field is accepted as-is.)
        </p>
        <p className="mt-3 text-muted">
          The endpoints that <span className="text-fg">write a new ticket</span> —{" "}
          <Mono>/reserve</Mono>, <Mono>/gift</Mono>, <Mono>/purchase</Mono> — take{" "}
          <Mono>robloxId</Mono> only, and no username. Resolving a name costs a
          round trip to Roblox that can fail, and a name is a label that can
          change: neither is a thing to hang &ldquo;who gets a ticket&rdquo; on.
          Your game server has <Mono>Player.UserId</Mono>. Use it.
        </p>
        <p className="mt-3 text-muted">
          <span className="text-fg">A player lookup needs <Mono>eventId</Mono>.</span>{" "}
          One person can hold a ticket to every show we run, so their name alone
          does not identify a ticket. Without it you get a <Mono>400</Mono>. A{" "}
          <Mono>code</Mono>, by contrast, identifies exactly one ticket on its own
          — though you should still send <Mono>eventId</Mono> with it, for the
          reason below.
        </p>

        <p className="mt-6 text-muted">Optional, and both worth sending:</p>
        <Code>{OPTIONAL_JSON}</Code>

        <h3 className="mt-6 text-fg">Always send eventId if you know it</h3>
        <p className="text-muted">
          Without it, the API can only answer{" "}
          <em>&ldquo;is this a real ticket&rdquo;</em> — not{" "}
          <em>&ldquo;is this a real ticket for tonight&rdquo;</em>. A genuine
          ticket for last month&rsquo;s show would come back{" "}
          <Mono>valid: true</Mono>. With <Mono>eventId</Mono>, a ticket for any
          other show is refused with <Mono>reason: &quot;wrong_event&quot;</Mono>.
        </p>

        <h3 className="mt-6 text-fg">
          The seal is optional and is not what admits anybody
        </h3>
        <p className="text-muted">
          <Mono>seal</Mono> is six characters printed on the ticket, derived from
          the ticket with a secret key. If you send it, the response includes{" "}
          <Mono>ticket.sealValid</Mono>. It exists so a crew member can eyeball a{" "}
          <span className="text-fg">printed or downloaded</span> ticket and spot a
          forgery without a scanner. The database is what actually admits people —
          you do not need the seal for a normal scan.
        </p>
      </Section>

      {/* 6 — The response */}
      <Section title="The response">
        <p className="text-muted">
          Every ticket endpoint returns HTTP 200 with this shape whenever the
          request was understood. Failure to <em>find</em> a ticket is not an HTTP
          error — it is a 200 with <Mono>valid: false</Mono>. So is a refusal to
          issue one.
        </p>
        <Code>{RESPONSE_JSON}</Code>
        <p className="mt-4 text-muted">
          When there is no ticket to talk about, <Mono>ticket</Mono>,{" "}
          <Mono>event</Mono> and <Mono>holder</Mono> are all <Mono>null</Mono>:
        </p>
        <Code>{EMPTY_JSON}</Code>
        <p className="mt-4 text-muted">
          The writing endpoints add one or two fields of their own{" "}
          <span className="text-fg">alongside</span> this shape, never instead of
          it — <Mono>issued</Mono>, <Mono>created</Mono>, <Mono>voided</Mono>,{" "}
          <Mono>banned</Mono>. They are described under each endpoint below.
        </p>

        <h3 className="mt-8 text-fg">What kind of ticket is it?</h3>
        <p className="text-muted">
          <Mono>ticket.admission</Mono>:
        </p>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            <Mono>tier</Mono> — the tier&rsquo;s name as it was{" "}
            <span className="text-fg">when the ticket was issued</span>
            (&ldquo;General Admission&rdquo;, &ldquo;VIP — Front Barrier&rdquo;).
            It is a snapshot: renaming or deleting a tier afterwards does not
            change what somebody already holds.
          </li>
          <li>
            <Mono>kind</Mono> — <Mono>&quot;GA&quot;</Mono> or{" "}
            <Mono>&quot;VIP&quot;</Mono>. <Mono>VIP</Mono> means it was a priced
            tier. Branch on this to open the VIP room, spawn them on the barrier,
            hand out a badge.
          </li>
          <li>
            <Mono>priceRobux</Mono> / <Mono>paid</Mono> — what it cost. Free
            tickets are <Mono>0</Mono> / <Mono>false</Mono>.
          </li>
        </ul>
        <Note>
          Paid (Robux) tiers are <span className="text-fg">switched off</span>{" "}
          platform-wide today, so in practice every live ticket is{" "}
          <Mono>kind: &quot;GA&quot;</Mono>, <Mono>paid: false</Mono>. The field is
          real and populated — build against it now and the VIP path works the day
          paid tiers are turned on.
        </Note>
      </Section>

      {/* 7 — valid vs admit */}
      <Callout kind="accent" title="valid vs admit — the one thing to get right">
        <p className="text-fg">
          <span className="font-semibold">Branch on <Mono>admit</Mono>. Never on{" "}
          <Mono>valid</Mono>.</span>
        </p>
        <ul className="mt-3 space-y-1 text-muted">
          <li>
            <Mono>valid</Mono> — the ticket is real and was not cancelled.
          </li>
          <li>
            <Mono>admit</Mono> — this person should walk through the door{" "}
            <span className="text-fg">right now</span>.
          </li>
        </ul>
        <p className="mt-3 text-muted">
          An already-checked-in ticket is <Mono>valid: true</Mono> and{" "}
          <Mono>admit: false</Mono>. It is a perfectly genuine ticket; it has
          simply already been used, and letting a second person in on it is the
          exact thing redeeming exists to prevent. A server that branches on{" "}
          <Mono>valid</Mono> will happily admit an entire queue on one ticket.
        </p>
      </Callout>

      {/* 8 — reason */}
      <Section title="reason">
        <TableBox minWidth={640}>
          <thead>
            <tr className="border-b border-line text-left">
              <Th>reason</Th>
              <Th>valid</Th>
              <Th>admit</Th>
              <Th>What happened</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {VERIFY_REASONS.map(([reason, valid, admit, what]) => (
              <tr key={reason}>
                <Td>
                  <Mono>{reason}</Mono>
                </Td>
                <Td className="font-mono text-xs text-faint">{valid}</Td>
                <Td className="font-mono text-xs text-faint">{admit}</Td>
                <Td className="text-muted">{what}</Td>
              </tr>
            ))}
          </tbody>
        </TableBox>
        <p className="mt-4 text-sm text-muted">
          <Mono>message</Mono> is a human sentence for the same thing. Show it to a
          crew member; do not parse it — it is written for people and may be
          reworded.
        </p>
      </Section>

      {/* 9 — Errors */}
      <Section title="Errors">
        <TableBox minWidth={640}>
          <thead>
            <tr className="border-b border-line text-left">
              <Th>HTTP</Th>
              <Th>Body</Th>
              <Th>Meaning</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ERRORS.map(([status, body, meaning]) => (
              <tr key={status}>
                <Td className="font-mono text-xs text-fg">{status}</Td>
                <Td>
                  <Mono>{body}</Mono>
                </Td>
                <Td className="text-muted">{meaning}</Td>
              </tr>
            ))}
          </tbody>
        </TableBox>
        <p className="mt-4 text-sm text-muted">
          A <Mono>403</Mono> is not a reason to re-copy your key. It means the key
          is fine and does not have that scope — go and mint one that does.
        </p>
      </Section>

      {/* 10 — Reading the line-up */}
      <Section title="Reading the line-up">
        <Code>{`GET /api/v1/events            → every published upcoming show your key can see
GET /api/v1/events/<id>       → one show, in full. Takes the id OR the slug.`}</Code>
        <p className="mt-4 text-muted">
          <Mono>/events/&lt;id&gt;</Mono> is what you read{" "}
          <span className="text-fg">before you offer anybody anything</span>. It
          gives you the tier ids to pass to <Mono>/reserve</Mono> and{" "}
          <Mono>/purchase</Mono>, what each costs, and how many are left:
        </p>
        <Code>{EVENT_JSON}</Code>
        <p className="mt-4 text-muted">
          <span className="text-fg">
            <Mono>available: false</Mono> means do not prompt for it.
          </span>{" "}
          <Mono>blockedReason</Mono> says why:
        </p>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            <Mono>soldout</Mono> — the tier is full, or the room is.
          </li>
          <li>
            <Mono>locked</Mono> — it is priced, and Robux sales are off. Nobody can
            buy it today, and taking somebody&rsquo;s money for a ticket that
            cannot be issued is the worst bug in this whole document.
          </li>
        </ul>
        <p className="mt-4 text-muted">
          A tier <Mono>id</Mono> of <Mono>null</Mono> is the{" "}
          <span className="text-fg">implicit tier</span>: an event nobody
          configured tiers for is one free General Admission. Send{" "}
          <Mono>tierId: null</Mono>, or leave it out entirely.
        </p>
      </Section>

      {/* 11 — Handing out tickets */}
      <Section title="Handing out tickets">
        <h3 className="text-fg">
          <Mono>POST /api/v1/tickets/reserve</Mono> — give this player a ticket
        </h3>
        <Code>{RESERVE_JSON}</Code>
        <p className="mt-4 text-muted">
          The player is standing in front of you and wants in. They do{" "}
          <span className="text-fg">not</span> need an account on ronation.live —
          if they have never opened the site in their life, we create one for them
          from their Roblox profile. They have a Roblox account, and that is
          enough.
        </p>
        <p className="mt-3 text-muted">
          <span className="text-fg">Free tiers only.</span> A priced tier comes
          back <Mono>payment_required</Mono>: a ticket somebody has to pay for is
          bought through <Mono>/purchase</Mono>, after Roblox has actually taken
          the Robux. Reserving one here would be giving the room away.
        </p>
        <p className="mt-3 text-muted">
          Idempotent. A player who already holds a ticket for this show gets the
          ticket they already hold, with <Mono>created: false</Mono>. Nobody holds
          two.
        </p>
        <p className="mt-3 text-sm text-faint">
          Adds to the response: <Mono>issued</Mono> (true/false),{" "}
          <Mono>created</Mono> (was a new one made).
        </p>

        <h3 className="mt-8 text-fg">
          <Mono>POST /api/v1/tickets/gift</Mono> — X gives Y a ticket
        </h3>
        <Code>{GIFT_JSON}</Code>
        <p className="mt-4 text-muted">
          <Mono>/reserve</Mono> with a name attached, and the name is the point: a
          VIP seat nobody paid for and nobody is recorded as handing out is a seat
          that turns up in an audit as a mystery. The giver is stamped on the
          ticket and shown in the portal.
        </p>
        <p className="mt-3 text-muted">
          A gift <span className="text-fg">may</span> be a priced tier. That is a
          comp — a free VIP, given away — and no Robux changes hands, which is
          exactly what a giveaway is. It still respects the paid-ticket switch: if
          Robux sales are off for your org, its priced tiers do not exist yet, and
          comping a seat in a tier that isn&rsquo;t supposed to exist is still
          handing out a seat.
        </p>
        <p className="mt-3 text-sm text-faint">
          Adds to the response: <Mono>issued</Mono>, <Mono>created</Mono>,{" "}
          <Mono>gifted</Mono>.
        </p>

        <h3 className="mt-8 text-fg">Why an issue can be refused</h3>
        <p className="text-muted">
          All three issuing endpoints answer{" "}
          <Mono>
            {'{ "ok": true, "issued": false, "reason": …, "message": … }'}
          </Mono>{" "}
          — a 200, because the request was understood perfectly and the answer is
          no.
        </p>
        <div className="mt-4">
          <TableBox minWidth={560}>
            <thead>
              <tr className="border-b border-line text-left">
                <Th>reason</Th>
                <Th>What happened</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ISSUE_REASONS.map(([reason, what]) => (
                <tr key={reason}>
                  <Td>
                    <Mono>{reason}</Mono>
                  </Td>
                  <Td className="text-muted">{what}</Td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        </div>
      </Section>

      {/* 12 — purchase */}
      <Section title="Selling tickets for Robux">
        <h3 className="text-fg">
          <Mono>POST /api/v1/tickets/purchase</Mono>
        </h3>
        <p className="text-muted">
          <span className="text-fg">
            Call this from <Mono>ProcessReceipt</Mono>, and nowhere else.
          </span>
        </p>
        <Code>{PURCHASE_JSON}</Code>

        <Callout
          kind="warn"
          title="What this endpoint trusts, and what it does not"
        >
          <p className="text-muted">
            Robux cannot be charged from a website. A real payment is a Developer
            Product prompted inside your experience, and the{" "}
            <span className="text-fg">only</span> witness to it is the{" "}
            <Mono>ProcessReceipt</Mono> handler on your game server. Roblox offers
            no server-to-server call for us to ask{" "}
            <em>&ldquo;was purchase X really paid for?&rdquo;</em> — so we cannot
            check. <span className="text-fg">We take your game server&rsquo;s word for it.</span>
          </p>
          <p className="mt-3 text-muted">
            That is the trust boundary, and it is worth reading twice rather than
            skimming: anybody holding a key with <Mono>TICKETS_PURCHASE</Mono> can
            assert that anybody paid for anything, and get a paid ticket for free.
            Give that scope only to a place you would trust with your own Robux,
            and revoke the key the moment it leaks.
          </p>
        </Callout>

        <h3 className="mt-8 text-fg">What it does guarantee</h3>
        <p className="text-muted">
          That a payment is honoured <span className="text-fg">exactly once</span>.
        </p>
        <p className="mt-3 text-muted">
          <Mono>purchaseId</Mono> is Roblox&rsquo;s own <Mono>PurchaseId</Mono>,
          and it is the idempotency key. <Mono>ProcessReceipt</Mono> is explicitly
          at-least-once — Roblox re-delivers a receipt until your game returns{" "}
          <Mono>PurchaseGranted</Mono>, and a server that crashes mid-call{" "}
          <span className="text-fg">will</span> send it again. So:
        </p>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            Send the same <Mono>purchaseId</Mono> twice and the second call returns
            the <span className="text-fg">same ticket</span>,{" "}
            <Mono>created: false</Mono>, and takes no second payment.{" "}
            <span className="text-fg">Retry freely.</span> A dropped response is
            safe to re-send, and you should re-send it.
          </li>
          <li>
            It is checked <span className="text-fg">before anything else can
            refuse it</span> — before the show is sold out, before it is past,
            before the tier is deactivated. Somebody who has already been charged
            must never be told they have no ticket because the room filled up while
            their receipt was in flight.
          </li>
          <li>
            If they already hold a ticket for this show, the payment{" "}
            <span className="text-fg">upgrades</span> it (one ticket per person per
            show, always). It is never silently swallowed: taking Robux and changing
            nothing is theft with extra steps.
          </li>
        </ul>

        <h3 className="mt-8 text-fg">Granting the receipt</h3>
        <p className="text-muted">
          Return <Mono>Enum.ProductPurchaseDecision.PurchaseGranted</Mono>{" "}
          <span className="text-fg">only</span> once this has answered{" "}
          <Mono>issued: true</Mono>. If it answers <Mono>issued: false</Mono>, do
          not grant — return <Mono>NotProcessedYet</Mono> and let Roblox
          re-deliver.
        </p>
        <p className="mt-3 text-muted">
          And do not prompt at all for a tier that{" "}
          <Mono>GET /api/v1/events/&lt;id&gt;</Mono> says is{" "}
          <Mono>available: false</Mono>. <Mono>payments_off</Mono> after you have
          taken somebody&rsquo;s Robux is a refund, not an error message.
        </p>
        <Note>
          Paid tiers are switched off platform-wide today, so this endpoint answers{" "}
          <Mono>payments_off</Mono> for every priced tier right now. It is real and
          it works — build against it, and the day the switch flips, your purchase
          path is already correct.
        </Note>
      </Section>

      {/* 13 — void vs revoke */}
      <Section title="Taking a ticket back">
        <p className="text-muted">
          Both take the same body as <Mono>/verify</Mono> — a <Mono>code</Mono>, or
          a player + <Mono>eventId</Mono> — plus an optional <Mono>reason</Mono>{" "}
          and <Mono>byName</Mono>.
        </p>

        <h3 className="mt-6 text-fg">
          <Mono>POST /api/v1/tickets/void</Mono> — cancel it
        </h3>
        <p className="text-muted">
          Issued to the wrong player. A duplicate. A change of plan. The ticket is
          cancelled and{" "}
          <span className="text-fg">the holder may reserve again immediately</span>
          , exactly as if they had cancelled it themselves — because voiding is a
          statement about the <em>ticket</em>, not the person.
        </p>

        <h3 className="mt-6 text-fg">
          <Mono>POST /api/v1/tickets/revoke</Mono> — cancel it, and bar them
        </h3>
        <p className="text-muted">
          Everything <Mono>/void</Mono> does, plus the part that matters: the
          holder is stamped, and <Mono>/reserve</Mono>, <Mono>/gift</Mono> and{" "}
          <Mono>/purchase</Mono> all refuse to hand them another one for this show.
          Without that, a revoke is a gesture — they click Reserve again and walk
          straight back in.
        </p>
        <p className="mt-3 text-muted">
          The difference is what you are <em>saying</em>. Voiding says &ldquo;this
          ticket is wrong&rdquo;. Revoking says &ldquo;this person is not
          coming&rdquo;. Use the second only when you mean it, and send a{" "}
          <Mono>reason</Mono> — it is written down, and it is what the crew will
          read when this person turns up at the door and asks why.
        </p>
        <p className="mt-3 text-muted">
          It bars them from <span className="text-fg">this show</span>. A standing
          ban across everything you run is the blacklist, in the portal — a
          different question with a different answer.
        </p>
        <p className="mt-3 text-muted">
          Lifting a revocation is done in the portal, not from the game. The same
          key that can ban should not quietly un-ban.
        </p>
        <p className="mt-3 text-sm text-faint">
          Both add to the response: <Mono>voided</Mono>, <Mono>banned</Mono>,{" "}
          <Mono>alreadyVoid</Mono>.
        </p>
        <p className="mt-3 text-muted">
          Both are idempotent, and{" "}
          <span className="text-fg">
            neither will touch a <Mono>CHECKED_IN</Mono> ticket
          </span>
          : they answer <Mono>voided: false, reason: &quot;checked_in&quot;</Mono>.
          That person is already in the room — cancelling the record now would not
          get them out of it, it would only make the record lie. Whoever asked for
          this wants security, not a database write.
        </p>
      </Section>

      {/* 14 — Luau */}
      <Section title="Luau: the whole thing">
        <p className="text-muted">
          One <Mono>callApi</Mono> helper, because every ticket endpoint answers in
          the same shape.
        </p>
        <Code>{LUAU_CALL}</Code>

        <h3 className="mt-8 text-fg">Kicking anyone without a ticket</h3>
        <Code>{LUAU_GATE}</Code>
        <p className="mt-4 text-muted">
          Note that one uses <Mono>valid</Mono>, not <Mono>admit</Mono>: at the{" "}
          <em>gate</em> you are asking &ldquo;do you hold a ticket at all&rdquo;,
          and somebody already checked in still does. <Mono>admit</Mono> is for the{" "}
          <em>door</em>, where the question is &ldquo;should this ticket let another
          body through&rdquo;.
        </p>

        <h3 className="mt-8 text-fg">Handing somebody a ticket at the gate</h3>
        <p className="text-muted">
          Rather than kicking them, sell them the show. They are already here.
        </p>
        <Code>{LUAU_RESERVE}</Code>

        <h3 className="mt-8 text-fg">Selling a VIP tier, properly</h3>
        <Code>{LUAU_RECEIPT}</Code>

        <h3 className="mt-8 text-fg">Looking somebody up by name</h3>
        <p className="text-muted">
          For a staff command or an admin panel, where a person is typing rather
          than a server reading <Mono>Player.UserId</Mono>:
        </p>
        <Code>{LUAU_LOOKUP}</Code>
        <p className="mt-4 text-muted">
          The response&rsquo;s <Mono>holder</Mono> block comes back with the
          canonical <Mono>robloxId</Mono>, <Mono>username</Mono> and{" "}
          <Mono>displayName</Mono> of whoever we matched. Read it before acting on
          the answer — it is how you confirm the name resolved to the person you
          meant.
        </p>
      </Section>

      <p className="mt-10 text-sm text-faint">
        The machine-readable copy of everything above lives at{" "}
        <a
          href="/llm.txt"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-fg"
        >
          /llm.txt
        </a>
        . If the code and this page ever disagree, the code wins and this page is
        the bug.
      </p>
    </div>
  );
}

/* ---- The local component vocabulary --------------------------------------
   Same shapes as the settings page: a card per section, a bordered box for
   anything monospaced, and nothing that needs a colour of its own. */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-bg p-4">
      <pre className="font-mono text-xs leading-relaxed text-fg">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] text-fg">{children}</code>;
}

/** A table that scrolls inside itself rather than widening the page. */
function TableBox({
  minWidth,
  children,
}: {
  minWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-bg">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
  );
}

/** An aside from llm.txt — the blockquotes. Quieter than a callout. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 border-l-2 border-line pl-4 text-sm text-muted">
      {children}
    </div>
  );
}

/**
 * The two things on this page somebody must not skim past: what to branch on,
 * and what /purchase does not check. A border, so the eye stops.
 */
function Callout({
  kind,
  title,
  children,
}: {
  kind: "accent" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const accent = kind === "accent";
  return (
    <div
      className={`mt-6 rounded-xl border p-6 ${
        accent ? "border-accent bg-accent-soft" : "border-line bg-bg"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-kicker ${
          accent ? "text-accent" : "text-amber-400"
        }`}
      >
        {accent ? "Read this one" : "Warning — the trust boundary"}
      </p>
      <h3 className="mt-2 font-display text-xl text-fg">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Method({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
        method === "GET"
          ? "bg-emerald-400/10 text-emerald-300"
          : "bg-accent-soft text-accent"
      }`}
    >
      {method}
    </span>
  );
}
