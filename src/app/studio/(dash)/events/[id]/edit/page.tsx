import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { updateEvent } from "@/app/actions/studio";
import { requireStudioUser } from "@/lib/studio";
import { env } from "@/lib/env";
import { robuxSalesAllowed } from "@/lib/tickets/pricing";
import { tierDraftsFor } from "@/lib/tickets/tiers-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit event" };

export default async function StudioEditEventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireStudioUser();
  // RNL's own events only. A partner's event id resolves to null here, so the
  // form never renders for one — matching the write guard in actions/studio.ts,
  // which would refuse it anyway.
  const event = await prisma.event.findFirst({
    where: { id: params.id, partnerId: null },
  });
  if (!event) notFound();

  return (
    <div>
      <AdminHeader title="Edit event" subtitle={event.title} />
      <EventForm
        action={updateEvent}
        event={event}
        error={searchParams.error}
        cancelHref="/studio/events"
        tiers={await tierDraftsFor(event.id)}
        robuxEnabled={robuxSalesAllowed(null, env.robuxTickets)}
      />
    </div>
  );
}
