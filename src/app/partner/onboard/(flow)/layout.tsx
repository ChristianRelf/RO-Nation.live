import type { Metadata } from "next";
import Link from "next/link";
import { requirePartnerAccount } from "@/lib/partner-account";
import { PortalFooter } from "@/components/portal-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Setting up", template: "%s · Setting up" },
  robots: { index: false, follow: false },
};

/**
 * The guided setup's chrome, and its courtesy guard.
 *
 * NOT the lock. requirePartnerAccount() is called here because the header needs a name to
 * greet somebody by, and every page under this layout calls it again for itself - a page
 * segment renders in parallel with its layout and is serialised into the RSC payload
 * either way, so a layout-only guard still ships the page's body to somebody it just
 * redirected. See lib/session.ts, and the identical note on the hub's layout.
 *
 * ---- Why this is not PartnerShell --------------------------------------------
 *
 * The hub's shell is a tool: tabs to the areas somebody moves between, a sign-out, an
 * avatar. This is a FLOW - one thing at a time, in order, with a way out. Tabs to
 * "Documents" and "Payments" across the top of it would invite exactly the wandering the
 * flow exists to prevent, and the two links that matter here (skip, and the hub) are the
 * only ones on it.
 *
 * ---- The (flow) route group is load-bearing ---------------------------------
 *
 * /onboard/site/<uuid> is a BEARER LINK, opened by somebody who may hold no account at
 * all - their designer, their manager. Under this layout, the guard above would turn
 * every one of them away at a URL RNL itself sent them.
 *
 * A route group is what keeps them apart without changing either URL: (flow) wraps the
 * guarded steps and contributes nothing to the path, while app/partner/onboard/site sits
 * beside it and inherits none of this. Move site/ inside the group and the brief becomes
 * unopenable by exactly the people it exists for.
 */
export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePartnerAccount();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div aria-hidden className="h-px w-full bg-accent/40" />
        <div className="shell flex h-14 items-center justify-between gap-6">
          <span className="flex items-center gap-3">
            <span className="display text-xl leading-none tracking-tight">
              RO. Nation LIVE
            </span>
            <span aria-hidden className="hidden h-3.5 w-px bg-line-strong sm:block" />
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
              {user.account.name}
            </span>
          </span>

          {/* The way out, and it is deliberately present on every step. A setup flow with
              no exit is a trap, and a partner who wants to look at something and come back
              will otherwise do it with the back button, which loses whatever they typed. */}
          <Link
            href="/hub"
            className="shrink-0 text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
          >
            Finish later
          </Link>
        </div>
      </header>

      <main className="shell flex-1 py-10 sm:py-14">{children}</main>

      <PortalFooter />
    </div>
  );
}
