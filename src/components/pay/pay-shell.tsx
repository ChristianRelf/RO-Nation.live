import type { ReactNode } from "react";
import Link from "next/link";
import { PortalFooter } from "@/components/portal-footer";
import { PayNav } from "@/components/pay/pay-nav";

// The chrome for pay.ronation.live - the CLIENT side of the payment system.
//
// Modelled on PartnerShell, deliberately: this is the same person, signing in with the
// same Roblox account, and the two areas should read as two rooms in one building rather
// than two products. What differs is the word in the header and the tabs under it.
//
// The marketing header and footer are off - see areaFor() in middleware.ts, which puts
// /pay in its own area. A page where somebody reads what they are owed does not want
// "Book tickets" above it.
//
// ---- One thing to be careful with -----------------------------------------
//
// Every link in here is RELATIVE, and must stay that way: this shell only ever renders on
// pay.ronation.live, so "/" is the overview and "/statements" is the statement list. The
// two places the area genuinely leaves the host - a document, and querying something with
// RNL - use absolute URLs from lib/accounting/urls.ts and are plain <a>. See the note on
// OutLink in components/accounting/accounting-shell.tsx for why <Link> is wrong for those.
export function PayShell({
  user,
  accountName,
  openRequests = 0,
  children,
}: {
  user: { displayName: string; avatarUrl?: string | null };
  /** The ENTITY, not the person - it is the entity the money belongs to. */
  accountName: string;
  openRequests?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div aria-hidden className="h-px w-full bg-accent/40" />

        <div className="shell flex h-14 items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="display text-xl leading-none tracking-tight">
              RO. Nation LIVE
            </span>
            <span aria-hidden className="hidden h-3.5 w-px bg-line-strong sm:block" />
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent transition-opacity group-hover:opacity-70 sm:inline">
              Payments
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* The ENTITY is named beside the person, and that is not decoration. A
                company may have several logins, and "you are looking at Sleep Token's
                money as Chris" is the one fact somebody needs before they read a figure
                or submit a request on the entity's behalf. */}
            <div className="flex items-center gap-2.5 rounded-brand border border-line py-1 pl-1 pr-3">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-brand"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-brand bg-accent text-xs font-bold text-accent-ink">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden leading-tight sm:block">
                <span className="block text-xs font-semibold">{accountName}</span>
                <span className="block text-[10px] text-faint">
                  {user.displayName}
                </span>
              </span>
            </div>

            {/* Same-host, and returnTo is a path on THIS host - signing out has to clear
                the cookie that was set here. See lib/session.ts. */}
            <a
              href="/api/auth/logout?returnTo=/"
              className="rounded-brand border border-transparent px-2.5 py-2 text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              Sign out
            </a>
          </div>
        </div>

        <div className="shell border-t border-line/60 py-1.5">
          <PayNav openRequests={openRequests} />
        </div>
      </header>

      <main className="shell flex-1 py-10 sm:py-14">{children}</main>

      <PortalFooter />
    </div>
  );
}
