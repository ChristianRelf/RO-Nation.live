import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import {
  deletePartnerEvent,
  updatePartnerEvent,
} from "@/app/actions/partner-events";
import { EventForm } from "@/components/event-form";
import { ConfirmButton } from "@/components/confirm-button";
import { env } from "@/lib/env";
import { robuxSalesAllowed } from "@/lib/tickets/pricing";
import { tierDraftsFor } from "@/lib/tickets/tiers-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit show" };

export default async function EditPartnerShowPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { error?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "events");

  // Matched on the partner as well as the id, so another org's event id in the
  // URL is a 404 here rather than an editable form — the write action would
  // refuse it anyway, but the form should never render for it in the first place.
  const event = await prisma.event.findFirst({
    where: { id: params.id, partnerId: partner.slug },
  });
  if (!event) notFound();

  const base = partnerPortalPath(partner.slug, "/studio/events");

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

        <form action={deletePartnerEvent} className="shrink-0">
          <input type="hidden" name="scope" value={partner.slug} />
          <input type="hidden" name="id" value={event.id} />
          <ConfirmButton
            message={`Delete "${event.title}"? Every ticket reserved for it goes too. This cannot be undone.`}
            className="border border-line px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            Delete show
          </ConfirmButton>
        </form>
      </div>

      <EventForm
        action={updatePartnerEvent}
        event={event}
        error={searchParams.error}
        cancelHref={base}
        scope={partner.slug}
        tiers={await tierDraftsFor(event.id)}
        robuxEnabled={robuxSalesAllowed(partner, env.robuxTickets)}
      />
    </div>
  );
}
