import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
// round trip succeeds for any Roblox account, and the grant decides the rest.
//
// This page is now only the second of those. "Sign in with Roblox" - and the
// sign-in error messages that went with it - moved to /login, the one front door
// every anonymous request to this host reaches. What is left is the state that
// could never be shared: signed in, but this partner has not granted you access,
// which is a different sentence from SHASHA's rank rule and from the docs'.
// See the header of app/login/page.tsx for the whole argument.

export default async function PartnerAccessPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { returnTo?: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  const base = partnerPortalPath(partner.slug);
  const access = await getPartnerAccess(partner.slug);
  if (access?.state === "allowed") redirect(base);

  // Only ever return somewhere inside THIS partner's portal. Without the check,
  // ?returnTo=https://evil.example is an open redirect dressed up as a login.
  const returnTo =
    searchParams.returnTo?.startsWith(`${base}/`) ||
    searchParams.returnTo === base
      ? searchParams.returnTo
      : base;

  // Not signed in - that half of this page moved to /login, which every anonymous
  // request to this host already reaches by way of the gate in middleware.ts. The
  // sanitised returnTo goes with them, so signing in resumes the page they wanted
  // rather than the portal's front page.
  if (access?.state === "anonymous") {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

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

            {/* Only one state left to draw - anonymous redirected out above. */}
            <div className="card mt-8 p-6">
              <h2 className="font-display text-xl uppercase">No access</h2>
              <p className="mt-3 text-sm text-muted">
                You&apos;re signed in as{" "}
                <span className="font-semibold text-fg">
                  {access?.state === "denied" ? access.session.displayName : ""}
                </span>
                , but that account hasn&apos;t been given access to the{" "}
                {partner.name} portal.
              </p>
              <p className="mt-3 text-xs text-faint">
                Access here is granted per account, not by Roblox group rank - so
                a promotion in the group won&apos;t do it. Ask {partner.name}{" "}
                management, or RO. Nation LIVE, to add you.
              </p>

              <div className="mt-6 flex flex-col gap-2">
                {/* Not everybody refused HERE is refused everywhere - RNL staff
                    and other partners' crew land on this card all the time. The
                    hub is the page that knows which doors they do hold. */}
                <Link href="/hub" className="btn btn-accent w-full">
                  See what you can open
                </Link>
                <a
                  href={`/api/auth/logout?returnTo=${encodeURIComponent("/login")}`}
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
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}
