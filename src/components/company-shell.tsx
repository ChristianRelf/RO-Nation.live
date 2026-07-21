import type { ReactNode } from "react";
import type { CompanyUser } from "@/lib/company";
import { CompanyNav } from "./company-nav";

// The Company chrome: the sidebar and the content column beside it. Lifted out of
// (dash)/layout.tsx so the invoice pages - which live OUTSIDE that route group, because
// the printable invoice DOCUMENT must not inherit a layout it would print - can wear the
// same shell without the two drifting. One shell, rendered by the group layout for most
// pages and by hand for the invoice lists.
export function CompanyShell({
  user,
  children,
}: {
  user: CompanyUser;
  children: ReactNode;
}) {
  return (
    <div className="shell py-10">
      <div className="grid gap-8 lg:grid-cols-[210px_1fr]">
        <CompanyNav
          user={{
            displayName: user.displayName,
            roleName: user.roleName,
            rank: user.rank,
          }}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
