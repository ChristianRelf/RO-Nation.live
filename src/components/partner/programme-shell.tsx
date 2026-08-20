import type { ReactNode } from "react";
import Link from "next/link";
import { PortalFooter } from "@/components/portal-footer";

// The chrome for the PUBLIC front of partner.ronation.live - the programme page, the
// application form, an invitation, a site brief.
//
// ---- Why this host has two shells ------------------------------------------
//
// PartnerShell is for /hub: a signed-in partner, with their avatar in the corner, tabs to
// their agreements and a sign-out. Everything it renders assumes a person we know.
//
// The pages here assume the opposite. A stranger reading the programme, somebody opening
// an invitation who has never visited, a designer filling in a brief on a link that was
// forwarded to them. None of them have a session, none of them have anything to sign out
// of, and putting an empty identity block above them would be furniture that says "you
// are logged out" to somebody who was never logged in.
//
// So: one wordmark that goes home, one call to action, and the same slim policy footer
// every RNL portal uses. The header is deliberately not sticky - these are pages people
// read from top to bottom, not tools they navigate.
//
// ---- signedIn is a courtesy, not a gate ------------------------------------
//
// Resolved by the page, on the server. It only swaps the call to action: somebody who
// already holds an account is offered their hub instead of an application form, because
// "Ask about partnering" is a strange thing to be shown when you are already a partner.
// Nothing here checks whether they may open what it links to - /hub does that for itself.
export function ProgrammeShell({
  cta,
  children,
}: {
  /**
   * The one link in the header, or none.
   *
   * Pages that ARE the call to action pass nothing - a header button pointing at the form
   * somebody is already filling in is a button that can only lose their work.
   */
  cta?: { label: string; href: string } | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div aria-hidden className="h-px w-full bg-accent/40" />

        <div className="shell flex h-16 items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="display text-xl leading-none tracking-tight">
              RO. Nation LIVE
            </span>
            <span aria-hidden className="hidden h-3.5 w-px bg-line-strong sm:block" />
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent transition-opacity group-hover:opacity-70 sm:inline">
              Partner programme
            </span>
          </Link>

          {cta ? (
            <Link href={cta.href} className="btn btn-accent shrink-0 text-sm">
              {cta.label}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <PortalFooter />
    </div>
  );
}
