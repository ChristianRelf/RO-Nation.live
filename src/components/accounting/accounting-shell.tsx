import type { ReactNode } from "react";
import type { CompanyUser } from "@/lib/company";
import { CompanyShell } from "@/components/company-shell";

// The chrome for the accounting DESK pages - the hub, the builder, the refund page.
//
// It is CompanyShell (so the company sidebar is still there to navigate by) plus one
// quiet line at the foot, and nothing else. The marketing header and footer are gone -
// see areaFor() in middleware.ts - because this is a finance tool, and a page about
// money framed by "Book tickets" and a newsletter sign-up reads like a page you
// shouldn't be typing figures into.
//
// NOT used by the document pages. A document draws its own letterhead and its own
// footer, and it is a printable sheet: a second footer under it would print, directly
// beneath the one the document already ends with.
export function AccountingShell({
  user,
  children,
}: {
  user: CompanyUser;
  children: ReactNode;
}) {
  return (
    <CompanyShell user={user}>
      <div className="min-h-[70vh]">{children}</div>

      {/* Deliberately understated. It is a maker's mark at the bottom of a workspace,
          not a banner - anything louder competes with the figures above it, which are
          the only thing on the page anybody is here to read. */}
      <footer className="mt-16 border-t border-line pt-5">
        <p className="text-[11px] uppercase tracking-kicker text-faint">
          Powered by RO. Nation LIVE Accounting
        </p>
      </footer>
    </CompanyShell>
  );
}
