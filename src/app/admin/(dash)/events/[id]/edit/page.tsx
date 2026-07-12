import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { updateEvent } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireAdmin();
  // RNL's own events only — see the matching guard in actions/admin.ts.
  const event = await prisma.event.findFirst({
    where: { id: params.id, partnerId: null },
  });
  if (!event) notFound();

  return (
    <div>
      <AdminHeader
        title="Edit event"
        subtitle={event.title}
        action={{ label: "View attendees", href: `/admin/events/${event.id}/attendees` }}
      />
      <EventForm action={updateEvent} event={event} error={searchParams.error} />
    </div>
  );
}
