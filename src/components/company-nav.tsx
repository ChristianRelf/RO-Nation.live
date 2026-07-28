"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The Company sidebar. Everything on ronation.live is authored from behind these links -
// the /admin dashboard that used to hold some of them is gone.
//
// It is GROUPED, and that is not decoration. It was a flat list of nine, which is about
// where a flat list stops working; team, testimonials, enquiries and partners take it to
// thirteen, and thirteen undifferentiated links is a menu you scan rather than read.
//
// The groups answer the question you actually arrive with - "what am I here to do?" -
// rather than the one the database would answer:
//
//   The shows    the thing RNL does. Events, and the door you check people in at.
//   Content      things RNL publishes.
//   People       every human the org touches, from the crew to the inbox.
type NavLink = {
  label: string;
  href: string;
  /**
   * This link leaves ronation.live. Rendered as a plain <a> with an arrow.
   *
   * A <Link> across a host boundary triggers a client RSC fetch that the middleware
   * answers with a cross-origin redirect the browser cannot follow - Next logs "Failed to
   * fetch RSC payload … Falling back to browser navigation" and does the hard nav anyway.
   * Same reasoning as NavItem.hardNav in lib/site.ts.
   */
  out?: boolean;
};

/**
 * The groups, as a FUNCTION of the one href that has to come from the server.
 *
 * ---- Why accountsHref is a prop and not an import -------------------------
 *
 * This is a "use client" module, so everything at its top level is evaluated TWICE: once
 * on the server, where process.env.NEXT_PUBLIC_SITE_URL is read at runtime, and again in
 * the browser from the client bundle - where Next inlined that variable AT BUILD TIME. The
 * image is built without it (docker-compose passes it at runtime), so the baked value is
 * the "http://localhost:3000" fallback.
 *
 * Calling accountsOrigin() up here would therefore render the right link on the server and
 * replace it with http://accounts.localhost:3000 the moment React hydrates - a link that
 * works until the page finishes loading, which is about the worst failure shape available.
 * lib/site.ts documents the same trap for site.domain.
 *
 * So the origin is resolved by CompanyShell, on the server, and handed down.
 */
const groupsFor = (accountsHref: string): { title: string; links: NavLink[] }[] => [
  {
    title: "The shows",
    links: [
      { label: "Overview", href: "/company" },
      { label: "Events", href: "/company/events" },
      { label: "Tickets", href: "/company/tickets" },
      { label: "Venues", href: "/company/venues" },
      { label: "Door", href: "/company/door" },
    ],
  },
  {
    title: "Content",
    links: [
      { label: "Blog", href: "/company/blog" },
      { label: "Merch", href: "/company/merch" },
      { label: "Docs", href: "/company/docs" },
      { label: "Surveys", href: "/company/surveys" },
    ],
  },
  {
    title: "People",
    links: [
      { label: "Team", href: "/company/team" },
      { label: "Careers", href: "/company/careers" },
      { label: "Applications", href: "/company/applications" },
      { label: "Testimonials", href: "/company/testimonials" },
      { label: "Enquiries", href: "/company/enquiries" },
      { label: "Partners", href: "/company/partners" },
      { label: "Partner accounts", href: "/company/partner-accounts" },
      { label: "SHASHA access", href: "/company/shasha" },
    ],
  },
  {
    // Money. Invoices used to sit under People, which was where it fitted least badly
    // when it was the only one of these; with the payment system beside it, the two
    // together are plainly their own thing.
    //
    // They stay SEPARATE links rather than one, because they are separate instruments:
    // a payout statement is DERIVED from the ticket ledger and nobody types a figure
    // into it, while everything in Accounts is hand-authored. One link would imply
    // you can edit a payout, which is exactly what its whole design forbids.
    title: "Money",
    links: [
      // Accounting is now a portal on its own host, so this is an ABSOLUTE URL and it is
      // marked `out`. A relative /company/accounting would still work - the middleware
      // forwards it - but it would cost a redirect on every click and would light up as
      // "active" against a path that no longer exists. See lib/accounting/urls.ts.
      { label: "Accounts", href: accountsHref, out: true },
      { label: "Payout invoices", href: "/company/invoices" },
    ],
  },
];

export function CompanyNav({
  user,
  accountsHref,
}: {
  user: { displayName: string; roleName: string; rank: number };
  /** https://accounts.ronation.live - resolved on the server. See groupsFor above. */
  accountsHref: string;
}) {
  const pathname = usePathname();
  const groups = groupsFor(accountsHref);

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-6">
        <p className="font-display text-2xl uppercase">Company</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {user.roleName} · rank {user.rank}
        </p>
      </div>

      {/* On a narrow screen the groups collapse back into one scrolling row - the
          headings are structure, and on a phone the structure is the scroll. */}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0">
        {groups.map((group) => (
          <div key={group.title} className="contents lg:block">
            <p className="hidden lg:mb-1.5 lg:mt-5 lg:block lg:px-3 lg:text-[10px] lg:font-bold lg:uppercase lg:tracking-kicker lg:text-faint lg:first:mt-0">
              {group.title}
            </p>

            {group.links.map((l) => {
              const className = cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:block",
                "text-muted hover:bg-surface/60 hover:text-fg",
              );

              // An off-site link is never "active" - you are by definition not on it -
              // and it is an <a>, not a <Link>. See NavLink.out above.
              if (l.out) {
                return (
                  <a key={l.href} href={l.href} className={className}>
                    {l.label} ↗
                  </a>
                );
              }

              const active =
                l.href === "/company"
                  ? pathname === "/company"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:block",
                    active
                      ? "bg-surface text-fg"
                      : "text-muted hover:bg-surface/60 hover:text-fg",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-1 border-t border-line pt-4">
        <Link
          href="/company/settings"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          Settings
        </Link>
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          View site ↗
        </Link>
        <a
          href="/api/auth/logout"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-red-400"
        >
          Sign out
        </a>
      </div>
    </aside>
  );
}
