import type { ReactNode } from "react";
import type { CompanyUser } from "@/lib/company";
import { AccountsNav } from "./accounts-nav";
import { outboundUrls } from "@/lib/accounting/urls";

// The chrome for accounts.ronation.live - the STAFF side of the payment system.
//
// It used to be CompanyShell plus a footer line, because the desk used to be a section
// inside ronation.live/company. It is now a portal of its own, on its own host, so it
// draws its own sidebar (AccountsNav) - the company one's links all point at a different
// hostname and would every one of them 404. See the note at the top of that file.
//
// The marketing header and footer stay gone - see areaFor() in middleware.ts - because
// this is a finance tool, and a page about money framed by "Book tickets" and a newsletter
// sign-up reads like a page you shouldn't be typing figures into.
//
// Everything that leaves this host is ABSOLUTE and comes from lib/accounting/urls.ts.
// There are only a few such links and they are all in the block at the bottom of the
// sidebar, which is deliberate: crossing a host boundary should be a visible act, not
// something that happens because a nav item was copied in from somewhere else.
//
// NOT used by the document pages. A document draws its own letterhead and its own footer,
// and it is a printable sheet: a second footer under it would print, directly beneath the
// one the document already ends with.
export function AccountingShell({
  user,
  openRequests = 0,
  children,
}: {
  user: CompanyUser;
  /**
   * Payment requests still waiting on somebody - the badge in the nav.
   *
   * Passed in rather than counted here, so a page that has already read the queue (the
   * requests page itself) does not pay for a second COUNT, and a page that has not can
   * decide whether the round trip is worth it. Defaults to none, which renders no badge -
   * an absent count must never look like a settled one.
   */
  openRequests?: number;
  children: ReactNode;
}) {
  return (
    <div className="shell py-10">
      <div className="grid gap-8 lg:grid-cols-[210px_1fr]">
        <div className="min-w-0">
          <AccountsNav
            user={{
              displayName: user.displayName,
              roleName: user.roleName,
              rank: user.rank,
            }}
            openRequests={openRequests}
          />

          {/* The doors out. Absolute, because every one of them is on another host. */}
          <div className="mt-6 hidden flex-col gap-1 border-t border-line pt-4 lg:flex">
            <OutLink href={outboundUrls.payoutInvoices()}>Payout invoices ↗</OutLink>
            <OutLink href={outboundUrls.company()}>Company ↗</OutLink>
            <OutLink href={outboundUrls.hub()}>Backstage hub ↗</OutLink>
            {/* Same-host, so no arrow and no absolute URL - signing out has to happen on
                THIS host or the cookie it clears is the wrong one. See lib/session.ts. */}
            <a
              href="/api/auth/logout"
              className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-red-400"
            >
              Sign out
            </a>
          </div>
        </div>

        <div className="min-w-0">
          <div className="min-h-[70vh]">{children}</div>

          {/* Deliberately understated. It is a maker's mark at the bottom of a workspace,
              not a banner - anything louder competes with the figures above it, which are
              the only thing on the page anybody is here to read. */}
          <footer className="mt-16 border-t border-line pt-5">
            <p className="text-[11px] uppercase tracking-kicker text-faint">
              Powered by RO. Nation LIVE Accounting
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

/**
 * A plain <a>, never a <Link>, because every one of these hands the request to another
 * host. A <Link> would trigger a client RSC fetch of the path, which the middleware
 * answers with a redirect the browser then cannot follow cross-origin - Next logs
 * "Failed to fetch RSC payload … Falling back to browser navigation" and does the hard
 * nav anyway. Same reasoning as NavItem.hardNav in lib/site.ts.
 */
function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
    >
      {children}
    </a>
  );
}
