import type { Metadata } from "next";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";
import { createStudioEvent } from "@/app/actions/studio-events";
import { EventForm } from "@/components/event-form";
import { env } from "@/lib/env";
import { robuxSalesAllowed } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New show" };

export default async function NewShashaShowPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Management only, guarded in the PAGE rather than left to the layout - a layout
  // redirect still ships this page's RSC payload in the body of the 307 that
  // bounced it. See lib/session.ts.
  await requireScopeManager(SHASHA_SCOPE);

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Line-up
        </p>
        <h1 className="display mt-3 text-5xl">New show</h1>
        <p className="mt-2 text-sm text-muted">
          Save it as a draft while you work on it. Publishing puts it on
          ronation.live and opens tickets.
        </p>
      </div>

      <EventForm
        action={createStudioEvent}
        error={searchParams.error}
        cancelHref="/shasha/shows"
        scope={SHASHA_SCOPE}
        // null, not "shasha" - robuxSalesAllowed asks about a PARTNER, and RNL is
        // the org that has none. The platform switch is what decides it here.
        robuxEnabled={robuxSalesAllowed(null, env.robuxTickets)}
      />
    </div>
  );
}
