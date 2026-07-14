import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { robloxConfigured } from "@/lib/env";
import { partnerBySlug } from "@/lib/partners/registry";
import { getPartnerAccess } from "@/lib/partners/guard";
import { partnerOrigin, partnerPortalPath } from "@/lib/partners/urls";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = partnerBySlug(params.slug);
  return {
    title: `${partner?.name ?? "Portal"} - sign in`,
    robots: { index: false, follow: false },
  };
}

// Signing in with Roblox and *having access* are two different things: the OAuth
// round trip succeeds for any Roblox account, and the grant decides the rest. So
// this page has to handle the middle state - signed in, but not a member - or
// someone the partner hasn't been granted access yet would be bounced back here
// on a loop with nothing to read. Same shape as /shasha/login.

const ERRORS: Record<string, string> = {
  denied: "Roblox sign-in was cancelled.",
  state: "That sign-in link expired. Give it another go.",
  exchange: "Roblox wouldn't complete the sign-in. Try again in a moment.",
  "not-configured":
    "Roblox sign-in isn't configured on this server yet (ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET).",
};

export default async function PartnerLoginPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string; returnTo?: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const base = partnerPortalPath(partner.slug);
  const access = await getPartnerAccess(partner.slug);
  if (access?.state === "allowed") redirect(base);

  const message = searchParams.error ? ERRORS[searchParams.error] : null;

  // Only ever return somewhere inside THIS partner's portal. Without the check,
  // ?returnTo=https://evil.example is an open redirect dressed up as a login.
  const returnTo =
    searchParams.returnTo?.startsWith(`${base}/`) ||
    searchParams.returnTo === base
      ? searchParams.returnTo
      : base;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                {partner.name}
              </p>
              <h1 className="display mt-4 text-5xl">Portal</h1>
              <p className="mt-3 text-sm text-muted">
                VIP list &amp; blacklist. Crew access only.
              </p>
            </div>

            {access?.state === "anonymous" ? (
              <div className="card mt-8 p-6">
                {message ? (
                  <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {message}
                  </p>
                ) : null}

                <a
                  href={`/api/auth/roblox/login?returnTo=${encodeURIComponent(returnTo)}`}
                  className={`btn w-full ${
                    robloxConfigured
                      ? "btn-accent"
                      : "btn-ghost pointer-events-none opacity-40"
                  }`}
                  aria-disabled={!robloxConfigured}
                >
                  Sign in with Roblox
                </a>

                <p className="mt-4 text-center text-xs text-faint">
                  Sign in with the Roblox account {partner.name} management gave
                  access to.
                </p>
              </div>
            ) : (
              <div className="card mt-8 p-6">
                <h2 className="font-display text-xl uppercase">No access</h2>
                <p className="mt-3 text-sm text-muted">
                  You&apos;re signed in as{" "}
                  <span className="font-semibold text-fg">
                    {access?.state === "denied"
                      ? access.session.displayName
                      : ""}
                  </span>
                  , but that account hasn&apos;t been given access to the{" "}
                  {partner.name} portal.
                </p>
                <p className="mt-3 text-xs text-faint">
                  Access here is granted per account, not by Roblox group rank -
                  so a promotion in the group won&apos;t do it. Ask {partner.name}{" "}
                  management, or RO. Nation LIVE, to add you.
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  <a
                    href={`/api/auth/logout?returnTo=${encodeURIComponent(`${base}/login`)}`}
                    className="btn btn-ghost w-full"
                  >
                    Sign out
                  </a>
                  <a
                    href={partnerOrigin(partner.slug)}
                    className="btn btn-ghost w-full"
                  >
                    Back to site
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}
