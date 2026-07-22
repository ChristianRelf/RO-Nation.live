import type { ReactNode } from "react";
import Link from "next/link";
import { PortalFooter } from "@/components/portal-footer";
import { PartnerNav } from "@/components/partner/partner-nav";

// The chrome for portal.ronation.live/partner. Modelled on the hub's HubHeader + PortalFooter:
// portal chrome, not marketing chrome (the middleware puts /partner in the "portal" bucket, so
// the root layout renders neither the "Book tickets" header nor the marketing footer). The
// identity block and sign-out mirror the hub so a partner and a staffer see the same shape.
export function PartnerShell({
  user,
  showAccounting,
  children,
}: {
  user: { displayName: string; avatarUrl?: string };
  showAccounting: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div aria-hidden className="h-px w-full bg-accent/40" />

        <div className="shell flex h-14 items-center justify-between gap-6">
          <Link href="/partner" className="group flex items-center gap-3">
            <span className="display text-xl leading-none tracking-tight">
              RO. Nation LIVE
            </span>
            <span aria-hidden className="hidden h-3.5 w-px bg-line-strong sm:block" />
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent transition-opacity group-hover:opacity-70 sm:inline">
              Partners
            </span>
          </Link>

          <div className="flex items-center gap-2">
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
              <span className="hidden text-xs font-semibold leading-none sm:block">
                {user.displayName}
              </span>
            </div>

            <a
              href="/api/auth/logout?returnTo=/partner"
              className="rounded-brand border border-transparent px-2.5 py-2 text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              Sign out
            </a>
          </div>
        </div>

        <div className="shell border-t border-line/60 py-1.5">
          <PartnerNav showAccounting={showAccounting} />
        </div>
      </header>

      <main className="shell flex-1 py-10 sm:py-14">{children}</main>

      <PortalFooter />
    </div>
  );
}
