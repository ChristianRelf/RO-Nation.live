import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";
import {
  deleteStudioEvent,
  updateStudioEvent,
} from "@/app/actions/studio-events";
import { EventForm } from "@/components/event-form";
import { ConfirmButton } from "@/components/confirm-button";
import { env } from "@/lib/env";
import { robuxSalesAllowed } from "@/lib/tickets/pricing";
import { tierDraftsFor } from "@/lib/tickets/tiers-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit show" };

export default async function EditShashaShowPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const { scope } = await requireScopeManager(SHASHA_SCOPE);

  // Matched on the org as well as the id, so a partner's event id in the URL is a
  // 404 here rather than an editable form. The write action would refuse it too,
  // but a form that renders somebody else's show and only fails on save is a worse
  // way to find out.
  const event = await prisma.event.findFirst({
    where: { id: params.id, partnerId: scope.eventScope },
  });
  if (!event) notFound();

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            Line-up
          </p>
          <h1 className="display mt-3 text-5xl">Edit show</h1>
          <p className="mt-2 text-sm text-muted">{event.title}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* The seat designer lives on the main site: it is one editor over the
              same VenueMap rows, and forking it onto the portal would be the
              per-area duplicate this whole phase exists to remove. */}
          <a
            href={`${env.siteUrl}/company/events/${event.id}/venue`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            {event.venueMapId ? "Venue & seating ↗" : "+ Add a venue ↗"}
          </a>

          <form action={deleteStudioEvent}>
            <input type="hidden" name="scope" value={SHASHA_SCOPE} />
            <input type="hidden" name="id" value={event.id} />
            <ConfirmButton
              message={`Delete "${event.title}"? Every ticket reserved for it goes too. This cannot be undone.`}
              className="border border-line px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              Delete show
            </ConfirmButton>
          </form>
        </div>
      </div>

      <EventForm
        action={updateStudioEvent}
        event={event}
        error={searchParams.error}
        cancelHref="/shasha/shows"
        scope={SHASHA_SCOPE}
        tiers={await tierDraftsFor(event.id)}
        robuxEnabled={robuxSalesAllowed(null, env.robuxTickets)}
      />
    </div>
  );
}
