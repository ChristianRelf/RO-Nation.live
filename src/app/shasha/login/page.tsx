import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { discordConfigured, env } from "@/lib/env";
import { getPortalUser } from "@/lib/session";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "SHASHA — sign in",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  denied: "Discord sign-in was cancelled.",
  state: "That sign-in link expired. Give it another go.",
  exchange: "Discord wouldn't complete the sign-in. Try again in a moment.",
  unauthorised:
    "That Discord account isn't on the SHASHA access list. Ask management to add your Discord ID.",
  "not-configured":
    "Discord sign-in isn't configured on this server yet (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET).",
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; returnTo?: string };
}) {
  if (await getPortalUser()) redirect("/shasha");

  const message = searchParams.error ? ERRORS[searchParams.error] : null;
  const noManagers = !env.discord.managerIds.length;
  const returnTo = searchParams.returnTo?.startsWith("/shasha")
    ? searchParams.returnTo
    : "/shasha";

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                RO. Nation LIVE
              </p>
              <h1 className="display mt-4 text-6xl">SHASHA</h1>
              <p className="mt-3 text-sm text-muted">
                VIP list &amp; blacklist. Staff access only.
              </p>
            </div>

            <div className="card mt-8 p-6">
              {message ? (
                <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {message}
                </p>
              ) : null}

              {noManagers ? (
                <p className="mb-4 border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                  No managers are configured yet. Set{" "}
                  <code className="font-mono text-xs">DISCORD_MANAGER_IDS</code>{" "}
                  on the server, or nobody will be able to get in.
                </p>
              ) : null}

              <a
                href={`/api/auth/discord/login?returnTo=${encodeURIComponent(returnTo)}`}
                className={`btn w-full ${
                  discordConfigured
                    ? "btn-accent"
                    : "btn-ghost pointer-events-none opacity-40"
                }`}
                aria-disabled={!discordConfigured}
              >
                Continue with Discord
              </a>

              <p className="mt-4 text-center text-xs text-faint">
                Access is granted per Discord account. If you&apos;re not on the
                list, sign-in will be refused.
              </p>
            </div>
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}
