import Link from "next/link";
import type { Partner } from "@/lib/partners/registry";
import { getUserSession } from "@/lib/session";

/**
 * A partner site's own header. Links are bare paths ("/events") because the
 * browser is already on <slug>.ronation.live and the middleware rewrites from
 * there — see lib/partners/urls.ts.
 */
export async function PartnerHeader({ partner }: { partner: Partner }) {
  const session = await getUserSession();

  const nav = [
    { label: "Shows", href: "/events" },
    { label: "Tickets", href: "/tickets" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" className="group flex flex-col leading-none">
          <span className="display text-xl tracking-wide sm:text-2xl">
            {partner.name}
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-kicker text-faint">
            {partner.tagline}
          </span>
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
