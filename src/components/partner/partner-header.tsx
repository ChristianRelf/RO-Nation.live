import Link from "next/link";
import { partnerHasFeature, type Partner } from "@/lib/partners/registry";
import { getUserSession } from "@/lib/session";
import { PartnerMark } from "./emblem";

/**
 * A partner site's own header. Links are bare paths ("/events") because the
 * browser is already on <slug>.ronation.live and the middleware rewrites from
 * there - see lib/partners/urls.ts.
 *
 * The nav is built from the registry's features, so it can't point at a route
 * this partner doesn't have. That is presentation matching the guard, not
 * standing in for it: the pages themselves call assertPartnerFeature and 404.
 *
 * The mark appears BESIDE the name, never instead of it - unless the partner's
 * `wordmarkLogo` says the mark already IS the name (see the field's note on
 * why that's only ever true for a partner with no real-world act to be
 * mistaken for). Everywhere else, PartnerMark is decorative (aria-hidden)
 * precisely because the words beside it are the thing being announced.
 */
export async function PartnerHeader({ partner }: { partner: Partner }) {
  const session = await getUserSession();

  const nav = [
    ...(partnerHasFeature(partner, "events")
      ? [
          { label: "Shows", href: "/events" },
          { label: "Tickets", href: "/tickets" },
        ]
      : []),
    ...(partnerHasFeature(partner, "blog")
      ? [{ label: "Blog", href: "/blog" }]
      : []),
    ...(partnerHasFeature(partner, "careers")
      ? [{ label: "Crew", href: "/careers" }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-3">
          {partner.wordmarkLogo ? (
            <PartnerMark
              partner={partner}
              size={160}
              alt={partner.name}
              className="max-h-11 shrink-0 opacity-90 transition-opacity group-hover:opacity-100"
            />
          ) : (
            <>
              <PartnerMark
                partner={partner}
                size={34}
                className="max-h-8 shrink-0 opacity-80 transition-opacity group-hover:opacity-100"
              />
              <span className="flex flex-col leading-none">
                <span className="display text-xl tracking-wide sm:text-2xl">
                  {partner.name}
                </span>
                <span className="mt-1 text-[9px] font-semibold uppercase tracking-kicker text-faint">
                  {partner.tagline}
                </span>
              </span>
            </>
          )}
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {nav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              {l.label}
            </Link>
          ))}

          {session ? (
            <Link href="/tickets" className="btn btn-ghost ml-1 py-2">
              {session.displayName}
            </Link>
          ) : (
            <Link href="/account" className="btn btn-accent ml-1 py-2">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
