import { AdminHeader } from "@/components/admin-ui";
import { env, robloxConfigured, devLoginEnabled } from "@/lib/env";
import { requireCompanyUser } from "@/lib/company";

export const dynamic = "force-dynamic";

const luau = `local HttpService = game:GetService("HttpService")

local API_BASE = "%SITE%/api/v1"
local API_KEY  = "YOUR_GAME_API_KEY"   -- keep this server-side only
local EVENT_ID = "paste-the-event-id-here"

-- Call when a player joins the event place, then let them in / kick.
local function redeemTicket(player)
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
				eventId = EVENT_ID,
			}),
		})
	end)

	if not ok or not res.Success then
		return false
	end
	local data = HttpService:JSONDecode(res.Body)
	return data.redeemed == true or data.alreadyRedeemed == true
end

game.Players.PlayerAdded:Connect(function(player)
	if not redeemTicket(player) then
		player:Kick("No valid ticket found for this event.")
	end
end)`;

export default async function SettingsPage() {
  await requireCompanyUser();
  const base = env.siteUrl;
  const script = luau.replace("%SITE%", base);

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
        <StatusTile
          label="In-game API key"
          ok={Boolean(env.gameApiKey)}
          okText="Set"
          badText="Missing"
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
          Your Roblox experience verifies tickets by calling these endpoints with
          the header{" "}
          <code className="font-mono text-fg">x-api-key: &lt;GAME_API_KEY&gt;</code>
          . Enable{" "}
          <span className="text-fg">Allow HTTP Requests</span> in Game Settings →
          Security.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody className="divide-y divide-line">
              <EndpointRow
                method="GET"
                path="/api/v1/events"
                desc="List published upcoming events + counts"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/verify"
                desc="Check if a ticket is valid (no side effects)"
              />
              <EndpointRow
                method="POST"
                path="/api/v1/tickets/redeem"
                desc="Mark a ticket checked-in at the door"
              />
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Verify with curl
        </p>
        <Code>{`curl -X POST ${base}/api/v1/tickets/verify \\
  -H "x-api-key: $GAME_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code":"RN-AB12CD"}'`}</Code>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Roblox (Luau) — kick players without a ticket
        </p>
        <Code>{script}</Code>

        <p className="mt-4 text-sm text-muted">
          Tickets can be looked up by{" "}
          <code className="font-mono text-fg">code</code> or by{" "}
          <code className="font-mono text-fg">robloxId</code> +{" "}
          <code className="font-mono text-fg">eventId</code>. Find an event&apos;s
          ID on its Attendees page.
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
