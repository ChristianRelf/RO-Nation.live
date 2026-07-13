import { AdminHeader } from "@/components/admin-ui";
import { env, robloxConfigured, devLoginEnabled } from "@/lib/env";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

// The snippet on the settings page. It MUST track the API's real response shape:
// this is the code people paste into a live game, and a field that no longer
// exists reads as `nil`, which reads as "no ticket", which kicks the room.
//
// Full documentation, written for an LLM to build from, lives at /llm.txt.
const luau = `local HttpService = game:GetService("HttpService")

local API_BASE = "%SITE%/api/v1"
local API_KEY  = "rnl_..."             -- mint one in the portal. Server-side ONLY.
local EVENT_ID = "paste-the-event-id-here"

-- Redeem the ticket of whoever just joined, and let them in or kick them.
local function admit(player)
	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = API_BASE .. "/tickets/redeem",
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["x-api-key"] = API_KEY,
			},
			Body = HttpService:JSONEncode({
				robloxId = tostring(player.UserId),
				eventId = EVENT_ID,   -- pins the check to THIS show
			}),
		})
	end)

	-- The network failed. Fail OPEN: a blip at our end must not start kicking
	-- a room full of people out of a show they hold tickets for.
	if not ok or not res.Success then
		return true
	end

	local data = HttpService:JSONDecode(res.Body)

	-- Branch on \`admit\`, never on \`valid\` — an already-used ticket is still
	-- a valid one, and it must not let a second person through.
	if data.admit then
		if data.ticket.admission.kind == "VIP" then
			print(player.Name .. " is VIP: " .. data.ticket.admission.tier)
		end
		return true
	end

	player:Kick(data.message or "No valid ticket for this show.")
	return false
end

game.Players.PlayerAdded:Connect(admit)`;

export default async function SettingsPage() {
  await requireCompanyUser();
  const base = env.siteUrl;
  const script = luau.replace("%SITE%", base);

  // The portal is a subdomain of whatever host we are actually on, so this is
  // right in dev (http://portal.localhost:3000) and in production alike — the same
  // reason the middleware derives everything from the Host header rather than an
  // env var. Keys and the API docs both live over there.
  const portalOrigin = base.replace(/^(https?:\/\/)/, "$1portal.");

  return (
    <div>
      <AdminHeader
        title="Settings & integrations"
        subtitle="Connect the site to Roblox login and to your in-game entry system."
      />

      {/* Status */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatusTile
          label="Roblox OAuth"
          ok={robloxConfigured}
          okText="Configured"
          badText="Not configured"
        />
        {/* Set is now the state to WORRY about, not the healthy one. Keys are rows
            in the database, minted per organisation with scopes; this env var is
            the old global one, and it is unscoped and all-powerful. Amber, not
            green. See lib/apikey.ts. */}
        <StatusTile
          label="Root API key (legacy)"
          ok={!env.gameApiKey}
          okText="Retired"
          badText="Set — unscoped"
          invert
        />
        <StatusTile
          label="Dev login"
          ok={!devLoginEnabled}
          okText="Off (production)"
          badText="On (local only)"
          invert
        />
      </div>

      {/* Roblox OAuth */}
      <Section title="Roblox sign-in">
        <p className="text-muted">
          Create an OAuth app in the{" "}
          <a
            href="https://create.roblox.com/dashboard/credentials"
            className="text-accent"
            target="_blank"
            rel="noreferrer"
          >
            Roblox Creator Dashboard
          </a>{" "}
          and register this redirect URL, with scopes{" "}
          <code className="font-mono text-fg">openid profile</code>:
        </p>
        <Code>{`${base}/api/auth/roblox/callback`}</Code>
        <Row label="Client ID" value={env.roblox.clientId || "— add ROBLOX_CLIENT_ID —"} />
        <Row
          label="Client secret"
          value={robloxConfigured ? "•••••••• (set)" : "— add ROBLOX_CLIENT_SECRET —"}
        />
      </Section>

      {/* In-game API */}
      <Section title="In-game ticket API">
        <p className="text-muted">
          Your Roblox experience talks to the door by calling these with the header{" "}
          <code className="font-mono text-fg">x-api-key: &lt;key&gt;</code>. Enable{" "}
          <span className="text-fg">Allow HTTP Requests</span> in Game Settings →
          Security.
        </p>

        <p className="text-muted">
          Keys are minted per organisation, with scopes, at{" "}
          <a
            href={`${portalOrigin}/shasha/keys`}
            className="text-accent hover:text-fg"
          >
            portal.ronation.live/shasha/keys
          </a>
          . A key belongs to one org and can do only what it was granted — a door
          scanner that leaks cannot be turned into a ticket printer. Partners mint
          their own, in their own portal, and theirs can never see RNL&apos;s shows.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody className="divide-y divide-line">
              <EndpointRow method="GET" path="/api/v1/events" desc="The upcoming line-up" />
              <EndpointRow
                method="GET"
                path="/api/v1/events/<id>"
                desc="One show: tiers, prices, seats left"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/verify"
                desc="Is this ticket good? (no side effects)"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/redeem"
                desc="Check somebody in at the door"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/reserve"
                desc="Give a player a free ticket"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/gift"
                desc="One player gives another a ticket"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/purchase"
                desc="They paid Robux — issue the paid ticket"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/void"
                desc="Cancel a ticket. They may reserve again"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/revoke"
                desc="Cancel it, and bar them from the show"
              />
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Verify with curl
        </p>
        <Code>{`curl -X POST ${base}/api/v1/tickets/verify \\
  -H "x-api-key: $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"RN-AB12CD"}'`}</Code>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Roblox (Luau) — kick players without a ticket
        </p>
        <Code>{script}</Code>

        <p className="mt-4 text-sm text-muted">
          The full contract — every endpoint, every field, every{" "}
          <code className="font-mono text-fg">reason</code>, and working Luau for
          the door and for ProcessReceipt — is at{" "}
          <a
            href={`${portalOrigin}/docs/api`}
            className="text-accent hover:text-fg"
          >
            portal.ronation.live/docs/api
          </a>
          , and in machine-readable form at{" "}
          <a
            href="/llm.txt"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-fg"
          >
            /llm.txt
          </a>
          , which is written to be handed straight to an LLM.
        </p>
      </Section>

      {/* The manual door */}
      <Section title="The manual door">
        <p className="text-muted">
          Every scanner dies mid-queue eventually. Crew can check a ticket and
          check somebody in by hand, from a browser — the{" "}
          <a href="/company/door" className="text-accent hover:text-fg">
            Door
          </a>{" "}
          page. It calls the same code the game API does, so the laptop and the
          game can never disagree about who gets in.
        </p>
        <p className="mt-3 text-sm text-muted">
          A USB barcode scanner works with no setup: it types the code and presses
          Enter, and the page clears and re-focuses itself after every check.
          Partners have the same page inside their own portal.
        </p>
      </Section>

      {/* Access */}
      <Section title="Who gets in">
        <Row label="Roblox group" value={env.company.groupId} />
        <Row
          label="Company (here)"
          value={`Rank ${env.company.minRank}+`}
        />
        <Row
          label="Every partner portal"
          value={`Rank ${env.partners.staffRank}+`}
        />
        <Row
          label="SHASHA"
          value={`Rank ${env.shasha.minRank}+ to read, ${env.shasha.managerRank}+ to write`}
        />
        <p className="mt-2 text-sm text-muted">
          There is no account list and no password to rotate — a rank in the group
          IS the grant, and a demotion IS the revocation. Rank is re-read from
          Roblox on every request, so a change lands within a few minutes.
        </p>
      </Section>
    </div>
  );
}

function StatusTile({
  label,
  ok,
  okText,
  badText,
  invert,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  invert?: boolean;
}) {
  const good = ok;
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            good ? "bg-emerald-400" : invert ? "bg-amber-400" : "bg-red-500"
          }`}
        />
        <span className="font-medium">{good ? okText : badText}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mt-6 p-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-sm text-fg">{value}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg p-4">
      <pre className="font-mono text-xs leading-relaxed text-fg">{children}</pre>
    </div>
  );
}

function EndpointRow({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  return (
    <tr>
      <td className="py-3 pr-3 align-top">
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
            method === "GET"
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-accent-soft text-accent"
          }`}
        >
          {method}
        </span>
      </td>
      <td className="py-3 pr-3 align-top font-mono text-xs text-fg">{path}</td>
      <td className="py-3 align-top text-sm text-muted">{desc}</td>
    </tr>
  );
}
